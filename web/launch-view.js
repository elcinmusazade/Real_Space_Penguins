/**
 * Orbiter launch prelude: setup panel and the launch animation.
 * Display only. Python (ares/launch.py) decides the outcome; this file
 * animates whatever outcome the server returned.
 */

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
const kg = value => `${Math.round(value).toLocaleString('en-US')} kg`;
const FAULT_KEY = 'ares-fault-lab-v1';
const FAULT_RESULT_KEY = 'ares-fault-lab-result-v1';

export function readFaultDesign() {
  try {
    const design = JSON.parse(localStorage.getItem(FAULT_KEY) || 'null');
    const result = JSON.parse(localStorage.getItem(FAULT_RESULT_KEY) || 'null');
    return design && typeof design === 'object' ? {design, result} : {design: null, result: null};
  } catch {
    return {design: null, result: null};
  }
}

function dateLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
}

export function readout(assessment) {
  if (!assessment) return '<p class="lp-muted">Calculating…</p>';
  if (!assessment.ok) return `<p class="lp-error">${esc(assessment.error)}</p>`;
  const n = assessment.numbers;
  return `<dl class="lp-readout">
    <div><dt>Launch mass</dt><dd>${kg(n.launchMassKg)} <span>/ ${kg(n.capacityKg)} rocket limit at this C3</span></dd></div>
    <div><dt>Capture burn</dt><dd>${n.dvAvailableKms.toFixed(2)} km/s <span>carried / ${n.dvNeededKms.toFixed(2)} km/s needed</span></dd></div>
    <div><dt>Launch direction</dt><dd>${n.dlaDeg > 0 ? '+' : ''}${n.dlaDeg}° <span>declination</span></dd></div>
    <div><dt>Cruise</dt><dd>${n.transferDays} days <span>arrive ${esc(dateLabel(n.arrival))}</span></dd></div>
  </dl>`;
}

export function renderLaunchPanel({catalog, windowId, propellant, assessment, fault}) {
  if (!catalog) return `<section class="lp"><p class="lp-muted">Loading GMAT launch data…</p></section>`;
  const o = catalog.orbiter;
  const computer = fault.design && catalog.computers[fault.design.computer];
  const faultLine = computer
    ? `${esc(computer.name)} · ${fault.design.rules?.length || 0} rules${fault.result ? ` · ${fault.result.passed}/${fault.result.total} fault tests passed` : ' · not tested yet'}`
    : 'Not designed yet. Your orbiter needs fault protection before it can fly.';
  const windows = catalog.windows.map(w => `
    <button class="lp-date ${w.id === windowId ? 'selected' : ''}" data-action="launch-window" data-id="${esc(w.id)}" aria-pressed="${w.id === windowId}">
      <strong>${esc(dateLabel(w.launch))}</strong>
      <span>C3 ${w.c3.toFixed(1)} · ${w.transferDays} d</span>
    </button>`).join('');
  return `<section class="lp" aria-labelledby="lp-title">
    <div class="lp-step">
      <div class="lp-step-head"><span class="tag orange">01 / FAULT PROTECTION</span><a class="text-btn" href="/faults.html">${computer ? 'Edit in fault lab' : 'Open fault lab'}</a></div>
      <p class="lp-status ${computer ? '' : 'red'}">${faultLine}</p>
    </div>
    <div class="lp-step">
      <div class="lp-step-head"><span class="tag orange">02 / ORBITER LAUNCH</span><span class="lp-muted">${esc(catalog.vehicle.name)} · Mars orbit 400 km</span></div>
      <h3 id="lp-title">Send the relay orbiter ahead of the crew.</h3>
      <p class="lp-muted">Pick a 2028 launch date and how much propellant to carry. More propellant brakes harder at Mars but makes the orbiter heavier on the rocket. Orbiter dry mass ${kg(o.dryMassKg)}${computer ? ` + ${computer.mass} kg flight computer` : ''}.</p>
      <div class="lp-dates" role="group" aria-label="Launch date">${windows}</div>
      <label class="lp-slider">
        <span>Propellant <b id="lp-prop-value">${kg(propellant)}</b></span>
        <input type="range" id="lp-prop" min="${o.propellantMinKg}" max="${o.propellantMaxKg}" step="${o.propellantStepKg}" value="${propellant}" aria-label="Propellant load in kilograms">
      </label>
      <div id="lp-readout">${readout(assessment)}</div>
      <p class="lp-source">Launch dates, C3, declination, arrival speed and the Atlas V 401 performance curve come from NASA GMAT R2026a data (JPL DE421 ephemeris, EMTG launch-vehicle library). Orbiter mass and engine are game assumptions.</p>
    </div>
    <div class="lp-step-head" style="margin-top:6px"><span class="tag orange">03 / CREW CARGO</span></div>
  </section>`;
}

// ---------- animation ----------

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const at = (track, t) => {
  const f = Math.max(0, Math.min(1, t)) * (track.length - 1);
  const i = Math.min(track.length - 2, Math.floor(f));
  const k = f - i;
  return [lerp(track[i][0], track[i + 1][0], k), lerp(track[i][1], track[i + 1][1], k)];
};
const path = track => track.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(3)},${(-p[1]).toFixed(3)}`).join('');

function rocketSvg() {
  return `<svg class="la-rocket-scene" viewBox="0 0 200 260" aria-hidden="true">
    <rect x="0" y="232" width="200" height="28" fill="#2a2522"/>
    <rect x="128" y="120" width="8" height="112" fill="#3a3632"/><rect x="112" y="150" width="24" height="4" fill="#3a3632"/>
    <g class="la-rocket">
      <path d="M100 96c10 12 13 30 13 52v76H87v-76c0-22 3-40 13-52Z" fill="#e9e3d9"/>
      <path d="M87 200h26v24H87z" fill="#c9c0b2"/><path d="M100 96c6 7 9 16 11 26H89c2-10 5-19 11-26Z" fill="#f17a49"/>
      <path d="M87 210l-9 16h9zM113 210l9 16h-9z" fill="#f17a49"/>
      <path class="la-flame" d="M91 224h18l-9 34Z" fill="#ffb066"/>
    </g>
  </svg>`;
}

function stage(overlay, html) {
  overlay.querySelector('.la-stage').innerHTML = html;
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, reduced() ? Math.min(ms, 120) : ms)); }

function animate(duration, step) {
  return new Promise(resolve => {
    if (reduced()) { step(1); resolve(); return; }
    const start = performance.now();
    const frame = now => {
      const t = Math.min(1, (now - start) / duration);
      step(t);
      if (t < 1) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
}

async function ascent(overlay, scrub) {
  stage(overlay, rocketSvg());
  const caption = overlay.querySelector('.la-caption');
  const rocket = overlay.querySelector('.la-rocket');
  const flame = overlay.querySelector('.la-flame');
  for (const n of ['T-3', 'T-2', 'T-1']) { caption.textContent = n; await wait(380); }
  if (scrub) {
    flame.style.display = 'none';
    caption.textContent = 'HOLD · HOLD · HOLD';
    await wait(900);
    return;
  }
  caption.textContent = 'LIFTOFF';
  await animate(1400, t => { rocket.style.transform = `translateY(${-ease(t) * 330}px)`; });
}

async function strandedOrbit(overlay) {
  stage(overlay, `<svg class="la-space" viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true">
    <circle r=".32" fill="#3d6f9e"/><circle r=".32" fill="none" stroke="#8ccbd1" stroke-width=".01" opacity=".6"/>
    <circle r=".62" fill="none" stroke="#efeee9" stroke-width=".006" stroke-dasharray=".03 .03" opacity=".5"/>
    <path id="la-escape" d="M.62,0 C.9,-.3 1.1,-.7 1.3,-1.3" fill="none" stroke="#ef8e7b" stroke-width=".008" stroke-dasharray=".04 .03" opacity="0"/>
    <circle id="la-craft" r=".035" fill="#f17a49"/>
  </svg>`);
  overlay.querySelector('.la-caption').textContent = 'UPPER STAGE BURN…';
  const craft = overlay.querySelector('#la-craft');
  const escape = overlay.querySelector('#la-escape');
  await animate(2600, t => {
    const a = t * Math.PI * 4;
    craft.setAttribute('cx', (Math.cos(a) * .62).toFixed(3));
    craft.setAttribute('cy', (Math.sin(a) * .62).toFixed(3));
    escape.setAttribute('opacity', (Math.sin(t * Math.PI) * .9).toFixed(2));
  });
  overlay.querySelector('.la-caption').textContent = 'NOT ENOUGH ENERGY TO LEAVE EARTH';
  await wait(700);
}

async function cruise(overlay, win, tracks, success) {
  const sun = '<circle r=".09" fill="#f6c36b"/><circle r=".16" fill="#f6c36b" opacity=".12"/>';
  stage(overlay, `<svg class="la-space" viewBox="-1.75 -1.75 3.5 3.5" aria-hidden="true">
    <path d="${path(tracks.earth)}" fill="none" stroke="#8ccbd1" stroke-width=".006" opacity=".35"/>
    <path d="${path(tracks.mars)}" fill="none" stroke="#ef8e7b" stroke-width=".006" opacity=".35"/>
    ${sun}
    <path id="la-arc" d="${path(win.arc)}" fill="none" stroke="#f17a49" stroke-width=".012" stroke-dasharray="1 1" pathLength="1" stroke-dashoffset="1"/>
    <circle id="la-earth" r=".05" fill="#5b9bd5"/>
    <circle id="la-mars" r=".06" fill="#d9734e"/>
    <circle id="la-craft" r=".025" fill="#efeee9"/>
  </svg>`);
  const caption = overlay.querySelector('.la-caption');
  const earth = overlay.querySelector('#la-earth');
  const mars = overlay.querySelector('#la-mars');
  const craft = overlay.querySelector('#la-craft');
  const arc = overlay.querySelector('#la-arc');
  const place = (node, p) => { node.setAttribute('cx', p[0].toFixed(3)); node.setAttribute('cy', (-p[1]).toFixed(3)); };
  await animate(3800, t => {
    place(earth, at(win.earth, t));
    place(mars, at(win.mars, t));
    place(craft, at(win.arc, t));
    arc.setAttribute('stroke-dashoffset', (1 - t).toFixed(3));
    const day = Math.round(t * win.transferDays);
    caption.textContent = `CRUISE · DAY ${day} OF ${win.transferDays}`;
  });
  caption.textContent = 'MARS ORBIT INSERTION BURN…';
  await wait(600);
  if (success) return;
  const end = win.arc[win.arc.length - 1], prev = win.arc[win.arc.length - 4];
  const dir = [end[0] - prev[0], end[1] - prev[1]];
  const len = Math.hypot(...dir) || 1;
  await animate(1500, t => place(craft, [end[0] + dir[0] / len * t * 1.1, end[1] + dir[1] / len * t * 1.1]));
  caption.textContent = 'CAPTURE FAILED · FLYING PAST MARS';
  await wait(700);
}

async function capture(overlay) {
  stage(overlay, `<svg class="la-space" viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true">
    <circle r=".4" fill="#c4643f"/><circle r=".4" fill="url(#la-shade)"/>
    <defs><radialGradient id="la-shade" cx=".35" cy=".35"><stop offset="0" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>
    <ellipse rx=".7" ry=".7" fill="none" stroke="#efeee9" stroke-width=".006" opacity=".5"/>
    <circle id="la-craft" r=".035" fill="#f17a49"/>
  </svg>`);
  const craft = overlay.querySelector('#la-craft');
  overlay.querySelector('.la-caption').textContent = 'ORBIT ACHIEVED · 400 KM';
  await animate(2000, t => {
    const a = -Math.PI / 2 + t * Math.PI * 2;
    craft.setAttribute('cx', (Math.cos(a) * .7).toFixed(3));
    craft.setAttribute('cy', (Math.sin(a) * .7).toFixed(3));
  });
}

function outcomeCard(result) {
  const titles = {success: 'Orbiter in place.', scrub: 'Launch scrubbed.', stranded: 'Stranded in Earth orbit.', flyby: 'Missed Mars orbit.'};
  return `<div class="la-card" role="dialog" aria-modal="true" aria-labelledby="la-title">
    <div class="eyebrow">${result.passed ? 'MISSION SUCCESS' : 'MISSION FAILURE'}</div>
    <h2 id="la-title">${titles[result.outcome]}</h2>
    <p>${esc(result.explanation)}</p>
    <ul class="la-checks">${result.checks.map(c => `<li class="${c.ok ? 'ok' : 'bad'}"><b>${c.ok ? '✓' : '✗'} ${esc(c.label)}</b><span>${esc(c.detail)}</span></li>`).join('')}</ul>
    <div class="la-actions">${result.passed
      ? '<button class="btn btn-primary" data-la="continue">Land the crew →</button>'
      : '<button class="btn btn-primary" data-la="retry">Adjust launch plan</button>'}</div>
  </div>`;
}

/** Plays the animation for a server-decided outcome. Resolves when the player clicks the card button. */
export async function playLaunch(result, catalog) {
  const win = catalog.windows.find(w => w.id === result.window);
  const overlay = document.createElement('div');
  overlay.className = 'la-overlay';
  overlay.innerHTML = `<div class="la-stage"></div><p class="la-caption" aria-live="polite"></p>
    <p class="la-meta">ARES RELAY ORBITER · ${esc(catalog.vehicle.name.toUpperCase())} · ${esc(result.numbers.launch)}</p>
    <button class="la-skip" data-la="skip">Skip ›</button>`;
  document.body.append(overlay);
  document.body.style.overflow = 'hidden';
  let skipped = false;
  const sequence = (async () => {
    await ascent(overlay, result.outcome === 'scrub');
    if (skipped) return;
    if (result.outcome === 'stranded') await strandedOrbit(overlay);
    else if (result.outcome !== 'scrub') {
      await cruise(overlay, win, catalog.orbitTracks, result.outcome === 'success');
      if (skipped) return;
      if (result.outcome === 'success') await capture(overlay);
    }
  })();
  const skip = new Promise(resolve => overlay.querySelector('.la-skip').addEventListener('click', () => { skipped = true; resolve(); }, {once: true}));
  await Promise.race([sequence, skip]);
  overlay.querySelector('.la-skip').remove();
  overlay.insertAdjacentHTML('beforeend', outcomeCard(result));
  const button = overlay.querySelector('.la-card [data-la]');
  button.focus();
  await new Promise(resolve => button.addEventListener('click', resolve, {once: true}));
  overlay.remove();
  document.body.style.overflow = '';
  return result.passed;
}
