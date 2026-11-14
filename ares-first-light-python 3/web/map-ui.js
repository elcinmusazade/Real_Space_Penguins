/** Immersive, map-first HUD; state mutations stay in the Python simulation. */

const safe = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatted = n => Math.round(Number(n)||0).toLocaleString('en-US');
const terrain = {plain:'PLAINS',ice:'ICE DEPOSIT',ridge:'ROCK RIDGE',science:'ANOMALY',salvage:'SALVAGE',hazard:'HAZARD ZONE'};
const signs = {solar:'☀',extractor:'❄',greenhouse:'❀',laboratory:'⚗',heater:'♨',drill:'⚒',shield:'⬡'};

export function mapScreen({catalog,state,selectedWorld,selectedHub,selectedBuilding,selectedTile,pending}) {
  const ownHubs=state.hubs.filter(h=>h.world===selectedWorld),surfaceHubs=ownHubs.filter(h=>h.kind==='surface');
  const own=surfaceHubs.find(h=>h.id===selectedHub)||surfaceHubs[0]||null;
  const location=own||ownHubs[0]||null;
  const world=catalog.worlds[selectedWorld],size=catalog.mapSize||32;
  const tile=own?.tiles[selectedTile],revealed=own?.tiles.filter(t=>t.revealed).length||0;
  const expedition=state.expeditions.find(e=>own&&e.hub===own.id&&e.status==='en_route');
  const worlds=['earth','mars','venus','mercury','europa'];
  return `<section class="game-map-stage map-theme-${selectedWorld}">
    <canvas id="planet-map" class="planet-map-canvas" role="img" aria-label="Large interactive ${safe(world.name)} map. Drag to pan, scroll to zoom, click a sector to explore or build."></canvas>
    <div class="map-topline"><span class="signal-dot">●</span> SOL ${String(state.turn).padStart(2,'0')} <span class="sep">/</span> ${safe(world.environment.toUpperCase())} <span class="sep">/</span> ${own?`${revealed} / ${size*size} SECTORS SURVEYED`:'PRE-LANDING ORBITAL SCAN'}</div>
    <aside class="map-worlds"><div class="hud-kicker">NAVIGATION <span>01 / 05</span></div><h3>SOLAR SYSTEM</h3><div class="planet-selector">
    ${worlds.map(id=>{const w=catalog.worlds[id],hubs=state.hubs.filter(h=>h.world===id);return `<button class="planet-choice ${id===selectedWorld?'is-active':''}" data-action="map-world" data-id="${id}"><span class="mini-planet mini-${id}"></span><span class="planet-choice-text"><b>${safe(w.name)}</b><small>${hubs.length?`${hubs.length} HUB${hubs.length>1?'S':''} ONLINE`:'NOT COLONIZED'}</small></span><span class="planet-chevron">›</span></button>`;}).join('')}
    </div><div class="map-worlds-foot"><span>✦ SYSTEM PATHFINDER</span><p>${state.milestone?'ALL TARGET WORLDS VISITED':'VISIT VENUS, MERCURY & EUROPA'}</p></div></aside>
    <div class="map-title-card"><div class="hud-kicker">${safe(world.kind.toUpperCase())} <span> / TERRAIN COMMAND</span></div><h1>${safe(world.name)} <span class="planet-title-mark">◈</span></h1><div class="map-subtitle">${safe(location?.site||world.role)} <span>•</span> ${own?'COLONY ACTIVE':'REMOTE SURFACE PREVIEW'}</div>
      ${ownHubs.length?`<div class="map-hub-picker">${ownHubs.map(h=>`<button data-action="map-hub" data-id="${safe(h.id)}" class="map-hub-chip ${location?.id===h.id?'active':''}" title="${safe(h.name)}">${h.kind==='orbital'?'◇':h.kind==='control'?'⌂':'⌑'} ${safe(h.kind==='control'?'Mission Control':h.site)}</button>`).join('')}</div>`:''}
    </div>
    <aside class="map-inspector"><div class="hud-kicker">${own?'SURFACE CONTROL':'MISSION INTELLIGENCE'} <span>${safe(own?.id||'REMOTE')}</span></div><h2>${own?`SECTOR ${String(selectedTile+1).padStart(4,'0')}`:'FRONTIER UNCLAIMED'}</h2>
      <div class="sector-info"><span class="sector-emblem">${own?(tile?.building?'⌂':tile?.revealed?'◈':'?'):'◎'}</span><div><b>${own?(tile?.revealed?safe(terrain[tile.terrain]||'UNKNOWN'):'UNKNOWN TERRAIN'):'NO SURFACE STATION'}</b><small>${own?(tile?.building?`FACILITY · ${safe(tile.building.type.toUpperCase())}`:tile?.revealed?'SURVEY COMPLETE':'AWAITING DISCOVERY'):'LAUNCH TO ESTABLISH A HUB'}</small></div></div>
      ${own?`<p class="sector-instruction">${selectedBuilding?`Place <b>${safe(catalog.buildings[selectedBuilding].name)}</b> on any connected, revealed empty tile.`:tile?.revealed?'Choose a structure in the construction bay, then click a valid sector.':'Click an unknown sector to scan or send a rover expedition. Nearby scans are free.'}</p>
        <div class="rover-strip"><span>⟡ ROVERS</span><b>${own.rovers} ${own.roverBusyUntil>state.turn?`· BUSY TO SOL ${own.roverBusyUntil}`:'· READY'}</b></div>
        ${expedition?`<div class="rover-strip"><span>◷ ACTIVE EXPEDITION</span><b>${expedition.arrivesAt-state.turn} TURNS</b></div>`:''}
        <div class="map-stock-list">${['energy','materials','fuel','water','food','oxygen','heat'].map(k=>`<div><span>${k.toUpperCase()}</span><b>${formatted(own.stocks[k])}</b></div>`).join('')}</div>`:
        `<p class="sector-instruction">This planet has its own ${size}×${size} map. Establish a surface hub to unlock exploration, construction, and rover missions here.</p><button class="hud-launch-button" data-action="map-plan">DESIGN LANDING MISSION ↗</button>`}
      <div class="inspector-bottom">${own?`${revealed} DISCOVERED / ${size*size} TOTAL`:'NO OUTPOST ASSIGNED'}</div>
    </aside>
    <div class="map-resources"><span><b>◈ ${formatted(state.science)}</b> SCIENCE</span><span><b>◉ ${formatted(state.credits)}</b> CREDITS</span><span><b>⌂ ${state.hubs.length}</b> HUBS</span><button class="hud-next-turn" data-action="advance" ${pending?'disabled':''}>NEXT TURN <b>→</b></button></div>
    <div class="map-controls"><button data-action="map-zoom-in" title="Zoom in" aria-label="Zoom in">＋</button><button data-action="map-zoom-out" title="Zoom out" aria-label="Zoom out">−</button><button data-action="map-center" title="Recenter" aria-label="Recenter">⌖</button><button data-action="map-overview" title="Full map" aria-label="Full map">▣</button></div>
    <div class="map-minimap-box"><div class="minimap-title">TACTICAL OVERVIEW <span>${size} × ${size}</span></div><canvas id="mini-map" class="map-minimap" title="Click to center map on this location"></canvas><div class="minimap-caption"><span>■ CHARTED</span><span>□ UNKNOWN</span></div></div>
    <div class="map-help"><span>⟡ DRAG TO PAN</span><span>⌕ SCROLL TO ZOOM</span><span>⌖ CLICK TO ${selectedBuilding?'CONSTRUCT':'EXPLORE'}</span></div>
    <div class="map-action-bar"><div class="construction-heading"><span class="hud-kicker">02 / CONSTRUCTION</span><b>${selectedBuilding?safe(catalog.buildings[selectedBuilding].name):'OUTPOST BUILDER'}</b></div>
      ${own?`<div class="map-build-items">${Object.entries(catalog.buildings).map(([id,b])=>`<button class="map-build-btn ${selectedBuilding===id?'active':''}" data-action="build-mode" data-id="${id}" title="${safe(b.name)} | ${b.materials} materials | ${b.turns} turns"><span>${signs[id]||'◇'}</span><small>${safe(b.name)}</small></button>`).join('')}</div><button class="map-cancel-build" data-action="cancel-build" ${!selectedBuilding?'disabled':''}>CANCEL</button>`:
      `<div class="map-await-build">BASE OPERATIONS LOCKED — DEPLOY A LANDER FIRST</div><button class="hud-launch-button" data-action="map-plan">+ FOUND OUTPOST</button>`}</div>
  </section>`;
}
