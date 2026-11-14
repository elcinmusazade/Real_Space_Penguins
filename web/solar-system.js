/** Solar-system navigation only. Positions and sizes are a schematic, not ephemeris data. */
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const playable = ['mercury','venus','earth','mars','europa'];
const center={x:550,y:310},orbitTilt=-14,orbitFlattening=.48;
const bodies = {
  sun: {name:'Sun',kind:'Our star',description:'The center of your mission network. Select a world to explore its surface, manage a hub, or plan your next departure.',r:103,color:'#ffaf38'},
  mercury: {name:'Mercury',orbit:120,period:24,phase:-1.1,r:13,color:'#b8aaa0'},
  venus: {name:'Venus',orbit:175,period:38,phase:1.2,r:23,color:'#e8bb75'},
  earth: {name:'Earth',orbit:230,period:52,phase:-.35,r:26,color:'#61b5d1'},
  mars: {name:'Mars',orbit:280,period:68,phase:2.1,r:19,color:'#d58a63'},
  jupiter: {name:'Jupiter',orbit:335,period:92,phase:-2.6,r:51,color:'#cfa581',kind:'Gas giant',description:'Europa belongs to the Jupiter system. Select the icy moon to plan an expedition or manage its outposts.'},
  saturn: {name:'Saturn',orbit:385,period:116,phase:.5,r:41,color:'#d5c68d',kind:'Gas giant',description:'A ringed landmark in the outer solar system. Surface operations are not available here in this campaign.'},
  uranus: {name:'Uranus',orbit:435,period:142,phase:-1.4,r:29,color:'#a5d7dc',kind:'Ice giant',description:'A distant landmark beyond Saturn. Surface operations are not available here in this campaign.'},
  neptune: {name:'Neptune',orbit:485,period:168,phase:2.8,r:28,color:'#6598d9',kind:'Ice giant',description:'The outermost planet in this navigation chart. Surface operations are not available here in this campaign.'},
  europa: {name:'Europa',kind:'Moon of Jupiter',r:12,color:'#d9d4b8'},
};
const bodyScale=id=>id==='sun'?.5:.8;
function ellipsePoint(origin,rx,ry,angle,tilt){
  const rotation=tilt*Math.PI/180,x=rx*Math.cos(angle),y=ry*Math.sin(angle);
  return {x:origin.x+x*Math.cos(rotation)-y*Math.sin(rotation),y:origin.y+x*Math.sin(rotation)+y*Math.cos(rotation)};
}
/** Decorative orbital periods in seconds, independent of campaign turns/ephemerides. */
export function solarPositions(elapsedMs=0){
  const positions={sun:{...center}},seconds=elapsedMs/1000;
  for(const [id,body] of Object.entries(bodies)){
    if(body.orbit)positions[id]=ellipsePoint(center,body.orbit,body.orbit*orbitFlattening,body.phase+seconds/body.period*Math.PI*2,orbitTilt);
  }
  positions.europa=ellipsePoint(positions.jupiter,74,60,1.1+seconds/18*Math.PI*2,-28);
  return positions;
}
const hubsAt=(state,id)=>state.hubs.filter(h=>h.world===id);

export function solarToggle(catalog,state,selectedWorld) {
  const count=hubsAt(state,selectedWorld).length;
  return `<button class="solar-toggle" data-action="solar-open" aria-haspopup="dialog" aria-expanded="false" aria-controls="solar-system-dialog" aria-label="Open solar system navigator"><span class="solar-toggle-icon" aria-hidden="true">◎</span><span><b>SOLAR SYSTEM</b><small>${esc(catalog.worlds[selectedWorld].name)} · ${count} HUB${count===1?'':'S'}</small></span><span aria-hidden="true">↗</span></button>`;
}

function planetArt(id,b) {
  const r=b.r;
  const bands=['jupiter','saturn','venus'].includes(id) ? Array.from({length:9},(_,i)=>{const y=-r+i*r*.25;return `<path d="M${-r} ${y} C${-r*.5} ${y+8} ${r*.5} ${y-8} ${r} ${y}" fill="none" stroke="${i%2?'#fff0ca':'#825641'}" stroke-width="${id==='jupiter'?6:3}" opacity="${id==='venus'?.25:.45}"/>`;}).join('') : '';
  const continents=id==='earth'?'<path d="M-23 -14 l11 -7 13 4 -4 8 6 6 -8 7 -8 -5 -3 -7z M4 6 l13 -5 8 11 -10 13 -8 -4z" fill="#609c78"/>':'';
  const clouds=id==='earth'?'<path d="M-26 -7 Q-8 -14 8 -4 T26 -7 M-26 12 Q0 5 26 12" fill="none" stroke="#eaf8ef" stroke-width="3" opacity=".65"/>':'';
  const marks=['mercury','mars','europa'].includes(id)?Array.from({length:10},(_,i)=>`<ellipse cx="${Math.sin(i*4)*r*.75}" cy="${Math.cos(i*7)*r*.75}" rx="${2+i%3}" ry="${1+i%3}" fill="${id==='europa'?'#997d61':'#654e47'}" opacity=".4"/>`).join(''):'';
  const haze=['uranus','neptune'].includes(id)?`<path d="M${-r} -10 Q0 -18 ${r} -10 M${-r} 11 Q0 2 ${r} 11" fill="none" stroke="#e0f3f4" stroke-width="3" opacity=".25"/><ellipse cx="10" cy="5" rx="8" ry="3" fill="#365f95" opacity=".35"/>`:'';
  const spot=id==='jupiter'?'<ellipse cx="15" cy="19" rx="14" ry="7" fill="#ad6648" opacity=".8"/>':'';
  // Surface spin is independent of the sphere's orbital translation.
  const spin=(art,duration)=>`<g class="solar-surface-spin" style="--spin-width:${-2*r}px;--spin-duration:${duration}s">${[-1,0,1].map(i=>`<g transform="translate(${i*2*r} 0)">${art}</g>`).join('')}</g>`;
  const duration={mercury:58,venus:66,earth:34,mars:39,jupiter:24,saturn:29,uranus:46,neptune:42,europa:54}[id];
  const rings=id==='saturn'?`<ellipse rx="72" ry="18" transform="rotate(-24)" fill="none" stroke="#c5ba88" stroke-width="12" opacity=".7"/><ellipse rx="76" ry="20" transform="rotate(-24)" fill="none" stroke="#5d5742" stroke-width="3"/>`:'';
  const glint=id==='saturn'?'<g transform="rotate(-24)"><path class="solar-ring-glint" d="M-68 5 A72 18 0 0 0 68 5" fill="none" stroke="#fff0be" stroke-width="2" opacity=".4"/></g>':'';
  return `<g aria-hidden="true" class="solar-planet-art">${rings}<circle r="${r+2}" fill="${b.color}" opacity=".15"/><g clip-path="url(#solar-clip-${id})"><circle r="${r}" fill="${b.color}"/>${spin(bands+continents+marks+haze+spot,duration)}${clouds?spin(clouds,27):''}<circle r="${r}" fill="url(#solar-shade)"/></g>${glint}</g>`;
}

function sunArt() {
  return '<g class="solar-planet-art" aria-hidden="true"><g clip-path="url(#solar-clip-sun)"><circle r="103" fill="url(#solar-fire)"/><g class="solar-sun-spin"><circle r="106" fill="url(#solar-fire)" filter="url(#solar-fire-texture)"/><path d="M-85 -30 Q-35 -90 35 -45 T85 20 M-90 20 Q-30 70 30 20 T90 -15 M-55 80 Q10 30 65 65" fill="none" stroke="#ffe4a1" stroke-width="4" opacity=".3"/></g><circle r="103" fill="url(#solar-sun-light)"/></g><g class="solar-prominence"><path d="M-50 -91 C-47 -130 4 -128 12 -103 M90 50 C126 36 136 72 76 70" fill="none" stroke="#ffbd62" stroke-width="2" opacity=".65"/></g></g>';
}

function traffic(state) {
  const worldFor=id=>state.hubs.find(h=>h.id===id)?.world;
  return [
    ...state.missions.filter(m=>m.status==='in_flight').map(m=>({...m,from:worldFor(m.source),to:m.destination,label:'Mission'})),
    ...state.shipments.filter(s=>s.status==='in_flight').map(s=>({...s,from:worldFor(s.source),to:worldFor(s.target),label:'Cargo'})),
  ];
}

function routeGeometry(a,b,t){
  const cx=(a.x+b.x)/2,cy=Math.min(a.y,b.y)-95;
  return {d:`M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`,x:(1-t)**2*a.x+2*(1-t)*t*cx+t*t*b.x,y:(1-t)**2*a.y+2*(1-t)*t*cy+t*t*b.y};
}
function routeArt(f,state,positions) {
  const a=positions[f.from],b=positions[f.to];
  if(!a||!b||f.from===f.to)return '';
  const t=Math.max(0,Math.min(1,(state.turn-f.departed)/(f.arrivesAt-f.departed||1)));
  const {d,x,y}=routeGeometry(a,b,t);
  return `<g class="solar-flight" aria-hidden="true" data-from="${esc(f.from)}" data-to="${esc(f.to)}" data-progress="${t}"><path d="${d}"/><circle cx="${x}" cy="${y}" r="4"/><title>${esc(f.id)} · ${esc(f.label)} · arrives turn ${f.arrivesAt}</title></g>`;
}

export function solarSystemView({catalog,state,selected,showRoutes,date}) {
  const positions=solarPositions();
  const b=bodies[selected]||bodies.earth,w=catalog.worlds[selected];
  const hubs=hubsAt(state,selected), flights=traffic(state), localFlights=flights.filter(f=>f.from===selected||f.to===selected);
  const active=hubs.filter(h=>h.status==='active').length;
  return `<div class="solar-scrim" data-action="solar-dismiss"><section id="solar-system-dialog" class="solar-dialog" role="dialog" aria-modal="true" aria-labelledby="solar-heading">
    <header class="solar-header"><div><span class="solar-eyebrow">MISSION NETWORK / NAVIGATION</span><h2 id="solar-heading">Solar system<span>.</span></h2></div><div class="solar-summary"><span>TURN ${String(state.turn).padStart(2,'0')} · ${esc(date)}</span><b>${state.hubs.filter(h=>h.status==='active').length} ACTIVE HUBS <i>/</i> ${flights.length} IN TRANSIT</b></div><button class="solar-close" data-action="solar-close" aria-label="Close solar system navigator">✕</button></header>
    <div class="solar-layout"><div class="solar-map-area"><div class="solar-scene-label"><span class="solar-live-dot"></span> SOL / EXPLORATION NETWORK <small class="solar-motion-hint">HOVER TO HOLD · SELECT A WORLD</small></div>
      <div class="solar-viewport" aria-label="Solar system chart. Drag empty space to pan; scroll to zoom.">
        <svg class="solar-chart" viewBox="0 0 1100 650" width="1100" height="650" role="group" aria-label="Interactive planets and orbits">
          <defs><radialGradient id="solar-shade" cx=".25" cy=".2" r=".85"><stop offset="0" stop-color="white" stop-opacity=".35"/><stop offset=".4" stop-color="white" stop-opacity="0"/><stop offset=".82" stop-color="#020713" stop-opacity=".5"/><stop offset="1" stop-color="#01030a" stop-opacity=".96"/></radialGradient><radialGradient id="solar-fire" cx=".3" cy=".4"><stop stop-color="#fff4b8"/><stop offset=".45" stop-color="#ffcc48"/><stop offset=".8" stop-color="#f66c15"/><stop offset="1" stop-color="#b82b0d"/></radialGradient><radialGradient id="solar-corona"><stop offset=".5" stop-color="#ff9d23" stop-opacity=".4"/><stop offset="1" stop-color="#ff6713" stop-opacity="0"/></radialGradient>
          <radialGradient id="solar-sun-light" cx=".22" cy=".3" r=".85"><stop stop-color="#fff6cf" stop-opacity=".45"/><stop offset=".65" stop-color="#ffb53c" stop-opacity="0"/><stop offset="1" stop-color="#b82b0d" stop-opacity=".45"/></radialGradient>
          <filter id="solar-fire-texture"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="3" seed="12" result="noise"/><feBlend in="SourceGraphic" in2="noise" mode="soft-light"/></filter>
          ${Object.entries(bodies).map(([id,p])=>`<clipPath id="solar-clip-${id}"><circle r="${p.r}"/></clipPath>`).join('')}</defs>
          <g aria-hidden="true" class="solar-chart-decoration">${Array.from({length:100},(_,i)=>`<circle ${i%3===0?`class="solar-star" style="--twinkle-duration:${4+i%7}s;--phase:${i*713}ms"`:''} cx="${(i*317+71)%1100}" cy="${(i*193+43)%650}" r="${i%11===0?1.6:.7}" fill="#c9d9eb" opacity="${.12+(i%5)*.08}"/>`).join('')}
          ${Object.entries(bodies).filter(([,p])=>p.orbit).map(([id,p])=>`<ellipse class="solar-orbit ${selected===id?'is-selected':''}" cx="${center.x}" cy="${center.y}" rx="${p.orbit}" ry="${p.orbit*orbitFlattening}" transform="rotate(${orbitTilt} ${center.x} ${center.y})"/>`).join('')}
          <g class="solar-moon-track" transform="translate(${positions.jupiter.x} ${positions.jupiter.y})"><ellipse class="solar-moon-orbit" rx="74" ry="60" transform="rotate(-28)"/></g>
          <circle class="solar-corona" cx="${center.x}" cy="${center.y}" r="130" fill="url(#solar-corona)"/>${showRoutes?flights.map(f=>routeArt(f,state,positions)).join(''):''}</g>
          ${Object.entries(bodies).map(([id,p])=>{const r=p.r*bodyScale(id),point=positions[id];return `<g class="solar-body ${selected===id?'is-selected':''} ${catalog.worlds[id]?'is-destination':''}" transform="translate(${point.x} ${point.y})" role="button" tabindex="0" aria-label="Inspect ${p.name}" aria-pressed="${selected===id}" data-action="solar-select" data-id="${id}"><circle class="solar-hit" r="${Math.max(30,r+12)}" fill="transparent"/><circle class="solar-selection" r="${r+11}"/><g transform="scale(${bodyScale(id)})">${id==='sun'?sunArt():planetArt(id,p)}</g><text class="solar-planet-name" y="${r+25}" text-anchor="middle">${p.name}</text>${catalog.worlds[id]?`<text class="solar-planet-status" y="${r+42}" text-anchor="middle">${id==='europa'?'JUPITER’S MOON':hubsAt(state,id).length?`${hubsAt(state,id).length} HUB${hubsAt(state,id).length===1?'':'S'}`:'UNEXPLORED'}</text>`:''}</g>`;}).join('')}
        </svg>
      </div>
      <div class="solar-map-tools"><span>DRAG TO PAN · SCROLL TO ZOOM<small>SCHEMATIC · NOT TO SCALE</small></span><div><button data-action="solar-zoom-out" aria-label="Zoom out solar system">−</button><output class="solar-zoom-label" aria-label="Solar system zoom">100%</output><button data-action="solar-zoom-in" aria-label="Zoom in solar system">+</button><button data-action="solar-fit" aria-label="Fit solar system">⌖</button><button class="solar-route-toggle" data-action="solar-routes" aria-pressed="${showRoutes}" title="Show or hide active mission and cargo routes">ROUTES</button><button class="solar-motion-toggle" data-action="solar-motion" aria-label="Pause solar system animation">Ⅱ PAUSE</button></div></div>
    </div>
    <aside class="solar-detail" aria-label="Selected world details"><div class="solar-detail-kicker">${w?'DESTINATION / '+(selected==='europa'?'JOVIAN SYSTEM':'SOL SYSTEM'):'SYSTEM LANDMARK'}</div><h3>${esc(b.name)}</h3><p class="solar-kind">${esc(w?.environment||b.kind)}</p><p class="solar-description">${esc(w?.description||b.description)}</p>
      ${w?`<div class="solar-world-stats"><div><b>${active}<span> / ${hubs.length}</span></b><small>HUBS ACTIVE</small></div><div><b>${localFlights.length}</b><small>IN TRANSIT</small></div></div><button class="solar-primary" data-action="solar-map" data-id="${selected}">${hubs.some(h=>h.tiles.length)?'OPEN SURFACE MAP':'VIEW SURFACE'} <span>↗</span></button>${selected==='earth'?`<button class="solar-secondary" data-action="solar-operations" data-id="${esc(hubs[0]?.id||'')}">MISSION CONTROL →</button>`:`<button class="solar-secondary" data-action="solar-plan" data-id="${selected}">PLAN LANDING MISSION →</button>`}
      <div class="solar-section-label">YOUR HUBS <span>${hubs.length}</span></div><div class="solar-hub-list">${hubs.length?hubs.map(h=>`<button data-action="solar-hub" data-id="${esc(h.id)}"><span class="solar-hub-symbol">${h.kind==='orbital'?'◇':'⌑'}</span><span><b>${esc(h.site)}</b><small>${esc(h.status.toUpperCase())} · ${h.kind==='orbital'?'ORBITAL / SUPPLIES':'SURFACE / MAP'}</small></span><span>↗</span></button>`).join(''):'<p class="solar-empty">No outpost here yet. Plan a landing to establish your first hub.</p>'}</div>
      <div class="solar-section-label">TRAFFIC <span>${localFlights.length}</span></div>${localFlights.length?localFlights.map(f=>`<div class="solar-traffic-item"><b>${esc(f.id)} · ${f.label}</b><span>${esc(bodies[f.from]?.name||'Hub')} → ${esc(bodies[f.to]?.name||'Hub')}</span><small>ARRIVES IN ${Math.max(0,f.arrivesAt-state.turn)} TURNS</small></div>`).join(''):'<p class="solar-empty">No active missions or cargo at this world.</p>'}`:
      selected==='jupiter'?'<button class="solar-primary" data-action="solar-select" data-id="europa">EXPLORE EUROPA <span>↗</span></button>':selected==='sun'?'<button class="solar-primary" data-action="solar-select" data-id="earth">GO TO EARTH HQ <span>↗</span></button>':'<div class="solar-landmark-note">CHARTED LANDMARK<span>Choose a campaign destination below.</span></div>'}
    </aside></div>
    <footer class="solar-footer"><span>DESTINATIONS <small>${state.milestone?'PATHFINDER COMPLETE':'YOUR NEXT FRONTIER'}</small></span><nav aria-label="Campaign destinations">${playable.map(id=>`<button class="${selected===id?'is-selected':''}" data-action="solar-select" data-id="${id}" aria-pressed="${selected===id}"><span class="mini-planet mini-${id}" aria-hidden="true"></span>${bodies[id].name}${hubsAt(state,id).length?'<i aria-label="Has a hub"></i>':''}</button>`).join('')}</nav></footer>
  </section></div>`;
}

/** View-local camera and decorative clock; neither advances campaign time. */
export function mountSolarSystem(root,camera,motion={paused:false,elapsedMs:0}) {
  const viewport=root.querySelector('.solar-viewport'), chart=root.querySelector('.solar-chart');
  const output=root.querySelector('.solar-zoom-label');
  const listeners=new AbortController();
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton=root.querySelector('[data-action="solar-motion"]');
  const motionHint=root.querySelector('.solar-motion-hint');
  const bodyNodes=[...root.querySelectorAll('.solar-body')],moonTrack=root.querySelector('.solar-moon-track');
  const routes=[...root.querySelectorAll('.solar-flight')].map(el=>({from:el.dataset.from,to:el.dataset.to,progress:Number(el.dataset.progress),path:el.querySelector('path'),marker:el.querySelector('circle')}));
  let running=false,startedAt=performance.now(),frame=null,hovering=false,focused=false;
  let positions=solarPositions(motion.elapsedMs);
  // Negative delays retain the visual phase when campaign rendering replaces the dialog.
  root.style.setProperty('--solar-time',`${-motion.elapsedMs}ms`);
  function captureTime(){const now=performance.now();if(running)motion.elapsedMs+=now-startedAt;startedAt=now;}
  function placeBodies(){
    positions=solarPositions(motion.elapsedMs);
    for(const node of bodyNodes){const p=positions[node.dataset.id];node.setAttribute('transform',`translate(${p.x} ${p.y})`);}
    moonTrack.setAttribute('transform',`translate(${positions.jupiter.x} ${positions.jupiter.y})`);
    // Routes follow the moving endpoints, but journey completion still uses campaign turns.
    for(const route of routes){
      const {d,x,y}=routeGeometry(positions[route.from],positions[route.to],route.progress);
      route.path.setAttribute('d',d);route.marker.setAttribute('cx',x);route.marker.setAttribute('cy',y);
    }
  }
  function animate(){frame=null;if(!running)return;captureTime();placeBodies();frame=requestAnimationFrame(animate);}
  function syncMotion(){
    captureTime();
    running=!motion.paused&&!reducedMotion.matches&&!document.hidden&&!hovering&&!focused;
    if(frame!==null){cancelAnimationFrame(frame);frame=null;}
    root.classList.toggle('solar-motion-paused',!running);
    motionButton.disabled=reducedMotion.matches;
    motionButton.textContent=reducedMotion.matches?'STILL':motion.paused?'▶ PLAY':'Ⅱ PAUSE';
    const label=reducedMotion.matches?'Animation disabled by your reduced motion setting':motion.paused?'Resume solar system animation':'Pause solar system animation';
    motionButton.setAttribute('aria-label',label);motionButton.title=label;
    motionHint.textContent=reducedMotion.matches?'REDUCED MOTION · SELECT A WORLD':motion.paused?'MOTION PAUSED · SELECT A WORLD':hovering||focused?'ORBIT HELD · SELECT A WORLD':'HOVER TO HOLD · SELECT A WORLD';
    placeBodies();
    if(running)frame=requestAnimationFrame(animate);
  }
  function toggleMotion(){if(!reducedMotion.matches){motion.paused=!motion.paused;syncMotion();}}
  reducedMotion.addEventListener('change',syncMotion,{signal:listeners.signal});
  document.addEventListener('visibilitychange',syncMotion,{signal:listeners.signal});
  let pointer=null,base=1;
  function draw(){
    base=Math.min(viewport.clientWidth/1100,viewport.clientHeight/650);
    const extent=1100*base*camera.zoom/2;
    camera.x=Math.max(-extent,Math.min(extent,camera.x));
    camera.y=Math.max(-650*base*camera.zoom/2,Math.min(650*base*camera.zoom/2,camera.y));
    chart.style.transform=`translate(-50%,-50%) translate(${camera.x}px,${camera.y}px) scale(${base*camera.zoom})`;
    output.textContent=`${Math.round(camera.zoom*100)}%`;
    root.querySelector('[data-action="solar-zoom-out"]').disabled=camera.zoom<=1;
    root.querySelector('[data-action="solar-zoom-in"]').disabled=camera.zoom>=4;
  }
  function zoom(factor,x=0,y=0){const previous=camera.zoom;camera.zoom=Math.max(1,Math.min(4,camera.zoom*factor));const ratio=camera.zoom/previous;camera.x=x+(camera.x-x)*ratio;camera.y=y+(camera.y-y)*ratio;draw();}
  function fit(){Object.assign(camera,{x:0,y:0,zoom:1});draw();}
  viewport.addEventListener('wheel',e=>{e.preventDefault();const r=viewport.getBoundingClientRect();zoom(e.deltaY<0?1.12:1/1.12,e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2);},{passive:false,signal:listeners.signal});
  viewport.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('[data-action]'))return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};viewport.setPointerCapture(e.pointerId);viewport.classList.add('is-dragging');},{signal:listeners.signal});
  viewport.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;camera.x+=e.clientX-pointer.x;camera.y+=e.clientY-pointer.y;pointer.x=e.clientX;pointer.y=e.clientY;draw();},{signal:listeners.signal});
  const release=()=>{pointer=null;viewport.classList.remove('is-dragging');};
  viewport.addEventListener('pointerup',release,{signal:listeners.signal});
  viewport.addEventListener('pointercancel',release,{signal:listeners.signal});
  viewport.addEventListener('pointerover',e=>{
    if(e.pointerType==='touch')return;
    const body=e.target.closest('.solar-body');
    if(body&&body!==e.relatedTarget?.closest?.('.solar-body')){hovering=true;syncMotion();}
  },{signal:listeners.signal});
  viewport.addEventListener('pointerout',e=>{
    if(e.pointerType==='touch'||!e.target.closest('.solar-body'))return;
    const body=e.relatedTarget?.closest?.('.solar-body');
    if(body!==e.target.closest('.solar-body')){hovering=Boolean(body);syncMotion();}
  },{signal:listeners.signal});
  viewport.addEventListener('focusin',e=>{
    const body=e.target.closest('.solar-body');if(!body)return;
    focused=body.matches(':focus-visible');syncMotion();
    const p=positions[body.dataset.id];
    // Keep keyboard-selected bodies visible after zooming or panning.
    const r=body.querySelector('.solar-hit').getBoundingClientRect(),v=viewport.getBoundingClientRect();
    if(r.left<v.left||r.right>v.right||r.top<v.top||r.bottom>v.bottom){camera.x=-(p.x-550)*base*camera.zoom;camera.y=-(p.y-325)*base*camera.zoom;draw();}
  },{signal:listeners.signal});
  viewport.addEventListener('focusout',()=>{focused=false;syncMotion();},{signal:listeners.signal});
  const resize=new ResizeObserver(draw);resize.observe(viewport);draw();
  placeBodies();hovering=Boolean(root.querySelector('.solar-body:hover'));syncMotion();
  return {zoom,fit,toggleMotion,destroy(){captureTime();running=false;if(frame!==null)cancelAnimationFrame(frame);root.classList.add('solar-motion-paused');resize.disconnect();listeners.abort();}};
}
