/** Browser interface for the Python-authoritative interplanetary campaign. */
import {mountPlanetMap} from './planet-map.js';
import {mapScreen} from './map-ui.js';
import {solarSystemView,mountSolarSystem} from './solar-system.js';
import {softwareView, programView, softwareConfig, ordersConfig, guideSteps} from './program-ui.js';
import {applyRuleAction, applyRuleField} from './rule-editor.js';
import {playLaunch, playArrival} from './flight-view.js';

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
let mapController=null, mapMotion=true;
let inspection=null, inspectionKey=null, inspectionRequest=0;
let solarOpen=false,solarSelected='mars',solarRoutes=true,solarController=null;
const solarCamera={x:0,y:0,zoom:1};
const solarMotion={paused:false,elapsedMs:0};
let modal='intro', assistantTopic='welcome';
let draft={source:'H1',destination:'mars',site:'Jezero Rim',objective:'surface',hull:'lander',engine:'chemical',trajectory:'balanced',payload:['survey','lab'],vehicle:'atlas_v_401',propellantKg:600};
let softwareDraft=null, ordersDraft=null, softwareTest=null, guideHidden=false;
const GUIDE_KEY='ares.first-light.guide-hidden';
try{guideHidden=localStorage.getItem(GUIDE_KEY)==='1';}catch{/* storage unavailable */}
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
    resetDrafts();
    save(); render(); refreshQuote();
  }catch(error){app.innerHTML=`<main class="error-page"><h1>Mission engine unavailable</h1><p>${esc(error.message)}</p><p>Run <code>python3 -m ares.server</code> from the project directory.</p><button onclick="location.reload()">Retry connection</button></main>`;}
}

function hub(id) { return state.hubs.find(h=>h.id===id); }
function resetDrafts(){softwareDraft=JSON.parse(JSON.stringify(state.software));ordersDraft=JSON.parse(JSON.stringify(state.orders));}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function turnDate(turn){const d=new Date(Date.UTC(...catalog.campaignStart.split('-').map((v,i)=>i===1?Number(v)-1:Number(v))));d.setUTCDate(d.getUTCDate()+catalog.turnDays*(turn-1));return d.toISOString().slice(0,10);}
function world(id) { return catalog.worlds[id]; }
function activeFlights(){return state.missions.filter(x=>x.status==='in_flight');}
function activeCargo(){return state.shipments.filter(x=>x.status==='in_flight');}
function hubCount(id){return state.hubs.filter(h=>h.world===id).length;}
function until(turn){return `${Math.max(0,turn-state.turn)} TURN${Math.max(0,turn-state.turn)===1?'':'S'}`;}

function navButton(id,label,icon) {return `<button class="nav-item ${tab===id?'active':''}" data-action="nav" data-id="${id}" aria-pressed="${tab===id}" title="${label}" aria-label="${label}"><span>${icon}</span>${label}</button>`;}

function topbar() {
  return `<header class="topbar"><button class="brand" data-action="nav" data-id="system" aria-label="Ares interplanetary command home"><span class="brand-mark">✦</span><span>ARES <small>INTERPLANETARY COMMAND</small></span></button>
  <nav class="topnav" aria-label="Game navigation">${navButton('system','PLANET MAP','◈')}${navButton('planner','SHIPYARD','⌁')}${navButton('hubs','OUTPOSTS','▦')}${navButton('logistics','SUPPLY LINES','⇄')}${navButton('research','TECH TREE','✧')}${navButton('software','SOFTWARE','⌬')}${navButton('program','PROGRAMME','◎')}</nav>
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
    ...state.surveys.filter(e=>e.status==='en_route').map(e=>({id:e.id,name:`Regional survey · ${hub(e.hub)?.name||e.hub}`,time:e.arrivesAt,kind:'SURVEY',color:'survey'})),
  ].sort((a,b)=>a.time-b.time);
  return records.length?records.slice(0,limit).map(m=>`<div class="timeline-row"><span class="timeline-mark ${m.color}">↗</span><div><b>${esc(m.id)} · ${esc(m.name)}</b><small>${m.kind}</small></div><span class="eta">${until(m.time)}</span></div>`).join(''):'<div class="empty-state">No spacecraft or regional surveys in progress. Design a mission or dispatch supplies to begin.</div>';
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

const outcomeText={go:'ALL CHECKS PASS',scrub:'WILL BE SCRUBBED',stranded:'WILL BE STRANDED',flyby:'WILL FLY PAST',drift:'WILL DRIFT PAST'};
function windowStrip(){
  if(!quote.windows?.length)return '';
  const max=Math.max(...quote.windows.map(w=>Math.min(w.totalDvKms,20)));
  return `<div class="window-strip" aria-label="Lowest total delta-v for the next 12 turns"><div class="eyebrow">NEXT 12 TURNS · LOWER BAR = CHEAPER TRANSFER</div><div class="window-bars">${quote.windows.map(w=>`<span class="window-bar ${w.turn===state.turn?'now':''} ${w.safeDvKms!==null&&w.safeDvKms<=w.totalDvKms+0.6?'reachable':''}" style="--h:${Math.round(Math.min(w.totalDvKms,20)/max*100)}%" title="Turn ${w.turn} (${w.date}): ${w.totalDvKms} km/s total, C3 ${w.c3}"><i></i><small>${w.turn}</small></span>`).join('')}</div></div>`;
}
function quotePanel() {
  if(!quote)return `<div class="quote-panel"><div class="eyebrow">FLIGHT CALCULATION</div><p>Calculating launch parameters with Python...</p></div>`;
  if(!quote.ok)return `<div class="quote-panel invalid"><div class="eyebrow">PLAN NEEDS WORK</div><p>${esc(quote.error)}</p></div>`;
  const t=quote.transfer,n=quote.numbers,sw=quote.software;
  return `<div class="quote-panel"><div class="eyebrow">LAUNCH CHECKS · ${esc(outcomeText[quote.outcome])}</div>
    <ul class="check-list">${quote.checks.map(c=>`<li class="${c.ok?'ok':'bad'}"><b>${c.ok?'✓':'✕'} ${esc(c.label)}</b><span>${esc(c.detail)}</span></li>`).join('')}
    <li class="${sw.passedNominal?(sw.passedHarsh?'ok':'warn'):'bad'}"><b>${sw.passedNominal?(sw.passedHarsh?'✓':'!'):'✕'} Flight software vs ${esc(sw.name.toLowerCase())}</b><span>${sw.passedNominal?(sw.passedHarsh?'Passes the lab test with margin for harsher conditions.':'Passes the lab test, but fails if conditions run 25% harsher.'):sw.lost?'Lab test: spacecraft LOST. Fix the rules in SOFTWARE before launching.':`Lab test: arrives damaged (${sw.science}/${sw.target} science).`}</span></li></ul>
    <div class="quote-grid"><div><small>LAUNCH</small><strong>${esc(t.launch)}</strong></div><div><small>ARRIVAL · TURN ${quote.arrivalTurn}</small><strong>${esc(t.arrival)}</strong></div><div><small>LAUNCH ENERGY C3</small><strong>${t.c3??'—'}<em> km²/s²</em></strong></div><div><small>ARRIVAL SPEED</small><strong>${t.arrivalVinf}<em> km/s</em></strong></div><div><small>DELTA-V NEED / HAVE</small><strong>${n.dvNeedKms} / ${n.dvHaveKms}<em> km/s</em></strong></div><div><small>LAUNCH MASS</small><strong>${num(n.launchKg)}<em> kg${n.vehicleCapacityKg!==null?' / '+num(n.vehicleCapacityKg):''}</em></strong></div><div><small>FUEL · CREDITS</small><strong>${quote.fuel}<em> U</em> · ${quote.credits}<em> CR</em></strong></div><div><small>SHIP MATERIALS</small><strong>${quote.materials}<em> MAT</em></strong></div></div>
    ${t.label?`<p class="field-description">${esc(t.label)}.</p>`:''}
    ${windowStrip()}
    ${quote.rescue?`<div class="callout">This landing will reopen the lost base at ${esc(quote.site)}.</div>`:''}
    ${!quote.affordable?'<div class="quote-warning">Insufficient resources at the departure hub. Refill or ship resources before launching.</div>':''}<p class="simulation-note">${esc(quote.notice)}</p></div>`;
}

function plannerView() {
  const sourceNames=Object.fromEntries(state.hubs.map(h=>[h.id,h.name]));
  const destinations=Object.keys(catalog.worlds).filter(x=>x!=='earth');
  const w=world(draft.destination);
  const sites=draft.objective==='surface'?w.sites:[draft.objective==='orbital'?'Orbital Station':'Remote Survey'];
  return `${ribbon('MISSION PLANNING','SHIPYARD / TRAJECTORY DESIGN')}<div class="page-heading"><div><h1>Design the impossible.</h1><p>Turn ${state.turn} · ${turnDate(state.turn)}. Earth launches are checked against NASA GMAT data: planet positions, launch energy and real rocket limits.</p></div>${pill('GMAT LAUNCH WINDOWS')}</div>
  <div class="planner-layout"><section class="surface-card planner-form"><div class="subheading"><h2>01 · Mission brief</h2><span>ROUTE</span></div>
  <div class="form-grid">${selectField('source',Object.keys(sourceNames),draft.source,sourceNames)}${selectField('destination',destinations,draft.destination,Object.fromEntries(destinations.map(id=>[id,world(id).name])))}${selectField('objective',['surface','orbital','survey'],draft.objective,{surface:'Establish surface hub',orbital:'Deploy orbital hub',survey:'Robotic science survey'})}${selectField('site',sites,draft.site)}</div>
  <div class="subheading"><h2>02 · Configure spacecraft</h2><span>ENGINEERING</span></div><div class="form-grid">${selectField('hull',Object.keys(catalog.hulls),draft.hull,Object.fromEntries(Object.entries(catalog.hulls).map(([id,v])=>[id,`${v.name} · ${num(v.dryKg)} kg dry`])))}${selectField('engine',Object.keys(catalog.engines),draft.engine,Object.fromEntries(Object.entries(catalog.engines).map(([id,v])=>[id,`${v.name} · Isp ${v.isp} s`])))}${selectField('trajectory',Object.keys(catalog.trajectories),draft.trajectory,Object.fromEntries(Object.entries(catalog.trajectories).map(([id,v])=>[id,v.name])))}${hub(draft.source)?.world==='earth'?selectField('vehicle',Object.keys(catalog.vehicles),draft.vehicle,Object.fromEntries(Object.entries(catalog.vehicles).map(([id,v])=>[id,`${v.name}${v.source==='estimate'?' (estimate)':''} · ${v.credits} CR`]))):''}</div>
  <p class="field-description">${esc(catalog.trajectories[draft.trajectory].description)} ${esc(catalog.engines[draft.engine].description)}${hub(draft.source)?.world==='earth'?' '+esc(catalog.vehicles[draft.vehicle].note):''}</p>
  <label class="field propellant-field"><span>PROPELLANT LOAD · ${num(draft.propellantKg)} KG · ${Math.ceil(draft.propellantKg/catalog.fuelUnitKg)} FUEL UNITS</span><div class="propellant-row"><input type="range" data-field="propellantKg" min="0" max="${catalog.propellantMaxKg}" step="50" value="${draft.propellantKg}" aria-label="Propellant load in kilograms"><input type="number" data-field="propellantKg" min="0" max="${catalog.propellantMaxKg}" step="10" value="${draft.propellantKg}" aria-label="Propellant kilograms"></div></label>
  <div class="subheading"><h2>03 · Select payload</h2><span>MULTIPLE MODULES</span></div><div class="payload-grid">${Object.entries(catalog.payloads).map(([id,p])=>`<button class="payload-card ${draft.payload.includes(id)?'selected':''}" aria-pressed="${draft.payload.includes(id)}" data-action="payload" data-id="${id}"><span class="payload-check">${draft.payload.includes(id)?'✓':'+'}</span><strong>${esc(p.name)}</strong><small>${num(p.mass)} kg · ${p.materials} MAT</small><span>${esc(p.description)}</span></button>`).join('')}</div>
  <div class="planner-actions"><button class="button secondary" data-action="quote">RECALCULATE</button><button class="button primary ${quote?.ok&&quote.outcome!=='go'?'risky':''}" data-action="launch" ${!quote?.ok||!quote?.affordable||pending?'disabled':''}>${quote?.ok&&quote.outcome!=='go'?'LAUNCH ANYWAY…':'AUTHORIZE LAUNCH ↗'}</button></div></section>
  <aside class="planner-preview">${shipBlueprint()}${quotePanel()}<div class="mission-advice"><span>✺ AURA'S NOTE</span><p>Planets line up for cheap transfers only every so often: watch the 12-turn strip. More propellant means a bigger braking burn but a heavier rocket load. Every check must be green, and your flight software must survive the approach.</p></div></aside></div>`;
}

function stockCards(h) {return `<div class="stock-grid">${Object.entries(h.stocks).map(([key,value])=>`<div class="stock-item"><small>${esc(resourceName[key]||key)}</small><strong>${num(value)}</strong></div>`).join('')}</div>`;}

function tileLabel(tile,h) {
  const task=state.surveys.find(e=>e.hub===h.id&&e.tile===tile.id&&e.status==='en_route');
  if(!tile.revealed)return task?`<small>SURVEY</small><b>${until(task.arrivesAt)}</b>`:'<b class="question">?</b>';
  return `<small>${esc(terrainLabel[tile.terrain]||'BASE')}</small><b>${tile.building?esc(tile.building.type==='habitat'?'⌂':tile.building.type==='solar'?'☀':tile.building.type==='shield'?'⬡':'◈'):'·'}</b><span>${tile.id+1}</span>`;
}

function controlView() {
  const h=hub(selectedHub);
  return `${ribbon('MISSION CONTROL','EARTH / OPERATIONS')}<div class="page-heading"><div><h1>${esc(h.name)}</h1><p>Design spacecraft, send supplies, and research technology for your outposts.</p></div>${pill('COMMAND HUB ONLINE','green')}</div>
    <div class="form-grid"><button class="button primary" data-action="map-plan">DESIGN MISSION ↗</button><button class="button secondary" data-action="map-supply" data-id="${esc(h.id)}">SEND RESOURCES →</button><button class="button secondary" data-action="nav" data-id="research">OPEN TECH TREE →</button></div>
    <section class="surface-card inventory-panel"><div class="subheading"><h2>Earth stockpile</h2><span>AVAILABLE FOR LAUNCHES &amp; SHIPMENTS</span></div>${stockCards(h)}</section>`;
}

function hubsView() {
  const h=hub(selectedHub)||state.hubs[0];
  const hubOptions=Object.fromEntries(state.hubs.map(x=>[x.id,x.name]));
  const operations=h.kind==='surface';
  const tile=h.tiles[selectedTile]||h.tiles[12];
  return `${ribbon('COLONY OPERATIONS','SURFACE / ORBITAL HUBS')}<div class="page-heading"><div><h1>Every outpost matters.</h1><p>Hubs have their own stockpiles. Resources move only when you schedule a shipment.</p></div>${pill('NO ACTION POINTS','green')}</div>
  <div class="hub-picker">${selectField('hub',Object.keys(hubOptions),h.id,hubOptions)}<div><small>LOCATION</small><b>${esc(world(h.world).name)} · ${esc(h.kind.toUpperCase())}</b></div><div><small>CREW HEALTH</small><b>${h.crew.length?`${h.health}%`:'AUTONOMOUS'}</b></div><div><small>SURVEY UPLINK</small><b>${h.surveyUntil>state.turn?`BUSY TO T${h.surveyUntil}`:'READY'}</b></div></div>
  ${operations?`<div class="hub-layout"><section class="surface-card terrain-panel"><div class="subheading"><h2>Sector map · ${esc(h.site)}</h2><span>${h.tiles.filter(t=>t.revealed).length}/${h.tiles.length} SURVEYED</span></div><p class="field-description">Select a sector, then use Scan Sector in the map inspector. Regional surveys cost energy and take up to three turns. Choose a building and review its site costs before selecting Build Here.</p>
  <div class="terrain-map world-map-${h.world}">${h.tiles.map(tile=>`<button class="terrain-tile ${tile.revealed?'surveyed':'hidden'} ${tile.terrain||''} ${selectedTile===tile.id?'picked':''} ${selectedBuilding?'building-mode':''}" data-action="tile" data-id="${tile.id}" title="Sector ${tile.id+1}${tile.revealed?` · ${tile.terrain}`:' · Unexplored'}" aria-label="Sector ${tile.id+1}, ${tile.revealed?tile.terrain:'unexplored'}">${tileLabel(tile,h)}</button>`).join('')}</div>
  <div class="terrain-foot"><span>▦ BASE CONNECTIVITY REQUIRED</span><span>${selectedBuilding?`PLACING ${esc(catalog.buildings[selectedBuilding].name)}`:'SURVEY MODE'}</span></div></section>
  <aside class="surface-card inspector"><div class="subheading"><h2>Sector ${tile.id+1}</h2><span>${tile.revealed?'SURVEYED':'FOG OF WAR'}</span></div><div class="inspector-illustration ${tile.terrain||'unknown'}">${tile.revealed?(tile.building?'⌂':glyph[h.world]):'？'}</div><h3>${tile.revealed?esc((terrainLabel[tile.terrain]||'Unknown')+' TERRAIN'):'Uncharted region'}</h3><p>${tile.revealed?(tile.building?`Installed ${tile.building.type}. ${tile.building.onlineFrom>state.turn?`Online on turn ${tile.building.onlineFrom}.`:'Currently operating if supplied.'}`:'A candidate for construction, subject to site and resource requirements.'):'Free scans cover the immediate hub perimeter. Regional surveys use energy to map a 3×3 area.'}</p>
  ${selectedBuilding?`<div class="callout">Construction selected: <b>${esc(catalog.buildings[selectedBuilding].name)}</b>. Select an empty surveyed neighboring tile and choose Build Here.</div><button class="button secondary full" data-action="cancel-build">CANCEL CONSTRUCTION</button>`:`<div class="callout">${tile.revealed?'Select a structure below to begin planning.':'Select this sector, then start a survey in the map inspector.'}</div>`}</aside></div>
  <div class="surface-card"><div class="subheading"><h2>Construction bay</h2><span>MATERIALS + TIME · NO AP</span></div><div class="building-grid">${Object.entries(catalog.buildings).map(([id,b])=>`<button class="building-card ${selectedBuilding===id?'selected':''}" data-action="build-mode" data-id="${id}"><span class="building-symbol">${id==='solar'?'☀':id==='heater'?'♨':id==='extractor'?'≋':id==='greenhouse'?'❀':id==='laboratory'?'✧':id==='shield'?'⬡':'▤'}</span><b>${esc(b.name)}</b><small>${b.materials} MAT · ${b.turns} TURN${b.turns>1?'S':''}</small><span>${esc(b.description)}</span></button>`).join('')}</div></div>`:`<section class="surface-card orbit-panel"><div class="orbital-symbol">◇</div><h2>${h.kind==='control'?'Earth-based command center':'Orbital refueling and communications station'}</h2><p>${h.kind==='control'?'The central shipyard finances missions and manufactures launch materials and fuel each turn.':'Orbital hubs stock fuel and contribute scientific data each turn. They reduce flight costs and connect surface stations through cargo spacecraft.'}</p><button class="button primary" data-action="nav" data-id="logistics">SEND RESOURCES →</button></section>`}
  <section class="surface-card inventory-panel"><div class="subheading"><h2>Local inventories</h2><span>NO AUTOMATIC SHARING</span></div>${stockCards(h)}</section>
  ${h.crew.length?`<section class="surface-card"><div class="subheading"><h2>Astronaut assignments</h2><span>REAL-TIME COMMANDS · NO AP</span></div><div class="crew-grid">${h.crew.map((person,i)=>`<label class="crew-card"><span class="crew-avatar">${esc(person.name.split(' ').map(n=>n[0]).join(''))}</span><b>${esc(person.name)}</b><small>${esc(person.specialty)}</small><select data-field="crew" data-index="${i}">${['engineering','science','survival'].map(role=>`<option value="${role}" ${person.assigned===role?'selected':''}>${role.toUpperCase()}</option>`).join('')}</select></label>`).join('')}</div></section>`:''}
  <section class="surface-card"><div class="subheading"><h2>Regional surveys</h2><span>REMOTE SENSING</span></div>${state.surveys.filter(e=>e.hub===h.id&&e.status==='en_route').map(e=>`<div class="timeline-row"><span class="timeline-mark survey">⟡</span><div><b>Survey ${e.id} → Sector ${e.tile+1}</b><small>Survey in progress</small></div><span class="eta">${until(e.arrivesAt)}</span></div>`).join('')||'<p class="muted">No active regional survey. Select a sector on the map to inspect its survey cost.</p>'}</section>`;
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
    exploration:'Nearby fogged tiles can be scanned freely. Select a distant sector and start a regional survey: energy buys a 3×3 scan in one to three turns. Coasts supply water, fertile soil boosts food, and rocky terrain improves mining. Water plants feed greenhouses and oxygen plants. No action points limit your orders.',
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
  if(modal==='intro')return `<div class="modal-scrim"><section class="aura-modal" role="dialog" aria-modal="true" aria-labelledby="aura-title"><div class="modal-aura">✺</div><div class="eyebrow">A.U.R.A. · INCOMING BRIEFING</div><h2 id="aura-title">Welcome to<br><em>interplanetary command.</em></h2><p>Commander, it is ${turnDate(state.turn)}. Each turn is three months. Launch windows open and close with the real planets, missions can fail, storms can kill a crew, and a review board decides your budget every year.</p><div class="intro-steps"><div><span>01</span><b>WRITE RULES</b><small>Flight software and base orders react when Earth is too far away.</small></div><div><span>02</span><b>FLY THE WINDOWS</b><small>Pass every launch check with real rocket and orbit data.</small></div><div><span>03</span><b>KEEP THEM ALIVE</b><small>Supply, repair and prepare bases before hazards strike.</small></div></div><div class="modal-buttons"><button class="button secondary" data-action="intro-skip">EXPLORE FREELY</button><button class="button primary" data-action="intro-plan">DESIGN FIRST MISSION ↗</button></div><div class="modal-disclaimer">Earth-departure trajectories use NASA GMAT's bundled DE421 ephemeris and Atlas V 401 data, solved as Sun-only two-body transfers. Other values are labelled game estimates.</div></section></div>`;
  if(modal==='event'&&state.event)return `<div class="modal-scrim"><section class="aura-modal event-modal" role="dialog" aria-modal="true" aria-labelledby="event-title"><div class="modal-aura danger">!</div><div class="eyebrow">ENVIRONMENTAL EVENT · TURN ${fmtTurn(state.turn)}</div><h2 id="event-title">${esc(state.event.title)}</h2><p>${esc(state.event.description)}</p><div class="event-options">${state.event.choices.map(c=>`<button class="event-option" data-action="event-choice" data-id="${esc(c.id)}"><b>${esc(c.label)} →</b><span>${esc(c.description)}</span></button>`).join('')}</div></section></div>`;
  if(modal==='confirm-launch'&&quote?.ok){const failed=quote.checks.filter(c=>!c.ok);return `<div class="modal-scrim"><section class="aura-modal compact" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div class="modal-aura danger">!</div><div class="eyebrow">LAUNCH CHECK FAILED</div><h2 id="confirm-title">This mission ${esc((outcomeText[quote.outcome]||'').toLowerCase())}.</h2><ul class="check-list">${failed.map(c=>`<li class="bad"><b>✕ ${esc(c.label)}</b><span>${esc(c.detail)}</span></li>`).join('')}</ul><p>Launching anyway spends the credits${quote.outcome==='scrub'?'; the spacecraft is returned.':quote.outcome==='stranded'?', the spacecraft and its propellant.':' and the spacecraft will not achieve its objective.'}</p><div class="modal-buttons"><button class="button secondary" data-action="dismiss-modal">FIX THE PLAN</button><button class="button primary risky" data-action="confirm-launch">LAUNCH ANYWAY</button></div></section></div>`;}
  if(modal==='reset')return `<div class="modal-scrim"><section class="aura-modal compact" role="dialog" aria-modal="true" aria-labelledby="reset-title"><div class="eyebrow">CAMPAIGN RESET</div><h2 id="reset-title">Start a new space programme?</h2><p>Your current browser save will be replaced. Consider keeping this run open if you want to continue it.</p><div class="modal-buttons"><button class="button secondary" data-action="dismiss-modal">CANCEL</button><button class="button primary" data-action="confirm-reset">RESET CAMPAIGN</button></div></section></div>`;
  return '';
}

function guideCard(){
  if(guideHidden||!catalog.faults)return '';
  const steps=guideSteps(state,{software:catalog.faults.example,orders:catalog.orders.example});
  const index=steps.findIndex(s=>!s.done);
  if(index<0)return '';
  const step=steps[index];
  return `<aside class="guide-card" aria-label="First mission guide"><div class="hud-kicker">FIRST MISSION GUIDE · STEP ${index+1} / ${steps.length} <button class="guide-close" data-action="guide-hide" aria-label="Hide guide">✕</button></div><p>${step.action?`<button data-action="nav" data-id="${step.action}">${esc(step.text)} →</button>`:esc(step.text)}</p></aside>`;
}

function activeSurface(){const candidates=state.hubs.filter(h=>h.world===selectedWorld&&h.tiles.length);return candidates.find(h=>h.id===selectedHub)||candidates[0]||null;}

async function selectMapTile(index){
  selectedTile=index;
  const surface=activeSurface();
  if(!surface){
    const control=state.hubs.find(h=>h.world===selectedWorld&&h.kind==='control'),mid=Math.floor((catalog.mapSize||32)/2);
    if(control&&index===mid*(catalog.mapSize||32)+mid){selectedHub=control.id;tab='hubs';}
    render();return;
  }
  render();

}

function inspectionMatches(){const h=activeSurface();return inspectionKey?.state===state&&inspectionKey.hub===h?.id&&inspectionKey.tile===selectedTile;}
async function refreshInspection(){
  const h=activeSurface();
  if(!h){inspectionKey=null;inspection=null;inspectionRequest++;return;}
  if(inspectionMatches())return;
  const key={state,hub:h.id,tile:selectedTile},request=++inspectionRequest;
  inspectionKey=key;inspection=null;
  try{const result=await api('/api/campaign/inspect',{state,hub:h.id,tile:selectedTile});if(request===inspectionRequest&&inspectionMatches()){inspection=result;render();}}
  catch(error){if(request===inspectionRequest&&inspectionMatches()){inspection={ok:false,error:error.message};render();}}
}

function mountGameMap(){
  const canvas=document.querySelector('#planet-map');
  if(!canvas)return;
  const surface=activeSurface();
  const control=state.hubs.find(h=>h.world===selectedWorld&&h.kind==='control');
  mapController=mountPlanetMap(canvas,document.querySelector('#mini-map'),{
    world:selectedWorld,hubId:surface?.id||control?.id,size:catalog.mapSize||32,tiles:surface?.tiles||catalog.surfacePreviews[selectedWorld]||[],biomes:catalog.biomes,buildingMode:Boolean(selectedBuilding),motion:mapMotion,controlHub:Boolean(control&&!surface),
    selection:surface?selectedTile:null,turn:state.turn,
    surveys:state.surveys.filter(e=>surface&&e.hub===surface.id&&e.status==='en_route').map(e=>e.tile),
    onSelect:selectMapTile,
  });
}

function render(){
  if(!state||!catalog)return;
  const focused=document.activeElement;
  const mapFocus=focused?.id==='planet-map';
  const solarFocus=focused?.closest('.solar-dialog')?{tag:focused.tagName,action:focused.dataset.action,id:focused.dataset.id}:null;
  solarController?.destroy();solarController=null;
  const secondary=tab==='hubs'&&hub(selectedHub)?.kind==='control'?controlView():tab==='planner'?plannerView():tab==='logistics'?logisticsView():tab==='research'?researchView():tab==='software'?softwareView({catalog,state,softwareDraft,ordersDraft,softwareTest,dirtySoftware:!same(softwareDraft,state.software),dirtyOrders:!same(ordersDraft,state.orders)}):tab==='program'?programView({catalog,state,date:turnDate(state.turn)}):'';
  const lightWorld=selectedWorld==='earth'?null:selectedWorld;
  app.innerHTML=`<div class="campaign-app map-mode">${topbar()}<main class="map-main">${mapScreen({catalog,state,selectedWorld,selectedHub,selectedBuilding,selectedTile,pending,inspection:inspectionMatches()?inspection:null,mapMotion,date:turnDate(state.turn),lightMinutes:lightWorld?(catalog.lightMinutes?.[lightWorld]?.[(state.turn-1)%catalog.lightMinutes[lightWorld].length]??'—'):0,guide:guideCard()})}${secondary?`<div class="game-screen-dimmer"></div><section class="game-screen-panel"><button class="map-back" data-action="nav" data-id="system">← BACK TO MAP</button>${secondary}</section>`:''}</main></div>${solarOpen?solarSystemView({catalog,state,selected:solarSelected,showRoutes:solarRoutes,date:turnDate(state.turn)}):''}${modalMarkup()}`;
  document.querySelector('.campaign-app').inert=Boolean(modal||solarOpen);
  document.querySelector('[data-action="solar-open"]').setAttribute('aria-expanded',String(solarOpen));
  mountGameMap();
  if(mapFocus)document.querySelector('#planet-map')?.focus({preventScroll:true});
  refreshInspection();
  if(solarOpen){
    const panel=document.querySelector('.solar-dialog');
    solarController=mountSolarSystem(panel,solarCamera,solarMotion);
    const restored=solarFocus&&[...panel.querySelectorAll('[data-action]')].find(el=>el.tagName===solarFocus.tag&&el.dataset.action===solarFocus.action&&el.dataset.id===solarFocus.id);
    (restored||panel.querySelector('.solar-close')).focus({preventScroll:true});
  }
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
    const oldCount=state.hubs.length,oldTurn=state.turn,oldMissions=state.missions.length;
    state=result.state;save();notify(result.message||'Mission control acknowledged.');
    if(action==='setSoftware'||action==='setOrders')resetDrafts();
    if(action==='launch'&&state.missions.length>oldMissions){const m=state.missions.at(-1);render();await playLaunch({mission:{...m,outcome:m.status==='failed'?m.outcome:'launched'},catalog,tracks:catalog.orbitTracks});}
    if(action==='advance'){for(const m of state.missions.filter(m=>m.arrivesAt===state.turn&&m.departed<oldTurn+1&&(m.status==='complete'||m.status==='failed')&&m.outcome&&!['scrubbed','stranded'].includes(m.outcome))){render();await playArrival({mission:m,catalog,tracks:catalog.orbitTracks});}}
    if(state.hubs.length>oldCount&&tab==='planner'){selectedHub=state.hubs.at(-1).id;selectedWorld=state.hubs.at(-1).world;}
    if(state.event)modal='event';
    render();
    refreshQuote();
  }catch(error){notify(error.message,true);}finally{pending=false;render();}
}

/** First landing site with no base and no lander on the way; a lost base's site comes next (rescue). */
function freeSite(id){
  const sites=world(id).sites;
  const taken=site=>state.hubs.some(h=>h.world===id&&h.kind==='surface'&&h.site===site)||state.missions.some(m=>m.status==='in_flight'&&m.destination===id&&m.objective==='surface'&&m.site===site);
  return sites.find(site=>!taken(site))||sites.find(site=>state.hubs.some(h=>h.world===id&&h.site===site&&h.status==='lost'))||sites[0];
}

function chooseDestination(id){selectedWorld=id;draft.destination=id;draft.site=freeSite(id);draft.objective='surface';tab='planner';quote=null;render();refreshQuote();}

function closeSolar(){solarOpen=false;render();document.querySelector('[data-action="solar-open"]')?.focus({preventScroll:true});}
function openWorldMap(id,hubId){
  selectedWorld=id;
  const established=hub(hubId)||state.hubs.find(h=>h.world===id&&h.tiles.length)||state.hubs.find(h=>h.world===id);
  if(established)selectedHub=established.id;
  selectedTile=(catalog.mapSize||32)*(catalog.mapSize||32)/2+(catalog.mapSize||32)/2;
  selectedBuilding=null;tab='system';solarOpen=false;render();
  document.querySelector('[data-action="solar-open"]')?.focus({preventScroll:true});
}

app.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');
  if(!button||button.disabled)return;
  const action=button.dataset.action,id=button.dataset.id;
  if(action==='solar-open'){solarSelected=selectedWorld;solarOpen=true;render();return;}
  if(action==='solar-close'||(action==='solar-dismiss'&&event.target===button)){closeSolar();return;}
  if(action==='solar-select'){solarSelected=id;render();return;}
  if(action==='solar-zoom-in'){solarController?.zoom(1.25);return;}
  if(action==='solar-zoom-out'){solarController?.zoom(.8);return;}
  if(action==='solar-fit'){solarController?.fit();return;}
  if(action==='solar-motion'){solarController?.toggleMotion();return;}
  if(action==='solar-routes'){solarRoutes=!solarRoutes;render();return;}
  if(action==='solar-map'){openWorldMap(id);return;}
  if(action==='solar-plan'){solarOpen=false;chooseDestination(id);document.querySelector('.map-back')?.focus();return;}
  if(action==='solar-operations'){solarOpen=false;selectedHub=id;selectedWorld='earth';tab='hubs';render();document.querySelector('.map-back')?.focus();return;}
  if(action==='solar-hub'){
    const h=hub(id);if(!h)return;
    if(h.tiles.length){openWorldMap(h.world,id);return;}
    solarOpen=false;selectedHub=id;selectedWorld=h.world;freight.source=id;
    if(freight.target===id)freight.target=state.hubs.find(item=>item.id!==id)?.id||id;
    tab='logistics';render();document.querySelector('.map-back')?.focus();return;
  }
  if(action==='nav'){tab=id;selectedBuilding=null;if(tab==='software'&&same(softwareDraft,state.software)&&same(ordersDraft,state.orders))resetDrafts();render();if(tab==='planner')refreshQuote();return;}
  if(action==='map-world'){openWorldMap(id);return;}
  if(action==='map-hub'){selectedHub=id;selectedWorld=hub(id).world;selectedTile=528;selectedBuilding=null;tab='system';render();return;}
  if(action==='map-supply'){
    freight.source=id;
    if(freight.target===id)freight.target=state.hubs.find(h=>h.id!==id)?.id||id;
    tab='logistics';render();return;
  }
  if(action==='map-plan'){if(selectedWorld==='earth')draft.source=state.hubs.find(h=>h.kind==='control').id;draft.destination=selectedWorld==='earth'?'mars':selectedWorld;draft.site=freeSite(draft.destination);draft.objective='surface';tab='planner';render();refreshQuote();return;}
  if(action==='map-motion'){mapMotion=!mapMotion;render();return;}
  if(action==='survey-sector'){const h=activeSurface();if(h)await perform('explore',{hub:h.id,tile:selectedTile});return;}
  if(action==='construct-sector'){const h=activeSurface();if(h&&selectedBuilding){const previous=state;await perform('construct',{hub:h.id,tile:selectedTile,building:selectedBuilding});if(state!==previous)selectedBuilding=null;render();}return;}
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
  if(action==='launch'){if(quote?.ok&&quote.outcome!=='go'){modal='confirm-launch';render();return;}await perform('launch',{design:draft});return;}
  if(action==='confirm-launch'){modal=null;await perform('launch',{design:draft,confirm:true});return;}
  if(action==='guide-hide'){guideHidden=true;try{localStorage.setItem(GUIDE_KEY,'1');}catch{/* ignore */}render();return;}
  if(action==='prepare'){await perform('prepare',{forecast:id});return;}
  if(action==='repair'){const surface=activeSurface();if(surface)await perform('repair',{hub:surface.id,tile:Number(id)});return;}
  if(action==='pick-computer'){softwareDraft={...softwareDraft,computer:id};softwareTest=null;render();return;}
  if(action.startsWith('rule-')){const kind=button.dataset.kind;if(kind==='software'){const config={...softwareConfig(catalog),slots:catalog.computers[softwareDraft.computer].slots};softwareDraft={...softwareDraft,rules:applyRuleAction(softwareDraft.rules,action,button.dataset,config)};softwareTest=null;}else{ordersDraft=applyRuleAction(ordersDraft,action,button.dataset,ordersConfig(catalog,state));}render();return;}
  if(action==='software-test'){try{softwareTest=await api('/api/campaign/faults/test',{design:softwareDraft});}catch(error){softwareTest={ok:false,error:error.message};}render();return;}
  if(action==='software-save'){await perform('setSoftware',softwareDraft);refreshQuote();return;}
  if(action==='orders-save'){await perform('setOrders',{rules:ordersDraft});return;}
  if(action==='build-mode'){selectedBuilding=selectedBuilding===id?null:id;render();return;}
  if(action==='cancel-build'){selectedBuilding=null;render();return;}
  if(action==='tile'){await selectMapTile(Number(id));return;}
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
    try {state=(await api('/api/campaign/new',{seed:`HORIZON-${Date.now().toString(36).toUpperCase().slice(-6)}`})).state;resetDrafts();softwareTest=null;selectedHub='H2';selectedWorld='mars';selectedTile=528;selectedBuilding=null;tab='system';modal='intro';quote=null;save();render();refreshQuote();}
    catch(error){notify(error.message,true);}return;
  }
});

app.addEventListener('change',async event=>{
  const control=event.target,field=control.dataset.field;
  if(control.dataset.ruleField){
    if(control.dataset.kind==='software'){softwareDraft={...softwareDraft,rules:applyRuleField(softwareDraft.rules,control.dataset,control.value,softwareConfig(catalog))};softwareTest=null;}
    else ordersDraft=applyRuleField(ordersDraft,control.dataset,control.value,ordersConfig(catalog,state));
    render();return;
  }
  if(!field)return;
  if(field==='propellantKg'){draft.propellantKg=Math.max(0,Math.min(catalog.propellantMaxKg,Math.round(Number(control.value)||0)));quote=null;render();refreshQuote();return;}
  if(field==='hub'){selectedHub=control.value;selectedWorld=hub(selectedHub).world;selectedTile=528;selectedBuilding=null;render();return;}
  if(field==='crew'){await perform('assignCrew',{hub:selectedHub,index:Number(control.dataset.index),assignment:control.value});return;}
  if(field.startsWith('freight_')){freight[field.slice(8)]=field==='freight_amount'?Number(control.value):control.value;render();return;}
  draft[field]=control.value;
  if(field==='destination'){selectedWorld=draft.destination;draft.site=freeSite(draft.destination);}
  if(field==='objective'){draft.site=field==='objective'&&draft.objective==='surface'?freeSite(draft.destination):draft.objective==='orbital'?'Orbital Station':'Remote Survey';}
  quote=null;render();refreshQuote();
});

let propTimer=null;
app.addEventListener('input',event=>{
  const control=event.target;
  if(control.dataset.field!=='propellantKg'||control.type!=='range')return;
  draft.propellantKg=Number(control.value);
  const label=control.closest('.propellant-field')?.querySelector('span');
  if(label)label.textContent=`PROPELLANT LOAD · ${num(draft.propellantKg)} KG · ${Math.ceil(draft.propellantKg/catalog.fuelUnitKg)} FUEL UNITS`;
  clearTimeout(propTimer);propTimer=setTimeout(()=>{quote=null;refreshQuote();},180);
});

document.addEventListener('keydown',event=>{
  if(solarOpen){
    if(event.key==='Escape'){event.preventDefault();closeSolar();return;}
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('.solar-body')){event.preventDefault();solarSelected=event.target.dataset.id;render();return;}
    if(event.key==='Tab'){
      const controls=[...document.querySelectorAll('.solar-dialog button:not(:disabled),.solar-dialog [role="button"]')].filter(el=>el.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
    return;
  }
  if(event.key==='Escape'&&modal&&modal!=='event'){modal=state?.event?'event':null;render();}
});

initialize();
