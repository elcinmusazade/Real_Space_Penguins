/** Browser interface for the Python-authoritative interplanetary campaign. */
import {mountPlanetMap} from './planet-map.js';
import {mapScreen} from './map-ui.js';

const SAVE_KEY = 'ares.first-light.campaign.v2';
const app = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = value => Math.round(Number(value) || 0).toLocaleString('en-US');
const fmtTurn = value => String(value).padStart(2, '0');
const glyph = {earth:'◎',mars:'●',venus:'◉',mercury:'◌',europa:'◍'};
const terrainLabel = {plain:'PLAIN',ice:'ICE',ridge:'RIDGE',science:'SCIENCE',salvage:'CACHE',hazard:'HAZARD'};
const resourceName = {energy:'Energy',materials:'Materials',fuel:'Fuel',water:'Water',food:'Food',oxygen:'Oxygen',heat:'Heat'};
let catalog=null, state=null, quote=null, pending=false, quoteId=0;
let tab='system', selectedWorld='mars', selectedHub='H2', selectedBuilding=null, selectedTile=528;
let mapController=null;
let modal='intro', assistantTopic='welcome';
let draft={source:'H1',destination:'venus',site:'Ishtar Terra',objective:'surface',hull:'lander',engine:'chemical',trajectory:'balanced',payload:['rover','lab','shield']};
let freight={source:'H1',target:'H2',resource:'materials',amount:20};

async function api(path, payload) {
  const options = payload === undefined ? {} : {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)};
  const response=await fetch(path,options);
  const data=await response.json();
  if(!response.ok)throw new Error(data.error || 'Python mission server rejected the request.');
  return data;
}

function notify(message, error=false) {
  const item=document.createElement('div');
  item.className=`notification ${error?'is-error':''}`;
  item.textContent=message;
  document.querySelector('#notification-root').append(item);
  window.setTimeout(()=>item.remove(),5400);
}

function save() { try { localStorage.setItem(SAVE_KEY,JSON.stringify(state)); } catch { notify('Browser save is unavailable. Keep this tab open.',true); } }

async function initialize() {
  try {
    const configuration=await api('/api/campaign/catalog');
    catalog=configuration.catalog;
    let previous=null;
    try { previous=JSON.parse(localStorage.getItem(SAVE_KEY)||'null'); } catch { /* Ignore a malformed save. */ }
    if(previous) {
      try { const result=await api('/api/campaign/validate',{state:previous});if(result.ok)state=result.state; }
      catch { notify('Previous campaign save is invalid. Starting a fresh campaign.',true); }
    }
    if(!state)state=(await api('/api/campaign/new',{seed:'HORIZON-01'})).state;
    if(state.event)modal='intro'; // AURA always opens first; pending events open when the briefing closes.
    if(!state.hubs.some(h=>h.id===selectedHub))selectedHub=state.hubs.find(h=>h.kind==='surface')?.id || state.hubs[0].id;
    save(); render(); refreshQuote();
  }catch(error){app.innerHTML=`<main class="error-page"><h1>Mission engine unavailable</h1><p>${esc(error.message)}</p><p>Run <code>python3 -m ares.server</code> from the project directory.</p><button onclick="location.reload()">Retry connection</button></main>`;}
}

function hub(id) { return state.hubs.find(h=>h.id===id); }
function world(id) { return catalog.worlds[id]; }
function activeFlights(){return state.missions.filter(x=>x.status==='in_flight');}
function activeCargo(){return state.shipments.filter(x=>x.status==='in_flight');}
function hubCount(id){return state.hubs.filter(h=>h.world===id).length;}
function until(turn){return `${Math.max(0,turn-state.turn)} TURN${Math.max(0,turn-state.turn)===1?'':'S'}`;}

function navButton(id,label,icon) {return `<button class="nav-item ${tab===id?'active':''}" data-action="nav" data-id="${id}" aria-pressed="${tab===id}"><span>${icon}</span>${label}</button>`;}

function topbar() {
  return `<header class="topbar"><button class="brand" data-action="nav" data-id="system" aria-label="Ares interplanetary command home"><span class="brand-mark">✦</span><span>ARES <small>INTERPLANETARY COMMAND</small></span></button>
  <nav class="topnav" aria-label="Game navigation">${navButton('system','PLANET MAP','◈')}${navButton('planner','SHIPYARD','⌁')}${navButton('hubs','OUTPOSTS','▦')}${navButton('logistics','SUPPLY LINES','⇄')}${navButton('research','TECH TREE','✧')}</nav>
  <div class="header-actions"><span class="save-status"><i></i> LOCAL SAVE</span><button class="tiny-icon" data-action="assistant" aria-label="Open mission assistant">✺</button><button class="tiny-icon" data-action="reset" aria-label="Reset campaign" title="New campaign">↻</button></div></header>`;
}

function stats() {
  return `<section class="statsbar" aria-label="Space programme status">
    <div><small>MISSION TURN</small><strong>${fmtTurn(state.turn)} <em>◷</em></strong></div>
    <div><small>PROGRAMME CREDITS</small><strong>${num(state.credits)} <em>CR</em></strong></div>
    <div><small>SCIENCE AVAILABLE</small><strong>${num(state.science)} <em>SCI</em></strong></div>
    <div><small>ESTABLISHED HUBS</small><strong>${state.hubs.length} <em>OUTPOSTS</em></strong></div>
    <div><small>MISSIONS IN FLIGHT</small><strong>${activeFlights().length} <em>ACTIVE</em></strong></div>
    <button class="advance-button" data-action="advance" ${pending?'disabled':''}>ADVANCE TURN <span>→</span></button>
  </section>`;
}

function planetOrb(id,size='medium') { return `<span class="planet planet-${id} planet-${size}" aria-hidden="true"></span>`; }

function sidebar() {
  const worlds=['earth','mars','venus','mercury','europa'];
  return `<aside class="sidebar"><div class="side-heading"><span>01 / MISSION NETWORK</span><b>THE SOLAR SYSTEM</b></div>
   <div class="world-list">${worlds.map(id=>{const w=world(id);return `<button class="world-link ${selectedWorld===id?'selected':''}" data-action="select-world" data-id="${id}">${planetOrb(id,'small')}<span><b>${esc(w.name)}</b><small>${esc(w.role)}</small></span><span class="world-count">${hubCount(id)}</span></button>`;}).join('')}</div>
   <div class="sidebar-divider"></div><div class="side-heading"><span>02 / FACILITIES</span><b>YOUR HUBS</b></div>
   <div class="hub-list">${state.hubs.map(h=>`<button class="hub-link ${selectedHub===h.id?'selected':''}" data-action="select-hub" data-id="${esc(h.id)}"><span class="hub-symbol">${h.kind==='orbital'?'◇':h.kind==='control'?'⌂':'⌑'}</span><span><b>${esc(h.name)}</b><small>${h.kind.toUpperCase()} · ${h.id}</small></span></button>`).join('')}</div>
   <button class="new-route" data-action="nav" data-id="logistics">＋ Establish a supply route</button>
  </aside>`;
}

function ribbon(label,sub) {return `<div class="section-label">${esc(label)} <span>${esc(sub||'')}</span></div>`;}
function pill(value,color=''){return `<span class="pill ${color}">${esc(value)}</span>`;}
function flightList(limit=5) {
  const records=[
    ...activeFlights().map(m=>({id:m.id,name:`${world(m.destination).name} · ${m.objective}`,time:m.arrivesAt,kind:'MISSION',color:m.destination})),
    ...activeCargo().map(s=>({id:s.id,name:`${s.amount} ${resourceName[s.resource]} → ${hub(s.target)?.name||s.target}`,time:s.arrivesAt,kind:'CARGO',color:'cargo'})),
    ...state.expeditions.filter(e=>e.status==='en_route').map(e=>({id:e.id,name:`Rover expedition · ${hub(e.hub)?.name||e.hub}`,time:e.arrivesAt,kind:'ROVER',color:'rover'})),
  ].sort((a,b)=>a.time-b.time);
  return records.length?records.slice(0,limit).map(m=>`<div class="timeline-row"><span class="timeline-mark ${m.color}">↗</span><div><b>${esc(m.id)} · ${esc(m.name)}</b><small>${m.kind}</small></div><span class="eta">${until(m.time)}</span></div>`).join(''):'<div class="empty-state">No spacecraft or rovers currently in transit. Design a mission or dispatch supplies to begin.</div>';
}

function systemView() {
  const places=['mars','venus','mercury','europa'];
  return `<div class="system-view">${ribbon('SYSTEM OVERVIEW','MISSION STATUS / LIVE')}
    <section class="system-hero"><div class="hero-copy"><span class="eyebrow">THE NEXT FRONTIER AWAITS</span><h1>One network.<br><i>Many worlds.</i></h1><p>Design your spacecraft. Choose a trajectory. Build a connected system of planetary and orbital hubs—one mission at a time.</p><div class="hero-actions"><button class="button primary" data-action="nav" data-id="planner">DESIGN A MISSION <span>↗</span></button><button class="button secondary" data-action="nav" data-id="hubs">MANAGE HUBS →</button></div><div class="hero-milestone">${state.milestone?'✓ SYSTEM PATHFINDER UNLOCKED':'◈ SYSTEM PATHFINDER · Reach Venus, Mercury & Europa'}</div></div>
    <div class="solar-visual" aria-hidden="true"><div class="orbital-ring ring-a"></div><div class="orbital-ring ring-b"></div><div class="orbital-ring ring-c"></div><div class="visual-sun"></div><div class="visual-world visual-mercury">${planetOrb('mercury','medium')}</div><div class="visual-world visual-venus">${planetOrb('venus','medium')}</div><div class="visual-world visual-earth">${planetOrb('earth','medium')}</div><div class="visual-world visual-mars">${planetOrb('mars','medium')}</div><div class="visual-world visual-europa">${planetOrb('europa','medium')}</div><span class="orbit-label">MISSION NETWORK · SIMPLIFIED ORBITS</span></div></section>
    <div class="subheading"><h2>Mission destinations</h2><span>AVAILABLE FOR PLANNING</span></div>
    <div class="destination-grid">${places.map(id=>{const w=world(id);return `<button class="destination-card destination-${id}" data-action="choose-destination" data-id="${id}"><span class="destination-head"><small>${w.kind.toUpperCase()}</small>${pill(hubCount(id)?`${hubCount(id)} HUB${hubCount(id)>1?'S':''}`:'UNEXPLORED',hubCount(id)?'green':'')}</span><span class="destination-orb">${planetOrb(id,'large')}</span><b>${esc(w.name)}</b><span>${esc(w.role)}</span><small class="destination-footer">${esc(w.hazard)} <strong>↗</strong></small></button>`;}).join('')}</div>
    <div class="dual-panels"><section class="surface-card">${ribbon('OPERATIONS','SHIPMENTS & MISSIONS')}<h2>In transit</h2>${flightList()}</section><section class="surface-card">${ribbon('LATEST TELEMETRY','MISSION RECORD')}<h2>From mission control</h2>${state.log.slice(-4).reverse().map(e=>`<div class="log-row"><small>T${fmtTurn(e.turn)}</small><span>${esc(e.message)}</span></div>`).join('')}</section></div>
  </div>`;
}

function selectField(name,valueList,current,labels={}) {
  return `<label class="field"><span>${esc(name.replaceAll('_',' ').toUpperCase())}</span><select data-field="${esc(name)}">${valueList.map(value=>`<option value="${esc(value)}" ${current===value?'selected':''}>${esc(labels[value]||value)}</option>`).join('')}</select></label>`;
}

function shipBlueprint() {
  const hull=draft.hull, payload=draft.payload;
  const wing=hull==='freighter'?52:hull==='lander'?40:28;
  return `<div class="blueprint"><div class="blueprint-title">SPACECRAFT BLUEPRINT <small>CONFIGURATION / ${esc(hull.toUpperCase())}</small></div><svg viewBox="0 0 420 170" role="img" aria-label="Stylized spacecraft design preview"><defs><linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a3bccb"/><stop offset="1" stop-color="#49667e"/></linearGradient></defs><path d="M210 20 235 67 233 125 210 145 187 125 185 67Z" fill="url(#metal)" stroke="#b8e2e9" stroke-width="1.4"/><path d="M210 18 220 52 200 52Z" fill="#d6e6ec"/><path d="M185 75  ${185-wing} 118 ${185-wing} 145 188 119Z" fill="#688497" stroke="#a9d4df"/><path d="M235 75 ${235+wing} 118 ${235+wing} 145 232 119Z" fill="#688497" stroke="#a9d4df"/><path d="M197 144 203 159 210 166 217 159 223 144Z" fill="#f3a86b" opacity=".85"/><ellipse cx="210" cy="82" rx="11" ry="20" fill="#1c394a" stroke="#8fd1da"/><path d="M75 74H160M260 74H350M210 12V1M210 167V158" fill="none" stroke="#527688" stroke-dasharray="4 5"/><text x="15" y="67" fill="#78a3b2" font-size="10" font-family="monospace">${esc(catalog.hulls[hull].name.toUpperCase())}</text><text x="275" y="67" fill="#78a3b2" font-size="10" font-family="monospace">${esc(catalog.engines[draft.engine].name.toUpperCase())}</text></svg><div class="blueprint-modules">${payload.length?payload.map(p=>`<span>◇ ${esc(catalog.payloads[p].name)}</span>`).join(''):'<span>No payload selected</span>'}</div></div>`;
}

function quotePanel() {
  if(!quote)return `<div class="quote-panel"><div class="eyebrow">FLIGHT CALCULATION</div><p>Calculating launch parameters with Python...</p></div>`;
  if(!quote.ok)return `<div class="quote-panel invalid"><div class="eyebrow">PLAN NEEDS WORK</div><p>${esc(quote.error)}</p></div>`;
  return `<div class="quote-panel"><div class="eyebrow">MISSION TRADE-OFFS · ESTIMATED</div><div class="quote-grid"><div><small>TRANSFER TIME</small><strong>${quote.turns}<em> TURNS</em></strong></div><div><small>FUEL REQUIRED</small><strong>${quote.fuel}<em> UNITS</em></strong></div><div><small>MISSION CREDITS</small><strong>${quote.credits}<em> CR</em></strong></div><div><small>SHIP MATERIALS</small><strong>${quote.materials}<em> MAT</em></strong></div><div><small>PAYLOAD MASS</small><strong>${quote.mass}<em> / ${quote.capacity} t</em></strong></div><div><small>ARRIVAL RISK</small><strong>${quote.riskPercent}<em>%</em></strong></div></div>${!quote.affordable?'<div class="quote-warning">Insufficient resources at the departure hub. Refill or ship resources before launching.</div>':''}<p class="simulation-note">${esc(quote.notice)}</p></div>`;
}

function plannerView() {
  const sourceNames=Object.fromEntries(state.hubs.map(h=>[h.id,h.name]));
  const destinations=Object.keys(catalog.worlds).filter(x=>x!=='earth');
  const w=world(draft.destination);
  const sites=draft.objective==='surface'?w.sites:[draft.objective==='orbital'?'Orbital Station':'Remote Survey'];
  return `${ribbon('MISSION PLANNING','SHIPYARD / TRAJECTORY DESIGN')}<div class="page-heading"><div><h1>Design the impossible.</h1><p>Your spacecraft, route and payload directly affect cost, arrival time and risk.</p></div>${pill('PYTHON FLIGHT RULES')}</div>
  <div class="planner-layout"><section class="surface-card planner-form"><div class="subheading"><h2>01 · Mission brief</h2><span>ROUTE</span></div>
  <div class="form-grid">${selectField('source',Object.keys(sourceNames),draft.source,sourceNames)}${selectField('destination',destinations,draft.destination,Object.fromEntries(destinations.map(id=>[id,world(id).name])))}${selectField('objective',['surface','orbital','survey'],draft.objective,{surface:'Establish surface hub',orbital:'Deploy orbital hub',survey:'Robotic science survey'})}${selectField('site',sites,draft.site)}</div>
  <div class="subheading"><h2>02 · Configure spacecraft</h2><span>ENGINEERING</span></div><div class="form-grid">${selectField('hull',Object.keys(catalog.hulls),draft.hull,Object.fromEntries(Object.entries(catalog.hulls).map(([id,v])=>[id,v.name])))}${selectField('engine',Object.keys(catalog.engines),draft.engine,Object.fromEntries(Object.entries(catalog.engines).map(([id,v])=>[id,v.name])))}${selectField('trajectory',Object.keys(catalog.trajectories),draft.trajectory,Object.fromEntries(Object.entries(catalog.trajectories).map(([id,v])=>[id,v.name])))}</div>
  <p class="field-description">${esc(catalog.trajectories[draft.trajectory].description)} Mass and fuel needs depend on every chosen component.</p>
  <div class="subheading"><h2>03 · Select payload</h2><span>MULTIPLE MODULES</span></div><div class="payload-grid">${Object.entries(catalog.payloads).map(([id,p])=>`<button class="payload-card ${draft.payload.includes(id)?'selected':''}" aria-pressed="${draft.payload.includes(id)}" data-action="payload" data-id="${id}"><span class="payload-check">${draft.payload.includes(id)?'✓':'+'}</span><strong>${esc(p.name)}</strong><small>${p.mass} t · ${p.materials} MAT</small><span>${esc(p.description)}</span></button>`).join('')}</div>
  <div class="planner-actions"><button class="button secondary" data-action="quote">RECALCULATE</button><button class="button primary" data-action="launch" ${!quote?.ok||!quote?.affordable||pending?'disabled':''}>AUTHORIZE LAUNCH ↗</button></div></section>
  <aside class="planner-preview">${shipBlueprint()}${quotePanel()}<div class="mission-advice"><span>✺ AURA'S NOTE</span><p>Faster transfers cost more fuel. Extra payload improves scientific return but increases ship mass and construction costs.</p></div></aside></div>`;
}

function stockCards(h) {return `<div class="stock-grid">${Object.entries(h.stocks).map(([key,value])=>`<div class="stock-item"><small>${esc(resourceName[key]||key)}</small><strong>${num(value)}</strong></div>`).join('')}</div>`;}

function tileLabel(tile,h) {
  const task=state.expeditions.find(e=>e.hub===h.id&&e.tile===tile.id&&e.status==='en_route');
  if(!tile.revealed)return task?`<small>ROVER</small><b>${until(task.arrivesAt)}</b>`:'<b class="question">?</b>';
  return `<small>${esc(terrainLabel[tile.terrain]||'BASE')}</small><b>${tile.building?esc(tile.building.type==='habitat'?'⌂':tile.building.type==='solar'?'☀':tile.building.type==='shield'?'⬡':'◈'):'·'}</b><span>${tile.id+1}</span>`;
}

function hubsView() {
  const h=hub(selectedHub)||state.hubs[0];
  const hubOptions=Object.fromEntries(state.hubs.map(x=>[x.id,x.name]));
  const operations=h.kind==='surface';
  const tile=h.tiles[selectedTile]||h.tiles[12];
  return `${ribbon('COLONY OPERATIONS','SURFACE / ORBITAL HUBS')}<div class="page-heading"><div><h1>Every outpost matters.</h1><p>Hubs have their own stockpiles. Resources move only when you schedule a shipment.</p></div>${pill('NO ACTION POINTS','green')}</div>
  <div class="hub-picker">${selectField('hub',Object.keys(hubOptions),h.id,hubOptions)}<div><small>LOCATION</small><b>${esc(world(h.world).name)} · ${esc(h.kind.toUpperCase())}</b></div><div><small>CREW HEALTH</small><b>${h.crew.length?`${h.health}%`:'AUTONOMOUS'}</b></div><div><small>ROVERS</small><b>${h.rovers} ${h.roverBusyUntil>state.turn?`· BUSY TO T${h.roverBusyUntil}`:''}</b></div></div>
  ${operations?`<div class="hub-layout"><section class="surface-card terrain-panel"><div class="subheading"><h2>Sector map · ${esc(h.site)}</h2><span>${h.tiles.filter(t=>t.revealed).length}/25 SURVEYED</span></div><p class="field-description">Click hidden nearby sectors for a free scan. Distant sectors require a rover expedition and several turns. Select a building to construct.</p>
  <div class="terrain-map world-map-${h.world}">${h.tiles.map(tile=>`<button class="terrain-tile ${tile.revealed?'surveyed':'hidden'} ${tile.terrain||''} ${selectedTile===tile.id?'picked':''} ${selectedBuilding?'building-mode':''}" data-action="tile" data-id="${tile.id}" title="Sector ${tile.id+1}${tile.revealed?` · ${tile.terrain}`:' · Unexplored'}" aria-label="Sector ${tile.id+1}, ${tile.revealed?tile.terrain:'unexplored'}">${tileLabel(tile,h)}</button>`).join('')}</div>
  <div class="terrain-foot"><span>▦ BASE CONNECTIVITY REQUIRED</span><span>${selectedBuilding?`PLACING ${esc(catalog.buildings[selectedBuilding].name)}`:'SURVEY MODE'}</span></div></section>
  <aside class="surface-card inspector"><div class="subheading"><h2>Sector ${tile.id+1}</h2><span>${tile.revealed?'SURVEYED':'FOG OF WAR'}</span></div><div class="inspector-illustration ${tile.terrain||'unknown'}">${tile.revealed?(tile.building?'⌂':glyph[h.world]):'？'}</div><h3>${tile.revealed?esc((terrainLabel[tile.terrain]||'Unknown')+' TERRAIN'):'Uncharted region'}</h3><p>${tile.revealed?(tile.building?`Installed ${tile.building.type}. ${tile.building.onlineFrom>state.turn?`Online on turn ${tile.building.onlineFrom}.`:'Currently operating if supplied.'}`:'A candidate for construction, subject to site and resource requirements.'):'Free scans cover the immediate hub perimeter. Farther surveys require a rover, fuel and travel time.'}</p>
  ${selectedBuilding?`<div class="callout">Construction selected: <b>${esc(catalog.buildings[selectedBuilding].name)}</b>. Click an empty surveyed neighboring tile.</div><button class="button secondary full" data-action="cancel-build">CANCEL CONSTRUCTION</button>`:`<div class="callout">${tile.revealed?'Select a structure below to begin planning.':'Click this sector to scan it or dispatch a rover.'}</div>`}</aside></div>
  <div class="surface-card"><div class="subheading"><h2>Construction bay</h2><span>MATERIALS + TIME · NO AP</span></div><div class="building-grid">${Object.entries(catalog.buildings).map(([id,b])=>`<button class="building-card ${selectedBuilding===id?'selected':''}" data-action="build-mode" data-id="${id}"><span class="building-symbol">${id==='solar'?'☀':id==='heater'?'♨':id==='extractor'?'≋':id==='greenhouse'?'❀':id==='laboratory'?'✧':id==='shield'?'⬡':'▤'}</span><b>${esc(b.name)}</b><small>${b.materials} MAT · ${b.turns} TURN${b.turns>1?'S':''}</small><span>${esc(b.description)}</span></button>`).join('')}</div></div>`:`<section class="surface-card orbit-panel"><div class="orbital-symbol">◇</div><h2>${h.kind==='control'?'Earth-based command center':'Orbital refueling and communications station'}</h2><p>${h.kind==='control'?'The central shipyard finances missions and manufactures launch materials and fuel each turn.':'Orbital hubs stock fuel and contribute scientific data each turn. They reduce flight costs and connect surface stations through cargo spacecraft.'}</p><button class="button primary" data-action="nav" data-id="logistics">SEND RESOURCES →</button></section>`}
  <section class="surface-card inventory-panel"><div class="subheading"><h2>Local inventories</h2><span>NO AUTOMATIC SHARING</span></div>${stockCards(h)}</section>
  ${h.crew.length?`<section class="surface-card"><div class="subheading"><h2>Astronaut assignments</h2><span>REAL-TIME COMMANDS · NO AP</span></div><div class="crew-grid">${h.crew.map((person,i)=>`<label class="crew-card"><span class="crew-avatar">${esc(person.name.split(' ').map(n=>n[0]).join(''))}</span><b>${esc(person.name)}</b><small>${esc(person.specialty)}</small><select data-field="crew" data-index="${i}">${['engineering','science','survival'].map(role=>`<option value="${role}" ${person.assigned===role?'selected':''}>${role.toUpperCase()}</option>`).join('')}</select></label>`).join('')}</div></section>`:''}
  <section class="surface-card"><div class="subheading"><h2>Rover operations</h2><span>${h.rovers} ASSIGNED</span></div>${state.expeditions.filter(e=>e.hub===h.id&&e.status==='en_route').map(e=>`<div class="timeline-row"><span class="timeline-mark rover">⟡</span><div><b>Rover ${e.id} → Sector ${e.tile+1}</b><small>Expedition underway</small></div><span class="eta">${until(e.arrivesAt)}</span></div>`).join('')||'<p class="muted">No active rover expedition. Select a distant fogged tile to dispatch one.</p>'}</section>`;
}

function logisticsView() {
  const hubNames=Object.fromEntries(state.hubs.map(h=>[h.id,h.name]));
  const routeLabels=state.routes.map(route=>{const [a,b]=route.split(':');return `${hub(a)?.name||a} ⇄ ${hub(b)?.name||b}`;});
  return `${ribbon('RESOURCE NETWORK','TRANSIT / ROUTE MANAGEMENT')}<div class="page-heading"><div><h1>Build a connected system.</h1><p>Each hub maintains its own inventory. Dispatch cargo via spacecraft, orbital shuttle, or surface convoy.</p></div>${pill(`${state.routes.length} ROUTES`,'green')}</div>
  <div class="dual-panels logistics-columns"><section class="surface-card"><div class="subheading"><h2>Dispatch a shipment</h2><span>SUPPLY TRANSFER</span></div><div class="form-grid">${selectField('freight_source',Object.keys(hubNames),freight.source,hubNames)}${selectField('freight_target',Object.keys(hubNames),freight.target,hubNames)}${selectField('freight_resource',catalog.resources,freight.resource,resourceName)}<label class="field"><span>CARGO QUANTITY</span><input data-field="freight_amount" type="number" min="1" max="80" value="${freight.amount}"></label></div>
    <div class="freight-visual"><div class="freight-node">${esc(hub(freight.source)?.name||'Origin')}</div><div class="freight-link"><span>◀── ◇ ──▶</span><small>SCHEDULED TRANSPORT</small></div><div class="freight-node">${esc(hub(freight.target)?.name||'Destination')}</div></div><p class="field-description">Cargo leaves the source immediately, travels over one or more turns, then appears at the destination. The first successful shipment establishes a reusable route.</p><button class="button primary full" data-action="shipment" ${pending?'disabled':''}>DISPATCH CARGO →</button></section>
    <section class="surface-card"><div class="subheading"><h2>Network links</h2><span>ESTABLISHED ROUTES</span></div>${routeLabels.length?routeLabels.map(r=>`<div class="route-row"><span>⇄</span><b>${esc(r)}</b>${pill('ACTIVE','green')}</div>`).join(''):'<div class="empty-state">No supply corridors yet. Send a shipment between two hubs to establish a connection.</div>'}<div class="subheading" style="margin-top:30px"><h2>Shipments in transit</h2><span>${activeCargo().length} ACTIVE</span></div>${activeCargo().length?activeCargo().map(s=>`<div class="timeline-row"><span class="timeline-mark cargo">⇄</span><div><b>${s.amount} ${esc(resourceName[s.resource])}</b><small>${esc(hub(s.source)?.name||s.source)} → ${esc(hub(s.target)?.name||s.target)}</small></div><span class="eta">${until(s.arrivesAt)}</span></div>`).join(''):'<div class="empty-state">No freight currently in transit.</div>'}</section></div>`;
}

function researchView(){
  const current=state.research;
  return `${ribbon('RESEARCH DIVISION','BRANCHING TECHNOLOGY PROGRAMME')}<div class="page-heading"><div><h1>Knowledge opens worlds.</h1><p>Research costs scientific data and credits, then progresses as turns advance.</p></div>${pill(`${num(state.science)} SCI AVAILABLE`,'green')}</div>
  ${current?`<div class="research-progress"><span>◇</span><div><b>${esc(catalog.research[current.id].name)} · IN PROGRESS</b><small>Completion on turn ${current.completesAt} · ${until(current.completesAt)}</small></div></div>`:''}
  <div class="tech-grid">${Object.entries(catalog.research).map(([id,item])=>{const unlocked=state.tech.includes(id),requirements=item.requires.filter(r=>!state.tech.includes(r)),ready=!unlocked&&!current&&!requirements.length&&state.science>=item.science&&state.credits>=item.credits;return `<article class="tech-card ${unlocked?'unlocked':''}"><div class="tech-head"><span>✧</span>${pill(unlocked?'RESEARCHED':current?.id===id?'IN PROGRESS':requirements.length?'LOCKED':'AVAILABLE',unlocked?'green':'')}</div><h2>${esc(item.name)}</h2><p>${esc(item.description)}</p><div class="tech-prereq">${item.requires.length?'REQUIRES '+item.requires.map(r=>esc(catalog.research[r].name)).join(', '):'FOUNDATIONAL TECHNOLOGY'}</div><div class="tech-cost"><span>${item.science} SCI · ${item.credits} CR</span><span>${item.turns} TURNS</span></div><button class="button ${ready?'primary':'secondary'} full" data-action="research" data-id="${id}" ${ready?'':'disabled'}>${unlocked?'COMPLETED':current?.id===id?'RESEARCHING':requirements.length?'PREREQUISITE NEEDED':'START RESEARCH →'}</button></article>`;}).join('')}</div>`;
}

function assistantMessage() {
  const topics={
    welcome:`Commander, ${state.hubs.length} hubs are online. Each has its own stockpile. Use the Mission Designer to launch new outposts; never assume resources teleport between worlds.`,
    ships:'Choose a hull, engine, trajectory, and payload. The Python flight planner estimates mass, fuel, travel turns and arrival risk. These are game estimates, pending GMAT data.',
    exploration:'Nearby fogged tiles can be scanned freely. Distant sites need an available rover; after its travel time, the sector reveals immediately. No action points limit your orders.',
    logistics:'Select two hubs in Logistics and dispatch a shipment. It consumes fuel and credits, travels for turns, and establishes a supply corridor when delivered.',
    survival:'Crewed outposts consume food, water, oxygen, heat and power each turn. Supply shortages lower crew health. Solar arrays, extractors, heaters and greenhouses help balance production.',
  };
  if(state.event)return `Warning: ${state.event.title}. Resolve the event before advancing. Defensive preparation costs local materials; enduring can damage reserves.`;
  if(assistantTopic==='welcome'&&activeFlights().length)return `${activeFlights().length} spacecraft in flight. Open the mission timeline to track their estimated arrival, or advance a turn to progress travel and production.`;
  return topics[assistantTopic]||topics.welcome;
}

function advisor(){return `<aside class="advisor-panel"><div class="advisor-head"><span class="aura-avatar">✺</span><div><b>A.U.R.A.</b><small>MISSION CONTROL ADVISOR</small></div>${pill('GUIDANCE','green')}</div><div class="advisor-body"><div class="aura-message">${esc(assistantMessage())}</div><p class="aura-caption">Ask AURA about:</p><div class="aura-topics">${[['ships','Ship design'],['exploration','Exploration'],['logistics','Cargo routes'],['survival','Survival']].map(([key,label])=>`<button data-action="advisor-topic" data-id="${key}" class="${assistantTopic===key?'selected':''}">${label}</button>`).join('')}</div><div class="advisor-notice">ⓘ This offline guide uses authored, state-aware explanations. Live AI integration is not enabled.</div></div><button class="advisor-manual" data-action="assistant">OPEN INTRODUCTION ↗</button></aside>`;}

function modalMarkup(){
  if(!modal)return '';
  if(modal==='intro')return `<div class="modal-scrim"><section class="aura-modal" role="dialog" aria-modal="true" aria-labelledby="aura-title"><div class="modal-aura">✺</div><div class="eyebrow">A.U.R.A. · INCOMING BRIEFING</div><h2 id="aura-title">Welcome to<br><em>interplanetary command.</em></h2><p>Commander, you're directing a space programme across Mars, Venus, Mercury and Europa. Every spacecraft you build and every shipment you send changes what your missions can accomplish.</p><div class="intro-steps"><div><span>01</span><b>DESIGN</b><small>Choose hull, engine, trajectory and payload.</small></div><div><span>02</span><b>EXPLORE</b><small>Deploy hubs and dispatch rovers into the unknown.</small></div><div><span>03</span><b>CONNECT</b><small>Link stations with real cargo transfers.</small></div></div><div class="modal-buttons"><button class="button secondary" data-action="intro-skip">EXPLORE FREELY</button><button class="button primary" data-action="intro-plan">DESIGN FIRST MISSION ↗</button></div><div class="modal-disclaimer">Physics coefficients are simplified game estimates. Give us your GMAT inputs to refine trajectory calculations.</div></section></div>`;
  if(modal==='event'&&state.event)return `<div class="modal-scrim"><section class="aura-modal event-modal" role="dialog" aria-modal="true" aria-labelledby="event-title"><div class="modal-aura danger">!</div><div class="eyebrow">ENVIRONMENTAL EVENT · TURN ${fmtTurn(state.turn)}</div><h2 id="event-title">${esc(state.event.title)}</h2><p>${esc(state.event.description)}</p><div class="event-options">${state.event.choices.map(c=>`<button class="event-option" data-action="event-choice" data-id="${esc(c.id)}"><b>${esc(c.label)} →</b><span>${esc(c.description)}</span></button>`).join('')}</div></section></div>`;
  if(modal==='reset')return `<div class="modal-scrim"><section class="aura-modal compact" role="dialog" aria-modal="true" aria-labelledby="reset-title"><div class="eyebrow">CAMPAIGN RESET</div><h2 id="reset-title">Start a new space programme?</h2><p>Your current browser save will be replaced. Consider keeping this run open if you want to continue it.</p><div class="modal-buttons"><button class="button secondary" data-action="dismiss-modal">CANCEL</button><button class="button primary" data-action="confirm-reset">RESET CAMPAIGN</button></div></section></div>`;
  return '';
}

function activeSurface(){const candidates=state.hubs.filter(h=>h.world===selectedWorld&&h.kind==='surface');return candidates.find(h=>h.id===selectedHub)||candidates[0]||null;}

async function selectMapTile(index){
  selectedTile=index;
  const surface=activeSurface();
  if(!surface){render();return;}
  const tile=surface.tiles[index];
  if(selectedBuilding){
    if(!tile.revealed||tile.building){notify('Choose an empty surveyed sector touching a facility.',true);render();return;}
    const previous=state;
    await perform('construct',{hub:surface.id,tile:index,building:selectedBuilding});
    if(state!==previous)selectedBuilding=null;
    render();return;
  }
  if(!tile.revealed)await perform('explore',{hub:surface.id,tile:index});
  else render();
}

function mountGameMap(){
  const canvas=document.querySelector('#planet-map');
  if(!canvas)return;
  const surface=activeSurface();
  mapController=mountPlanetMap(canvas,document.querySelector('#mini-map'),{
    world:selectedWorld,hubId:surface?.id,size:catalog.mapSize||32,tiles:surface?.tiles||[],
    selection:selectedTile,turn:state.turn,
    expeditions:state.expeditions.filter(e=>surface&&e.hub===surface.id&&e.status==='en_route').map(e=>e.tile),
    onSelect:selectMapTile,
  });
}

function render(){
  if(!state||!catalog)return;
  const secondary=tab==='planner'?plannerView():tab==='logistics'?logisticsView():tab==='research'?researchView():'';
  app.innerHTML=`<div class="campaign-app map-mode">${topbar()}<main class="map-main">${mapScreen({catalog,state,selectedWorld,selectedHub,selectedBuilding,selectedTile,pending})}${secondary?`<div class="game-screen-dimmer"></div><section class="game-screen-panel"><button class="map-back" data-action="nav" data-id="system">← BACK TO MAP</button>${secondary}</section>`:''}</main></div>${modalMarkup()}`;
  document.querySelector('.campaign-app').inert=Boolean(modal);
  mountGameMap();
}

async function refreshQuote(){
  if(!state||!catalog)return;
  const ticket=++quoteId;
  try {const calculated=await api('/api/campaign/quote',{state,design:draft});if(ticket===quoteId){quote=calculated;render();}}
  catch(error){if(ticket===quoteId){quote={ok:false,error:error.message};render();}}
}

async function perform(action,args={}){
  if(pending)return;
  pending=true;
  try{
    const result=await api('/api/campaign/action',{state,action,args});
    if(!result.ok){notify(result.message||'Mission command was rejected.',true);return;}
    const oldCount=state.hubs.length;
    state=result.state;save();notify(result.message||'Mission control acknowledged.');
    if(state.hubs.length>oldCount&&tab==='planner'){selectedHub=state.hubs.at(-1).id;selectedWorld=state.hubs.at(-1).world;}
    if(state.event)modal='event';
    render();
    refreshQuote();
  }catch(error){notify(error.message,true);}finally{pending=false;render();}
}

function chooseDestination(id){selectedWorld=id;draft.destination=id;draft.site=world(id).sites[0];draft.objective='surface';tab='planner';quote=null;render();refreshQuote();}

app.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');
  if(!button||button.disabled)return;
  const action=button.dataset.action,id=button.dataset.id;
  if(action==='nav'){tab=id;selectedBuilding=null;render();if(tab==='planner')refreshQuote();return;}
  if(action==='map-world'){
    selectedWorld=id;const established=state.hubs.find(h=>h.world===id&&h.kind==='surface')||state.hubs.find(h=>h.world===id);
    if(established)selectedHub=established.id;
    selectedTile=(catalog.mapSize||32)*(catalog.mapSize||32)/2+(catalog.mapSize||32)/2;
    selectedBuilding=null;tab='system';render();return;
  }
  if(action==='map-hub'){selectedHub=id;selectedWorld=hub(id).world;selectedTile=528;selectedBuilding=null;tab='system';render();return;}
  if(action==='map-plan'){draft.destination=selectedWorld==='earth'?'mars':selectedWorld;draft.site=world(draft.destination).sites[0];draft.objective='surface';tab='planner';render();refreshQuote();return;}
  if(action==='map-zoom-in'){mapController?.zoom(1.22);return;}
  if(action==='map-zoom-out'){mapController?.zoom(1/1.22);return;}
  if(action==='map-center'){mapController?.centerOn();return;}
  if(action==='map-overview'){mapController?.overview();return;}
  if(action==='select-world'){
    selectedWorld=id;
    const established=state.hubs.find(h=>h.world===id);
    if(established){selectedHub=established.id;selectedTile=528;selectedBuilding=null;tab='hubs';render();}
    else chooseDestination(id);
    return;
  }
  if(action==='select-hub'){selectedHub=id;selectedWorld=hub(id).world;selectedTile=528;selectedBuilding=null;tab='hubs';render();return;}
  if(action==='choose-destination'){chooseDestination(id);return;}
  if(action==='payload'){draft.payload=draft.payload.includes(id)?draft.payload.filter(item=>item!==id):[...draft.payload,id];quote=null;render();refreshQuote();return;}
  if(action==='quote'){refreshQuote();return;}
  if(action==='launch'){await perform('launch',{design:draft});return;}
  if(action==='build-mode'){selectedBuilding=selectedBuilding===id?null:id;render();return;}
  if(action==='cancel-build'){selectedBuilding=null;render();return;}
  if(action==='tile'){
    selectedTile=Number(id);
    const selected=hub(selectedHub).tiles[selectedTile];
    if(selectedBuilding){const original=state;await perform('construct',{hub:selectedHub,tile:selectedTile,building:selectedBuilding});if(state!==original)selectedBuilding=null;render();}
    else if(!selected.revealed)await perform('explore',{hub:selectedHub,tile:selectedTile});
    else render();
    return;
  }
  if(action==='shipment'){await perform('shipment',{...freight,amount:Number(freight.amount)});return;}
  if(action==='research'){await perform('research',{tech:id});return;}
  if(action==='advance'){await perform('advance');return;}
  if(action==='event-choice'){modal=null;await perform('eventChoice',{choice:id});if(state.event)modal='event';render();return;}
  if(action==='assistant'){modal='intro';render();return;}
  if(action==='advisor-topic'){assistantTopic=id;render();return;}
  if(action==='intro-skip'){modal=state.event?'event':null;render();return;}
  if(action==='intro-plan'){modal=state.event?'event':null;tab='planner';render();refreshQuote();return;}
  if(action==='reset'){modal='reset';render();return;}
  if(action==='dismiss-modal'){modal=null;render();return;}
  if(action==='confirm-reset'){
    try {state=(await api('/api/campaign/new',{seed:`HORIZON-${Date.now().toString(36).toUpperCase().slice(-6)}`})).state;selectedHub='H2';selectedWorld='mars';selectedTile=528;selectedBuilding=null;tab='system';modal='intro';quote=null;save();render();refreshQuote();}
    catch(error){notify(error.message,true);}return;
  }
});

app.addEventListener('change',async event=>{
  const control=event.target,field=control.dataset.field;
  if(!field)return;
  if(field==='hub'){selectedHub=control.value;selectedWorld=hub(selectedHub).world;selectedTile=528;selectedBuilding=null;render();return;}
  if(field==='crew'){await perform('assignCrew',{hub:selectedHub,index:Number(control.dataset.index),assignment:control.value});return;}
  if(field.startsWith('freight_')){freight[field.slice(8)]=field==='freight_amount'?Number(control.value):control.value;render();return;}
  draft[field]=control.value;
  if(field==='destination'){selectedWorld=draft.destination;draft.site=world(draft.destination).sites[0];}
  if(field==='objective'){draft.site=field==='objective'&&draft.objective==='surface'?world(draft.destination).sites[0]:draft.objective==='orbital'?'Orbital Station':'Remote Survey';}
  quote=null;render();refreshQuote();
});

document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal&&modal!=='event'){modal=state?.event?'event':null;render();}});

initialize();
