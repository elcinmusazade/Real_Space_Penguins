/** Read-only views for Campaign V3: flight software, standing orders, programme, debriefs. */
import {ruleEditor} from './rule-editor.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pill = (text, tone = '') => `<span class="pill ${tone}">${esc(text)}</span>`;
const ribbon = (label, sub) => `<div class="section-label">${esc(label)} <span>${esc(sub || '')}</span></div>`;
const worldName = (catalog, id) => catalog.worlds[id]?.name || id;

export function softwareConfig(catalog) {
  const f = catalog.faults;
  return {kind: 'software', sensors: f.sensors, responses: f.responses, instruments: f.instruments, maxConditions: f.limits.conditions, hasFor: true, maxFor: f.limits.for};
}

export function ordersConfig(catalog, state) {
  const o = catalog.orders;
  return {kind: 'orders', sensors: o.sensors, responses: Object.fromEntries(Object.entries(o.responses).map(([id, r]) => [id, {...r, target: false}])),
    maxConditions: 2, hasFor: false, slots: o.slots + (state.tech.includes('autonomy') ? o.autonomySlots : 0)};
}

const WORLD_ORDER = ['mercury', 'venus', 'earth', 'mars', 'europa', 'jupiter', 'saturn', 'uranus', 'neptune'];

/** 12-turn chart of battery and danger level, with a mark wherever a rule fired. */
function runChart(result) {
  const W = 300, H = 92, L = 22, T = 8, B = 18, R = 6, n = 12;
  const x = t => L + (t - 1) * (W - L - R) / (n - 1), y = v => T + (100 - v) * (H - T - B) / 100;
  const line = key => result.timeline.map((row, i) => `${i ? 'L' : 'M'}${x(row.turn).toFixed(1)},${y(row[key]).toFixed(1)}`).join('');
  const marks = result.timeline.filter(row => row.fired.some(f => f.status === 'applied')).map(row => `<path class="rc-fire" d="M${x(row.turn).toFixed(1)},${(H - B + 2)} l-3.5,6 h7z"><title>Turn ${row.turn}: rule ${row.fired.filter(f => f.status === 'applied').map(f => f.rule + 1).join(', ')} fired</title></path>`).join('');
  const lostAt = result.lost ? `<text class="rc-lost" x="${x(result.timeline.at(-1).turn) + 3}" y="${T + 10}">lost</text>` : '';
  return `<svg class="run-chart" viewBox="0 0 ${W} ${H + 8}" role="img" aria-label="Battery and danger level over the 12-step test">
    ${[0, 50, 100].map(v => `<line class="rc-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="rc-axis" x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('')}
    ${[1, 4, 8, 12].map(t => `<text class="rc-axis" x="${x(t)}" y="${H - 6}" text-anchor="middle">${t}</text>`).join('')}
    <path class="rc-hazard" d="${line('hazard')}"/><path class="rc-battery" d="${line('battery')}"/>${marks}${lostAt}</svg>
    <div class="rc-legend"><span class="k-battery">Battery %</span><span class="k-hazard">Danger level</span><span class="k-fire">▲ a rule fired</span></div>`;
}

function dangerResult(r) {
  const verdict = r.passed ? (r.harsh ? 'PASS' : 'PASS, BUT NOT IF 25% HARSHER') : r.lost ? 'SHIP LOST' : 'ARRIVES DAMAGED';
  return `<article class="danger-result ${r.passed ? 'pass' : 'fail'}"><div class="dr-head"><b>${esc(r.name)}</b><span>${verdict}</span></div>
    <small>${r.lost ? 'Lost after repeated brownouts' : `${r.science} of ${r.target} science`} · ${r.brownouts} brownouts · without any rules: ${r.baseline.lost ? 'lost' : `${r.baseline.science} science`}</small>
    ${runChart(r)}${r.hint ? `<p class="dr-hint"><b>What went wrong:</b> ${esc(r.hint)}</p>` : ''}</article>`;
}

function labResults(catalog, test, softwareTab) {
  if (!test) return '';
  if (!test.ok) return `<div class="test-results"><div class="quote-warning">${esc(test.error)}</div></div>`;
  if (test.summary) {
    return `<div class="test-results"><div class="eyebrow">DEFAULT RULES ON EVERY PLANET THAT USES THEM · ${test.summary.filter(s => s.passed).length} / ${test.summary.length} PASS</div>
      ${test.summary.map(s => `<div class="test-row ${s.passed ? 'pass' : 'fail'}"><span class="test-mark">${s.passed ? '✓' : '✕'}</span><div><b>${esc(worldName(catalog, s.world))}</b><small>${s.results.map(r => `${esc(r.name)}: ${r.passed ? 'pass' : r.lost ? 'lost' : 'damaged'}`).join(' · ')}</small></div><button class="button secondary" data-action="software-tab" data-id="${esc(s.world)}">OPEN TAB</button></div>`).join('')}</div>`;
  }
  return `<div class="test-results"><div class="eyebrow">LAB TEST · ${esc(worldName(catalog, softwareTab).toUpperCase())} · ${test.passed} / ${test.results.length} DANGERS SURVIVED</div>${test.results.map(dangerResult).join('')}</div>`;
}

export function softwareView({catalog, state, softwareTab, softwareDraft, ordersDraft, softwareTest, dirtySoftware, dirtyOrders, shipLabel}) {
  const sw = softwareConfig(catalog);
  const computers = catalog.computers;
  sw.slots = computers[softwareDraft.computer].slots;
  const od = ordersConfig(catalog, state);
  const profiles = state.softwareProfiles || {};
  const planet = softwareTab !== 'default', own = planet && Boolean(profiles[softwareTab]);
  const dangers = planet ? catalog.faults.planetDangers[softwareTab].map(id => catalog.faults.scenarios[id]) : [];
  const tabs = `<div class="planet-tabs" role="tablist" aria-label="Flight rules for each planet">
    <button role="tab" aria-selected="${!planet}" class="planet-tab ${!planet ? 'active' : ''}" data-action="software-tab" data-id="default"><b>Default</b><small>${WORLD_ORDER.filter(w => !profiles[w]).length} planets</small></button>
    ${WORLD_ORDER.map(w => `<button role="tab" aria-selected="${softwareTab === w}" class="planet-tab ${softwareTab === w ? 'active' : ''}" data-action="software-tab" data-id="${w}"><b>${esc(worldName(catalog, w))}</b><small>${profiles[w] ? 'own rules' : 'default'}</small></button>`).join('')}</div>`;
  return `${ribbon('AUTONOMY', 'FLIGHT RULES PER PLANET / STANDING ORDERS')}
  <div class="page-heading"><div><h1>Prepare for each planet.</h1><p>Every planet has two dangers of its own. A ship carries the rules of the planet it is flying to, and meets one of that planet's dangers on arrival, so give each destination rules that survive both.</p></div>${pill('PLAYER-DESIGNED', 'green')}</div>
  ${tabs}
  <div class="dual-panels software-columns">
    <section class="surface-card"><div class="subheading"><h2>${planet ? `${esc(worldName(catalog, softwareTab))} flight rules` : 'Default flight rules'}</h2><span>${planet ? (own ? 'THIS PLANET’S OWN RULES' : 'USING THE DEFAULT RULES') : 'FOR PLANETS WITHOUT THEIR OWN'}</span></div>
      ${planet ? `<div class="danger-cards">${dangers.map((d, i) => `<div class="danger-card"><small>DANGER ${i + 1} OF 2</small><b>${esc(d.name)}</b><p>${esc(d.description)}</p></div>`).join('')}</div>
        ${own ? '' : `<p class="callout">${esc(worldName(catalog, softwareTab))} uses the default rules. Change anything below and save to give ${esc(worldName(catalog, softwareTab))} rules of its own.</p>`}`
        : `<p class="field-description">Planets without their own rules use this list. Give a planet its own rules from its tab.</p>`}
      <div class="computer-picker">${Object.entries(computers).map(([id, c]) => `<button class="computer-card ${softwareDraft.computer === id ? 'selected' : ''}" data-action="pick-computer" data-id="${id}" aria-pressed="${softwareDraft.computer === id}"><b>${esc(c.name)}</b><small>${c.slots} rules · ${c.mass * 10} kg · ${c.cost} CR</small></button>`).join('')}</div>
      ${ruleEditor(softwareDraft.rules, sw)}
      <p class="field-description">Lab test ship: <b>${esc(shipLabel)}</b> (your current Shipyard design). Real conditions vary from 85% to 125% of the test.</p>
      <div class="planner-actions">${own ? '<button class="button secondary" data-action="software-clear">USE DEFAULT RULES INSTEAD</button>' : ''}<button class="button secondary" data-action="software-test">RUN LAB TEST</button><button class="button primary" data-action="software-save" ${dirtySoftware ? '' : 'disabled'}>${dirtySoftware ? (planet ? `SAVE ${esc(worldName(catalog, softwareTab).toUpperCase())} RULES` : 'SAVE DEFAULT RULES') : 'SAVED'}</button></div>
      ${labResults(catalog, softwareTest, softwareTab)}
    </section>
    <section class="surface-card"><div class="subheading"><h2>Base standing orders</h2><span>CHECKED EVERY TURN AT EVERY BASE</span></div>
      <p class="field-description">Hazards are forecast 2 turns ahead. You can order a base to prepare up to one turn before it strikes; after that, only standing orders act. Orders run top to bottom, and each response fires once per turn.</p>
      ${ruleEditor(ordersDraft, od)}
      <div class="planner-actions"><button class="button primary" data-action="orders-save" ${dirtyOrders ? '' : 'disabled'}>${dirtyOrders ? 'SAVE STANDING ORDERS' : 'SAVED'}</button></div>
      <div class="mission-advice"><span>✺ AURA'S NOTE</span><p>Sheltering protects crew and electronics but stops labs and drills. Stowing arrays protects them from dust but cuts power to 30%. Good orders trade a little output for survival.</p></div>
    </section>
  </div>`;

}

function goalRows(catalog, state) {
  const records = Object.fromEntries(state.goals.map(g => [g.id, g.status]));
  return catalog.goals.map(g => {
    const status = records[g.id] || 'open', left = g.deadline - state.turn;
    return `<div class="goal-row ${status}"><span class="goal-mark">${status === 'done' ? '✓' : status === 'missed' ? '✕' : '◇'}</span><div><b>${esc(g.title)}</b><small>DEADLINE TURN ${g.deadline}${status === 'open' ? ` · ${Math.max(0, left)} TURNS LEFT` : ''} · REWARD ${g.reward} CR</small></div>${pill(status.toUpperCase(), status === 'done' ? 'green' : status === 'missed' ? 'orange' : '')}</div>`;
  }).join('');
}

const outcomeTone = {nominal: 'green', degraded: 'orange', flyby: 'orange', lost: 'orange', stranded: 'orange', scrubbed: 'orange', missed: 'orange'};

export function missionReport(catalog, mission) {
  return `<article class="report-card"><div class="report-head"><b>${esc(mission.id)} · ${esc(worldName(catalog, mission.destination))} · ${esc(mission.objective)}</b>${pill((mission.outcome || 'in flight').toUpperCase(), outcomeTone[mission.outcome] || '')}</div>
    <ol class="report-steps">${(mission.report || []).map(r => `<li class="${r.ok === false ? 'bad' : r.ok ? 'good' : ''}"><small>${esc(r.phase.toUpperCase())}</small><span>${esc(r.text)}</span></li>`).join('')}</ol>
    ${mission.faultTest?.events?.length ? `<details><summary>Approach log</summary><ul>${mission.faultTest.events.map(e => `<li>${esc(e)}</li>`).join('')}</ul></details>` : ''}</article>`;
}

export function programView({catalog, state, date}) {
  const last = state.reviews.at(-1);
  const nextReview = state.turn + ((catalog.reviewEvery - ((state.turn - 1) % catalog.reviewEvery)) % catalog.reviewEvery || catalog.reviewEvery);
  const forecasts = state.forecasts.filter(f => f.turn >= state.turn).sort((a, b) => a.turn - b.turn);
  const reports = state.missions.filter(m => m.report?.length).slice().reverse();
  return `${ribbon('PROGRAMME OFFICE', `${date} / BUDGET ${state.budget} CR PER TURN`)}
  <div class="page-heading"><div><h1>Answer to the review board.</h1><p>Every ${catalog.reviewEvery} turns (one year) a review scores science, mission results, goals and crew safety. Good years raise your budget; bad years cut it.</p></div>${pill(`NEXT REVIEW TURN ${nextReview}`, 'green')}</div>
  <div class="dual-panels">
    <section class="surface-card"><div class="subheading"><h2>Programme goals</h2><span>${state.goals.filter(g => g.status === 'done').length} / ${catalog.goals.length} COMPLETE</span></div>${goalRows(catalog, state)}</section>
    <section class="surface-card"><div class="subheading"><h2>Reviews</h2><span>BUDGET ${state.budget} CR / TURN</span></div>
      ${last ? state.reviews.slice(-4).reverse().map(r => `<div class="review-row"><div><b>Turn ${r.turn} · score ${r.score}</b><small>${esc(r.notes.join(' · '))}</small></div>${pill(r.change > 0 ? `+${r.change} CR` : r.change < 0 ? `${r.change} CR` : 'HELD', r.change > 0 ? 'green' : r.change < 0 ? 'orange' : '')}</div>`).join('') : '<div class="empty-state">No review yet. The first is on turn 5.</div>'}
      <div class="subheading" style="margin-top:24px"><h2>Hazard forecasts</h2><span>${forecasts.length} ACTIVE</span></div>
      ${forecasts.length ? forecasts.map(f => {const hub = state.hubs.find(h => h.id === f.hub); const canPrep = !f.prepared && f.turn > state.turn; return `<div class="forecast-row"><div><b>${esc(f.kind || 'Hazard')} · severity ${f.severity}</b><small>${esc(hub?.name || f.hub)} · strikes on turn ${f.turn}</small></div>${f.prepared ? pill('PREPARED', 'green') : canPrep ? `<button class="button secondary" data-action="prepare" data-id="${esc(f.id)}">PREPARE · ${catalog.prepareCost} MAT</button>` : pill('STANDING ORDERS ONLY', 'orange')}</div>`;}).join('') : '<div class="empty-state">No hazards forecast.</div>'}
    </section>
  </div>
  <section class="surface-card"><div class="subheading"><h2>Mission debriefs</h2><span>WHY EACH MISSION WENT THE WAY IT DID</span></div>${reports.length ? `<div class="report-grid">${reports.map(m => missionReport(catalog, m)).join('')}</div>` : '<div class="empty-state">No missions flown yet.</div>'}</section>`;
}

/** First-mission guide: steps derived from state; purely presentational. */
export function guideSteps(state, defaults) {
  const home = state.hubs.find(h => h.world === 'mars' && h.tiles.length) || state.hubs.find(h => h.kind === 'control');
  const softwareChanged = JSON.stringify(state.software) !== JSON.stringify(defaults.software);
  return [
    {done: state.turn > 1 || state.missions.length > 0 || (home?.discovered || 0) > 0, text: `Explore ${home?.world === 'earth' ? 'Earth' : 'Mars'} HQ: select an unsurveyed sector near your command center, then choose Scan Sector for free.`, action: null},
    {done: softwareChanged, text: 'Open SOFTWARE, run the lab test and fix the flight rules that fail.', action: 'software'},
    {done: JSON.stringify(state.orders) !== JSON.stringify(defaults.orders), text: 'Write standing orders so bases survive storms on their own.', action: 'software'},
    {done: state.missions.length > 0, text: 'In the SHIPYARD, plan a landing on Earth. Make every check green, launch, and advance turns to arrive.', action: 'planner'},
    {done: state.turn >= 3, text: 'Press NEXT TURN. Prepare bases for forecast hazards in PROGRAMME.', action: 'program'},
  ];
}
