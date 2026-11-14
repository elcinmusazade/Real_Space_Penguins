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

function scenarioRows(catalog, test) {
  const destinationFor = Object.fromEntries(Object.entries(catalog.faults.arrivalScenario).map(([world, scenario]) => [scenario, world]));
  return test.results.map(r => `<div class="test-row ${r.passed ? 'pass' : 'fail'}"><span class="test-mark">${r.passed ? '✓' : r.lost ? '✕' : '!'}</span>
    <div><b>${esc(r.name)} <small>· ARRIVING AT ${esc(worldName(catalog, destinationFor[r.scenario]).toUpperCase())}</small></b>
    <small>${r.lost ? 'Spacecraft LOST after repeated brownouts' : `${r.science} / ${r.target} science`}${r.instrumentTarget ? ` · camera ${r.byInstrument.camera} / ${r.instrumentTarget.science}` : ''} · ${r.brownouts} brownouts · baseline without rules: ${r.baseline.lost ? 'lost' : r.baseline.science}</small></div>
    ${pill(r.passed ? 'PASS' : r.lost ? 'LOST' : 'DEGRADED', r.passed ? 'green' : 'orange')}</div>`).join('');
}

export function softwareView({catalog, state, softwareDraft, ordersDraft, softwareTest, dirtySoftware, dirtyOrders}) {
  const sw = softwareConfig(catalog);
  const computers = catalog.computers;
  sw.slots = computers[softwareDraft.computer].slots;
  const od = ordersConfig(catalog, state);
  return `${ribbon('AUTONOMY', 'FLIGHT SOFTWARE / STANDING ORDERS')}
  <div class="page-heading"><div><h1>Write the rules before you need them.</h1><p>Signals take 3 to 22 minutes to reach Mars and up to 54 minutes to reach Jupiter. When something goes wrong in flight or on a base, only the rules you wrote react in time.</p></div>${pill('PLAYER-DESIGNED', 'green')}</div>
  <div class="dual-panels software-columns">
    <section class="surface-card"><div class="subheading"><h2>Spacecraft flight software</h2><span>LOADED ON EVERY NEW LAUNCH</span></div>
      <p class="field-description">Each destination has its own approach hazard (${Object.entries(catalog.faults.arrivalScenario).map(([w, s]) => `${worldName(catalog, w)}: ${catalog.faults.scenarios[s].name.toLowerCase()}`).join('; ')}). Real conditions vary from 85% to 125% of the lab test, so leave margin.</p>
      <div class="computer-picker">${Object.entries(computers).map(([id, c]) => `<button class="computer-card ${softwareDraft.computer === id ? 'selected' : ''}" data-action="pick-computer" data-id="${id}" aria-pressed="${softwareDraft.computer === id}"><b>${esc(c.name)}</b><small>${c.slots} rules · ${c.mass * 10} kg · ${c.cost} CR</small></button>`).join('')}</div>
      ${ruleEditor(softwareDraft.rules, sw)}
      <div class="planner-actions"><button class="button secondary" data-action="software-test">RUN LAB TEST</button><button class="button primary" data-action="software-save" ${dirtySoftware ? '' : 'disabled'}>${dirtySoftware ? 'SAVE FLIGHT SOFTWARE' : 'SAVED'}</button></div>
      ${softwareTest ? `<div class="test-results">${softwareTest.ok ? `<div class="eyebrow">LAB TEST · ${softwareTest.passed} / ${softwareTest.results.length} SCENARIOS PASSED AT NOMINAL INTENSITY</div>${scenarioRows(catalog, softwareTest)}` : `<div class="quote-warning">${esc(softwareTest.error)}</div>`}</div>` : ''}
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
  const softwareChanged = JSON.stringify(state.software) !== JSON.stringify(defaults.software);
  return [
    {done: state.turn > 1 || state.missions.length > 0 || state.hubs[1].tiles.filter(t => t.revealed).length > 9, text: 'Click fogged tiles around Arcadia to scan them for free.', action: null},
    {done: softwareChanged, text: 'Open SOFTWARE, run the lab test and fix the flight rules that fail.', action: 'software'},
    {done: JSON.stringify(state.orders) !== JSON.stringify(defaults.orders), text: 'Write standing orders so bases survive storms on their own.', action: 'software'},
    {done: state.missions.length > 0, text: 'In the SHIPYARD, wait for a good launch window and make every check green.', action: 'planner'},
    {done: state.turn >= 3, text: 'Press NEXT TURN. Prepare bases for forecast hazards in PROGRAMME.', action: 'program'},
  ];
}
