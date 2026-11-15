/** Campaign soundtrack. One player survives map, inspector and Shipyard re-renders. */
const TITLES = {
  "earth": "Gymnopédie No. 1 · Michael Laucke",
  "mars": "Peaceful Village · Stefan Grossmann",
  "mercury": "Recuerdos de la Alhambra · Carlo Alberto Boni",
  "venus": "Gnossienne No. 1 · La Pianista",
  "jupiter": "Cello Suite No. 3 in C major — Sarabande · John Michel",
  "saturn": "Gymnopédie No. 3 · Michael Laucke",
  "uranus": "Partita in A minor — Sarabande · Alex Murray",
  "neptune": "Prelude in E minor, Op. 28 No. 4 · Ivan Ilić",
  "europa": "Gnossienne No. 2 · La Pianista"
};
const PREF = 'ares.planet-music.v1';
const FADE = 1.2;

export function createPlanetMusic(host, doc) {
  let enabled = true, volume = 40, world = 'mars';
  try {
    const saved = JSON.parse(host.localStorage.getItem(PREF));
    if (typeof saved?.enabled === 'boolean') enabled = saved.enabled;
    if (Number.isInteger(saved?.volume) && saved.volume >= 0 && saved.volume <= 100) volume = saved.volume;
  } catch { /* Preferences are optional in private browsing. */ }

  const Audio = host.AudioContext || host.webkitAudioContext;
  let context, master, playing, pending, failed;
  const buffers = new Map();
  const wanted = () => enabled && volume > 0 && !doc.hidden;
  function save() {
    try { host.localStorage.setItem(PREF, JSON.stringify({enabled, volume})); } catch { /* Optional storage. */ }
  }
  function cancelLoad() {
    pending?.controller.abort();
    pending = null;
  }
  function fadeOut(voice) {
    if (!voice) return;
    const now = context.currentTime;
    const level = Math.min(1, Math.max(0, (now - voice.start) / FADE));
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(level, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + FADE);
    voice.source.stop(now + FADE);
  }
  function play(id, buffer) {
    const now = context.currentTime;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    gain.connect(master);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start(now);
    fadeOut(playing);
    playing = {world:id, source, gain, start:now};
  }
  async function syncTrack() {
    if (!wanted() || context?.state !== 'running' || pending?.world === world) return;
    cancelLoad();
    if (playing?.world === world) return;
    const job = {world, controller:new AbortController()};
    pending = job;
    failed = null;
    try {
      let buffer = buffers.get(job.world);
      if (!buffer) {
        const url = new URL('./music/' + job.world + '.mp3', import.meta.url);
        const response = await host.fetch(url, {signal:job.controller.signal});
        if (!response.ok) throw new Error('Music asset unavailable');
        buffer = await context.decodeAudioData(await response.arrayBuffer());
      }
      // Decoding may finish after another world was picked, muted or hidden.
      if (pending !== job || job.world !== world || !wanted() || context.state !== 'running') return;
      buffers.delete(job.world);
      buffers.set(job.world, buffer);
      if (buffers.size > 2) buffers.delete(buffers.keys().next().value);
      play(job.world, buffer);
    } catch {
      if (pending === job) {
        failed = job.world;
        fadeOut(playing);
        playing = null;
      }
    } finally {
      if (pending === job) pending = null;
    }
  }
  function updatePlayback(gesture = false) {
    if (!wanted()) {
      cancelLoad();
      if (context) context.suspend().catch(() => {});
      return;
    }
    if (!context) {
      if (!gesture || !Audio) return;
      try {
        context = new Audio();
        master = context.createGain();
        master.gain.value = volume / 100;
        master.connect(context.destination);
      } catch { return; }
    }
    // Request resume inside the input handler, before fetching or decoding audio.
    context.resume().then(syncTrack).catch(() => {});
  }
  function unlock() {
    if (context?.state !== 'running') updatePlayback(true);
  }
  doc.addEventListener('pointerup', unlock, true);
  doc.addEventListener('click', unlock, true);
  doc.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ' || event.key.startsWith('Arrow')) unlock();
  }, true);
  doc.addEventListener('visibilitychange', () => updatePlayback());

  return {
    select(id) {
      if (!Object.hasOwn(TITLES, id) || world === id) return;
      world = id;
      syncTrack();
    },
    setEnabled(on) { enabled = on; save(); updatePlayback(true); },
    setVolume(value) {
      if (!Number.isFinite(value)) return;
      volume = Math.max(0, Math.min(100, Math.round(value)));
      if (master) master.gain.setTargetAtTime(volume / 100, context.currentTime, .035);
      save();
      updatePlayback(true);
    },
    get settings() {
      return {enabled, volume, title:TITLES[world], unavailable:!Audio || failed === world};
    },
  };
}
