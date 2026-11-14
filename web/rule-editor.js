/**
 * Rule editor for player-written automation: spacecraft flight software and base
 * standing orders. Pure view helpers: they render HTML and return edited copies
 * of a draft rule list. Python validates and stores the rules (setSoftware /
 * setOrders); nothing here changes game state.
 */

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = v => JSON.parse(JSON.stringify(v));

/** config: {kind, sensors, responses, instruments?, maxConditions, hasFor, maxFor, slots} */
export function defaultRule(config) {
  const [sensor, spec] = Object.entries(config.sensors).find(([, s]) => s.kind !== 'bool') || Object.entries(config.sensors)[0];
  const rule = {when: [{sensor, op: '>', value: Math.round(((spec.min ?? 0) + (spec.max ?? 100)) / 2)}], then: Object.keys(config.responses)[0]};
  if (config.hasFor) rule.for = 1;
  return rule;
}

function conditionFor(sensor, config) {
  const spec = config.sensors[sensor];
  if (spec.kind === 'bool') return {sensor, op: 'is', value: true};
  return {sensor, op: '>', value: Math.round(((spec.min ?? 0) + (spec.max ?? 100)) / 2)};
}

function select(attrs, options, current, label) {
  return `<select ${attrs} aria-label="${esc(label)}">${options.map(([value, text]) => `<option value="${esc(value)}" ${String(current) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>`;
}

function conditionMarkup(rule, ri, ci, config) {
  const cond = rule.when[ci], spec = config.sensors[cond.sensor];
  const at = `data-kind="${config.kind}" data-rule="${ri}" data-cond="${ci}"`;
  const sensor = select(`data-rule-field="sensor" ${at}`, Object.entries(config.sensors).map(([id, s]) => [id, s.name]), cond.sensor, `Rule ${ri + 1} sensor`);
  let compare;
  if (spec.kind === 'bool') {
    compare = `<span class="rule-word">is</span>${select(`data-rule-field="bool" ${at}`, [['true', 'yes'], ['false', 'no']], String(cond.value), `Rule ${ri + 1} value`)}`;
  } else {
    compare = `${select(`data-rule-field="op" ${at}`, [['<', 'below'], ['>', 'above']], cond.op, `Rule ${ri + 1} comparison`)}<input type="number" data-rule-field="value" ${at} min="${spec.min}" max="${spec.max}" value="${esc(cond.value)}" aria-label="Rule ${ri + 1} threshold"><span class="rule-unit">${esc(spec.unit || '')}</span>`;
  }
  const remove = rule.when.length > 1 ? `<button class="rule-mini" data-action="rule-cond-del" ${at} aria-label="Remove condition">✕</button>` : '';
  return `<div class="rule-cond"><span class="rule-word">${ci ? 'AND' : 'WHEN'}</span>${sensor}${compare}${remove}</div>`;
}

export function ruleEditor(rules, config) {
  const cards = rules.map((rule, ri) => {
    const at = `data-kind="${config.kind}" data-rule="${ri}"`;
    const response = config.responses[rule.then];
    const target = response?.target && config.instruments
      ? select(`data-rule-field="target" ${at}`, Object.entries(config.instruments).map(([id, s]) => [id, s.name]), rule.target || '', `Rule ${ri + 1} instrument`) : '';
    const hold = config.hasFor ? `<div class="rule-cond"><span class="rule-word">FOR</span>${select(`data-rule-field="for" ${at}`, Array.from({length: config.maxFor}, (_, i) => [i + 1, `${i + 1} turn${i ? 's' : ''} in a row`]), rule.for || 1, `Rule ${ri + 1} duration`)}</div>` : '';
    return `<article class="rule-card"><div class="rule-head"><span class="rule-index">${ri + 1}</span><span class="rule-priority">${ri === 0 ? 'HIGHEST PRIORITY' : 'PRIORITY ' + (ri + 1)}</span>
      <span class="rule-tools"><button class="rule-mini" data-action="rule-up" ${at} ${ri === 0 ? 'disabled' : ''} aria-label="Move rule up">↑</button><button class="rule-mini" data-action="rule-down" ${at} ${ri === rules.length - 1 ? 'disabled' : ''} aria-label="Move rule down">↓</button><button class="rule-mini" data-action="rule-del" ${at} aria-label="Delete rule">✕</button></span></div>
      ${rule.when.map((_, ci) => conditionMarkup(rule, ri, ci, config)).join('')}
      ${rule.when.length < config.maxConditions ? `<button class="rule-add-cond" data-action="rule-cond-add" ${at}>+ AND condition</button>` : ''}
      ${hold}
      <div class="rule-cond rule-then"><span class="rule-word">THEN</span>${select(`data-rule-field="then" ${at}`, Object.entries(config.responses).map(([id, r]) => [id, r.name]), rule.then, `Rule ${ri + 1} response`)}${target}</div>
      ${response?.help ? `<p class="rule-help">${esc(response.help)}</p>` : ''}</article>`;
  }).join('');
  const full = rules.length >= config.slots;
  return `<div class="rule-list">${cards || '<div class="empty-state">No rules yet. Without rules, nothing reacts until Earth notices — and that is too late.</div>'}</div>
    <div class="rule-footer"><span class="rule-slots">${rules.length} / ${config.slots} SLOTS USED</span><button class="button secondary" data-action="rule-add" data-kind="${config.kind}" ${full ? 'disabled' : ''}>+ ADD RULE</button></div>`;
}

/** Apply an <select>/<input> change. Returns a new rule list. */
export function applyRuleField(rules, dataset, value, config) {
  const next = clone(rules), rule = next[Number(dataset.rule)];
  if (!rule) return next;
  const field = dataset.ruleField;
  if (dataset.cond !== undefined) {
    const ci = Number(dataset.cond);
    if (field === 'sensor') rule.when[ci] = conditionFor(value, config);
    else if (field === 'op') rule.when[ci].op = value;
    else if (field === 'value') rule.when[ci].value = Number(value);
    else if (field === 'bool') rule.when[ci].value = value === 'true';
  } else if (field === 'then') {
    rule.then = value;
    if (config.responses[value]?.target) rule.target = rule.target || Object.keys(config.instruments || {})[0];
    else delete rule.target;
  } else if (field === 'target') rule.target = value;
  else if (field === 'for') rule.for = Number(value);
  return next;
}

/** Apply a button action. Returns a new rule list. */
export function applyRuleAction(rules, action, dataset, config) {
  const next = clone(rules), ri = Number(dataset.rule);
  if (action === 'rule-add' && next.length < config.slots) next.push(defaultRule(config));
  if (action === 'rule-del') next.splice(ri, 1);
  if (action === 'rule-up' && ri > 0) [next[ri - 1], next[ri]] = [next[ri], next[ri - 1]];
  if (action === 'rule-down' && ri < next.length - 1) [next[ri + 1], next[ri]] = [next[ri], next[ri + 1]];
  if (action === 'rule-cond-add' && next[ri].when.length < config.maxConditions) next[ri].when.push(conditionFor(Object.keys(config.sensors)[0], config));
  if (action === 'rule-cond-del' && next[ri].when.length > 1) next[ri].when.splice(Number(dataset.cond), 1);
  return next;
}
