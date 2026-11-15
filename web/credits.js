import {SOURCES} from './science.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const link = (name, url) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(name)} ↗</a>`;
let recordings = '';

function recordingRow(track) {
  const [type, version] = new URL(track.license).pathname.split('/').filter(Boolean).slice(-2);
  return `<li><small>${esc(track.world)}</small><h4>${esc(track.title)}</h4>
    <p>Composed by ${esc(track.composer)} · Performed by ${esc(track.performer)} (${esc(track.instrument)})</p>
    ${track.credit ? `<p>${esc(track.credit)}</p>` : ''}
    ${link('Original recording', track.source)} · ${link('CC ' + type.toUpperCase() + ' ' + version, track.license)}</li>`;
}

export async function loadMusicCredits() {
  if (recordings) return;
  let rows;
  try {
    const response = await fetch('./music/recordings.json');
    if (!response.ok) throw new Error();
    recordings = (await response.json()).map(recordingRow).join('');
    rows = recordings;
  } catch {
    rows = '<li>Open the plain-text recording credits below for the complete soundtrack.</li>';
  }
  const list = document.querySelector('.recording-list');
  if (list) list.innerHTML = rows;
}

export function creditsView() {
  return `<div class="modal-scrim"><section class="aura-modal compact credits-modal" role="dialog" aria-modal="true" aria-labelledby="credits-title">
    <button type="button" class="button secondary" data-action="credits-back">← Back to Settings</button>
    <h2 id="credits-title">Game credits</h2>
    <h3>Game development</h3><p>Elcin Musazade and Adnan Sadik</p>
    <details><summary>Planet soundtrack</summary>
      <p>Full performances converted to MP3 with playback gain adjusted for the game.</p>
      <ul class="recording-list">${recordings || '<li>Loading recordings…</li>'}</ul>
      <a href="./music/credits.txt" target="_blank" rel="noopener">Plain-text recording credits ↗</a>
    </details>
    <details><summary>Flight and planetary data</summary>
      <ul><li>${link('NASA General Mission Analysis Tool', 'https://software.nasa.gov/software/GSC-19640-1')}
        <p>GMAT R2026a supplied the EMTG Atlas V 401 launch-performance curve and the ephemeris used for the game’s offline Earth launch windows.</p></li>
      <li>${link('NASA JPL planetary ephemerides', 'https://ssd.jpl.nasa.gov/planets/orbits.html')}
        <p>JPL DE421 supplies planetary positions for the Sun-only, two-body transfer calculations.</p></li>
      <li>${link('NASA planetary fact sheets', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/')}<p>Curated by Dr. David R. Williams at NASA Goddard. Rounded distance, gravity, pressure and temperature figures inform the Shipyard’s planet-fit checks.</p></li></ul>
    </details>
    <details><summary>Science references and challenge inspiration</summary>
      <ul>${SOURCES.map(s => `<li>${link(s.title, s.url)}<p>${esc(s.description)}</p></li>`).join('')}</ul>
    </details>
    <details><summary>Tools and services</summary>
      <p>Google Gemini powers JARVIS. OpenAI Codex and Anthropic Claude assisted development. FFmpeg prepared the soundtrack. Render hosts the public game.</p>
    </details>
  </section></div>`;
}
