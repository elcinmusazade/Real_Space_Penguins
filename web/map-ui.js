/** Immersive, map-first HUD; state mutations stay in the Python simulation. */
import {solarToggle} from './solar-system.js';

const safe = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatted = n => Math.round(Number(n)||0).toLocaleString('en-US');
const terrain = {plain:'PLAINS',ice:'ICE DEPOSIT',ridge:'ROCK RIDGE',science:'ANOMALY',salvage:'SALVAGE',hazard:'HAZARD ZONE'};
const signs = {reactor:'⚛',solar:'☀',extractor:'❄',greenhouse:'❀',laboratory:'⚗',heater:'♨',drill:'⚒',recycler:'♧',shield:'⬡'};

const statusLabel = {active:'COLONY ACTIVE',dark:'STATION DARK — SHIP 20+ ENERGY TO REVIVE',lost:'BASE LOST — LAND AGAIN TO REOPEN'};

function conditionBar(building){
  const c=building.condition??100,tone=c>=50?'good':c>0?'warn':'bad';
  return `<div class="condition-bar ${tone}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${c}" aria-label="Building condition"><span style="width:${c}%"></span></div><small class="condition-text">CONDITION ${c}%${c<50?(c>0?' · HALF OUTPUT':' · OFFLINE'):''}</small>`;
}

function surfacePlan({tile,selectedBuilding,inspection,catalog,pending,atmosphere}){
  if(!inspection)return '<p class="sector-instruction">Reading site conditions…</p>';
  if(!inspection.ok)return `<p class="sector-instruction">${safe(inspection.error)}</p>`;
  const plan=selectedBuilding?inspection.buildings[selectedBuilding]:inspection.facility;
  const flow=plan?`<div class="site-flow"><b>${safe(selectedBuilding?catalog.buildings[selectedBuilding].name:catalog.buildings[tile.building.type]?.name||(atmosphere?'Platform Core':'Command facility'))}</b><span>${Object.entries(plan.outputs).map(([k,v])=>`+${Math.ceil(v)} ${safe(k)}`).join(' · ')||'Colony support'} / turn</span><small>${Object.entries(plan.inputs).map(([k,v])=>`${v} ${safe(k)}`).join(' + ')||'No production inputs'}</small>${plan.bonuses.map(b=>`<em>${safe(b)}</em>`).join('')}<small>Full-condition rates; weather, orders and shortages can reduce output.</small></div>`:'';
  if(selectedBuilding)return `${flow}<div class="site-cost">${plan.materials} MAT · ${plan.energy} ENERGY · ${plan.turns} TURNS${plan.siteCost?`<small>Includes ${plan.siteCost} materials for site preparation.</small>`:''}</div><button class="hud-launch-button site-action" data-action="construct-sector" ${pending||!plan.ok?'disabled':''}>BUILD HERE</button>${!plan.ok?`<p class="site-reason">${safe(plan.reason)}</p>${plan.requiredTech?`<button class="rd-link" data-action="tech-open" data-id="${safe(plan.requiredTech)}">VIEW REQUIRED TECHNOLOGY ↗</button>`:''}`:''}`;
  if(tile?.revealed)return `${flow}<p class="sector-instruction">${tile.building?'Connected facilities share this hub’s stockpile.':'Choose a facility below to compare this site’s construction cost and output.'}</p>`;
  const scan=inspection.survey;
  return `<p class="sector-instruction">Orbital imagery shows the landscape. Surveying discovers deposits and scientific sites.</p><div class="site-cost">${scan.turns?`${scan.energy} ENERGY · ${scan.turns} TURN${scan.turns===1?'':'S'} · UP TO ${scan.area} SECTORS`:'FREE · INSTANT · 1 SECTOR'}</div><button class="hud-launch-button site-action" data-action="survey-sector" data-free="${scan.turns?'false':'true'}" ${pending||!scan.ok?'disabled':''}>${scan.turns?'START REGIONAL SURVEY':'SCAN SECTOR'}</button>${!scan.ok?`<p class="site-reason">${safe(scan.reason)}</p>`:''}`;
}

export function mapScreen({catalog,state,selectedWorld,selectedHub,selectedBuilding,selectedTile,pending,inspection,mapMotion=true,date,lightMinutes,guide}) {
  const ownHubs=state.hubs.filter(h=>h.world===selectedWorld),surfaceHubs=ownHubs.filter(h=>h.tiles.length);
  const own=surfaceHubs.find(h=>h.id===selectedHub)||surfaceHubs[0]||null;
  const location=own||ownHubs[0]||null;
  const control=location?.kind==='control'&&!own;
  const world=catalog.worlds[selectedWorld],size=catalog.mapSize||96,atmosphere=world.mapLayer==='atmosphere';
  if(atmosphere)catalog={...catalog,buildings:Object.fromEntries(Object.entries(catalog.buildings).map(([id,b])=>[id,{...b,name:catalog.platformFacilities?.[id]||b.name}]))};
  const deposits=atmosphere?{...terrain,plain:'STABLE CLOUDS',ice:'CONDENSATE DEPOSIT',ridge:'AEROSOL RESOURCES'}:terrain;
  const tile=own?.tiles[selectedTile],revealed=own?.tiles.filter(t=>t.revealed).length||0;
  const expedition=state.surveys.find(e=>own&&e.hub===own.id&&e.status==='en_route');
  return `<section class="game-map-stage map-theme-${selectedWorld}">
    <canvas id="planet-map" class="planet-map-canvas" tabindex="0" role="application" aria-label="${control?`${safe(world.name)} Mission Control headquarters. Click the headquarters to open operations. Drag to pan, scroll to zoom.`:`Large interactive ${safe(world.name)} map. Drag to pan, scroll to zoom, click a sector or use arrow keys to inspect it. Use the inspector buttons to survey or build.`}"></canvas>
    <div class="map-topline"><span class="signal-dot">●</span> TURN ${String(state.turn).padStart(2,'0')} · ${safe(date)} <span class="sep">/</span> ${location?.kind==='control'?'MISSION CONTROL':selectedWorld==='earth'?'EARTH DESTINATION':`EARTH LIGHT-TIME ${catalog.estimatedLightWorlds?.includes(selectedWorld)?'EST. ':''}${lightMinutes} MIN`}<span class="topline-extra"> <span class="sep">/</span> ${safe(world.environment.toUpperCase())} <span class="sep">/</span> ${control?'COMMAND HUB ONLINE':own?`${revealed} / ${size*size} SECTORS SURVEYED`:atmosphere?'PRE-DEPLOYMENT CLOUD SCAN':'PRE-LANDING ORBITAL SCAN'}</span></div>
    ${solarToggle(catalog,state,selectedWorld)}
    <div class="map-title-card"><div class="hud-kicker">${safe(world.kind.toUpperCase())} <span> / ${control?'MISSION COMMAND':atmosphere?'ATMOSPHERE COMMAND':'TERRAIN COMMAND'}</span></div><h1>${safe(world.name)} <span class="planet-title-mark">◈</span></h1><div class="map-subtitle ${own&&own.status!=='active'?'is-alert':''}">${safe(location?.site||world.role)} <span>•</span> ${control?'MISSION CONTROL ONLINE':own?statusLabel[own.status]||'COLONY ACTIVE':atmosphere?'REMOTE CLOUD PREVIEW':'REMOTE SURFACE PREVIEW'}${own?.crew?.length?` <span>•</span> CREW HEALTH ${own.health}%`:''}</div>
      ${ownHubs.length?`<div class="map-hub-picker">${ownHubs.map(h=>`<button data-action="map-hub" data-id="${safe(h.id)}" class="map-hub-chip ${location?.id===h.id?'active':''}" title="${safe(h.name)}">${h.kind==='orbital'?'◇':h.kind==='control'?'⌂':'⌑'} ${safe(h.kind==='control'?'Mission Control':h.site)}</button>`).join('')}</div>`:''}
    </div>
    ${control?`<aside class="map-inspector"><div class="hud-kicker">MISSION CONTROL <span>${safe(location.id)}</span></div><h2>${safe(world.name.toUpperCase())} HQ</h2>
      <div class="sector-info"><span class="sector-emblem">⌂</span><div><b>COMMAND CENTER ONLINE</b><small>SHIPYARD &amp; SUPPLY OPERATIONS</small></div></div>
      <p class="sector-instruction">The central shipyard finances missions and manufactures launch materials and fuel each turn. Plan departures and send supplies to your outposts from here.</p>
      <button class="hud-launch-button" data-action="map-supply" data-id="${safe(location.id)}">SEND RESOURCES →</button>
      <div class="map-stock-list">${['energy','materials','fuel','water','food','oxygen','heat'].map(k=>`<div><span>${k.toUpperCase()}</span><b>${formatted(location.stocks[k])}</b></div>`).join('')}</div>
      <div class="inspector-bottom">${safe(world.name.toUpperCase())} COMMAND HUB</div></aside>`:`<aside class="map-inspector"><div class="hud-kicker">${own?(atmosphere?'PLATFORM CONTROL':'SURFACE CONTROL'):'MISSION INTELLIGENCE'} <span>${safe(own?.id||'REMOTE')}</span></div><h2>${own?`SECTOR ${String(selectedTile+1).padStart(4,'0')}`:'FRONTIER UNCLAIMED'}</h2>
      <div class="sector-info"><span class="sector-emblem">${own?(tile?.building?'⌂':tile?.revealed?'◈':'?'):'◎'}</span><div><b>${own?(safe(catalog.biomes?.[tile?.biome]?.name?.toUpperCase()||'UNKNOWN LANDSCAPE')):atmosphere?'NO CLOUD PLATFORM':'NO SURFACE STATION'}</b><small>${own?(tile?.building?`FACILITY · ${safe((catalog.platformFacilities?.[tile.building.type]&&atmosphere?catalog.platformFacilities[tile.building.type]:tile.building.type).toUpperCase())}`:tile?.revealed?safe(deposits[tile.terrain]||'SURVEY COMPLETE'):'DEPOSITS NOT YET SURVEYED'):'LAUNCH TO ESTABLISH A HUB'}</small></div></div>
      ${own&&tile?.building?`<div class="building-status">${conditionBar(tile.building)}${(tile.building.condition??100)<100&&own.status==='active'?`<button class="hud-mini-button" data-action="repair" data-id="${selectedTile}">REPAIR · ${catalog.repairCost} MAT</button>`:''}</div>`:''}
      ${own?state.forecasts.filter(f=>f.hub===own.id&&f.turn>=state.turn).map(f=>`<div class="forecast-strip"><span>⚠ ${safe((f.kind||'HAZARD').toUpperCase())} · SEV ${f.severity}</span><b>TURN ${f.turn}</b>${f.prepared?'<em>PREPARED</em>':f.turn>state.turn?`<button class="hud-mini-button" data-action="prepare" data-id="${safe(f.id)}">PREPARE · ${catalog.prepareCost} MAT</button>`:'<em>ORDERS ONLY</em>'}</div>`).join(''):''}
      ${own?`${surfacePlan({tile,selectedBuilding,inspection,catalog,pending,atmosphere})}
        ${expedition?`<div class="survey-strip"><span>◷ REGIONAL SURVEY</span><b>${expedition.arrivesAt-state.turn} TURNS</b></div>`:''}
        <div class="map-stock-list">${['energy','materials','fuel','water','food','oxygen','heat'].map(k=>`<div><span>${k.toUpperCase()}</span><b>${formatted(own.stocks[k])}</b></div>`).join('')}</div>`:
        `<p class="sector-instruction">${atmosphere?`This ${size}×${size} cloud-layer map uses fictional floating platforms, not solid ground. Research Deep-Space Engineering, then send a survey station and shield. Survey condensates, refine aerosols and expand power to sustain your base.`:`This world has its own ${size}×${size} map. Establish a surface hub to unlock surveys, construction, and local production here.`}</p><button class="hud-launch-button" data-action="map-plan">${atmosphere?'DESIGN PLATFORM MISSION':'DESIGN LANDING MISSION'} ↗</button>`}
      <div class="inspector-bottom">${own?`${revealed} DISCOVERED / ${size*size} TOTAL`:'NO OUTPOST ASSIGNED'}</div>
    </aside>`}
    <div class="map-resources"><span><b>◈ ${formatted(state.science)}</b> SCIENCE</span><span><b>◉ ${formatted(state.credits)}</b> CREDITS</span><span><b>⌂ ${state.hubs.filter(h=>h.status==='active').length}</b> HUBS</span><span><b>▲ ${state.budget}</b> CR / TURN</span><button class="hud-next-turn" data-action="advance" ${pending?'disabled':''}>NEXT TURN <b>→</b></button></div>
    <div class="map-controls"><button data-action="map-motion" title="Toggle ambient motion" aria-label="Ambient motion" aria-pressed="${mapMotion}">${mapMotion?'Ⅱ':'▶'}</button><button data-action="map-zoom-in" title="Zoom in" aria-label="Zoom in">＋</button><button data-action="map-zoom-out" title="Zoom out" aria-label="Zoom out">−</button><button data-action="map-center" title="Recenter" aria-label="Recenter">⌖</button><button data-action="map-overview" title="Full map" aria-label="Full map">▣</button></div>
    ${control?'':`<div class="map-minimap-box"><div class="minimap-title">${atmosphere?'CLOUD-LAYER OVERVIEW':'LANDSCAPE OVERVIEW'} <span>${size} × ${size}</span></div><canvas id="mini-map" class="map-minimap" title="Click to center map on this location"></canvas><div class="minimap-caption"><span>■ NATURAL REGIONS</span><span>□ FACILITIES</span></div></div>`}
    ${guide||''}
    <div class="map-help"><span>⟡ DRAG TO PAN</span><span>⌕ SCROLL TO ZOOM</span>${control?'<span>⌖ CLICK HQ TO OPEN OPERATIONS</span>':`<span>⌖ CLICK TO INSPECT</span>`}</div>
    <div class="map-action-bar"><div class="construction-heading"><span class="hud-kicker">02 / ${control?'OPERATIONS':'CONSTRUCTION'}</span><b>${control?'MISSION CONTROL':selectedBuilding?safe(catalog.buildings[selectedBuilding].name):'OUTPOST BUILDER'}</b></div>
      ${control?`<div class="map-await-build">PLAN LAUNCHES · SUPPLY YOUR OUTPOSTS</div><button class="hud-launch-button" data-action="map-plan">DESIGN MISSION ↗</button>`:own?`<div class="map-build-items">${Object.entries(catalog.buildings).map(([id,b])=>`<button class="map-build-btn ${selectedBuilding===id?'active':''} ${catalog.techUnlocks?.building?.[id]&&!state.tech.includes(catalog.techUnlocks.building[id])?'is-locked':''}" data-action="build-mode" data-id="${id}" title="${safe(b.name)} | ${b.materials} materials | ${b.turns} turns"><span>${signs[id]||'◇'}</span><small>${safe(b.name)}</small></button>`).join('')}</div><button class="map-cancel-build" data-action="cancel-build" ${!selectedBuilding?'disabled':''}>CANCEL</button>`:
      `<div class="map-await-build">BASE OPERATIONS LOCKED — ${atmosphere?'DEPLOY A PLATFORM':'DEPLOY A LANDER'} FIRST</div><button class="hud-launch-button" data-action="map-plan">+ FOUND OUTPOST</button>`}</div>
  </section>`;
}
