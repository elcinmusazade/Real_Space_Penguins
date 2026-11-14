/**
 * Fault Protection Lab UI. The browser only edits the rule list and asks the
 * Python server to validate and simulate it (POST /api/faults/test). No game
 * outcome is calculated here.
 */

const STORE = 'ares-fault-lab-v1';
const root = document.getElementById('lab');
let catalog = null;
let design = null;
let report = null;
let stale = false;
let error = '';
let running = false;

const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
const clone = value => JSON.parse(JSON.stringify(value));

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && catalog.computers[saved.computer] && Array.isArray(saved.rules)) return saved;
  } catch { /* storage unavailable or corrupt: fall back to the example */ }
  return clone(catalog.example);
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(design)); } catch { /* ignore */ }
}

function changed() {
  if (report) stale = true;
  error = '';
  save();
  render();
}

function defaultCondition(sensor = 'battery') {
  const spec = catalog.sensors[sensor];
  return spec.kind === 'bool' ? {sensor, op: 'is', value: true} : {sensor, op: '<', value: Math.round((spec.min + spec.max) / 2)};
}

function newRule() {
  return {when: [defaultCondition('battery')], for: 1, then: 'safe_mode'};
}

// ---------- editor ----------

function options(entries, selected) {
  return entries.map(([value, label]) => `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`).join('');
}

function conditionRow(rule, r, cond, c) {
  const spec = catalog.sensors[cond.sensor];
  const sensorSelect = `<select data-field="sensor" data-r="${r}" data-c="${c}" aria-label="Rule ${r + 1} sensor">${options(Object.entries(catalog.sensors).map(([k, s]) => [k, s.name]), cond.sensor)}</select>`;
  let compare;
  if (spec.kind === 'bool') {
    compare = `<span class="rule-unit">is</span><select data-field="bool" data-r="${r}" data-c="${c}" aria-label="Rule ${r + 1} value">${options([['true', 'yes'], ['false', 'no']], cond.value)}</select>`;
  } else {
    compare = `<select data-field="op" data-r="${r}" data-c="${c}" aria-label="Rule ${r + 1} comparison">${options([['<', 'below'], ['>', 'above']], cond.op)}</select>
      <input type="number" data-field="value" data-r="${r}" data-c="${c}" min="${spec.min}" max="${spec.max}" step="1" value="${esc(cond.value)}" aria-label="Rule ${r + 1} threshold">
      <span class="rule-unit">${esc(spec.unit)}</span>`;
  }
  const remove = rule.when.length > 1 ? `<button class="mini-btn" data-act="del-cond" data-r="${r}" data-c="${c}" aria-label="Remove condition">remove</button>` : '';
  return `<div class="rule-row"><span class="rule-kw">${c === 0 ? 'WHEN' : 'AND'}</span>${sensorSelect}${compare}${remove}</div>`;
}

function ruleCard(rule, r, total) {
  const response = catalog.responses[rule.then];
  const target = response.target
    ? `<select data-field="target" data-r="${r}" aria-label="Rule ${r + 1} instrument">${options(Object.entries(catalog.instruments).map(([k, s]) => [k, s.name]), rule.target || 'radar')}</select>`
    : '';
  const addCond = rule.when.length < catalog.limits.conditions
    ? `<button class="mini-btn" data-act="add-cond" data-r="${r}">+ AND condition</button>` : '';
  return `<li class="rule">
    <div class="rule-head">
      <span class="rule-priority">PRIORITY ${r + 1}</span>
      <span class="rule-tools">
        <button data-act="up" data-r="${r}" ${r === 0 ? 'disabled' : ''} aria-label="Move rule ${r + 1} up" title="Higher priority">↑</button>
        <button data-act="down" data-r="${r}" ${r === total - 1 ? 'disabled' : ''} aria-label="Move rule ${r + 1} down" title="Lower priority">↓</button>
        <button data-act="delete" data-r="${r}" aria-label="Delete rule ${r + 1}" title="Delete">×</button>
      </span>
    </div>
    ${rule.when.map((cond, c) => conditionRow(rule, r, cond, c)).join('')}
    <div class="rule-row"><span class="rule-kw"></span>${addCond}</div>
    <div class="rule-row"><span class="rule-kw">FOR</span>
      <select data-field="for" data-r="${r}" aria-label="Rule ${r + 1} duration">${options(Array.from({length: catalog.limits.for}, (_, i) => [i + 1, i === 0 ? '1 turn (immediately)' : `${i + 1} turns in a row`]), rule.for)}</select>
    </div>
    <div class="rule-row"><span class="rule-kw">THEN</span>
      <select data-field="then" data-r="${r}" aria-label="Rule ${r + 1} response">${options(Object.entries(catalog.responses).map(([k, s]) => [k, s.name]), rule.then)}</select>${target}
    </div>
    <p class="rule-help">${esc(response.help)}</p>
  </li>`;
}

function editor() {
  const computer = catalog.computers[design.computer];
  const full = design.rules.length >= computer.slots;
  const computers = Object.entries(catalog.computers).map(([key, c]) => `
    <button class="computer" data-act="computer" data-id="${key}" aria-pressed="${key === design.computer}">
      <strong>${esc(c.name)}</strong>
      <span><b>${c.slots}</b> rule slots<br>${c.power} power/turn · ${c.mass} kg · $${c.cost}M</span>
    </button>`).join('');
  const over = design.rules.length > computer.slots
    ? `<div class="error-box">This computer only holds ${computer.slots} rules. Delete ${design.rules.length - computer.slots} or choose a bigger computer.</div>` : '';
  return `
    <section class="lab-panel" aria-labelledby="computer-h">
      <span class="eyebrow">Step 1</span>
      <h2 id="computer-h">Flight computer</h2>
      <div class="computers">${computers}</div>
      <p class="lab-muted" style="margin-top:12px;font-size:12px">A bigger computer holds more rules but draws more power every turn, which matters in a dust storm or eclipse.</p>
    </section>
    <section class="lab-panel" aria-labelledby="rules-h">
      <span class="eyebrow">Step 2</span>
      <h2 id="rules-h">Fault protection rules <small>${design.rules.length}/${computer.slots} slots</small></h2>
      ${over}
      ${design.rules.length ? `<ol class="rules" style="list-style:none;margin:0;padding:0">${design.rules.map((rule, r) => ruleCard(rule, r, design.rules.length)).join('')}</ol>`
        : `<div class="rule-empty">No rules yet. Without rules the orbiter keeps every instrument on and only downlinks on its normal schedule, whatever happens.</div>`}
      <div class="lab-actions">
        <button class="btn" data-act="add" ${full ? 'disabled' : ''}>+ Add rule</button>
        <button class="btn btn-ghost" data-act="example">Load starter rules</button>
        <button class="btn btn-ghost" data-act="clear" ${design.rules.length ? '' : 'disabled'}>Clear all</button>
      </div>
      <p class="lab-muted" style="margin-top:14px;font-size:12px">Rules are checked from the top every turn. When two rules want the same thing (say one turns the radar off and another keeps it on), the higher one wins and the lower one is blocked.</p>
    </section>`;
}

// ---------- results ----------

function chart(timeline) {
  const w = 300, h = 84, pad = 6, n = catalog.turns;
  const x = i => pad + (i * (w - pad * 2)) / (n - 1);
  const y = v => h - pad - (v / 100) * (h - pad * 2);
  const line = key => timeline.map((t, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(t[key]).toFixed(1)}`).join('');
  const contacts = timeline.filter(t => t.contact).map(t => `<rect x="${(x(t.turn - 1) - 3).toFixed(1)}" y="${pad}" width="6" height="${h - pad * 2}" fill="var(--cyan)" opacity=".12"/>`).join('');
  const safe = timeline.filter(t => t.safe).map(t => `<circle cx="${x(t.turn - 1).toFixed(1)}" cy="${h - 4}" r="2.5" fill="var(--yellow)"/>`).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Battery and storage over ${timeline.length} turns">
    ${contacts}
    <path d="${line('battery')}" fill="none" stroke="var(--green)" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <path d="${line('storage')}" fill="none" stroke="var(--orange)" stroke-width="2" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>
    ${safe}
  </svg>`;
}

function logList(result) {
  return `<ol class="log">${result.timeline.map(t => {
    const lines = [];
    for (const f of t.fired) {
      const text = `Rule ${f.rule + 1}: ${esc(report.rules[f.rule] || '')}`;
      lines.push(f.status === 'blocked'
        ? `<div class="blocked">${text} (blocked by rule ${f.by + 1})</div>`
        : `<div class="applied">▸ ${text}${f.note ? ` — ${esc(f.note)}` : ''}</div>`);
    }
    for (const e of t.events) lines.push(`<div class="ev">${esc(e)}</div>`);
    if (!lines.length) lines.push(`<div class="quiet">Nominal. ${t.contact ? 'Downlink pass.' : ''}</div>`);
    return `<li><span class="t">T${t.turn}</span><div>${lines.join('')}<div class="quiet">Battery ${t.battery}% · storage ${t.storage}% · science ${t.science} · on: ${t.instruments.length ? t.instruments.map(k => esc(catalog.instruments[k].name)).join(', ') : 'none'}</div></div></li>`;
  }).join('')}</ol>`;
}

function scenarioCard(result) {
  const focus = result.instrumentTarget;
  const focusLine = focus ? ` · ${esc(catalog.instruments[focus.instrument].name)} ${result.byInstrument[focus.instrument]}/${focus.science}` : '';
  const delta = result.science - result.baseline.science;
  const reasons = [];
  if (result.lost) reasons.push('the spacecraft was lost to repeated brownouts');
  else if (result.science < result.target) reasons.push(`science returned was ${result.target - result.science} short of the target`);
  if (focus && result.byInstrument[focus.instrument] < focus.science) reasons.push(`the ${catalog.instruments[focus.instrument].name.toLowerCase()} returned too little`);
  return `<article class="scenario">
    <div class="scenario-head">
      <div><h3>${esc(result.name)}</h3><p>${esc(result.description)}</p></div>
      <span class="badge ${result.passed ? 'pass' : 'fail'}">${result.passed ? 'PASS' : 'FAIL'}</span>
    </div>
    <div class="stats">
      <div class="stat ${result.science >= result.target ? 'good' : 'bad'}"><b>${result.science}</b><span>science / ${result.target}${focusLine}</span></div>
      <div class="stat"><b>${delta >= 0 ? '+' : ''}${delta}</b><span>vs. no rules (${result.baseline.science}${result.baseline.lost ? ', lost' : ''})</span></div>
      <div class="stat ${result.brownouts ? 'bad' : ''}"><b>${result.brownouts}</b><span>brownouts${result.lost ? ' · LOST' : ''}</span></div>
      <div class="stat ${result.dataLost ? 'bad' : ''}"><b>${result.dataLost}</b><span>data units discarded</span></div>
    </div>
    ${chart(result.timeline)}
    <div class="legend"><span><i style="background:var(--green)"></i>Battery</span><span><i style="background:var(--orange)"></i>Storage</span><span><i style="background:var(--cyan);opacity:.5"></i>Contact window</span><span><i style="background:var(--yellow);height:5px;width:5px;border-radius:50%"></i>Safe mode</span></div>
    ${reasons.length ? `<p class="lab-muted" style="font-size:11px;margin-top:6px">Failed because ${esc(reasons.join(' and '))}.</p>` : ''}
    <p class="lab-muted" style="font-size:11px;margin-top:4px">End health: ${Object.entries(result.health).map(([k, v]) => `${esc(catalog.instruments[k].name)} ${v}%`).join(' · ')} · solar arrays ${result.arrays}%</p>
    <details><summary>Turn-by-turn log</summary>${logList(result)}</details>
  </article>`;
}

function results() {
  const scenarios = Object.values(catalog.scenarios);
  let body;
  if (!report) {
    body = `<p class="lab-muted">Python flies your design through ${scenarios.length} scripted fault scenarios of ${catalog.turns} turns each, and also flies the same orbiter with no rules so you can compare.</p>
      <ul class="lab-muted" style="font-size:12px;padding-left:18px;margin:12px 0 0">${scenarios.map(s => `<li><strong style="color:var(--text);font-weight:500">${esc(s.name)}</strong>: ${esc(s.description)}</li>`).join('')}</ul>`;
  } else {
    body = `<div class="summary"><span class="summary-score">${report.passed}/${report.results.length}</span><p>scenarios passed.<br>${report.passed === report.results.length ? 'Your fault protection is flight-ready.' : 'Open a failed scenario’s log to see which rule fired, or didn’t, and why.'}</p></div>
      ${stale ? '<p class="stale">Rules changed since this run. Run the tests again.</p>' : ''}
      ${report.results.map(scenarioCard).join('')}`;
  }
  return `<section class="lab-panel" aria-labelledby="test-h" aria-live="polite">
    <span class="eyebrow">Step 3</span>
    <h2 id="test-h">Fault test campaign</h2>
    ${error ? `<div class="error-box">${esc(error)}</div>` : ''}
    <button class="btn btn-primary" data-act="run" style="width:100%;margin-bottom:16px" ${running ? 'disabled' : ''}>${running ? 'Simulating…' : report ? 'Run tests again' : 'Run fault tests'}</button>
    ${body}
  </section>`;
}

function render() {
  const focused = document.activeElement;
  const key = focused && focused.dataset ? [focused.dataset.field || focused.dataset.act, focused.dataset.r, focused.dataset.c, focused.dataset.id].join('|') : null;
  const open = [...root.querySelectorAll('.scenario details')].map(d => d.open);
  root.innerHTML = `
    <header class="lab-top">
      <a class="lab-brand" href="/"><span class="brand-emblem"><svg viewBox="0 0 30 30" width="25" height="25" aria-hidden="true"><path d="M4 25 15 4l11 21-11-6Z" fill="currentColor"/><path d="m15 10 4 10-4-2-4 2Z" fill="#25201c"/></svg></span><span><span class="brand-title">ARES</span><span class="brand-sub" style="display:block">FAULT PROTECTION LAB</span></span></a>
      <a class="lab-back" href="/">← Mission control</a>
    </header>
    <section class="lab-hero">
      <span class="eyebrow">Mars orbiter · onboard autonomy</span>
      <h1>Teach your spacecraft to save itself.</h1>
      <p>Signals take 4 to 24 minutes to cross between Earth and Mars, so nobody on Earth can react to a fault as it happens. Real spacecraft carry <em>fault protection</em>: rules that run onboard and decide what to do when something goes wrong. Write those rules here, then see how they hold up.</p>
    </section>
    <div class="lab-grid">
      <div>${editor()}</div>
      <div>${results()}</div>
    </div>
    <p class="lab-note">Example slice of the mission-design game. Orbiter power, data, radiation and dust values are simplified game numbers, not NASA spacecraft specifications.</p>`;
  root.querySelectorAll('.scenario details').forEach((d, i) => { if (open[i]) d.open = true; });
  if (key) {
    const [field, r, c, id] = key.split('|');
    const selector = [field && `[data-${focused.dataset.field ? 'field' : 'act'}="${field}"]`, r && `[data-r="${r}"]`, c && `[data-c="${c}"]`, id && `[data-id="${id}"]`].filter(Boolean).join('');
    if (selector) root.querySelector(selector)?.focus();
  }
}

// ---------- events ----------

async function runTests() {
  running = true; error = ''; render();
  try {
    const response = await fetch('/api/faults/test', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({design})});
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Mission control rejected the design.');
    report = data; stale = false;
  } catch (err) {
    error = err instanceof TypeError ? 'Cannot reach the Python mission server. Is it running?' : err.message;
  } finally {
    running = false; render();
  }
}

root.addEventListener('click', event => {
  const button = event.target.closest('[data-act]');
  if (!button || button.disabled) return;
  const act = button.dataset.act, r = Number(button.dataset.r), c = Number(button.dataset.c);
  const rules = design.rules;
  if (act === 'run') { runTests(); return; }
  if (act === 'computer') design.computer = button.dataset.id;
  else if (act === 'add') rules.push(newRule());
  else if (act === 'example') design = clone(catalog.example);
  else if (act === 'clear') design.rules = [];
  else if (act === 'delete') rules.splice(r, 1);
  else if (act === 'up' && r > 0) [rules[r - 1], rules[r]] = [rules[r], rules[r - 1]];
  else if (act === 'down' && r < rules.length - 1) [rules[r + 1], rules[r]] = [rules[r], rules[r + 1]];
  else if (act === 'add-cond') rules[r].when.push(defaultCondition('storage'));
  else if (act === 'del-cond') rules[r].when.splice(c, 1);
  else return;
  changed();
});

root.addEventListener('change', event => {
  const el = event.target, field = el.dataset.field;
  if (!field) return;
  const rule = design.rules[Number(el.dataset.r)];
  const cond = rule && rule.when[Number(el.dataset.c)];
  if (field === 'sensor') rule.when[Number(el.dataset.c)] = defaultCondition(el.value);
  else if (field === 'op') cond.op = el.value;
  else if (field === 'bool') cond.value = el.value === 'true';
  else if (field === 'value') {
    const spec = catalog.sensors[cond.sensor];
    const number = Math.round(Number(el.value));
    cond.value = Number.isFinite(number) ? Math.min(spec.max, Math.max(spec.min, number)) : spec.min;
  } else if (field === 'for') rule.for = Number(el.value);
  else if (field === 'then') {
    rule.then = el.value;
    if (catalog.responses[el.value].target) rule.target = rule.target || 'radar';
    else delete rule.target;
  } else if (field === 'target') rule.target = el.value;
  changed();
});

(async function start() {
  try {
    const response = await fetch('/api/faults/catalog');
    const data = await response.json();
    if (!data.ok) throw new Error('bad catalog');
    catalog = data.catalog;
    design = load();
    render();
  } catch {
    root.innerHTML = '<p class="lab-muted" style="padding:40px 0">Cannot reach the Python mission server. Start it with <code>python3 -m ares.server</code> and reload.</p>';
  }
})();
