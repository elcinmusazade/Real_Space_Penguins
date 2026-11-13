/**
 * Ares: First Light — deterministic, immutable simulation.
 * All quantities are fictional game-balance values, NOT NASA mission parameters.
 * No browser, network, or DOM dependencies: this module is directly testable in Node.
 */

export const GRID_SIZE = 6;
export const RESOURCE_KEYS = Object.freeze(['energy', 'oxygen', 'water', 'food', 'materials']);
export const DEFAULT_LOADOUT = Object.freeze(['supplies', 'materials', 'battery']);
export const TERRAINS = Object.freeze({
  plain: { name: 'Basalt plain', description: 'Stable, level terrain. A good foundation for your outpost.', color: '#805547' },
  ridge: { name: 'Sunlit ridge', description: 'An exposed ridge. Solar arrays produce 25% more energy here.', color: '#a87953' },
  ice: { name: 'Subsurface ice', description: 'The rover detected buried water ice. A water extractor can operate here.', color: '#79a8ad' },
  science: { name: 'Geological site', description: 'An intriguing mineral deposit. Laboratories on or beside it gain +3 science per Sol.', color: '#9d83b1' },
  salvage: { name: 'Supply cache', description: 'A fictional earlier mission left reusable components. Scanning recovers 18 materials once.', color: '#a6a578' },
  hazard: { name: 'Unstable terrain', description: 'A fractured depression. It can be surveyed, but it is not safe for construction.', color: '#a3645d' },
});

export const BUILDINGS = Object.freeze({
  habitat: { name: 'Crew habitat', shortName: 'Habitat', description: 'Home to three astronauts. Includes basic water recovery and mission control.', cost: 0, production: { water: 1 }, consumption: { energy: 2, oxygen: 6, water: 4, food: 5 }, buildable: false },
  solar: { name: 'Solar array', shortName: 'Solar', description: 'Generates 12 energy per Sol. Sunlit ridges give +25%; dust reduces output.', cost: 14, production: { energy: 12 }, consumption: {} },
  oxygen: { name: 'Oxygen recycler', shortName: 'Life support', description: 'Produces 8 oxygen per Sol using 3 energy and 1 water.', cost: 14, production: { oxygen: 8 }, consumption: { energy: 3, water: 1 } },
  water: { name: 'Water extractor', shortName: 'Extractor', description: 'Extracts 9 water per Sol from an ice tile, using 4 energy.', cost: 16, production: { water: 9 }, consumption: { energy: 4 }, terrain: 'ice' },
  greenhouse: { name: 'Greenhouse', shortName: 'Greenhouse', description: 'Grows food in a controlled habitat. Choose a crop strategy to balance food, water, and power.', cost: 18, production: { food: 7 }, consumption: { water: 3, energy: 3 } },
  lab: { name: 'Research laboratory', shortName: 'Laboratory', description: 'Produces 5 science per Sol and unlocks research actions. Geological sites add +3 science.', cost: 20, production: { science: 5 }, consumption: { energy: 4 } },
  battery: { name: 'Battery bank', shortName: 'Battery', description: 'Stores surplus energy. Increases energy capacity by 30 when online.', cost: 10, production: {}, consumption: {} },
  shield: { name: 'Radiation shelter', shortName: 'Shelter', description: 'Protects the crew from event-related radiation and environmental damage. Uses 1 energy per Sol.', cost: 16, production: {}, consumption: { energy: 1 } },
});

export const CARGO = Object.freeze({
  supplies: { name: 'Supply reserves', description: 'Extra consumables buy time while you establish production.', cost: 20, mass: 2, benefits: ['+15 food', '+10 water', '+8 oxygen'] },
  materials: { name: 'Construction kit', description: 'Enough additional components to get essential infrastructure online.', cost: 25, mass: 3, benefits: ['+24 materials'] },
  battery: { name: 'Reserve battery', description: 'A charged reserve and a larger energy buffer for early emergencies.', cost: 20, mass: 2, benefits: ['+20 energy', '+20 energy capacity'] },
  instruments: { name: 'Science instruments', description: 'Calibrated instruments provide an early head start on the mission objective.', cost: 25, mass: 2, benefits: ['+8 science'] },
  rover: { name: 'Advanced rover', description: 'Efficient scouting and higher-quality surveys of scientific sites.', cost: 25, mass: 2, benefits: ['Scans cost 1 energy', '+3 science per geological discovery'] },
  shielding: { name: 'Shielding kit', description: 'Reduces environmental damage to the crew; does not prevent supply shortages.', cost: 30, mass: 3, benefits: ['40% less event-related crew damage'] },
});

export const CROPS = Object.freeze({
  greens: { name: 'Fast greens', description: 'Balanced growth. A steady food supply with moderate inputs.', production: { food: 7 }, consumption: { water: 3, energy: 3 } },
  starch: { name: 'Starch crops', description: 'Higher food output, but thirstier and more power-hungry.', production: { food: 10 }, consumption: { water: 5, energy: 5 } },
  legumes: { name: 'Low-input legumes', description: 'Conserves water and energy at the expense of food output.', production: { food: 5 }, consumption: { water: 2, energy: 2 } },
});

export const RESEARCH = Object.freeze({
  rover: { name: 'Efficient surveying', description: 'Reduce scans to 1 energy and gain +3 science at geological discoveries.', requiredScience: 15, cost: 10, energy: 3 },
  solar: { name: 'High-efficiency arrays', description: 'All solar arrays generate 25% more energy.', requiredScience: 25, cost: 12, energy: 3 },
  recycling: { name: 'Closed-loop recovery', description: 'The habitat recovers 2 additional water per Sol.', requiredScience: 35, cost: 10, energy: 3 },
  shielding: { name: 'Storm procedures', description: 'Reduce environmental crew damage by a further 30%.', requiredScience: 40, cost: 14, energy: 3 },
});

const EVENT_DEFINITIONS = Object.freeze({
  dust: {
    id: 'dust', title: 'Dust on the horizon', description: 'A dust front will reduce solar generation for this Sol and the next. Decide how to protect your power system.',
    choices: [
      { id: 'protect', label: 'Protect the arrays', description: 'Spend 4 materials. Keep 80% of normal solar output for two Sols.', cost: { materials: 4 } },
      { id: 'weather', label: 'Weather the storm', description: 'No immediate cost. Solar output falls to 50% for two Sols, and one array needs repair.', cost: {} },
    ],
  },
  seal: {
    id: 'seal', title: 'A leak in the habitat', description: 'A worn seal is venting breathable air. The crew can repair it, isolate the section, or improvise a temporary patch.',
    choices: [
      { id: 'repair', label: 'Replace the seal', description: 'Spend 8 materials. No loss of oxygen or crew health.', cost: { materials: 8 } },
      { id: 'isolate', label: 'Isolate the section', description: 'Spend 6 energy and 6 oxygen. Preserve the remaining supplies.', cost: { energy: 6, oxygen: 6 } },
      { id: 'patch', label: 'Improvise a patch', description: 'Lose 10 oxygen and up to 8 crew health. No materials required.', cost: {} },
    ],
  },
  samples: {
    id: 'samples', title: 'A rare sampling window', description: 'A clear weather interval reveals a promising geological exposure. Take a detailed survey or conserve power for the colony.',
    choices: [
      { id: 'detailed', label: 'Run the full survey', description: 'Spend 8 energy and gain 12 science.', cost: { energy: 8 } },
      { id: 'routine', label: 'Take a routine scan', description: 'Gain 4 science at no energy cost.', cost: {} },
    ],
  },
  radiation: {
    id: 'radiation', title: 'Solar particle alert', description: 'Mission control reports an incoming radiation event. Shelter the crew or accept a risk to finish the science programme.',
    choices: [
      { id: 'shelter', label: 'Shelter the crew', description: 'No supply cost. Laboratories pause passive science for this Sol.', cost: {} },
      { id: 'continue', label: 'Continue observations', description: 'Gain 8 science, but lose up to 18 crew health. Shielding reduces the damage.', cost: {} },
    ],
  },
});

const EVENTS_BY_SOL = Object.freeze({ 3: 'dust', 5: 'seal', 7: 'samples', 9: 'radiation' });
const emptyFlow = () => ({ energy: 0, oxygen: 0, water: 0, food: 0, materials: 0, science: 0 });
const clone = value => JSON.parse(JSON.stringify(value));
const round = value => Math.round(value * 10) / 10;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clearWeather = () => ({ name: 'Clear skies', description: 'Good visibility. Solar generation is operating normally.', solarMultiplier: 1, untilSol: null });
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const validId = id => Number.isInteger(id) && id >= 0 && id < GRID_SIZE * GRID_SIZE;

function hashSeed(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function rngFor(seed) {
  let value = hashSeed(seed);
  return () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function neighbors(id) {
  if (!validId(id)) return [];
  const x = id % GRID_SIZE, y = Math.floor(id / GRID_SIZE);
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
    .filter(([a, b]) => a >= 0 && a < GRID_SIZE && b >= 0 && b < GRID_SIZE)
    .map(([a, b]) => b * GRID_SIZE + a);
}

export function validateLoadout(loadout = []) {
  const errors = [];
  if (!Array.isArray(loadout)) return { ok: false, cost: 0, mass: 0, errors: ['Cargo must be a list of equipment IDs.'] };
  if (new Set(loadout).size !== loadout.length) errors.push('Each cargo item can be packed only once.');
  let cost = 0, mass = 0;
  for (const id of loadout) {
    if (typeof id !== 'string' || !Object.hasOwn(CARGO, id)) { errors.push('Unknown cargo item.'); continue; }
    cost += CARGO[id].cost; mass += CARGO[id].mass;
  }
  if (cost > 70) errors.push('The launch budget is 70 credits.');
  if (mass > 8) errors.push('The cargo capacity is 8 tonnes.');
  return { ok: errors.length === 0, cost, mass, errors };
}

function makeBuilding(type, onlineFrom = 1) {
  return { type, level: 1, onlineFrom, active: true, damage: 0, ...(type === 'greenhouse' ? { crop: 'greens' } : {}) };
}

export function createGame({ seed = 'ARES-01', loadout = [...DEFAULT_LOADOUT] } = {}) {
  const cargoCheck = validateLoadout(loadout);
  if (!cargoCheck.ok) throw new Error(cargoCheck.errors.join(' '));
  seed = String(seed).trim().slice(0, 64) || 'ARES-01';
  const random = rngFor(seed);
  const tiles = Array.from({ length: 36 }, (_, id) => {
    const x = id % 6, y = Math.floor(id / 6), roll = random();
    const terrain = roll < .4 ? 'plain' : roll < .57 ? 'ridge' : roll < .70 ? 'ice' : roll < .81 ? 'science' : roll < .93 ? 'salvage' : 'hazard';
    return { id, x, y, terrain, revealed: x >= 1 && x <= 3 && y >= 1 && y <= 3, collected: false, building: null };
  });
  // The starter footprint is safe, while the first vital discoveries are guaranteed.
  for (const tile of tiles) if (tile.revealed) tile.terrain = 'plain';
  tiles[14].building = makeBuilding('habitat');
  tiles[8].building = makeBuilding('solar');
  tiles[13].building = makeBuilding('oxygen');
  tiles[12].terrain = 'ice';
  tiles[2].terrain = 'science';
  tiles[15].terrain = 'ridge';
  tiles[1].terrain = 'salvage';
  tiles[7].terrain = 'plain';
  const state = {
    version: 1, seed, sol: 1, maxSols: 10, ap: 2,
    resources: { energy: 32, oxygen: 42, water: 32, food: 32, materials: 40 },
    health: 100, science: 0, goal: 70, tiles, tech: {},
    event: null, weather: clearWeather(), log: [], history: [], status: 'playing',
    loadout: [...loadout], effects: { labsPausedUntil: 0 },
    stats: { explored: 0, constructed: 0, repaired: 0, upgraded: 0, studies: 0, eventsResolved: 0 },
  };
  for (const item of loadout) {
    if (item === 'supplies') { state.resources.food += 15; state.resources.water += 10; state.resources.oxygen += 8; }
    if (item === 'materials') state.resources.materials += 24;
    if (item === 'battery') state.resources.energy += 20;
    if (item === 'instruments') state.science += 8;
  }
  state.history.push(snapshot(state, 0));
  addLog(state, 'Touchdown confirmed. Three astronauts, ten Sols, one chance to build a foothold.', 'success');
  addLog(state, 'Scout A3 for ice or C1 for a geological site. Every Sol gives you two actions.', 'info');
  return state;
}

function snapshot(state, sol = state.sol) {
  return { sol, resources: { ...state.resources }, health: state.health, science: state.science };
}

function addLog(state, text, type = 'info') {
  state.log.push({ sol: state.sol, text, type });
  state.log = state.log.slice(-120);
}

function running(state) {
  return state?.status === 'playing' ? { ok: true, reason: '' } : { ok: false, reason: 'This mission has ended. Prepare a new mission to continue.' };
}

function hasAction(state, costs = {}, points = 1) {
  const run = running(state); if (!run.ok) return run;
  if (state.ap < points) return { ok: false, reason: 'No action points remain. End the Sol to continue.' };
  for (const [resource, amount] of Object.entries(costs)) {
    if ((state.resources[resource] ?? 0) < amount) return { ok: false, reason: `Requires ${amount} ${resource}.` };
  }
  return { ok: true, reason: '' };
}

function fail(state, reason) { return { ok: false, state, message: reason }; }
function done(state, message, type = 'success') { addLog(state, message, type); return { ok: true, state, message }; }
function spend(state, costs = {}, points = 1) {
  state.ap -= points;
  for (const [key, amount] of Object.entries(costs)) state.resources[key] = round(state.resources[key] - amount);
}

function online(tile, state) {
  return !!tile?.building && tile.building.active && tile.building.onlineFrom <= state.sol && tile.building.damage < 2;
}

export function capacity(state) {
  let energy = 80 + (state.loadout.includes('battery') ? 20 : 0);
  for (const tile of state.tiles) if (online(tile, state) && tile.building.type === 'battery') energy += 30 * tile.building.level;
  return { energy, oxygen: 120, water: 120, food: 120, materials: 250, science: 1000 };
}

function capResources(state) {
  const caps = capacity(state);
  for (const key of RESOURCE_KEYS) state.resources[key] = round(clamp(state.resources[key], 0, caps[key]));
  state.health = round(clamp(state.health, 0, 100));
  state.science = round(clamp(state.science, 0, 1000));
}

export function canExplore(state, id) {
  const run = running(state); if (!run.ok) return run;
  if (!validId(id)) return { ok: false, reason: 'Select a tile within the mission sector.' };
  if (state.tiles[id].revealed) return { ok: false, reason: 'This sector has already been scanned.' };
  if (!neighbors(id).some(n => state.tiles[n].revealed)) return { ok: false, reason: 'Explore a tile bordering revealed territory first.' };
  const energy = state.loadout.includes('rover') || state.tech.rover ? 1 : 2;
  return hasAction(state, { energy });
}

export function explore(original, id) {
  const check = canExplore(original, id); if (!check.ok) return fail(original, check.reason);
  const state = clone(original), tile = state.tiles[id];
  spend(state, { energy: state.loadout.includes('rover') || state.tech.rover ? 1 : 2 });
  tile.revealed = true; state.stats.explored += 1;
  let reward = '';
  if (tile.terrain === 'salvage' && !tile.collected) { tile.collected = true; state.resources.materials += 18; reward = ' Recovered 18 materials.'; }
  if (tile.terrain === 'science' && !tile.collected) {
    tile.collected = true; const amount = 8 + (state.loadout.includes('rover') || state.tech.rover ? 3 : 0);
    state.science += amount; reward = ` Survey collected ${amount} science.`;
  }
  capResources(state);
  return done(state, `Sector ${coordinate(id)}: ${TERRAINS[tile.terrain].name} discovered.${reward}`, 'explore');
}

export function canBuild(state, type, id) {
  const run = running(state); if (!run.ok) return run;
  if (!Object.hasOwn(BUILDINGS, type) || type === 'habitat') return { ok: false, reason: 'Choose an available module from the construction bay.' };
  if (!validId(id)) return { ok: false, reason: 'Choose a tile within the mission sector.' };
  const tile = state.tiles[id];
  // Do not leak terrain information about an unexplored tile.
  if (!tile.revealed) return { ok: false, reason: 'Scan this sector before construction.' };
  if (tile.building) return { ok: false, reason: 'A module already occupies this tile.' };
  if (tile.terrain === 'hazard') return { ok: false, reason: 'Unstable ground is unsafe for construction.' };
  if (type === 'water' && tile.terrain !== 'ice') return { ok: false, reason: 'Water extractors must be placed on an ice deposit.' };
  if (!neighbors(id).some(n => state.tiles[n].building)) return { ok: false, reason: 'Build beside an existing colony module (not diagonally).' };
  return hasAction(state, { materials: BUILDINGS[type].cost });
}

export function build(original, type, id) {
  const check = canBuild(original, type, id); if (!check.ok) return fail(original, check.reason);
  const state = clone(original);
  spend(state, { materials: BUILDINGS[type].cost });
  state.tiles[id].building = makeBuilding(type, state.sol + 1); state.stats.constructed += 1;
  return done(state, `${BUILDINGS[type].name} installed in ${coordinate(id)}. Online on Sol ${state.sol + 1}.`, 'build');
}

function checkBuilding(state, id) {
  if (!validId(id) || !state.tiles[id].revealed || !state.tiles[id].building) return { ok: false, reason: 'Select an existing colony module.' };
  return running(state);
}

export function repair(original, id) {
  const check = checkBuilding(original, id); if (!check.ok) return fail(original, check.reason);
  if (original.tiles[id].building.damage === 0) return fail(original, 'This module is in good condition.');
  const cost = hasAction(original, { materials: 5 }); if (!cost.ok) return fail(original, cost.reason);
  const state = clone(original); spend(state, { materials: 5 }); state.tiles[id].building.damage = 0; state.stats.repaired += 1;
  return done(state, `${BUILDINGS[state.tiles[id].building.type].name} repaired in ${coordinate(id)}.`, 'build');
}

export function upgrade(original, id) {
  const check = checkBuilding(original, id); if (!check.ok) return fail(original, check.reason);
  const building = original.tiles[id].building;
  if (building.type === 'habitat') return fail(original, 'The crew habitat is already mission-ready.');
  if (building.level >= 2) return fail(original, 'This module is already at its maximum level.');
  if (building.onlineFrom > original.sol) return fail(original, 'Wait until this module is online before upgrading.');
  if (building.damage > 0) return fail(original, 'Repair this module before upgrading it.');
  const cost = hasAction(original, { materials: 10, energy: 3 }); if (!cost.ok) return fail(original, cost.reason);
  const state = clone(original); spend(state, { materials: 10, energy: 3 }); state.tiles[id].building.level = 2; state.stats.upgraded += 1;
  const benefit = building.type === 'battery' ? 'Energy storage increased from 30 to 60.'
    : building.type === 'shield' ? 'Environmental damage protection improved; operating energy +25%.'
    : 'Output +50%; operating inputs +25%.';
  return done(state, `${BUILDINGS[building.type].name} upgraded to level 2. ${benefit}`, 'research');
}

export function toggleBuilding(original, id) {
  const check = checkBuilding(original, id); if (!check.ok) return fail(original, check.reason);
  if (original.tiles[id].building.type === 'habitat') return fail(original, 'The crew habitat cannot be shut down.');
  const state = clone(original), b = state.tiles[id].building;
  b.active = !b.active;
  capResources(state);
  return done(state, `${BUILDINGS[b.type].name} ${b.active ? 'activated' : 'powered down'}.`, 'info');
}

export function setCrop(original, id, cropId) {
  const check = checkBuilding(original, id); if (!check.ok) return fail(original, check.reason);
  if (original.tiles[id].building.type !== 'greenhouse') return fail(original, 'Select a greenhouse to change its crop strategy.');
  if (!Object.hasOwn(CROPS, cropId)) return fail(original, 'Choose a valid crop strategy.');
  if (original.tiles[id].building.crop === cropId) return fail(original, 'This crop strategy is already selected.');
  const cost = hasAction(original); if (!cost.ok) return fail(original, cost.reason);
  const state = clone(original); spend(state); state.tiles[id].building.crop = cropId;
  return done(state, `Greenhouse in ${coordinate(id)} switched to ${CROPS[cropId].name.toLowerCase()}.`, 'build');
}

function availableLab(state) {
  return state.tiles.some(tile => tile.building?.type === 'lab' && online(tile, state));
}

export function study(original) {
  if (!availableLab(original)) return fail(original, 'Build and activate a research laboratory first.');
  if ((original.effects?.labsPausedUntil ?? 0) >= original.sol) return fail(original, 'The crew is sheltering. Research resumes next Sol.');
  const check = hasAction(original, { energy: 6 }); if (!check.ok) return fail(original, check.reason);
  const state = clone(original); spend(state, { energy: 6 }); state.science += 12; state.stats.studies += 1; capResources(state);
  return done(state, 'The crew completed an experiment. +12 science.', 'research');
}

export function researchTech(original, techId) {
  if (!Object.hasOwn(RESEARCH, techId)) return fail(original, 'Choose a valid research project.');
  if (original.tech[techId]) return fail(original, 'This technology has already been unlocked.');
  if (!availableLab(original)) return fail(original, 'An online research laboratory is required.');
  if ((original.effects?.labsPausedUntil ?? 0) >= original.sol) return fail(original, 'The crew is sheltering. Research resumes next Sol.');
  const tech = RESEARCH[techId];
  if (original.science < tech.requiredScience) return fail(original, `Requires ${tech.requiredScience} accumulated science. Science is not spent.`);
  const check = hasAction(original, { materials: tech.cost, energy: tech.energy }); if (!check.ok) return fail(original, check.reason);
  const state = clone(original); spend(state, { materials: tech.cost, energy: tech.energy }); state.tech[techId] = true;
  return done(state, `${tech.name} unlocked. ${tech.description}`, 'research');
}

// Potential rates describe an active module before resource allocation. Keep
// this separate from operationPlan so the public forecast/inspector cannot
// accidentally grant output to a module whose required inputs are unavailable.
function potentialTileOutput(state, id) {
  const tile = state.tiles[id];
  const production = emptyFlow(), consumption = emptyFlow();
  if (!tile?.building) return { production, consumption, delta: emptyFlow(), online: false, terrainBonus: '' };
  const b = tile.building, runningNow = online(tile, state);
  let terrainBonus = '';
  if (runningNow) {
    const data = b.type === 'greenhouse' ? CROPS[b.crop || 'greens'] : BUILDINGS[b.type];
    const outputFactor = (b.level === 2 ? 1.5 : 1) * (b.damage > 0 ? .5 : 1);
    const inputFactor = b.level === 2 ? 1.25 : 1;
    for (const [key, value] of Object.entries(data.production || {})) production[key] = value * outputFactor;
    for (const [key, value] of Object.entries(data.consumption || {})) consumption[key] = value * inputFactor;
    if (b.type === 'solar') {
      if (tile.terrain === 'ridge') { production.energy *= 1.25; terrainBonus = 'Sunlit ridge: solar output +25%'; }
      production.energy *= state.weather.solarMultiplier * (state.tech.solar ? 1.25 : 1);
    }
    if (b.type === 'lab') {
      if (tile.terrain === 'science' || neighbors(id).some(n => state.tiles[n].revealed && state.tiles[n].terrain === 'science')) {
        production.science += 3 * outputFactor; terrainBonus = 'Geological site: +3 science per Sol';
      }
      if ((state.effects?.labsPausedUntil ?? 0) >= state.sol) { production.science = 0; consumption.energy = 0; }
    }
    if (b.type === 'habitat' && state.tech.recycling) production.water += 2;
  }
  for (const key of Object.keys(production)) { production[key] = round(production[key]); consumption[key] = round(consumption[key]); }
  const delta = emptyFlow(); for (const key of Object.keys(delta)) delta[key] = round(production[key] - consumption[key]);
  return { production, consumption, delta, online: runningNow, terrainBonus };
}

function operationPlan(state) {
  const outputs = state.tiles.map(tile => ({ ...potentialTileOutput(state, tile.id), starved: false, reason: '' }));
  const available = { ...state.resources, science: state.science };
  const commit = output => {
    for (const key of Object.keys(emptyFlow())) available[key] = round((available[key] || 0) + output.production[key] - output.consumption[key]);
  };
  const deltaOf = output => {
    for (const key of Object.keys(output.delta)) output.delta[key] = round(output.production[key] - output.consumption[key]);
  };
  // Solar generation is available within this Sol, even if the battery starts
  // empty. Crewed life-support needs are reserved before optional industry.
  for (const tile of state.tiles) if (tile.building?.type === 'solar') commit(outputs[tile.id]);
  for (const tile of state.tiles) {
    if (tile.building?.type !== 'habitat') continue;
    const output = outputs[tile.id];
    // Crew rations are never optional; a power loss also stops water recovery.
    // Any resulting water/oxygen deficit can still be covered by the production
    // chain below before health penalties are assessed at the end of the Sol.
    if (available.energy < output.consumption.energy) {
      output.production = emptyFlow();
      output.starved = true;
      output.reason = 'Insufficient energy for habitat water recovery; crew consumption still applies.';
      output.online = false;
      deltaOf(output);
    }
    commit(output);
  }
  // Stable priority and tile-ID ordering make every outcome reproducible:
  // water supports oxygen and crops; food/life support take priority over labs.
  for (const type of ['water', 'oxygen', 'greenhouse', 'lab', 'shield', 'battery']) {
    for (const tile of state.tiles) {
      if (tile.building?.type !== type) continue;
      const output = outputs[tile.id];
      if (!output.online) continue;
      const missing = Object.entries(output.consumption).filter(([key, amount]) => amount > 0 && available[key] < amount);
      if (missing.length) {
        output.starved = true;
        output.reason = `Insufficient ${missing.map(([key, amount]) => `${key} (needs ${amount}, available ${Math.max(0, round(available[key]))})`).join(' and ')}.`;
        output.production = emptyFlow();
        output.consumption = emptyFlow();
        output.delta = emptyFlow();
        output.online = false;
      } else commit(output);
    }
  }
  return outputs;
}

export function getTileOutput(state, id) {
  if (!validId(id)) return { production: emptyFlow(), consumption: emptyFlow(), delta: emptyFlow(), online: false, terrainBonus: '', starved: false, reason: '' };
  return operationPlan(state)[id];
}

export function forecast(state) {
  const production = emptyFlow(), consumption = emptyFlow(), delta = emptyFlow(), warnings = [];
  const outputs = operationPlan(state);
  for (const tile of state.tiles) {
    const output = outputs[tile.id];
    for (const key of Object.keys(delta)) { production[key] += output.production[key]; consumption[key] += output.consumption[key]; }
    if (output.starved) warnings.push(`${BUILDINGS[tile.building.type].name} in ${coordinate(tile.id)} is idle. ${output.reason}`);
  }
  for (const key of Object.keys(delta)) {
    production[key] = round(production[key]); consumption[key] = round(consumption[key]);
    delta[key] = round(production[key] - consumption[key]);
    if (key !== 'science' && state.resources[key] + delta[key] < 0) warnings.push(`${key[0].toUpperCase() + key.slice(1)} will run out this Sol.`);
  }
  const caps = capacity(state);
  if (state.resources.energy + delta.energy > caps.energy) warnings.push('Surplus energy exceeds storage capacity. A battery can save it.');
  if (state.event) warnings.push('Resolve the mission event before ending this Sol.');
  return { delta, production, consumption, warnings };
}

export function eventChoiceStatus(state, choiceId) {
  const run = running(state); if (!run.ok) return run;
  if (!state.event || !EVENT_DEFINITIONS[state.event.id]) return { ok: false, reason: 'There is no pending mission event.' };
  const choice = EVENT_DEFINITIONS[state.event.id].choices.find(c => c.id === choiceId);
  if (!choice) return { ok: false, reason: 'Choose an available event response.' };
  return hasAction(state, choice.cost, 0);
}

function environmentalDamage(state, damage) {
  let factor = state.loadout.includes('shielding') ? .6 : 1;
  if (state.tech.shielding) factor *= .7;
  const outputs = operationPlan(state);
  const shelters = state.tiles.filter(t => t.building?.type === 'shield' && outputs[t.id].online);
  if (shelters.length) factor *= shelters.some(t => t.building.level === 2) ? .4 : .6;
  const actual = Math.round(damage * factor); state.health -= actual; return actual;
}

export function chooseEvent(original, choiceId) {
  const check = eventChoiceStatus(original, choiceId); if (!check.ok) return fail(original, check.reason);
  const state = clone(original), eventId = state.event.id;
  const choice = EVENT_DEFINITIONS[eventId].choices.find(c => c.id === choiceId);
  spend(state, choice.cost, 0);
  let effect = '';
  if (eventId === 'dust') {
    const multiplier = choiceId === 'protect' ? .8 : .5;
    state.weather = { name: 'Dust front', description: `Solar arrays generate ${multiplier * 100}% of normal output through Sol ${state.sol + 1}.`, solarMultiplier: multiplier, untilSol: state.sol + 1 };
    effect = `Solar output ${Math.round(multiplier * 100)}% through Sol ${state.sol + 1}.`;
    if (choiceId === 'weather') {
      const array = state.tiles.find(tile => tile.building?.type === 'solar' && online(tile, state));
      if (array) { array.building.damage = Math.min(2, array.building.damage + 1); effect += ` The array in ${coordinate(array.id)} is damaged; repair it to restore full output.`; }
    }
  }
  if (eventId === 'seal') {
    if (choiceId === 'patch') { state.resources.oxygen -= 10; const damage = environmentalDamage(state, 8); effect = `Lost 10 oxygen and ${damage} crew health.`; }
    else effect = choiceId === 'repair' ? 'The habitat is sealed with no supply loss.' : 'Spent 6 energy and 6 oxygen to isolate the section.';
  }
  if (eventId === 'samples') { const points = choiceId === 'detailed' ? 12 : 4; state.science += points; effect = `Collected ${points} science.`; }
  if (eventId === 'radiation') {
    if (choiceId === 'shelter') { state.effects.labsPausedUntil = state.sol; effect = 'Crew protected. Laboratory science pauses this Sol.'; }
    else { state.science += 8; const damage = environmentalDamage(state, 18); effect = `Collected 8 science. Crew health −${damage}.`; }
  }
  state.event = null; state.stats.eventsResolved += 1; capResources(state);
  if (state.health <= 0) { state.status = 'failed'; state.ap = 0; }
  return done(state, `${choice.label}. ${effect}`, 'event');
}

export function advanceSol(original) {
  const run = running(original); if (!run.ok) return fail(original, run.reason);
  if (original.event) return fail(original, 'Resolve the pending mission event before ending the Sol.');
  const state = clone(original), report = forecast(state), shortage = [];
  // Resolve this Sol using only modules already online at its start. New modules
  // become active on the next numbered Sol, never the turn they were placed.
  for (const key of RESOURCE_KEYS) {
    const raw = state.resources[key] + report.delta[key];
    if (raw < 0 && ['energy', 'oxygen', 'water', 'food'].includes(key)) shortage.push(key);
    state.resources[key] = raw;
  }
  state.science += report.delta.science;
  const penalties = { energy: 10, oxygen: 22, water: 18, food: 12 };
  const damage = shortage.reduce((total, key) => total + penalties[key], 0);
  if (damage) { state.health -= damage; addLog(state, `Supply shortage: ${shortage.join(', ')}. Crew health −${damage}.`, 'danger'); }
  else if (state.health < 100) state.health += 2;
  capResources(state);
  state.history.push(snapshot(state));
  addLog(state, `Sol ${state.sol} complete. Science ${state.science}/${state.goal}; crew health ${state.health}%.`, damage ? 'warning' : 'info');
  if (state.health <= 0) { state.status = 'failed'; state.ap = 0; return done(state, 'Critical life-support failure. The mission has ended.', 'danger'); }
  if (state.sol >= state.maxSols) {
    state.status = state.science >= state.goal ? 'success' : 'partial'; state.ap = 0;
    return done(state, state.status === 'success' ? 'Mission complete. The crew survived and achieved the science objective.' : 'Crew recovered safely. The science objective remains incomplete.', state.status === 'success' ? 'success' : 'warning');
  }
  state.sol += 1; state.ap = 2;
  if (state.weather.untilSol !== null && state.sol > state.weather.untilSol) state.weather = clearWeather();
  const eventId = EVENTS_BY_SOL[state.sol];
  if (eventId) { state.event = clone(EVENT_DEFINITIONS[eventId]); addLog(state, `Mission event: ${state.event.title}.`, 'event'); }
  return { ok: true, state, message: `Sol ${state.sol}. Two actions available.` };
}

export function coordinate(id) {
  return validId(id) ? `${String.fromCharCode(65 + id % 6)}${Math.floor(id / 6) + 1}` : '—';
}

export function summarize(state) {
  const discovered = state.tiles.filter(t => t.revealed).length;
  const buildings = state.tiles.filter(t => t.building).length;
  const solsCompleted = Math.max(0, state.history.length - 1);
  const scienceScore = Math.min(400, Math.round(state.science / state.goal * 400));
  const healthScore = Math.round(state.health * 3);
  const explorationScore = Math.round((discovered - 9) / 27 * 150);
  const infrastructureScore = Math.min(150, (buildings - 3) * 25);
  const score = Math.max(0, scienceScore + healthScore + explorationScore + infrastructureScore);
  const title = state.status === 'success' ? 'A foothold on Mars' : state.status === 'partial' ? 'The crew comes home' : state.status === 'failed' ? 'Signal lost' : 'Mission in progress';
  return {
    score, title, grade: score >= 850 ? 'S' : score >= 700 ? 'A' : score >= 550 ? 'B' : score >= 400 ? 'C' : 'D',
    description: state.status === 'success' ? 'You balanced engineering, exploration, and life support to complete the mission.' : state.status === 'partial' ? 'Your astronauts survived. A stronger research programme will complete the next mission.' : state.status === 'failed' ? 'Review the supply history, change the loadout, and try a new approach.' : 'Keep the crew alive and reach the science target by the end of Sol 10.',
    science: state.science, goal: state.goal, health: state.health, discovered, buildings, solsCompleted,
    totalTiles: 36, scienceScore, healthScore, explorationScore, infrastructureScore,
    objectiveProgress: Math.min(1, state.science / state.goal), stats: { ...state.stats },
  };
}

export function validateSave(input) {
  try {
    const value = typeof input === 'string' ? JSON.parse(input) : input;
    if (!value || typeof value !== 'object' || value.version !== 1) throw new Error('This save uses an unsupported version.');
    if (typeof value.seed !== 'string' || value.seed.length > 64) throw new Error('The save has an invalid mission seed.');
    if (!Number.isInteger(value.sol) || value.sol < 1 || value.sol > 10 || value.maxSols !== 10) throw new Error('The save has an invalid Sol.');
    if (!Number.isInteger(value.ap) || value.ap < 0 || value.ap > 2) throw new Error('The save has invalid action points.');
    if (!['playing', 'success', 'partial', 'failed'].includes(value.status)) throw new Error('The save has an invalid mission status.');
    if (!isFiniteNumber(value.health) || value.health < 0 || value.health > 100 || !isFiniteNumber(value.science) || value.science < 0 || value.science > 1000 || value.goal !== 70) throw new Error('The save has invalid crew or science values.');
    if (!validateLoadout(value.loadout).ok) throw new Error('The save has an invalid cargo configuration.');
    if (!value.resources || RESOURCE_KEYS.some(key => !isFiniteNumber(value.resources[key]) || value.resources[key] < 0 || value.resources[key] > 1000)) throw new Error('The save contains invalid resource values.');
    if (!Array.isArray(value.tiles) || value.tiles.length !== 36) throw new Error('The save has an invalid map.');
    for (let id = 0; id < 36; id++) {
      const tile = value.tiles[id];
      if (!tile || tile.id !== id || tile.x !== id % 6 || tile.y !== Math.floor(id / 6) || !Object.hasOwn(TERRAINS, tile.terrain) || typeof tile.revealed !== 'boolean' || typeof tile.collected !== 'boolean') throw new Error('The save contains a malformed tile.');
      const b = tile.building;
      if (b !== null && (!b || !Object.hasOwn(BUILDINGS, b.type) || ![1, 2].includes(b.level) || !Number.isInteger(b.onlineFrom) || b.onlineFrom < 1 || b.onlineFrom > 11 || typeof b.active !== 'boolean' || ![0, 1, 2].includes(b.damage) || (b.type === 'greenhouse' && !Object.hasOwn(CROPS, b.crop)))) throw new Error('The save contains a malformed building.');
    }
    if (value.tiles.filter(t => t.building?.type === 'habitat').length !== 1) throw new Error('The save must contain one crew habitat.');
    if (!value.weather || typeof value.weather.name !== 'string' || typeof value.weather.description !== 'string' || !isFiniteNumber(value.weather.solarMultiplier) || value.weather.solarMultiplier < 0 || value.weather.solarMultiplier > 1 || (value.weather.untilSol !== null && (!Number.isInteger(value.weather.untilSol) || value.weather.untilSol < 1 || value.weather.untilSol > 11))) throw new Error('The save has invalid weather.');
    if (value.event !== null && (!value.event || !Object.hasOwn(EVENT_DEFINITIONS, value.event.id))) throw new Error('The save has an invalid event.');
    if (!value.tech || typeof value.tech !== 'object' || Object.entries(value.tech).some(([key, enabled]) => !Object.hasOwn(RESEARCH, key) || typeof enabled !== 'boolean')) throw new Error('The save has invalid technology.');
    if (!Array.isArray(value.log) || !Array.isArray(value.history) || value.log.length > 120 || value.history.length > 11) throw new Error('The save has an invalid mission history.');
    const state = clone(value);
    state.effects = { labsPausedUntil: Number.isInteger(state.effects?.labsPausedUntil) ? clamp(state.effects.labsPausedUntil, 0, 10) : 0 };
    state.stats = Object.fromEntries(['explored', 'constructed', 'repaired', 'upgraded', 'studies', 'eventsResolved'].map(key => [key, Number.isInteger(state.stats?.[key]) ? clamp(state.stats[key], 0, 1000) : 0]));
    state.log = state.log.filter(entry => entry && Number.isInteger(entry.sol) && typeof entry.text === 'string' && typeof entry.type === 'string').map(entry => ({ sol: entry.sol, text: entry.text.slice(0, 500), type: entry.type }));
    state.history = state.history.filter(entry => entry && Number.isInteger(entry.sol) && isFiniteNumber(entry.health) && isFiniteNumber(entry.science) && entry.resources && RESOURCE_KEYS.every(key => isFiniteNumber(entry.resources[key])));
    if (state.event) state.event = clone(EVENT_DEFINITIONS[state.event.id]);
    capResources(state);
    return { ok: true, state, error: null };
  } catch (error) {
    return { ok: false, state: null, error: error instanceof Error ? error.message : 'This save could not be loaded.' };
  }
}
