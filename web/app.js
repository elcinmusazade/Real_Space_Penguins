import * as Engine from './bridge.js';
import { icon, terrainArt, buildingArt, planetArt } from './art.js';
import { SCIENCE_NOTES, SOURCES, FIELD_GUIDE, SIMULATION_NOTICE } from './science.js';

const app = document.querySelector('#app');
const SAVE_KEY = 'ares-first-light.mission.v1';
const PREF_KEY = 'ares-first-light.preferences.v1';
const BEST_KEY = 'ares-first-light.best.v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt = value => Number.isInteger(Number(value)) ? String(value) : Number(value).toFixed(1);
const signed = value => `${value > 0 ? '+' : ''}${fmt(value)}`;
const titleCase = value => value[0].toUpperCase() + value.slice(1);
const pad = value => String(value).padStart(2, '0');
const resourceConfig = {
  oxygen: { name: 'Oxygen', color: '#9abdc4' },
  energy: { name: 'Energy', color: '#e8bf78' },
  water: { name: 'Water', color: '#82afb9' },
  food: { name: 'Food', color: '#a8bd8c' },
  materials: { name: 'Materials', color: '#b7a798' },
  science: { name: 'Science', color: '#b8a5c9' },
};
const moduleIcons = { habitat: 'health', solar: 'sun', oxygen: 'oxygen', water: 'water', greenhouse: 'food', lab: 'science', battery: 'energy', shield: 'shield' };
const cargoIcons = { supplies: 'cargo', materials: 'build', battery: 'energy', instruments: 'science', rover: 'scan', shielding: 'shield' };
const benefitLines = { solar: '+12 ENERGY / SOL', oxygen: '+8 OXYGEN / SOL', water: '+9 WATER / SOL', greenhouse: '+7 FOOD / SOL', lab: '+5 SCIENCE / SOL', battery: '+30 ENERGY CAPACITY', shield: 'REDUCES CREW DAMAGE' };
let game = null;
let phase = 'setup';
let cargo = [...Engine.DEFAULT_LOADOUT];
let seed = makeSeed();
let selectedTile = 14;
let selectedBuild = null;
let buildTab = 'build';
let modal = null;
let sounds = false;
let tutorial = true;
let storageAvailable = true;
let audioContext;
let previousFocus = null;
let launchTimer;

function makeSeed() { return `ARES-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; }
function readStorage(key) { try { return localStorage.getItem(key); } catch { storageAvailable = false; return null; } }
function writeStorage(key, value) { try { localStorage.setItem(key, value); return true; } catch { storageAvailable = false; return false; } }

function saveGame() {
  if (!game) return;
  const ok = writeStorage(SAVE_KEY, JSON.stringify(game));
  if (!ok) toast('Browser storage is unavailable. Export your mission from the log to keep it.', true);
}

function loadGame() {
  const raw = readStorage(SAVE_KEY);
  if (!raw) return;
  const result = Engine.validateSave(raw);
  if (result.ok) { game = result.state; phase = 'game'; if (game.status !== 'playing') modal = { type: 'result' }; }
  else toast('The saved mission could not be restored. You can begin a new mission.', true);
}

function toast(message, error = false) {
  const node = document.createElement('div');
  node.className = `toast${error ? ' error' : ''}`;
  node.innerHTML = `${icon(error ? 'help' : 'check', 16)}<span>${esc(message)}</span>`;
  document.querySelector('#toast-root').append(node);
  setTimeout(() => node.remove(), error ? 5600 : 4200);
}

function playTone(kind = 'click') {
  if (!sounds) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    const t = audioContext.currentTime;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(kind === 'scan' ? 620 : kind === 'turn' ? 280 : 420, t);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'scan' ? 950 : 210, t + .12);
    gain.gain.setValueAtTime(.025, t); gain.gain.exponentialRampToValueAtTime(.001, t + .16);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(t); oscillator.stop(t + .17);
  } catch { /* Audio is optional; gameplay never depends on it. */ }
}

async function applyResult(pendingResult, kind = 'click') {
  const result = await pendingResult;
  if (!result.ok) { toast(result.message, true); return false; }
  game = result.state;
  saveGame(); playTone(kind); render();
  toast(result.message);
  if (game.status !== 'playing') { recordBest(); openModal({type:'result'}); }
  return true;
}

function recordBest() {
  const result = Engine.summarize(game);
  const old = Number(readStorage(BEST_KEY)) || 0;
  if (result.score > old) writeStorage(BEST_KEY, String(result.score));
}

function header(active = 'mission') {
  return `<header class="topbar">
    <button class="brand" data-action="brand" aria-label="Ares First Light mission control">
      <span class="brand-emblem"><svg viewBox="0 0 30 30" width="25" height="25" aria-hidden="true"><path d="M4 25 15 4l11 21-11-6Z" fill="currentColor"/><path d="m15 10 4 10-4-2-4 2Z" fill="#25201c"/></svg></span>
      <span><span class="brand-title">ARES</span><span class="brand-sub" style="display:block">FIRST LIGHT</span></span>
    </button>
    <nav class="topnav" aria-label="Main navigation">
      <button data-action="mission" class="${active === 'mission' ? 'active' : ''}">Mission control</button>
      <button data-action="journal">Mission log</button>
      <button data-action="manual">Field manual</button>
      <button data-action="faults">Fault lab</button>
    </nav>
    <div class="top-right">
      <span class="save-label">${icon('save', 12)} ${phase === 'game' ? (storageAvailable ? 'MISSION SAVED' : 'LOCAL SESSION') : 'FLIGHT SYSTEMS READY'}</span>
      <button class="icon-btn sound-toggle" data-action="sound" title="${sounds ? 'Mute game sounds' : 'Enable game sounds'}" aria-label="${sounds ? 'Mute game sounds' : 'Enable game sounds'}">${icon(sounds ? 'volume' : 'muted', 15)}</button>
      <button class="icon-btn" data-action="manual" title="How to play" aria-label="How to play">${icon('help', 16)}</button>
      ${phase === 'game' ? `<button class="icon-btn" data-action="new" title="New mission" aria-label="New mission">${icon('reset',16)}</button>` : ''}
    </div>
  </header>`;
}

function footer() {
  return `<footer class="footer"><span>ARES FIRST LIGHT &nbsp; / &nbsp; PYTHON SIMULATION EDITION</span><span><button data-action="sources">NASA sources & simulation notes</button> &nbsp; · &nbsp; V2.0 PY</span></footer>`;
}

function renderSetup() {
  const check = Engine.validateLoadout(cargo);
  return `<div class="app-shell">${header()}
    <main class="setup">
      <section class="setup-hero" aria-labelledby="setup-hero-title">
        <div class="planet-wrap">${planetArt()}</div>
        <div class="setup-hero-content"><div class="hero-kicker"><span class="dot"></span> MISSION ARES-01 · MARS</div>
          <h1 id="setup-hero-title">A new world.<br>Your <span>first light.</span></h1>
          <p class="hero-description">Three astronauts. Ten Sols. Build a foothold on Mars—and make every decision count.</p>
        </div>
        <div class="hero-footer"><div><strong>03</strong><span>CREW MEMBERS</span></div><div><strong>10</strong><span>SOLS TO SURVIVE</span></div><div><strong>70</strong><span>SCIENCE OBJECTIVE</span></div></div>
      </section>
      <section class="setup-config" aria-labelledby="cargo-heading">
        <div class="setup-title"><div><div class="eyebrow">PRE-FLIGHT CHECKLIST</div><h2 id="cargo-heading" style="margin-top:7px">Pack for the unknown.</h2></div><span class="tag orange">01 / MISSION PREP</span></div>
        <p class="setup-intro">Your habitat, solar array, oxygen recycler, and scout rover are included. Choose the extra cargo that shapes your strategy.</p>
        <div class="cargo-grid">${Object.entries(Engine.CARGO).map(([id,c]) => `<button class="cargo-card ${cargo.includes(id) ? 'selected' : ''}" data-action="cargo" data-id="${id}" aria-pressed="${cargo.includes(id)}" aria-label="${esc(c.name)}. ${c.cost} credits, ${c.mass} tonnes. ${esc(c.benefits.join(', '))}">
          ${icon(cargoIcons[id],21)}<span class="cargo-check">${icon('check',11)}</span><div class="cargo-name">${esc(c.name)}</div><div class="cargo-description">${esc(c.benefits.join(' · '))}</div><div class="cargo-bottom"><span>${c.cost} CREDITS</span><span>${c.mass} t</span></div></button>`).join('')}</div>
        <div class="loadout-meters">${loadoutMeter('Launch budget',check.cost,70,'cr')}${loadoutMeter('Payload mass',check.mass,8,'t')}</div>
        ${!check.ok ? `<p class="red" style="font-size:10px;margin:0 0 13px">${esc(check.errors.join(' '))}</p>` : ''}
        <button class="btn btn-primary btn-full launch-btn" data-action="launch" ${!check.ok ? 'disabled' : ''}>${icon('rocket',17)} Launch mission ${icon('arrow',17)}</button>
        <p class="setup-note">Turn-based strategy. No timer. Your progress saves on this device.</p>
        <div class="setup-small-actions"><button class="text-btn" data-action="balanced">Use balanced loadout</button><button class="text-btn" data-action="manual">Read field manual</button>${game ? `<button class="text-btn" data-action="continue">Resume Sol ${game.sol}</button>` : ''}</div>
      </section>
    </main>${footer()}</div>`;
}

function loadoutMeter(label,value,max,unit) {
  return `<div class="loadout-meter ${value>max?'over':''}"><div><span>${label}</span><b>${value}<span class="muted"> / ${max} ${unit}</span></b></div><div class="loadout-bar"><div style="width:${Math.min(100,value/max*100)}%"></div></div></div>`;
}

function renderResources() {
  const f = Engine.forecast(game), caps = Engine.capacity(game);
  return `<section class="resources" aria-label="Colony resources and end of Sol forecast">${Object.entries(resourceConfig).map(([id,c]) => {
    const value = id === 'science' ? game.science : game.resources[id], cap = id === 'science' ? game.goal : caps[id], d=f.delta[id] || 0;
    const warning = id !== 'science' && id !== 'materials' && value+d < 8;
    return `<div class="resource ${warning?'low':''}" style="--resource-color:${c.color}" title="${esc(c.name)}: ${fmt(value)}. Expected change at End Sol: ${signed(d)}. Newly built modules do not produce this Sol.">
      <div class="resource-label">${icon(id,14)} ${c.name}</div><div class="resource-values"><span class="resource-value">${fmt(value)}</span><span class="resource-cap">/ ${cap}</span><span class="resource-delta ${d<0?'negative':''}">${signed(d)}<span style="font-size:7px"> /sol</span></span></div><div class="resource-track"><div class="resource-fill" style="width:${Math.min(100,value/cap*100)}%"></div></div></div>`;
  }).join('')}</section>`;
}

function renderConstruction() {
  const playing = game.status === 'playing';
  const hasLab=game.tiles.some(t=>t.building?.type==='lab' && Engine.getTileOutput(game,t.id).online);
  return `<section class="panel build-panel"><div class="panel-head"><h2>Colony systems</h2><small>${game.tiles.filter(t=>t.building).length} MODULES</small></div>
    <div class="tabs" role="tablist" aria-label="Colony actions"><button role="tab" aria-selected="${buildTab==='build'}" class="${buildTab==='build'?'active':''}" data-action="tab" data-id="build">${icon('build',12)} &nbsp; Build</button><button role="tab" aria-selected="${buildTab==='research'}" class="${buildTab==='research'?'active':''}" data-action="tab" data-id="research">${icon('research',12)} &nbsp; Research</button></div>
    ${buildTab==='build' ? `<div class="build-list">${Object.entries(Engine.BUILDINGS).filter(([id])=>id!=='habitat').map(([id,b])=>`<button class="build-card ${selectedBuild===id?'selected':''}" data-action="select-build" data-id="${id}" aria-pressed="${selectedBuild===id}" ${!playing?'disabled':''} title="${esc(b.description)} Cost: ${b.cost} materials, 1 action."><span class="module-icon">${icon(moduleIcons[id],19)}</span><span><span class="module-title">${esc(b.shortName || b.name)}</span><span class="module-benefit" style="display:block">${benefitLines[id]}</span></span><span class="module-cost">${b.cost}<small>MAT</small></span></button>`).join('')}</div>
    <div class="panel-foot">${icon('help',11)} Select a module, then a highlighted tile. Construction uses 1 action.</div>` : `<div class="research-list"><div class="research-card"><h3>Run an experiment</h3><p>Use your laboratory to turn the crew's time and power into progress.</p><button class="btn btn-primary btn-sm" data-action="study" ${!playing||!hasLab||game.ap<1||game.resources.energy<6?'disabled':''}>${icon('science',13)} +12 science · 1 AP · 6 energy</button>${!hasLab?'<p style="margin:7px 0 0;font-size:8px">Requires an online laboratory.</p>':''}</div>
    ${Object.entries(Engine.RESEARCH).map(([id,r])=>`<div class="research-card"><h3>${esc(r.name)} ${game.tech[id]?'<span class="green">✓</span>':''}</h3><p>${esc(r.description)}</p><button class="btn btn-sm" data-action="research" data-id="${id}" ${!playing||game.tech[id]||!hasLab||game.science<r.requiredScience||game.ap<1||game.resources.materials<r.cost||game.resources.energy<r.energy?'disabled':''}>${game.tech[id]?'Researched':game.science<r.requiredScience?`${r.requiredScience} science required`:`${r.cost} MAT · 3 energy · 1 AP`}</button></div>`).join('')}</div><div class="panel-foot">Science unlocks technologies but is never spent. Your mission progress is preserved.</div>`}
  </section>`;
}

function renderMap() {
  const known = game.tiles.filter(t=>t.revealed).length;
  const cells=[...game.tiles].sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.x-b.x).map(tile=>{
    const x=350+(tile.x-tile.y)*46, y=96+(tile.x+tile.y)*25;
    const frontier=!tile.revealed && Engine.neighbors(tile.id).some(id=>game.tiles[id].revealed);
    const buildable=selectedBuild && Engine.canBuild(game,selectedBuild,tile.id).ok;
    const terrain=tile.revealed?tile.terrain:null;
    const colors={plain:'#604638',ridge:'#76533b',ice:'#536c6c',science:'#625343',salvage:'#62604a',hazard:'#704b40'};
    const base=terrain?colors[terrain]:'#222429';
    const label=tile.revealed?`${Engine.coordinate(tile.id)}, ${Engine.TERRAINS[tile.terrain].name}${tile.building?`, ${Engine.BUILDINGS[tile.building.type].name}`:''}`:`${Engine.coordinate(tile.id)}, unexplored${frontier?', click to scan':''}`;
    const operational=tile.building?Engine.getTileOutput(game,tile.id):null;
    return `<g class="tile ${tile.revealed?'revealed':'fog'} ${frontier?'frontier':''} ${selectedTile===tile.id?'selected':''} ${buildable?'buildable':''}" transform="translate(${x},${y})" data-action="tile" data-id="${tile.id}" role="button" tabindex="0" aria-label="${esc(label)}">
      <title>${esc(label)}</title><path d="M-44 0 0 24 44 0 44 8 0 32-44 8Z" fill="${tile.revealed?'#352a23':'#17191d'}" stroke="#161719" stroke-width="1"/>
      <polygon class="face" points="0,-24 44,0 0,24 -44,0" fill="${base}" stroke="${tile.revealed?'#96745566':'#34363b'}" stroke-width=".8"/>
      <g class="tile-decoration">${tile.revealed?terrainArt(tile.terrain,tile.id):`<path d="M-6 0H6M0-6V6" stroke="${frontier?'#8b7865':'#45474d'}" stroke-width=".8"/><circle cx="0" cy="0" r="10" fill="none" stroke="${frontier?'#6e6052':'#35373d'}" stroke-width=".5" stroke-dasharray="2 2"/>`}
      ${tile.building?buildingArt(tile.building.type,{level:tile.building.level,active:operational.online,damage:tile.building.damage}):''}
      <text class="tile-coordinate" x="0" y="18" text-anchor="middle">${Engine.coordinate(tile.id)}</text>
      ${tile.building&&tile.building.onlineFrom>game.sol?`<rect x="-16" y="-49" width="32" height="12" rx="3" fill="#f1bd7d"/><text x="0" y="-41" text-anchor="middle" fill="#2a2016" font-size="6" font-family="monospace">SOL ${tile.building.onlineFrom}</text>`:''}
      ${buildable?`<circle cx="0" cy="-3" r="9" fill="#b4d3a9" opacity=".92"/><path d="M-4-3H4M0-7V1" stroke="#283526" stroke-width="1.3"/>`:''}</g></g>`;
  }).join('');
  return `<section class="panel map-panel" aria-label="Interactive colony map">
    <div class="map-toolbar"><h2>${icon('map',14)} Arcadia sector <span class="tag" style="margin-left:6px;font-size:7px">6 × 6</span></h2><span class="seed">${esc(game.seed)} &nbsp;·&nbsp; ${known}/36 SURVEYED</span><button class="icon-btn" data-action="map-help" aria-label="Map controls" title="Map controls" style="width:26px;height:26px">${icon('help',13)}</button></div>
    <div class="map-scene"><div class="tile-tooltip">${icon(selectedBuild?'build':'scan',13)}${selectedBuild?`Place ${esc(Engine.BUILDINGS[selectedBuild].shortName)} <button data-action="cancel-build" class="icon-btn" style="pointer-events:auto;width:20px;height:20px;border:0" aria-label="Cancel construction">${icon('close',12)}</button>`:'Click a frontier tile to scan'}</div>
      <div class="map-compass">N<svg width="23" height="27" viewBox="0 0 23 27" aria-hidden="true"><path d="m12 2 7 19-7-5-7 5Z" fill="none" stroke="currentColor"/><path d="M12 2V16" stroke="currentColor"/></svg></div>
      <svg class="map-svg" viewBox="50 10 600 410" aria-label="Mars colony sector map" role="group"><ellipse cx="350" cy="342" rx="255" ry="54" fill="#000" opacity=".18"/>${cells}</svg>
      <div class="map-scale">100 m / tile*</div><div class="map-mode"><span class="dot"></span> ${selectedBuild?'CONSTRUCTION MODE':'SURFACE VIEW'}</div>
    </div>
    <div class="map-legend"><span><i class="legend-swatch terrain-ridge"></i> Sunlit ridge</span><span><i class="legend-swatch terrain-ice"></i> Ice</span><span><i class="legend-swatch terrain-science"></i> Science</span><span><i class="legend-swatch terrain-hazard"></i> Unstable</span></div>
    <div class="turnbar"><div class="action-display"><div class="action-pips">${[0,1].map(i=>`<span class="action-pip ${i>=game.ap?'used':''}">${icon('energy',13)}</span>`).join('')}</div><div class="action-copy"><strong>${game.ap} / 2</strong> actions left<br><span>Time moves when you do.</span></div></div>
      <button class="btn btn-primary end-sol" data-action="end-sol" ${game.status!=='playing'?'disabled':''}>${game.event?'Review event':'End Sol '+pad(game.sol)} ${icon('arrow',15)}</button>
    </div>
  </section>`;
}

function renderObjective() {
  const summary=Engine.summarize(game);
  return `<section class="panel objective"><div class="eyebrow">PRIMARY OBJECTIVE</div><h3>Leave more than footprints.</h3><p>Keep the crew alive through Sol 10.<br>Bring home ${game.goal} science.</p><div class="objective-progress"><div style="width:${summary.objectiveProgress*100}%"></div></div><div class="objective-meta"><span>${fmt(game.science)} / ${game.goal} SCIENCE</span><span>${Math.round(summary.objectiveProgress*100)}%</span></div><div class="crew-row"><div class="crew-icons" aria-label="Three crew members"><span class="crew-avatar">EK</span><span class="crew-avatar">JL</span><span class="crew-avatar">AM</span></div><div class="crew-status">CREW VITALS<br><b style="color:${game.health<35?'var(--red)':'var(--green)'}">${fmt(game.health)}% · ${game.health>70?'Nominal':game.health>35?'Caution':'Critical'}</b></div></div></section>`;
}

function renderWeather() {
  return `<section class="panel weather"><div class="weather-icon">${icon(game.weather.solarMultiplier<1?'wind':'sun',18)}</div><div><h3>${esc(game.weather.name)}</h3><p>${esc(game.weather.description)}${game.weather.solarMultiplier===1?' A good Sol to prepare.':''}</p></div></section>`;
}

function renderInspector() {
  const tile=game.tiles[selectedTile] || game.tiles[14];
  if (!tile.revealed) {
    const check=Engine.canExplore(game,tile.id), cost=game.loadout.includes('rover')||game.tech.rover?1:2;
    return `<section class="panel inspector"><div class="panel-head"><h2>Sector ${Engine.coordinate(tile.id)}</h2><span class="tag">UNSURVEYED</span></div><div class="inspector-art">${icon('scan',38)}</div><div class="inspector-body"><h3>Beyond the horizon.</h3><p>A rover scan reveals the terrain and any resources hidden beneath it.</p><div class="stat-row"><span>Survey cost</span><b>1 AP · ${cost} energy</b></div><button class="btn btn-primary btn-full btn-sm" data-action="scan-selected" ${!check.ok?'disabled':''}>${icon('scan',13)} Scan sector</button>${!check.ok?`<p style="margin-top:9px;font-size:9px">${esc(check.reason)}</p>`:''}</div></section>`;
  }
  const terrain=Engine.TERRAINS[tile.terrain];
  const b=tile.building, info=b?Engine.BUILDINGS[b.type]:null;
  const output=b?Engine.getTileOutput(game,tile.id):null;
  const current=game.status==='playing';
  const displayState=!b?'SURVEYED':b.onlineFrom>game.sol?'INSTALLING':b.damage>=2?'OFFLINE':b.damage>0?'DAMAGED':!b.active?'POWERED DOWN':output.starved?'NO INPUTS':'ONLINE';
  return `<section class="panel inspector"><div class="panel-head"><h2>Sector ${Engine.coordinate(tile.id)}</h2><span class="tag ${b&&output?.online?'orange':''}">${displayState}</span></div><div class="inspector-art"><svg viewBox="-60 -75 120 100" aria-hidden="true"><polygon points="0,-20 44,4 0,28 -44,4" fill="#68503c" opacity=".45"/>${terrainArt(tile.terrain,tile.id)}${b?buildingArt(b.type,{level:b.level,active:b.active&&b.onlineFrom<=game.sol,damage:b.damage}):''}</svg></div>
    <div class="inspector-body"><div class="eyebrow" style="font-size:8px">${esc(terrain.name)}${b?' · LEVEL '+b.level:''}</div><h3>${esc(info?.name||terrain.name)}</h3><p>${esc(info?.description||terrain.description)}</p>
    ${b?`${b.onlineFrom>game.sol?`<div class="inspector-rule">Comes online on Sol ${b.onlineFrom}. Today's forecast excludes this module.</div>`:''}${output.starved?`<div class="inspector-rule">${esc(output.reason)} This module is idle.</div>`:''}${output.terrainBonus?`<div class="inspector-rule">${esc(output.terrainBonus)}</div>`:''}
      ${Object.entries(output.delta).filter(([,v])=>v!==0).map(([k,v])=>`<div class="stat-row"><span>${icon(k,11)} ${titleCase(k)}</span><b style="color:${v>0?'var(--green)':'var(--yellow)'}">${signed(v)} / Sol</b></div>`).join('')}
      ${b.type==='battery'?`<div class="stat-row"><span>Storage expansion</span><b>+${30*b.level} energy</b></div>`:''}
      ${b.type==='greenhouse'?`<label for="crop-strategy" style="font-size:9px;color:var(--muted)">Crop strategy · change costs 1 AP</label><select class="crop-select" id="crop-strategy" data-tile="${tile.id}" ${!current||game.ap<1?'disabled':''}>${Object.entries(Engine.CROPS).map(([id,c])=>`<option value="${id}" ${b.crop===id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`:''}
      ${b.type!=='habitat'?`<div class="inspector-actions"><button class="btn btn-sm" data-action="toggle-building" data-id="${tile.id}" ${!current?'disabled':''}>${icon(b.active?'pause':'play',11)} ${b.active?'Power down':'Activate'}</button><button class="btn btn-sm" data-action="${b.damage>0?'repair':'upgrade'}" data-id="${tile.id}" ${!current||game.ap<1||(b.damage===0&&(b.level>=2||b.onlineFrom>game.sol))?'disabled':''} title="${b.damage>0?'Repair costs 5 materials and 1 AP':'Upgrade costs 10 materials, 3 energy and 1 AP'}">${icon(b.damage>0?'repair':'upgrade',11)} ${b.damage>0?'Repair · 5 MAT':b.level>=2?'Level 2':'Upgrade'}</button></div>`:`<div class="inspector-rule">Your home on Mars. Life support remains active at all times.</div>`}`:
      `${tile.terrain==='hazard'?'<div class="inspector-rule">Unsafe for construction. Try a different sector.</div>':`<div class="inspector-rule">Select a module in the construction bay. New buildings must touch an existing one.</div>`}`}
    </div></section>`;
}

function renderEventCallout() {
  if (!game.event) return '';
  return `<section class="panel event-callout"><div class="panel-head"><h2>${icon('log',13)} Incoming transmission</h2></div><p>${esc(game.event.title)}. Mission control is awaiting your decision.</p><button class="btn btn-primary btn-sm" data-action="event">Review event ${icon('arrow',13)}</button></section>`;
}

function renderLog(limit=3) {
  return `<section class="panel log-panel"><div class="panel-head"><h2>Mission log</h2><button class="text-btn" data-action="journal" style="font-size:9px;border:0">All entries ${icon('arrow',11)}</button></div><div class="log-entries">${game.log.slice(-limit).reverse().map(entry=>`<div class="log-entry"><span class="log-time">SOL ${pad(entry.sol)}</span><span class="dot" style="color:${entry.type==='danger'?'var(--red)':entry.type==='research'?'#b8a5c9':entry.type==='explore'?'var(--cyan)':'var(--orange)'}"></span><p>${esc(entry.text)}</p></div>`).join('')}</div></section>`;
}

function renderGame() {
  const forecast = Engine.forecast(game);
  const critical = forecast.warnings.filter(w=>/run out|idle/i.test(w));
  return `<div class="app-shell">${header()}<main>
    <section class="header"><div><div class="eyebrow"><span class="dot orange" style="margin-right:6px"></span> ARES-01 · SURFACE OPERATIONS</div><h1>Your foothold on Mars.</h1><p>${game.status==='playing'?'The next frontier is one decision away.':game.status==='success'?'Mission accomplished. Your outpost made history.':game.status==='partial'?'The crew is safe. There is more science to discover.':'The mission has ended. Every attempt teaches us something.'}</p></div><div class="sol-counter"><div class="sol-label">MISSION DAY<br><span class="orange">${game.status==='playing'?'IN PROGRESS':'DEBRIEF READY'}</span></div><div class="sol">${pad(game.sol)}<small> / ${game.maxSols}</small></div></div></section>
    ${renderResources()}
    <div class="control-layout">${renderConstruction()}<div class="map-column">
      ${critical.length?`<div class="hint">${icon('health',16)}<div><strong>Supply warning.</strong> ${esc(critical.join(' '))} Add capacity or power down nonessential systems.</div></div>`:tutorial&&game.sol<=2?`<div class="hint">${icon('scan',16)}<div><strong>${game.stats.explored===0?'A small step, commander.':'Build for the next Sol.'}</strong> ${game.stats.explored===0?'Click a dashed frontier tile to scan it. A3 has buried ice; C1 holds a scientific site.':'Choose a module, then a highlighted empty tile beside your colony. New modules activate next Sol.'}</div><button class="icon-btn" data-action="dismiss-tip" aria-label="Dismiss tutorial tip" style="flex-shrink:0;width:20px;height:20px;border:0">${icon('close',11)}</button></div>`:''}
      ${renderMap()}<div class="map-caption"><span>${icon('eye',11)} ${game.tiles.filter(t=>t.revealed).length} of 36 sectors surveyed</span><span>*Illustrative terrain, not a real landing-site map</span></div>${renderLog()}
      ${game.status!=='playing'?`<button class="btn btn-primary btn-full" data-action="result" style="margin-top:16px">View mission debrief ${icon('arrow',15)}</button>`:''}
    </div><aside class="right-column" aria-label="Mission information">${renderObjective()}${renderWeather()}${renderEventCallout()}${renderInspector()}</aside></div>
  </main>${footer()}</div>`;
}

function renderChart() {
  const points=game.history;
  if (!points.length) return '';
  const chartWidth=520,chartHeight=98;
  const lines=Object.entries(resourceConfig).filter(([id])=>!['materials','science'].includes(id)).map(([id,c])=>{
    const max=Math.max(60,...points.map(p=>p.resources[id]));
    const d=points.map((p,i)=>`${i?'L':'M'}${12+(i/10)*(chartWidth-24)},${8+chartHeight-(p.resources[id]/max)*chartHeight}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${c.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  return `<div class="report-chart"><div class="eyebrow" style="font-size:8px;margin-bottom:6px">RESOURCE HISTORY · RELATIVE TO EACH RESOURCE'S PEAK</div><svg viewBox="0 0 520 128" role="img" aria-label="Resource levels during the mission">${[0,1,2,3].map(i=>`<line x1="12" y1="${8+i*32}" x2="508" y2="${8+i*32}" stroke="#34373c" stroke-dasharray="3 6"/>`).join('')}${lines}<text x="12" y="123" fill="#737782" font-family="monospace" font-size="8">TOUCHDOWN</text><text x="480" y="123" fill="#737782" font-family="monospace" font-size="8">SOL 10</text></svg><div class="chart-legend">${Object.entries(resourceConfig).filter(([id])=>!['materials','science'].includes(id)).map(([,c])=>`<span style="color:${c.color}"><i class="dot"></i>${c.name}</span>`).join('')}</div></div>`;
}

function manualContent(tab) {
  if (tab==='science') return SCIENCE_NOTES.map(note=>`<article class="science-fact"><h3>${esc(note.title)}</h3><p>${esc(note.body)}</p><a href="${esc(note.url)}" target="_blank" rel="noopener noreferrer">${esc(note.source)} ↗</a></article>`).join('')+`<div class="notice">${esc(SIMULATION_NOTICE)}</div>`;
  if (tab==='sources') return SOURCES.map(source=>`<article class="source-card"><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)} ↗</a><p>${esc(source.description)}</p></article>`).join('')+`<div class="notice">${esc(SIMULATION_NOTICE)}<br><br>Scenario events are authored, not generated by a live AI. NASA links provide educational context; no live NASA feed or Earth crop prediction is used.</div>`;
  return FIELD_GUIDE.map((guide,i)=>`<div class="guide-row"><span class="guide-number">${pad(i+1)}</span><div><h3>${esc(guide.title)}</h3><p>${esc(guide.body)}</p></div></div>`).join('')+`<div class="notice">Keyboard: Tab navigates controls and map tiles. Enter scans a frontier tile or places your selected module. Arrow keys move between map tiles. Escape cancels construction or closes a dialog.</div>`;
}

function renderModal() {
  if (!modal) return '';
  let heading='',kicker='',body='',wide=false;
  if (modal.type==='manual') {
    heading='The field manual.';kicker='MISSION KNOWLEDGE';wide=true;
    const tab=modal.tab||'how';
    body=`<div class="manual-tabs" role="tablist" aria-label="Manual sections">${[['how','How to play'],['science','Real science'],['sources','Sources']].map(([id,label])=>`<button class="${id===tab?'active':''}" data-action="manual-tab" data-id="${id}" role="tab" aria-selected="${id===tab}">${label}</button>`).join('')}</div>${manualContent(tab)}`;
  } else if (modal.type==='event' && game?.event) {
    heading=game.event.title;kicker=`INCOMING TRANSMISSION · SOL ${pad(game.sol)}`;
    body=`<p>${esc(game.event.description)}</p><div class="eyebrow" style="color:var(--orange);font-size:9px">YOUR CALL, COMMANDER. NO ACTION POINT COST.</div><div class="event-choices">${game.event.choices.map(choice=>{const check=Engine.eventChoiceStatus(game,choice.id);return `<button class="event-choice" data-action="event-choice" data-id="${choice.id}" ${!check.ok?'disabled':''}><span><strong>${esc(choice.label)}</strong><span>${esc(choice.description)}</span>${!check.ok?`<span class="unavailable">${esc(check.reason)}</span>`:''}</span>${icon('arrow',17)}</button>`}).join('')}</div><div class="notice">Events are simplified scenarios. All consequences follow fixed game rules; your choice is recorded in the mission log.</div>`;
  } else if (modal.type==='end') {
    heading=`End Sol ${pad(game.sol)}?`;kicker='TURN REVIEW';
    const f=Engine.forecast(game);
    body=`<p>You have <strong>${game.ap} unused ${game.ap===1?'action':'actions'}</strong>. They won't carry over. Here is the projected resource balance:</p>${Object.entries(f.delta).filter(([,v])=>v!==0).map(([id,v])=>`<div class="stat-row" style="font-size:12px"><span>${titleCase(id)}</span><b style="color:${v>0?'var(--green)':'var(--yellow)'}">${signed(v)}</b></div>`).join('')}${f.warnings.length?`<div class="notice">${f.warnings.map(esc).join('<br>')}</div>`:''}<div class="modal-actions"><button class="btn btn-ghost" data-action="close">Keep planning</button><button class="btn btn-primary" data-action="confirm-end">End Sol ${icon('arrow',14)}</button></div>`;
  } else if (modal.type==='new') {
    heading='Chart a new course.';kicker='NEW MISSION';
    body=`<p>Return to mission preparation and try a different cargo strategy. Your current run stays saved until you launch the new mission.</p><div class="modal-actions"><button class="btn btn-ghost" data-action="close">Continue mission</button><button class="btn btn-primary" data-action="prepare">Prepare new mission ${icon('arrow',14)}</button></div>`;
  } else if (modal.type==='journal') {
    heading='Every decision leaves a trace.';kicker='MISSION LOG';wide=true;
    body=game?`<p>Mission seed <strong class="mono">${esc(game.seed)}</strong> · Sol ${game.sol} · ${game.status==='playing'?'In progress':'Complete'}</p>${renderChart()}<div class="log-entries" style="max-height:320px;overflow:auto;padding:0">${game.log.slice().reverse().map(e=>`<div class="log-entry"><span class="log-time">SOL ${pad(e.sol)}</span><span class="dot"></span><p>${esc(e.text)}</p></div>`).join('')}</div><div class="modal-actions"><button class="btn btn-ghost" data-action="import">Import mission</button><button class="btn" data-action="export">${icon('download',14)} Export save</button></div>`:`<p>Launch your mission to begin the log. You can also restore a previously exported save.</p><button class="btn" data-action="import">Import mission save</button>`;
  } else if (modal.type==='result' && game) {
    const s=Engine.summarize(game);wide=true;heading='Mission debrief.';kicker='ARES-01 · TRANSMISSION COMPLETE';
    body=`<div class="result-hero"><div class="result-medal">${icon(game.status==='success'?'rocket':game.status==='partial'?'shield':'health',32)}</div><div class="eyebrow">${game.status==='success'?'MISSION SUCCESS':game.status==='partial'?'PARTIAL SUCCESS':'MISSION ENDED'}</div><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p></div><div class="result-grid"><div class="result-stat"><b>${s.score}</b><span>MISSION SCORE / 1,000</span></div><div class="result-stat"><b>${fmt(s.science)}</b><span>SCIENCE / ${s.goal}</span></div><div class="result-stat"><b>${fmt(s.health)}%</b><span>CREW HEALTH</span></div></div>${renderChart()}<div class="report-grid"><div><h4>Your colony</h4><p>${s.buildings} modules established · ${s.discovered}/36 sectors surveyed · ${s.solsCompleted} Sols completed.</p></div><div><h4>Your next mission</h4><p>${s.health<60?'Bring more reserves, check the daily forecast, and prepare production before supplies run low.':s.science<s.goal?'Get a laboratory online early. Geological sites boost research, and experiments turn spare energy into science.':'Try a lighter loadout, explore more sectors, or complete the science programme with a different crop strategy.'}</p></div></div><div class="modal-actions"><button class="btn btn-ghost" data-action="close">View colony</button><button class="btn" data-action="export">${icon('download',14)} Export mission</button><button class="btn btn-primary" data-action="prepare">Another mission ${icon('arrow',14)}</button></div>`;
  } else if (modal.type==='map-help') {
    heading='A world worth exploring.';kicker='MAP CONTROLS';
    body=`<p><strong>Scan:</strong> click a dashed, unexplored tile beside known territory. It reveals instantly for 1 action and ${game?.loadout.includes('rover')||game?.tech.rover?1:2} energy.</p><p><strong>Build:</strong> choose a module from the construction bay. Valid tiles display a green plus. Click one to construct. Escape cancels placement.</p><p><strong>Inspect:</strong> click a revealed tile to see its output, bonuses, upgrades, and controls. Modules connect along edges, not corners.</p><p><strong>Plan ahead:</strong> new structures begin operating next Sol, not immediately.</p><button class="btn btn-primary btn-full" data-action="close">Back to the frontier</button>`;
  } else return '';
  return `<div class="modal-backdrop" data-action="backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header class="modal-header"><div><div class="eyebrow orange">${kicker}</div><h2 id="dialog-title">${esc(heading)}</h2></div><button class="icon-btn" data-action="close" aria-label="Close dialog">${icon('close',16)}</button></header><div class="modal-content">${body}</div></section></div>`;
}

function render() {
  app.innerHTML = (phase==='setup'?renderSetup():renderGame()) + renderModal() + `<input class="input-file" type="file" id="save-import" accept="application/json,.json" aria-label="Import mission save">`;
  document.body.style.overflow = modal ? 'hidden' : '';
  document.querySelector('.app-shell').inert = !!modal;
}

function openModal(value) {
  previousFocus=document.activeElement?.dataset?.action || null;
  modal=value;render();
  requestAnimationFrame(()=>document.querySelector('.modal button')?.focus());
}
function closeModal() {
  modal=null;render();
  if(previousFocus) document.querySelector(`[data-action="${previousFocus}"]`)?.focus();
}

async function launch() {
  const check=Engine.validateLoadout(cargo);
  if(!check.ok){toast(check.errors.join(' '),true);return;}
  try { game=await Engine.createGame({seed,loadout:cargo}); }
  catch(error) { toast(error.message || 'The Python mission server is unavailable.',true); return; }
  phase='game';selectedTile=14;selectedBuild=null;buildTab='build';modal=null;tutorial=true;saveGame();render();
  const overlay=document.createElement('div');overlay.className='launch-overlay';overlay.innerHTML=`<div class="launch-symbol">${icon('rocket',48)}</div><h2>GO FOR LANDING</h2><p>ARES-01 · ARCADIA SECTOR</p><div class="launch-progress"><div></div></div>`;document.body.append(overlay);
  playTone('turn');clearTimeout(launchTimer);launchTimer=setTimeout(()=>{overlay.remove();toast('Touchdown confirmed. Welcome to Mars, commander.');},window.matchMedia('(prefers-reduced-motion: reduce)').matches?150:1300);
}

async function endSol() {
  modal=null;selectedBuild=null;
  const ok=await applyResult(Engine.advanceSol(game),'turn');
  if(ok&&game.event)openModal({type:'event'});
}

function exportGame() {
  if(!game)return;
  const blob=new Blob([JSON.stringify(game,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`ares-first-light-sol-${game.sol}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Mission exported. Import this file to continue on another device.');
}

async function onAction(event) {
  const target=event.target.closest('[data-action]');
  if(!target||target.disabled)return;
  const action=target.dataset.action, id=target.dataset.id;
  if(action==='backdrop'){if(event.target===target)closeModal();return;}
  if(action==='close'){closeModal();return;}
  if(action==='faults'){location.href='/faults.html';return;}
  if(action==='manual'||action==='sources'){openModal({type:'manual',tab:action==='sources'?'sources':'how'});return;}
  if(action==='manual-tab'){modal.tab=id;render();document.querySelector(`[data-action="manual-tab"][data-id="${id}"]`)?.focus();return;}
  if(action==='journal'){openModal({type:'journal'});return;}
  if(action==='sound'){sounds=!sounds;writeStorage(PREF_KEY,JSON.stringify({sounds}));render();playTone();toast(sounds?'Sound enabled.':'Sound muted.');return;}
  if(action==='brand'||action==='mission'||action==='continue'){if(game){phase='game';modal=null;render();}return;}
  if(action==='cargo'){cargo=cargo.includes(id)?cargo.filter(v=>v!==id):[...cargo,id];render();document.querySelector(`[data-action="cargo"][data-id="${id}"]`)?.focus();return;}
  if(action==='balanced'){cargo=[...Engine.DEFAULT_LOADOUT];render();return;}
  if(action==='launch'){launch();return;}
  if(action==='new'){openModal({type:'new'});return;}
  if(action==='prepare'){phase='setup';seed=makeSeed();cargo=[...Engine.DEFAULT_LOADOUT];modal=null;render();window.scrollTo({top:0,behavior:'instant'});return;}
  if(action==='export'){exportGame();return;}
  if(action==='import'){document.querySelector('#save-import')?.click();return;}
  if(!game)return;
  if(action==='result'){openModal({type:'result'});return;}
  if(action==='dismiss-tip'){tutorial=false;render();return;}
  if(action==='map-help'){openModal({type:'map-help'});return;}
  if(action==='tab'){buildTab=id;selectedBuild=null;render();return;}
  if(action==='cancel-build'){selectedBuild=null;render();return;}
  if(action==='select-build'){
    selectedBuild=selectedBuild===id?null:id;render();
    if(selectedBuild&&!game.tiles.some(t=>Engine.canBuild(game,selectedBuild,t.id).ok))toast(game.ap<1?'No actions left. End the Sol to build tomorrow.':game.resources.materials<Engine.BUILDINGS[selectedBuild].cost?'Not enough materials. Scout supply caches for more.':'No valid site yet. Scan more terrain or extend the colony.',true);
    if(selectedBuild&&window.matchMedia('(max-width:760px)').matches)document.querySelector('.map-panel')?.scrollIntoView({block:'start',behavior:'smooth'});
    return;
  }
  if(action==='tile'){
    const tile=game.tiles[Number(id)];if(!tile)return;selectedTile=tile.id;
    if(selectedBuild){const type=selectedBuild;const result=await Engine.build(game,type,tile.id);if(result.ok)selectedBuild=null;await applyResult(result);if(!result.ok)render();}
    else if(!tile.revealed&&game.status==='playing'){const result=await Engine.explore(game,tile.id);await applyResult(result,'scan');if(!result.ok)render();}
    else render();
    return;
  }
  if(action==='scan-selected'){applyResult(Engine.explore(game,selectedTile),'scan');return;}
  if(action==='toggle-building'){applyResult(Engine.toggleBuilding(game,Number(id)));return;}
  if(action==='upgrade'){applyResult(Engine.upgrade(game,Number(id)));return;}
  if(action==='repair'){applyResult(Engine.repair(game,Number(id)));return;}
  if(action==='study'){applyResult(Engine.study(game));return;}
  if(action==='research'){applyResult(Engine.researchTech(game,id));return;}
  if(action==='event'){if(game.event)openModal({type:'event'});return;}
  if(action==='event-choice'){const result=await Engine.chooseEvent(game,id);if(result.ok)modal=null;await applyResult(result);return;}
  if(action==='end-sol'){if(game.event){openModal({type:'event'});return;}if(game.ap>0||Engine.forecast(game).warnings.some(w=>/run out/.test(w)))openModal({type:'end'});else endSol();return;}
  if(action==='confirm-end'){endSol();return;}
}

app.addEventListener('click', onAction);
app.addEventListener('change', async event=>{
  if(event.target.id==='crop-strategy')applyResult(Engine.setCrop(game,Number(event.target.dataset.tile),event.target.value));
  if(event.target.id==='save-import'){
    const file=event.target.files?.[0];if(!file)return;
    if(file.size>250000){toast('That save is too large. Choose an Ares mission JSON file under 250 KB.',true);return;}
    try {
      const result=Engine.validateSave(await file.text());
      if(!result.ok){toast(result.error,true);return;}
      game=result.state;phase='game';selectedTile=14;selectedBuild=null;modal=game.status==='playing'?null:{type:'result'};saveGame();render();toast(`Mission restored. Welcome back to Sol ${game.sol}.`);
    } catch { toast('This file could not be read as a mission save.',true); }
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){if(modal)closeModal();else if(selectedBuild){selectedBuild=null;render();}return;}
  if(modal&&event.key==='Tab'){
    const items=[...document.querySelectorAll('.modal button:not(:disabled),.modal a[href],.modal input,.modal select')];
    if(items.length){const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}}
  }
  const tile=event.target.closest?.('.tile');
  if(tile&&(event.key==='Enter'||event.key===' ')){event.preventDefault();tile.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}
  if(tile&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
    event.preventDefault();const id=Number(tile.dataset.id),x=id%6,y=Math.floor(id/6),offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-6,ArrowDown:6}[event.key];
    if((event.key==='ArrowLeft'&&x===0)||(event.key==='ArrowRight'&&x===5)||(event.key==='ArrowUp'&&y===0)||(event.key==='ArrowDown'&&y===5))return;
    document.querySelector(`.tile[data-id="${id+offset}"]`)?.focus();
  }
});

try { sounds=!!JSON.parse(readStorage(PREF_KEY)||'{}').sounds; } catch { /* Ignore an invalid preference, not the mission. */ }
loadGame();render();
window.addEventListener('pageshow',()=>{if(game&&phase==='game')saveGame();});
