/**
 * Browser adapter for the Python edition.
 *
 * Read-only UI projections (labels, forecasts, construction highlights) reuse
 * the original JS view helpers. Every state-changing command goes to Python.
 * There is deliberately no browser-side simulation fallback.
 */
export * from './engine-view.js';

let inFlight = false;

async function post(path, payload) {
  if (inFlight) throw new Error('Mission control is processing your previous command.');
  inFlight = true;
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Mission server rejected the request.');
    return result;
  } catch (error) {
    throw new Error(error instanceof TypeError ? 'Cannot reach the Python mission server. Check that it is running.' : error.message);
  } finally {
    inFlight = false;
  }
}

async function action(name, state, ...args) {
  try {
    return await post('/api/action', { action: name, state, args });
  } catch (error) {
    return { ok: false, state, message: error.message };
  }
}

export async function createGame({seed, loadout}) {
  const response = await post('/api/new', { seed, loadout });
  return response.state;
}

export const explore = (state, id) => action('explore', state, id);
export const build = (state, type, id) => action('build', state, type, id);
export const repair = (state, id) => action('repair', state, id);
export const upgrade = (state, id) => action('upgrade', state, id);
export const toggleBuilding = (state, id) => action('toggleBuilding', state, id);
export const setCrop = (state, id, crop) => action('setCrop', state, id, crop);
export const study = state => action('study', state);
export const researchTech = (state, tech) => action('researchTech', state, tech);
export const chooseEvent = (state, choice) => action('chooseEvent', state, choice);
export const advanceSol = state => action('advanceSol', state);
