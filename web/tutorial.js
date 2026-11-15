/**
 * Interactive tutorial: coach marks that spotlight the real interface, explain
 * mechanics and objectives, give hints, and wait for the player to act.
 *
 * Presentation only. It reads a context snapshot from campaign.js and never
 * changes game state; "Take me there" buttons simply click existing controls.
 * Progress is a per-browser preference in localStorage, so it survives reloads
 * but is not part of the Python-validated save.
 */

const KEY = 'ares.first-light.tutorial.v1';
const POS_KEY = 'ares.first-light.tutorial.position';
/** Interface the card should not cover by default, with how much covering each one costs. */
const BUSY = [['.map-inspector', 3], ['.map-action-bar', 3], ['.map-resources', 2], ['.topbar', 2], ['.map-minimap-box', 1], ['.map-controls', 1], ['.solar-toggle', 1]];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const revealed = h => h ? h.tiles.filter(t => t.revealed).length : 0;
const built = h => h ? h.tiles.filter(t => t.building).length : 0;

/**
 * Each step: chapter, title, body, hint, target (CSS selector, first match that
 * exists wins), goto (tab to open with "Take me there"), and for action steps
 * `base(ctx)` + `done(ctx, base)`. Action steps advance as soon as done() is true.
 */
export const STEPS = [
  {chapter: 'Welcome', title: 'Welcome, Commander', center: true,
    body: 'You run a young space programme from <b>Mars HQ</b>. Your goals: explore and build up Mars, fly the first missions to Earth and beyond, keep your crews alive, and satisfy the review board that sets your budget every year.',
    hint: 'This card is movable: drag it by its top bar (⠿) to anywhere it is not in the way, and it stays exactly where you put it. Close it any time with ✕; resume or restart from ⚙ Settings.'},
  {chapter: 'Welcome', title: 'Time and resources', target: ['.map-resources'],
    body: 'Science pays for research, credits pay for missions, and your budget adds credits every turn. <b>NEXT TURN</b> moves the calendar forward three months: buildings produce, ships travel, hazards strike.',
    hint: 'Watch CR / TURN: it is your yearly budget, and the review board raises or cuts it based on your results.'},
  {chapter: 'Welcome', title: 'Your base and its stockpile', target: ['.map-inspector'],
    body: 'The inspector shows the selected sector and this hub’s stockpile: energy, materials, fuel, water, food, oxygen and heat. Every hub has its <b>own</b> stockpile. Resources only move between hubs when you ship them.',
    hint: 'Drag to pan the map, scroll to zoom, and use ▣ for the full overview.'},
  {chapter: 'Welcome', title: 'The solar system', target: ['[data-action="solar-open"]'],
    body: 'Open the navigator to see every planet orbit the Sun, check your hubs and traffic, and jump to any world’s map or plan a mission there.',
    hint: 'Worlds without a base are previews. A landing mission must arrive before you can build there.'},

  {chapter: 'Explore & build', title: 'Scan the land around HQ', action: true, target: ['[data-action="survey-sector"][data-free="true"]', '#planet-map'], goto: 'system', assist: 'scan',
    status: ctx => !ctx.selection ? '' : ctx.selection.revealed ? 'That sector is already charted. Pick one just outside the charted patch.' : ctx.selection.free === false ? 'That sector is too far for a free scan (the button says Start Regional Survey). Pick one closer to a building, or press SHOW ME.' : ctx.selection.free ? 'Good pick. Press SCAN SECTOR in the inspector.' : '',
    body: 'The land right around HQ is already charted. Click a sector just beyond it, up to two sectors from any building, then press <b>SCAN SECTOR</b> in the inspector. Nearby scans are free and instant.',
    hint: 'Far sectors need a Regional Survey: it costs energy and takes 1–3 turns, but maps a 3×3 area.',
    base: ctx => revealed(ctx.home), done: (ctx, base) => revealed(ctx.home) > base},
  {chapter: 'Explore & build', title: 'Terrain matters', target: ['.map-action-bar'],
    body: 'The construction bay lists your facilities. Solar arrays make energy; water plants need ice or a coast; greenhouses turn water into food; oxygen plants turn water and energy into oxygen; labs make science; drills make materials.',
    hint: 'Fertile soil boosts food, rocky ground boosts drilling, high ground boosts solar but costs more to prepare.'},
  {chapter: 'Explore & build', title: 'Pick a facility', action: true, target: ['.map-build-items'], goto: 'system',
    body: 'Choose a facility from the construction bay. A <b>Solar Array</b> is a safe first pick: everything else runs on energy.',
    hint: 'Click the same button again, or CANCEL, to stop placing.',
    done: ctx => Boolean(ctx.selectedBuilding)},
  {chapter: 'Explore & build', title: 'Build it', action: true, target: ['[data-action="construct-sector"]:not(:disabled)', '#planet-map'], goto: 'system', assist: 'build',
    status: ctx => !ctx.selectedBuilding ? 'Choose a facility in the construction bay first.' : ctx.selection?.reason ? `Can’t build on this sector: ${ctx.selection.reason} Try another, or press SHOW ME.` : ctx.selection?.canBuild ? 'Good spot. Press BUILD HERE in the inspector.' : '',
    body: 'Select a scanned, empty sector that touches an existing building, check the cost and output in the inspector, then press <b>BUILD HERE</b>.',
    hint: 'If the button is disabled, the reason is shown below it: usually an unscanned sector, no connection, or not enough materials.',
    base: ctx => built(ctx.home), done: (ctx, base) => built(ctx.home) > base},
  {chapter: 'Explore & build', title: 'End the turn', action: true, target: ['.hud-next-turn'],
    body: 'Press <b>NEXT TURN</b>. Construction progresses, facilities produce, and the log reports what happened.',
    hint: 'New buildings take one or two turns to come online.',
    base: ctx => ctx.state.turn, done: (ctx, base) => ctx.state.turn > base},

  {chapter: 'Stay alive', title: 'Hazards and wear', target: ['.forecast-strip', '.map-inspector'],
    body: 'Storms and other hazards are <b>forecast two turns ahead</b>. Order PREPARE at least one turn before they strike to halve the damage. Buildings also wear down every turn: keep materials for upkeep and REPAIR worn facilities.',
    hint: 'A crew at 0% health is lost with its base. An uncrewed station with no power for three turns goes dark.'},
  {chapter: 'Stay alive', title: 'Open the Software room', action: true, target: ['[data-action="nav"][data-id="software"]'],
    body: 'Mars is minutes of light-time from anywhere else. When something goes wrong, only rules you wrote in advance can react. Open <b>SOFTWARE</b>.',
    hint: 'The ⌬ icon in the top bar.',
    done: ctx => ctx.tab === 'software'},
  {chapter: 'Stay alive', title: 'Flight software', target: ['.software-columns > section:first-child .rule-list', '.software-columns'], goto: 'software',
    body: 'Each planet has a tab with its own rules and two dangers of its own (Mars: dust storm and solar flare; Saturn: ring crossing and a giant polar storm). A ship carries the rules of the planet it flies to. Rules read: <b>WHEN</b> a sensor crosses a threshold, <b>FOR</b> some turns, <b>THEN</b> respond; higher rules win conflicts.',
    hint: 'Planets you never edit use the Default tab. The lab test flies your current Shipyard design, so better parts make the rules’ job easier.'},
  {chapter: 'Stay alive', title: 'Run the lab test', action: true, target: ['[data-action="software-test"]'], goto: 'software',
    body: 'Press <b>RUN LAB TEST</b> to fly your rules through this planet’s dangers (or every planet, on the Default tab).',
    hint: 'Real conditions vary from 85% to 125% of the lab test, so a narrow pass can still fail.',
    done: ctx => ctx.softwareTested},
  {chapter: 'Stay alive', title: 'Fix what fails, then save', target: ['.test-results', '.software-columns'], goto: 'software',
    body: 'Each danger shows a chart of battery and danger level, marks where your rules fired, and says what went wrong. Adjust the rules, test again, then press <b>SAVE</b>. New launches carry the saved rules.',
    hint: 'If the hint says the ship cannot make enough power, no rule will help: change the ship’s parts in the Shipyard.'},
  {chapter: 'Stay alive', title: 'Standing orders for bases', target: ['.software-columns > section:last-child', '.software-columns'], goto: 'software',
    body: 'Standing orders run at every base, every turn, top to bottom. They react inside the turn, before you could. Typical orders shelter the crew or stow solar arrays when a hazard is high.',
    hint: 'Sheltering protects people and electronics but pauses labs and drills. Save your orders when done.'},

  {chapter: 'First mission', title: 'Open the Shipyard', action: true, target: ['[data-action="nav"][data-id="planner"]'],
    body: 'Time for your first mission. Open the <b>SHIPYARD</b> to design a spacecraft.',
    hint: 'The ⌁ icon in the top bar, or DESIGN MISSION on the map.',
    done: ctx => ctx.tab === 'planner'},
  {chapter: 'First mission', title: 'Mission brief and spacecraft', target: ['.planner-form'], goto: 'planner',
    body: 'Choose where you leave from, where you go, and what you do there: <b>land</b> a base, put a station in <b>orbit</b>, or fly a <b>science survey</b>. Then pick a hull, engine, trajectory and payload modules.',
    hint: 'A first landing on Earth needs a lander hull and a Survey Station or habitat. Unneeded modules only add mass.'},
  {chapter: 'First mission', title: 'Propellant', target: ['.propellant-field'], goto: 'planner',
    body: 'Propellant lets the spacecraft brake and land when it arrives. More propellant also means a heavier spacecraft at launch.',
    hint: 'Raise it until the landing check turns green; lower it if launch mass turns red.'},
  {chapter: 'First mission', title: 'Launch checks', target: ['.check-list', '.quote-panel'], goto: 'planner',
    body: 'Python checks launch direction, launch mass and delta-v, and lab-tests your flight software against the destination. A red check means the mission will be <b>scrubbed</b>, <b>stranded</b> in orbit, or <b>fly past</b> its target.',
    hint: 'From Earth, launch windows follow the real planets (NASA GMAT data): watch the 12-turn strip for cheap transfers.'},
  {chapter: 'First mission', title: 'Launch!', action: true, target: ['[data-action="launch"]'], goto: 'planner',
    body: 'When the checks are green, press <b>AUTHORIZE LAUNCH</b> and watch the trajectory.',
    hint: 'LAUNCH ANYWAY flies a failing plan after a warning. You will see what happens, but it costs credits.',
    base: ctx => ctx.state.missions.length, done: (ctx, base) => ctx.state.missions.length > base},
  {chapter: 'First mission', title: 'Fly to arrival', target: ['.hud-next-turn'],
    body: 'Advance turns until the spacecraft arrives. The arrival plays out with your flight software, then a debrief explains exactly what happened and why.',
    hint: 'Keep building and preparing for hazards while the mission is in flight.'},

  {chapter: 'Programme', title: 'Goals and the review board', target: ['[data-action="nav"][data-id="program"]'],
    body: '<b>PROGRAMME</b> lists your goals with deadlines and rewards, upcoming hazards, and every mission debrief. Each year a review scores your science, missions, goals and crew safety, and raises or cuts your budget.',
    hint: 'Missed goals and lost bases cost budget. Completed goals pay credits immediately.'},
  {chapter: 'Programme', title: 'Research', target: ['[data-action="nav"][data-id="research"]'],
    body: 'The <b>TECH TREE</b> turns science into lasting advantages: better production and surveys, new engines and rockets, Europa landings and outer-planet platforms.',
    hint: 'Advanced projects need online labs or mission experience. Build a Research Lab early.'},
  {chapter: 'Programme', title: 'You are ready', center: true,
    body: 'Your first objectives: <b>grow Mars HQ</b>, <b>land on Earth</b>, <b>reach Venus</b>, and keep every crew above 70% health. After that, the whole solar system is open.',
    hint: 'Press ✺ any time: AURA lists what needs your attention (a red badge means something urgent) with a button to act on each. ⚙ Settings restarts this tutorial.'},
];

export function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && ['offer', 'active', 'paused', 'done'].includes(saved.status) && Number.isInteger(saved.step)) {
      return {status: saved.status, step: Math.max(0, Math.min(STEPS.length - 1, saved.step))};
    }
  } catch { /* storage unavailable */ }
  return {status: 'offer', step: 0};
}

function persist(progress) {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* storage unavailable */ }
}

/** Settings dialog markup (rendered by campaign.js inside its modal system). */
export function settingsView({tutorial, mapMotion, guideHidden}) {
  const status = {offer: 'Not started', active: `In progress · step ${tutorial.step + 1} of ${STEPS.length}`, paused: `Closed at step ${tutorial.step + 1} of ${STEPS.length}`, done: 'Completed'}[tutorial.status];
  return `<div class="modal-scrim"><section class="aura-modal compact settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div class="eyebrow">⚙ SETTINGS</div><h2 id="settings-title">Game settings</h2>
    <div class="settings-group"><div class="settings-row"><div><b>Tutorial</b><small>${esc(status)}</small></div>
      <div class="settings-actions">${tutorial.status === 'active'
        ? '<button class="button secondary" data-action="tutorial-close">CLOSE TUTORIAL</button>'
        : tutorial.status === 'paused' ? '<button class="button secondary" data-action="tutorial-resume">RESUME</button>' : ''}
      <button class="button primary" data-action="tutorial-restart">${tutorial.status === 'offer' ? 'START TUTORIAL' : 'RESTART TUTORIAL'}</button></div></div>
    <label class="settings-row settings-toggle"><div><b>First-mission guide card</b><small>The small next-step card on the map when the tutorial is off.</small></div><input type="checkbox" data-action="settings-guide" ${guideHidden ? '' : 'checked'}></label>
    <label class="settings-row settings-toggle"><div><b>Ambient map motion</b><small>Animated water, foliage and haze. Reduced-motion settings are always respected.</small></div><input type="checkbox" data-action="settings-motion" ${mapMotion ? 'checked' : ''}></label></div>
    <div class="modal-buttons"><button class="button primary" data-action="dismiss-modal">DONE</button></div></section></div>`;
}

/**
 * Create the tutorial controller. `getContext()` returns
 * {state, tab, selectedBuilding, home, softwareTested, blocked}.
 */
export function createTutorial(getContext, actions = {}) {
  let progress = loadProgress();
  let base = null, baseStep = -1, scrolledStep = -1, frame = 0, keyboard = false;
  let userPos = null, dragging = false;
  try { userPos = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch { /* storage unavailable */ }
  const savePos = () => { try { userPos ? localStorage.setItem(POS_KEY, JSON.stringify(userPos)) : localStorage.removeItem(POS_KEY); } catch { /* ignore */ } };
  const root = document.createElement('div');
  root.id = 'tutorial-root';
  document.body.append(root);

  const step = () => STEPS[progress.step];
  const save = () => persist(progress);

  function target(current) {
    for (const selector of current.target || []) {
      const el = document.querySelector(selector);
      if (el && el.getClientRects().length) return el;
    }
    return null;
  }

  function enterStep() {
    const ctx = getContext(), current = step();
    base = current.base ? current.base(ctx) : null;
    baseStep = progress.step;
    scrolledStep = -1;
  }

  function go(index) {
    progress = {status: index >= STEPS.length ? 'done' : 'active', step: Math.min(index, STEPS.length - 1)};
    save();
    if (progress.status === 'active') enterStep();
    sync();
  }

  function cardMarkup(current, el) {
    const n = progress.step, total = STEPS.length;
    const chapters = [...new Set(STEPS.map(s => s.chapter))];
    const missing = !current.center && !el;
    const waiting = current.action && !missing;
    return `<div class="tut-head" data-drag><span class="tut-grip" aria-hidden="true">⠿</span><span class="tut-chapter">CHAPTER ${chapters.indexOf(current.chapter) + 1} · ${esc(current.chapter.toUpperCase())}</span>
<button class="tut-close" data-tut="move" aria-label="Move tutorial card with arrow keys" title="Drag the top bar, or focus here and use arrow keys">✥</button><button class="tut-close" data-tut="close" aria-label="Close tutorial">✕</button></div>
      <h2 id="tut-title">${esc(current.title)}</h2>
      <p class="tut-body">${current.body}</p>
      ${current.hint ? `<p class="tut-hint"><span aria-hidden="true">💡</span> ${esc(current.hint)}</p>` : ''}
      ${current.status && current.status(getContext()) ? `<p class="tut-status">${esc(current.status(getContext()))}</p>` : ''}
      ${missing ? `<p class="tut-wait">This part of the screen is not open yet.</p>` : waiting ? `<p class="tut-wait"><span class="tut-pulse" aria-hidden="true"></span>Your turn: do this to continue.</p>` : ''}
      <div class="tut-progress" aria-hidden="true"><span style="width:${Math.round((n + 1) / total * 100)}%"></span></div>
      <div class="tut-foot"><span class="tut-count">${n + 1} / ${total}</span>
        <div class="tut-buttons">${n > 0 ? '<button class="button secondary" data-tut="back">BACK</button>' : ''}
        ${missing && current.goto ? `<button class="button primary" data-tut="goto">TAKE ME THERE</button>` : ''}
        ${!missing && current.assist && actions.suggest ? `<button class="button primary" data-tut="assist">SHOW ME</button>` : ''}
        ${current.action ? `<button class="button secondary" data-tut="next">SKIP STEP</button>` : `<button class="button primary" data-tut="next">${n === total - 1 ? 'FINISH' : 'NEXT'}</button>`}</div></div>`;
  }

  function offerMarkup() {
    return `<div class="tut-card tut-offer" role="dialog" aria-modal="false" aria-labelledby="tut-title">
      <div class="tut-head" data-drag><span class="tut-grip" aria-hidden="true">⠿</span><span class="tut-chapter">NEW COMMANDER</span><button class="tut-close" data-tut="dismiss" aria-label="Dismiss">✕</button></div>
      <h2 id="tut-title">Learn the ropes?</h2>
      <p class="tut-body">A guided tutorial walks you through exploring Mars, building, keeping crews alive, writing flight software and launching your first mission.</p>
      <p class="tut-hint"><span aria-hidden="true">💡</span> The tutorial card can be dragged out of your way by its top bar. You can restart it later from ⚙ Settings.</p>
      <div class="tut-foot"><span></span><div class="tut-buttons"><button class="button secondary" data-tut="dismiss">NOT NOW</button><button class="button primary" data-tut="start">START TUTORIAL</button></div></div></div>`;
  }

  function place(el) {
    const card = root.querySelector('.tut-card'), spot = root.querySelector('.tut-spot');
    if (!card) return;
    const vw = window.innerWidth, vh = window.innerHeight, m = 12;
    if (!el) {
      spot.style.display = 'none';
      root.classList.toggle('tut-dim', step()?.center === true || progress.status === 'offer');
      if (userPos) { pin(card); return; }
      card.style.left = `${Math.max(m, (vw - card.offsetWidth) / 2)}px`;
      card.style.top = `${Math.max(m, (vh - card.offsetHeight) / 2)}px`;
      return;
    }
    root.classList.remove('tut-dim');
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(spot.style, {display: 'block', left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`});
    if (userPos) { pin(card); return; }
    const w = card.offsetWidth, h = card.offsetHeight;
    const clampX = x => Math.max(m, Math.min(vw - w - m, x)), clampY = y => Math.max(m, Math.min(vh - h - m, y));
    // Candidates: beside the target, then calm areas of the screen. Pick the one that hides the least.
    const candidates = [
      [r.left + r.width / 2 - w / 2, r.bottom + 16], [r.left + r.width / 2 - w / 2, r.top - 16 - h],
      [r.right + 16, r.top + r.height / 2 - h / 2], [r.left - 16 - w, r.top + r.height / 2 - h / 2],
      [m, vh * .32], [vw * .3, vh * .3], [vw / 2 - w / 2, vh * .18], [m, vh - h - m], [vw - w - m, vh * .3],
      [m, m], [vw - w - m, vh - h - m], [m, vh / 2 - h / 2],
    ].map(([x, y]) => [clampX(x), clampY(y)]);
    const panel = document.querySelector('.game-screen-panel');
    const busy = (panel ? [['.topbar', 2]] : BUSY).flatMap(([sel, weight]) => [...document.querySelectorAll(sel)].map(node => [node.getBoundingClientRect(), weight]));
    // On the map, keep the middle (where the base is and where players click) clear.
    if (!panel && document.querySelector('#planet-map')) busy.push([{left: vw / 2 - 230, right: vw / 2 + 230, top: vh / 2 - 150, bottom: vh / 2 + 190}, 3]);
    const overlap = (x, y, b) => Math.max(0, Math.min(x + w, b.right) - Math.max(x, b.left)) * Math.max(0, Math.min(y + h, b.bottom) - Math.max(y, b.top));
    const target = el.matches('#planet-map') ? null : r;
    const cost = ([x, y]) => (target ? overlap(x, y, target) * 10 : 0) + busy.reduce((sum, [b, weight]) => sum + overlap(x, y, b) * weight, 0);
    const [x, y] = candidates.reduce((best, c) => cost(c) < cost(best) ? c : best);
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
  }

  function pin(card) {
    const vw = window.innerWidth, vh = window.innerHeight, m = 8;
    card.style.left = `${Math.max(m, Math.min(vw - card.offsetWidth - m, userPos.x))}px`;
    card.style.top = `${Math.max(m, Math.min(vh - 60, userPos.y))}px`;
  }

  function reposition() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (progress.status === 'active' && root.firstChild) place(step().center ? null : target(step()));
      else if (progress.status === 'offer' && root.firstChild) place(null);
    });
  }

  /** Called after every campaign render and on layout changes. */
  function sync() {
    if (dragging) return; // rebuilding now would drop the card back to its old spot
    const ctx = getContext();
    if (ctx.blocked || (progress.status !== 'active' && progress.status !== 'offer')) { root.innerHTML = ''; return; }
    if (progress.status === 'offer') {
      if (!root.querySelector('.tut-offer')) root.innerHTML = `<div class="tut-spot" aria-hidden="true"></div>${offerMarkup()}`;
      reposition();
      return;
    }
    if (baseStep !== progress.step) enterStep();
    const current = step();
    if (current.action && current.done(ctx, base)) {
      root.innerHTML = '';
      go(progress.step + 1);
      return;
    }
    const el = current.center ? null : target(current);
    if (el && scrolledStep !== progress.step) {
      scrolledStep = progress.step;
      if (!el.closest('.topbar') && !el.matches('#planet-map')) el.scrollIntoView({block: 'center', behavior: 'smooth'});
    }
    root.innerHTML = `<div class="tut-spot ${current.action ? 'is-action' : ''}" aria-hidden="true"></div><div class="tut-card" role="dialog" aria-modal="false" aria-live="polite" aria-labelledby="tut-title">${cardMarkup(current, el)}</div>`;
    place(el);
    if (keyboard) { keyboard = false; root.querySelector('[data-tut="next"],[data-tut="goto"]')?.focus({preventScroll: true}); }
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('[data-tut]');
    if (!button) return;
    keyboard = event.detail === 0;
    const what = button.dataset.tut;
    if (what === 'start') go(0);
    else if (what === 'dismiss' || what === 'close') { progress = {...progress, status: what === 'close' ? 'paused' : 'paused'}; save(); sync(); }
    else if (what === 'move') { /* focus target for arrow-key moves */ }
    else if (what === 'next') go(progress.step + 1);
    else if (what === 'back') go(Math.max(0, progress.step - 1));
    else if (what === 'assist') { if (!actions.suggest?.(step().assist)) { const note = root.querySelector('.tut-status'); if (note) note.textContent = 'No suitable sector is visible right now. Try scanning or zooming out.'; } }
    else if (what === 'goto') document.querySelector(`[data-action="nav"][data-id="${step().goto}"]`)?.click();
  });
  root.addEventListener('pointerdown', event => {
    const head = event.target.closest('[data-drag]');
    if (!head || event.target.closest('button') || event.button !== 0) return;
    const card = head.closest('.tut-card'), start = card.getBoundingClientRect();
    const dx = event.clientX - start.left, dy = event.clientY - start.top;
    head.setPointerCapture(event.pointerId);
    card.classList.add('is-dragging');
    dragging = true;
    const move = e => { userPos = {x: e.clientX - dx, y: e.clientY - dy}; pin(card); savePos(); };
    const end = () => {
      dragging = false;
      card.classList.remove('is-dragging');
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', end);
      head.removeEventListener('pointercancel', end);
      if (userPos) { savePos(); sync(); }
    };
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
    event.preventDefault();
  });
  root.addEventListener('keydown', event => {
    if (!event.target.matches('[data-tut="move"]')) return;
    const delta = {ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24]}[event.key];
    if (!delta) return;
    event.preventDefault();
    const card = root.querySelector('.tut-card'), rect = card.getBoundingClientRect();
    userPos = {x: rect.left + delta[0], y: rect.top + delta[1]};
    pin(card); savePos();
  });
  window.addEventListener('resize', reposition);
  document.addEventListener('scroll', reposition, true);

  return {
    sync,
    progress: () => ({...progress}),
    active: () => progress.status === 'active' || progress.status === 'offer',
    restart: () => go(0),
    resume: () => { progress = {...progress, status: 'active'}; save(); enterStep(); sync(); },
    close: () => { progress = {...progress, status: 'paused'}; save(); sync(); },
  };
}
