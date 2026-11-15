"""Prepare the game's licensed recordings. Authoring tools: curl and FFmpeg."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "web" / "music" / "recordings.json"
OUTPUT = ROOT / "web" / "music"
CHANGES = "Full performance, converted to MP3 with playback gain adjusted for the game."


def license_name(url):
    kind, version = url.rstrip("/").split("/")[-2:]
    return f"CC {kind.upper()} {version}"


def prepare(track, source):
    if hashlib.sha256(source.read_bytes()).hexdigest() != track["sha256"]:
        raise ValueError(f"Source recording differs from the credited version: {track['world']}")
    command = ["ffmpeg", "-hide_banner", "-nostdin", "-i", str(source)]
    meter = subprocess.run(command + ["-af", "loudnorm=I=-23:TP=-2:LRA=20:print_format=json",
                                      "-f", "null", "-"], capture_output=True, text=True, check=True)
    readings = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', meter.stderr).group())
    # Use one constant gain for the entire performance to preserve its dynamics.
    gain = min(track.get("target_lufs", -23) - float(readings["input_i"]), -2.5 - float(readings["input_tp"]))
    if not math.isfinite(gain):
        raise ValueError(f"Invalid source level for {track['world']}")
    dest = OUTPUT / (track["world"] + ".mp3")
    subprocess.run(command + ["-loglevel", "error", "-y", "-map", "0:a:0", "-map_metadata", "-1",
        "-af", f"volume={gain:.3f}dB", "-ar", "32000", "-codec:a", "libmp3lame", "-b:a", "112k",
        "-metadata", "title=" + track["title"], "-metadata", "artist=" + track["performer"],
        "-metadata", "composer=" + track["composer"], "-metadata", "copyright=" + track["license"],
        "-metadata", "comment=" + track["source"] + " — " + CHANGES, str(dest)], check=True)
    print(f"{track['world']:8s} {track['performer']} — {track['title']}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, help="use existing originals named by world and source extension")
    args = parser.parse_args()
    tracks = json.loads(SOURCES.read_text())
    credits = ["Ares: First Light — recording credits", "",
               "Each distributed recording carries the Creative Commons license listed below.", CHANGES, ""]
    OUTPUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as folder:
        for track in tracks:
            name = track["world"] + Path(urlsplit(track["download"]).path).suffix
            source = (args.source_dir or Path(folder)) / name
            if args.source_dir is None:
                subprocess.run(["curl", "--fail", "--silent", "--show-error", "--location",
                                "--output", str(source), track["download"]], check=True)
            prepare(track, source)
            credits.extend([track["world"].title() + " — " + track["title"],
                            "Composer: " + track["composer"],
                            "Performance: " + track["performer"] + " (" + track["instrument"] + ")",
                            *([track["credit"]] if "credit" in track else []),
                            "Source: " + track["source"],
                            license_name(track["license"]) + " — " + track["license"], ""])
    (OUTPUT / "credits.txt").write_text("\n".join(credits), encoding="utf-8")


if __name__ == "__main__":
    main()
