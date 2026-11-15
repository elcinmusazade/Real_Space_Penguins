/** AURA advice panel: Python-computed priorities plus topic explanations. View only. */

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICON = {critical: '!', warning: '▲', opportunity: '✦', info: 'i'};
const LABEL = {critical: 'URGENT', warning: 'WARNING', opportunity: 'OPPORTUNITY', info: 'NOTE'};

export const TOPICS = {
  basics: ['Basics', 'Each turn is three months. Give as many orders as you like, then press NEXT TURN: buildings produce, ships travel, research progresses and hazards strike. Every hub has its own stockpile; resources only move by shipment.'],
  building: ['Building', 'Scan within two sectors of a building for free; farther sectors need a paid Regional Survey. Build on scanned, empty sectors that touch a facility. Terrain matters: ice and coasts for water plants, fertile soil for greenhouses, rocky ground for drills. Buildings wear out: keep materials for upkeep and repair anything below 50%.'],
  survival: ['Survival', 'Crews use food, water, oxygen, heat and energy every turn. Shortages lower health; at 0% the base is lost. Hazards are forecast two turns ahead: PREPARE at least one turn before, and write standing orders that shelter the crew or stow arrays when hazard severity is high.'],
  missions: ['Missions', 'In the Shipyard, every launch check must be green: launch direction, launch mass and delta-v. From Earth, launch windows follow the real planets (NASA GMAT data), so watch the 12-turn strip. More propellant brakes harder but weighs more. Your saved flight software flies the approach on its own.'],
  software: ['Flight software', 'Rules run top to bottom: WHEN a sensor crosses a threshold, FOR some turns, THEN respond. Run the lab test against all four approach scenarios. Real conditions vary from 85% to 125% of the test, so leave margin. A safe-mode rule for low battery survives most dust storms.'],
  programme: ['Programme', 'Every four turns the review board scores science, arrived missions, goals and crew safety and raises or cuts your budget. Goals pay credits when completed. Research turns science into better production, new engines and rockets, and access to harder destinations.'],
};

export function badgeCount(advice) {
  return advice?.ok ? advice.counts.critical + advice.counts.warning : 0;
}

export function advisorView({advice, topic}) {
  const items = advice?.ok ? advice.items : null;
  const list = !advice ? '<p class="aura-loading">AURA is reviewing your programme…</p>'
    : !advice.ok ? `<p class="aura-loading">${esc(advice.error || 'Advice is unavailable right now.')}</p>`
    : !items.length ? '<p class="aura-clear">✓ Nothing needs your attention right now. A good time to explore, build or plan the next mission.</p>'
    : `<ol class="aura-list">${items.map((item, i) => `<li class="aura-item is-${item.level}">
        <span class="aura-icon" aria-hidden="true">${ICON[item.level]}</span>
        <div><small>${LABEL[item.level]} · ${esc(item.category.toUpperCase())}</small><b>${esc(item.title)}</b><p>${esc(item.detail)}</p></div>
        ${item.action ? `<button class="button ${item.level === 'critical' || item.level === 'warning' ? 'primary' : 'secondary'}" data-action="advice-go" data-index="${i}">${esc(item.action.label)} →</button>` : ''}</li>`).join('')}</ol>`;
  const [title, text] = TOPICS[topic] || TOPICS.basics;
  return `<div class="modal-scrim" data-action="advisor-dismiss"><section class="aura-modal advisor-modal" role="dialog" aria-modal="true" aria-labelledby="advisor-title">
    <div class="advisor-top"><span class="modal-aura">✺</span><div><div class="eyebrow">A.U.R.A. · MISSION ADVISOR${advice?.ok ? ` · TURN ${advice.turn} · ${esc(advice.date)}` : ''}</div><h2 id="advisor-title">What needs your attention</h2></div>
      <button class="tut-close" data-action="dismiss-modal" aria-label="Close advisor">✕</button></div>
    ${list}
    <div class="advisor-topics"><div class="eyebrow">HOW THINGS WORK</div>
      <div class="aura-topics" role="tablist">${Object.entries(TOPICS).map(([id, [name]]) => `<button role="tab" aria-selected="${id === topic}" class="${id === topic ? 'selected' : ''}" data-action="advisor-topic" data-id="${id}">${esc(name)}</button>`).join('')}</div>
      <p class="aura-topic-text"><b>${esc(title)}.</b> ${esc(text)}</p></div>
    <div class="modal-buttons"><button class="button secondary" data-action="advisor-briefing">REPLAY WELCOME BRIEFING</button><button class="button primary" data-action="dismiss-modal">BACK TO COMMAND</button></div>
    <p class="modal-disclaimer">AURA is authored, offline guidance computed from the game rules, not a live AI.</p></section></div>`;
}
