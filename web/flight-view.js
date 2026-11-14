/**
 * Launch and arrival animations. Python has already decided every outcome; this
 * module only plays it back. Trajectory arcs and planet orbits are the
 * GMAT/DE421-derived points returned by the server (ecliptic, in AU).
 */
import {missionReport} from './program-ui.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const at = (track, t) => {
  const f = Math.max(0, Math.min(1, t)) * (track.length - 1);
  const i = Math.min(track.length - 2, Math.floor(f)), k = f - i;
  return [lerp(track[i][0], track[i + 1][0], k), lerp(track[i][1], track[i + 1][1], k)];
};
const path = track => track.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(3)},${(-p[1]).toFixed(3)}`).join('');
const BODY = {mars: 'mars', venus: 'venus', mercury: 'mercury', europa: 'jupiter'};
const COLOR = {earth: '#5b9bd5', mars: '#d9734e', venus: '#d8b071', mercury: '#a9a4a0', jupiter: '#d2a77c'};

function wait(ms) { return new Promise(resolve => setTimeout(resolve, reduced() ? Math.min(ms, 100) : ms)); }
function animate(duration, step) {
  return new Promise(resolve => {
    if (reduced()) { step(1); resolve(); return; }
    const start = performance.now();
    const frame = now => { const t = Math.min(1, (now - start) / duration); step(t); if (t < 1) requestAnimationFrame(frame); else resolve(); };
    requestAnimationFrame(frame);
  });
}

function overlayShell(meta) {
  const overlay = document.createElement('div');
  overlay.className = 'fv-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Mission animation');
  overlay.innerHTML = `<div class="fv-stage"></div><p class="fv-caption" aria-live="polite"></p><p class="fv-meta">${esc(meta)}</p><button class="fv-skip" data-fv="skip">Skip ›</button>`;
  document.body.append(overlay);
  return overlay;
}
const stage = (overlay, html) => { overlay.querySelector('.fv-stage').innerHTML = html; };
const caption = (overlay, text) => { overlay.querySelector('.fv-caption').textContent = text; };

async function ascent(overlay, hold) {
  stage(overlay, `<svg viewBox="0 0 200 260" aria-hidden="true"><rect x="0" y="232" width="200" height="28" fill="#1d2a36"/>
    <rect x="128" y="120" width="8" height="112" fill="#2c3f4f"/><rect x="112" y="150" width="24" height="4" fill="#2c3f4f"/>
    <g class="fv-rocket"><path d="M100 96c10 12 13 30 13 52v76H87v-76c0-22 3-40 13-52Z" fill="#e6eef2"/><path d="M87 200h26v24H87z" fill="#b8c6cf"/>
    <path d="M100 96c6 7 9 16 11 26H89c2-10 5-19 11-26Z" fill="#e9ab7b"/><path d="M87 210l-9 16h9zM113 210l9 16h-9z" fill="#e9ab7b"/><path class="fv-flame" d="M91 224h18l-9 34Z" fill="#ffb066"/></g></svg>`);
  const rocket = overlay.querySelector('.fv-rocket'), flame = overlay.querySelector('.fv-flame');
  for (const n of ['T-3', 'T-2', 'T-1']) { caption(overlay, n); await wait(350); }
  if (hold) { flame.style.display = 'none'; caption(overlay, 'HOLD · HOLD · HOLD'); await wait(900); return; }
  caption(overlay, 'LIFTOFF');
  await animate(1300, t => { rocket.style.transform = `translateY(${-ease(t) * 330}px)`; });
}

async function stranded(overlay) {
  stage(overlay, `<svg viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true"><circle r=".32" fill="#3d6f9e"/>
    <circle r=".62" fill="none" stroke="#e6eef2" stroke-width=".006" stroke-dasharray=".03 .03" opacity=".5"/><circle id="fv-craft" r=".035" fill="#e9ab7b"/></svg>`);
  caption(overlay, 'UPPER STAGE BURN…');
  const craft = overlay.querySelector('#fv-craft');
  await animate(2400, t => { const a = t * Math.PI * 4; craft.setAttribute('cx', (Math.cos(a) * .62).toFixed(3)); craft.setAttribute('cy', (Math.sin(a) * .62).toFixed(3)); });
  caption(overlay, 'NOT ENOUGH ENERGY TO LEAVE EARTH');
  await wait(600);
}

function solarScene(tracks, arc, target) {
  const body = BODY[target];
  const extent = Math.max(1.15, ...[...tracks[body], ...(arc || [])].map(p => Math.hypot(p[0], p[1]))) * 1.12;
  const w = (extent * 2).toFixed(2), sw = (extent / 280).toFixed(4);
  return `<svg viewBox="${-extent} ${-extent} ${w} ${w}" aria-hidden="true">
    <path d="${path(tracks.earth)}" fill="none" stroke="#87cfce" stroke-width="${sw}" opacity=".35"/>
    <path d="${path(tracks[body])}" fill="none" stroke="${COLOR[body]}" stroke-width="${sw}" opacity=".45"/>
    <circle r="${(extent * .045).toFixed(3)}" fill="#f6c36b"/><circle r="${(extent * .08).toFixed(3)}" fill="#f6c36b" opacity=".12"/>
    ${arc ? `<path id="fv-arc" d="${path(arc)}" fill="none" stroke="#e9ab7b" stroke-width="${(sw * 2.2).toFixed(4)}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>` : ''}
    <circle id="fv-earth" r="${(extent * .028).toFixed(3)}" fill="${COLOR.earth}"/><circle id="fv-target" r="${(extent * .034).toFixed(3)}" fill="${COLOR[body]}"/>
    <circle id="fv-craft" r="${(extent * .016).toFixed(3)}" fill="#ffffff"/></svg>`;
}

async function cruise(overlay, {arc, tracks, target, from, to, transferDays}) {
  stage(overlay, solarScene(tracks, arc, target));
  const place = (node, p) => { node.setAttribute('cx', p[0].toFixed(3)); node.setAttribute('cy', (-p[1]).toFixed(3)); };
  const craft = overlay.querySelector('#fv-craft'), line = overlay.querySelector('#fv-arc');
  const earth = overlay.querySelector('#fv-earth'), planet = overlay.querySelector('#fv-target');
  place(earth, arc[0]);
  place(planet, arc.at(-1));
  await animate(3200, t => {
    const s = lerp(from, to, t);
    place(craft, at(arc, s));
    line.setAttribute('stroke-dashoffset', (1 - s).toFixed(3));
    caption(overlay, `CRUISE · DAY ${Math.round(s * transferDays)} OF ${transferDays}`);
  });
}

async function finale(overlay, outcome, target) {
  const color = COLOR[BODY[target]];
  const orbit = outcome === 'nominal' || outcome === 'degraded';
  stage(overlay, `<svg viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true"><circle r=".4" fill="${color}"/>
    <circle r=".4" fill="url(#fv-shade)"/><defs><radialGradient id="fv-shade" cx=".35" cy=".35"><stop offset="0" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>
    ${orbit ? '<ellipse rx=".72" ry=".55" fill="none" stroke="#e6eef2" stroke-width=".006" opacity=".5"/>' : ''}<circle id="fv-craft" r=".035" fill="#e9ab7b"/></svg>`);
  const craft = overlay.querySelector('#fv-craft');
  if (orbit) {
    caption(overlay, outcome === 'nominal' ? 'ARRIVED · ALL SYSTEMS NOMINAL' : 'ARRIVED · DAMAGE REPORTED');
    await animate(1800, t => { const a = -Math.PI / 2 + t * Math.PI * 2; craft.setAttribute('cx', (Math.cos(a) * .72).toFixed(3)); craft.setAttribute('cy', (Math.sin(a) * .55).toFixed(3)); });
  } else if (outcome === 'flyby' || outcome === 'missed') {
    caption(overlay, 'NOT ENOUGH PROPELLANT · FLYING PAST');
    await animate(1800, t => { craft.setAttribute('cx', (-1.1 + t * 2.3).toFixed(3)); craft.setAttribute('cy', (-.75 + t * .4).toFixed(3)); });
  } else {
    caption(overlay, 'SIGNAL LOST');
    await animate(1500, t => { craft.setAttribute('cx', (-1 + t * .5).toFixed(3)); craft.setAttribute('cy', '-.6'); craft.setAttribute('opacity', (t < .7 ? (Math.round(t * 12) % 2) : 0).toString()); });
  }
}

async function finish(overlay, cardHtml) {
  overlay.querySelector('.fv-skip')?.remove();
  overlay.insertAdjacentHTML('beforeend', `<div class="fv-card">${cardHtml}<div class="fv-actions"><button class="button primary" data-fv="close">CONTINUE →</button></div></div>`);
  const button = overlay.querySelector('[data-fv="close"]');
  button.focus();
  await new Promise(resolve => {
    button.addEventListener('click', resolve, {once: true});
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') resolve(); });
  });
  overlay.remove();
}

async function run(overlay, sequence) {
  let skipped = false;
  const skip = new Promise(resolve => overlay.querySelector('.fv-skip').addEventListener('click', () => { skipped = true; resolve(); }, {once: true}));
  await Promise.race([sequence(() => skipped), skip]);
}

/** Launch: countdown, then scrub / stranded / departure along the GMAT arc. */
export async function playLaunch({mission, catalog, tracks}) {
  const overlay = overlayShell(`${mission.id} · ${(mission.numbers && catalog.vehicles[mission.design.vehicle]?.name) || 'ORBITAL LAUNCH'} · ${mission.transfer?.launch || ''}`.toUpperCase());
  const outcome = mission.outcome || 'launched';
  await run(overlay, async skipped => {
    await ascent(overlay, outcome === 'scrubbed');
    if (skipped()) return;
    if (outcome === 'stranded') await stranded(overlay);
    else if (outcome !== 'scrubbed' && mission.arc) await cruise(overlay, {arc: mission.arc, tracks, target: mission.destination, from: 0, to: .35, transferDays: mission.transfer.transferDays});
  });
  const titles = {scrubbed: 'Launch scrubbed.', stranded: 'Stranded in Earth orbit.'};
  const card = titles[outcome]
    ? `<div class="eyebrow">MISSION FAILURE</div><h2>${titles[outcome]}</h2>${missionReport(catalog, mission)}`
    : `<div class="eyebrow">LAUNCH SUCCESSFUL</div><h2>${esc(mission.id)} is on its way to ${esc(catalog.worlds[mission.destination].name)}.</h2>
       <p>Arrival on turn ${mission.arrivesAt} (${esc(mission.transfer?.arrival || '')}). ${mission.transfer?.source === 'assist' ? esc(mission.transfer.label) + '. The arc shows only the first leg.' : mission.transfer?.source === 'estimate' ? 'Off-Earth departure: game-estimate trajectory.' : 'Trajectory from NASA GMAT DE421 data.'} The flight software you loaded will face the approach on its own.</p>`;
  await finish(overlay, card);
}

/** Arrival: end of the cruise arc, then capture / flyby / loss, then the debrief. */
export async function playArrival({mission, catalog, tracks}) {
  const overlay = overlayShell(`${mission.id} · ARRIVAL AT ${catalog.worlds[mission.destination].name.toUpperCase()}`);
  await run(overlay, async skipped => {
    if (mission.arc && mission.transfer?.source === 'gmat') {
      await cruise(overlay, {arc: mission.arc, tracks, target: mission.destination, from: .6, to: 1, transferDays: mission.transfer.transferDays});
      if (skipped()) return;
    }
    await finale(overlay, mission.outcome, mission.destination);
  });
  const good = mission.outcome === 'nominal';
  await finish(overlay, `<div class="eyebrow">${good ? 'MISSION SUCCESS' : mission.status === 'failed' ? 'MISSION FAILURE' : 'PARTIAL SUCCESS'}</div><h2>${esc(mission.id)} at ${esc(catalog.worlds[mission.destination].name)}: ${esc((mission.outcome || '').toUpperCase())}</h2>${missionReport(catalog, mission)}`);
}
