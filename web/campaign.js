/** Browser interface for the Python-authoritative interplanetary campaign. */
import {techTreeView,TREE} from './tech-tree.js';
import {mountPlanetMap} from './planet-map.js';
import {mapScreen} from './map-ui.js';
import {solarSystemView,mountSolarSystem} from './solar-system.js';
import {softwareView, programView, softwareConfig, ordersConfig, guideSteps} from './program-ui.js';
import {applyRuleAction, applyRuleField} from './rule-editor.js';
import {playLaunch, playArrival} from './flight-view.js';
import {creditsView, loadMusicCredits} from './credits.js';
import {createTutorial, settingsView, STEPS} from './tutorial.js';
import {advisorView, badgeCount} from './advisor.js';
import {createPlanetMusic} from './planet-music.js';
import {mountShip3d} from './ship-view.js';

import {loadCampaign,saveCampaign} from './campaign-save.js';
const app = document.querySelector('#app');
const music = createPlanetMusic(globalThis, document);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = value => Math.round(Number(value) || 0).toLocaleString('en-US');
const fmtTurn = value => String(value).padStart(2, '0');
const glyph = {earth:'◎',mars:'●',venus:'◉',mercury:'◌',europa:'◍',jupiter:'◉',saturn:'◎',uranus:'◌',neptune:'●'};
const terrainLabel = {plain:'PLAIN',ice:'ICE',ridge:'RIDGE',science:'SCIENCE',salvage:'CACHE',hazard:'HAZARD'};
const resourceName = {energy:'Energy',materials:'Materials',fuel:'Fuel',water:'Water',food:'Food',oxygen:'Oxygen',heat:'Heat',spares:'Spare parts'};
let catalog=null, state=null, quote=null, pending=false, quoteId=0;
function mapCore(){const size=catalog?.mapSize||96;return Math.floor(size/2)*(size+1);}
let tab='system', selectedWorld='mars', selectedHub='H1', selectedBuilding=null, selectedTile=mapCore();
let mapController=null, mapMotion=true, groundViewPinned=false;
let inspection=null, inspectionKey=null, inspectionRequest=0;
let techSelected='surveying',techZoom=.85,researchData=null,researchState=null,researchRequest=0;
let solarOpen=false,solarSelected='mars',solarRoutes=true,solarController=null,shipController=null;
const solarCamera={x:0,y:0,zoom:1};
const solarMotion={paused:false,elapsedMs:0};
let modal=null, assistantTopic='welcome';
let draft={source:'H1',destination:'earth',site:'Cape Canaveral',objective:'surface',hull:'lander',engine:'chemical',trajectory:'fast',payload:['survey'],vehicle:'atlas_v_401',propellantKg:300};
let softwareDraft=null, ordersDraft=null, softwareTest=null, guideHidden=false;
let addedRule=-1; // New flight-rule block being edited in the current draft.
let softwareTab='default'; // Software screen: 'default' or a planet id
let recentPart=null, recentAt=0, massDelta=null; // Shipyard feedback: which part just changed, and the launch-mass change it caused
const GUIDE_KEY='ares.first-light.guide-hidden';
try{guideHidden=localStorage.getItem(GUIDE_KEY)==='1';}catch{/* storage unavailable */}
let freight={source:'H1',target:'',resource:'materials',amount:20};
let tutorial=null;
let jarvis=null;
let renderedTab=null; // tab shown by the previous render, so scroll survives redraws of the same screen
let advice=null, adviceState=null, adviceRequest=0, adviceTopic='basics';

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

async function save() { try { await saveCampaign(state); } catch { notify('Browser save is unavailable. Keep this tab open.',true); } }

async function initialize() {
  try {
    const configuration=await api('/api/campaign/catalog');
    catalog=configuration.catalog;
    draft.parts={...catalog.ship.defaults};
    selectedTile=mapCore();
    const previous=await loadCampaign();
    if(previous) {
      try { const result=await api('/api/campaign/validate',{state:previous});if(result.ok)state=result.state; }
      catch { notify('Previous campaign save is invalid. Starting a fresh campaign.',true); }
    }
    if(!state)state=(await api('/api/campaign/new',{seed:'HORIZON-01'})).state;
    resetDrafts();
    openHome();
    tutorial=createTutorial(()=>({state,catalog,tab,selectedBuilding,home:homeHub(),softwareTested:Boolean(softwareTest?.ok),blocked:Boolean(modal||solarOpen),selection:tutorialSelection(),draft,softwareTab,softwareDraft,addedRule,
      softwareSlots:catalog.computers[softwareDraft.computer].slots,earthLabPassed:softwareTab==='earth'&&softwareTest?.results?.length>0&&softwareTest.passed===softwareTest.results.length,dirtySoftware:!same(softwareDraft,savedSoftware())}),{suggest:suggestTile,answer:applyAnswer,firstVisit:!previous});
    await save(); render();
    // The map can still open while a running server is being upgraded.
    import('./jarvis.js').then(({mountJarvis})=>{
      jarvis=mountJarvis(document.querySelector('#jarvis'), jarvisContext, !previous);
      jarvis.sync(state.turn, Boolean(modal||solarOpen));
    }).catch(error=>console.warn('JARVIS could not open.', error));
  }catch(error){app.innerHTML=`<main class="error-page"><h1>Mission engine unavailable</h1><p>${esc(error.message)}</p><p>Run <code>python3 -m ares.server</code> from the project directory.</p><button onclick="location.reload()">Retry connection</button></main>`;}
}

function jarvisContext() {
  const progress=tutorial.progress();
  const lesson=progress.status==='active' ? STEPS[progress.step] : null;
  const view={tab, world:selectedWorld, hub:selectedHub};
  if(tab==='system') { view.tile=selectedTile; view.building=selectedBuilding; }
  if(tab==='planner') {
    view.destination=draft.destination;
    view.ship=[draft.objective,draft.site,draft.hull,draft.engine,draft.trajectory,...draft.payload].join(', ');
    if(quote?.ok)view.quote=`Arrival turn ${quote.arrivalTurn}, ${quote.turns} turns in flight. Launch costs ${quote.credits} credits, ${quote.fuel} fuel and ${quote.materials} materials.`;
    view.launchChecks=quote?.checks?.map(c=>c.label+' — '+c.detail).join('\n') || quote?.error || '';
  }
  if(tab==='software')view.softwareWorld=softwareTab;
  if(lesson)view.tutorial=`Step ${progress.step+1}: ${lesson.title}. ${lesson.body.replace(/<[^>]+>/g,' ')}`;
  return {state,view};
}

function hub(id) { return state.hubs.find(h=>h.id===id); }
function homeHub(){return state.hubs.find(h=>h.world==='mars'&&h.kind==='control')||state.hubs.find(h=>h.world==='mars'&&h.tiles.length)||state.hubs.find(h=>h.kind==='control')||state.hubs[0];}
function openHome(){
  const home=homeHub();
  selectedHub=home.id;selectedWorld=home.world;selectedTile=mapCore();selectedBuilding=null;
  tab='system';modal=state.event?'event':null;solarOpen=false;solarSelected=home.world;
  draft.source=home.id;draft.destination=home.world==='earth'?'mars':'earth';draft.site=freeSite(draft.destination);draft.objective='surface';freight={source:home.id,target:state.hubs.find(h=>h.id!==home.id)?.id||'',resource:'materials',amount:20};
  quote=null;quoteId++;
}
function savedSoftware(){return softwareTab!=='default'&&state.softwareProfiles?.[softwareTab]||state.software;}
function resetSoftwareDraft(){softwareDraft=JSON.parse(JSON.stringify(savedSoftware()));addedRule=-1;}
function resetDrafts(){resetSoftwareDraft();ordersDraft=JSON.parse(JSON.stringify(state.orders));}
function shipLabel(){const sc=catalog.ship;return `${catalog.hulls[draft.hull].name} · ${sc.parts.power[draft.parts.power].name} · ${sc.parts.thermal[draft.parts.thermal].name} · ${sc.parts.shielding[draft.parts.shielding].name}`;}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function turnDate(turn){const d=new Date(Date.UTC(...catalog.campaignStart.split('-').map((v,i)=>i===1?Number(v)-1:Number(v))));d.setUTCDate(d.getUTCDate()+catalog.turnDays*(turn-1));return d.toISOString().slice(0,10);}
function world(id) { return catalog.worlds[id]; }
function activeFlights(){return state.missions.filter(x=>x.status==='in_flight');}
function activeCargo(){return state.shipments.filter(x=>x.status==='in_flight');}
function hubCount(id){return state.hubs.filter(h=>h.world===id).length;}
function until(turn){return `${Math.max(0,turn-state.turn)} TURN${Math.max(0,turn-state.turn)===1?'':'S'}`;}

function navButton(id,label,icon) {return `<button class="nav-item ${tab===id?'active':''}" data-action="nav" data-id="${id}" aria-pressed="${tab===id}" title="${label}" aria-label="${label}"><span>${icon}</span>${label}</button>`;}

function topbar() {
  return `<header class="topbar"><button class="brand" data-action="home" aria-label="Return to Mars home map"><span class="brand-mark">✦</span><span>ARES <small>INTERPLANETARY COMMAND</small></span></button>
  <nav class="topnav" aria-label="Game navigation">${navButton('system','PLANET MAP','◈')}${navButton('planner','SHIPYARD','⌁')}${navButton('hubs','OUTPOSTS','▦')}${navButton('logistics','SUPPLY LINES','⇄')}${navButton('research','TECH TREE','✧')}${navButton('software','SOFTWARE','⌬')}${navButton('program','PROGRAMME','◎')}</nav>
  <div class="header-actions"><span class="save-status"><i></i> LOCAL SAVE</span><button class="tiny-icon aura-button" data-action="assistant" aria-label="Open AURA advisor${badgeCount(adviceState===state?advice:null)?` (${badgeCount(advice)} need attention)`:''}" title="AURA advice">✺${badgeCount(adviceState===state?advice:null)?`<span class="aura-badge">${badgeCount(advice)}</span>`:''}</button><button class="tiny-icon" data-action="reset" aria-label="Reset campaign" title="New campaign">↻</button><button class="tiny-icon" data-action="settings-open" aria-label="Settings" title="Settings (tutorial, guide, motion)">⚙</button></div></header>`;
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
  const places=['earth','mars','venus','mercury','europa'];
  return `<div class="system-view">${ribbon('SYSTEM OVERVIEW','MISSION STATUS / LIVE')}
    <section class="system-hero"><div class="hero-copy"><span class="eyebrow">THE NEXT FRONTIER AWAITS</span><h1>One network.<br><i>Many worlds.</i></h1><p>Design your spacecraft. Choose a trajectory. Build a connected system of planetary and orbital hubs—one mission at a time.</p><div class="hero-actions"><button class="button primary" data-action="nav" data-id="planner">DESIGN A MISSION <span>↗</span></button><button class="button secondary" data-action="nav" data-id="hubs">MANAGE HUBS →</button></div><div class="hero-milestone">${state.milestone?'✓ SYSTEM PATHFINDER UNLOCKED':'◈ SYSTEM PATHFINDER · Reach Venus, Mercury & Europa'}</div></div>
    <div class="solar-visual" aria-hidden="true"><div class="orbital-ring ring-a"></div><div class="orbital-ring ring-b"></div><div class="orbital-ring ring-c"></div><div class="visual-sun"></div><div class="visual-world visual-mercury">${planetOrb('mercury','medium')}</div><div class="visual-world visual-venus">${planetOrb('venus','medium')}</div><div class="visual-world visual-earth">${planetOrb('earth','medium')}</div><div class="visual-world visual-mars">${planetOrb('mars','medium')}</div><div class="visual-world visual-europa">${planetOrb('europa','medium')}</div><span class="orbit-label">MISSION NETWORK · SIMPLIFIED ORBITS</span></div></section>
    <div class="subheading"><h2>Mission destinations</h2><span>AVAILABLE FOR PLANNING</span></div>
    <div class="destination-grid">${places.map(id=>{const w=world(id);return `<button class="destination-card destination-${id}" data-action="choose-destination" data-id="${id}"><span class="destination-head"><small>${w.kind.toUpperCase()}</small>${pill(hubCount(id)?`${hubCount(id)} HUB${hubCount(id)>1?'S':''}`:'UNEXPLORED',hubCount(id)?'green':'')}</span><span class="destination-orb">${planetOrb(id,'large')}</span><b>${esc(w.name)}</b><span>${esc(w.role)}</span><small class="destination-footer">${esc(w.hazard)} <strong>↗</strong></small></button>`;}).join('')}</div>
    <div class="dual-panels"><section class="surface-card">${ribbon('OPERATIONS','SHIPMENTS & MISSIONS')}<h2>In transit</h2>${flightList()}</section><section class="surface-card">${ribbon('LATEST TELEMETRY','MISSION RECORD')}<h2>From mission control</h2>${state.log.slice(-4).reverse().map(e=>`<div class="log-row"><small>T${fmtTurn(e.turn)}</small><span>${esc(e.message)}</span></div>`).join('')}</section></div>
  </div>`;
}

function selectField(name,valueList,current,labels={}) {
  const title=name.startsWith('part_')?catalog.ship.slotNames[name.slice(5)]:name.replaceAll('_',' ');
  return `<label class="field"><span>${esc(title.toUpperCase())}</span><select data-field="${esc(name)}">${valueList.map(value=>`<option value="${esc(value)}" ${current===value?'selected':''}>${esc(labels[value]||value)}</option>`).join('')}</select></label>`;
}

const SLOT_ICON={power:'☀',thermal:'♨',shielding:'⬡',entry:'⇣',structure:'▣',comms:'⌁'};
function shipModel() {
  const sc=catalog.ship,names=Object.fromEntries(sc.slots.map(slot=>[slot,sc.parts[slot][draft.parts[slot]].name]));
  names.engine=catalog.engines[draft.engine].name;names.payload='Payload modules';
  const age=Date.now()-recentAt;
  return {parts:draft.parts,hull:draft.hull,engine:draft.engine,payload:draft.payload,propellantKg:draft.propellantKg,names,
    changed:recentPart&&age<900?recentPart:null,changedAt:performance.now()-age};
}
/** Fill the tutorial's draft. Testing and saving use the normal game controls. */
function applyAnswer(answer){
  if(!answer)return;
  if(answer.earthRule){
    if(tab!=='software'||softwareTab!=='earth')return;
    const rules=softwareDraft.rules.slice();
    const index=addedRule>=0?addedRule:rules.length;
    const slots=catalog.computers[softwareDraft.computer].slots;
    if(rules.length>slots||index>=slots)return;
    rules[index]=structuredClone(answer.earthRule);
    addedRule=index;
    softwareDraft={...softwareDraft,rules};softwareTest=null;render();return;
  }
  const {parts,...rest}=answer;
  if(rest.destination&&rest.destination!==draft.destination){draft.destination=rest.destination;selectedWorld=rest.destination;}
  Object.assign(draft,rest);
  if(parts){draft.parts={...draft.parts,...parts};const slot=Object.keys(parts)[0];recentPart=slot;recentAt=Date.now();}
  if(tab!=='planner')tab='planner';
  quote=null;render();refreshQuote();
}
function pickPart(slot){
  const target=slot==='payload'?document.querySelector('.payload-chips'):document.querySelector(`[data-field="${slot==='engine'?'engine':'part_'+slot}"]`);
  if(!target)return;
  target.scrollIntoView({block:'nearest',behavior:'smooth'});
  const box=target.closest('.part-pick,.field,.payload-chips');box?.classList.remove('is-flash');void box?.offsetWidth;box?.classList.add('is-flash');
  if(target.tagName==='SELECT'){target.focus({preventScroll:true});try{target.showPicker?.();}catch{}}
}

const FIT_WORD={ok:'OK',warn:'WARNING',fail:'FAIL'},FIT_MARK={ok:'✓',warn:'!',fail:'✕'};
const outcomeText={go:'READY TO LAUNCH',scrub:'WILL BE SCRUBBED',stranded:'WILL BE STRANDED',flyby:'WILL FLY PAST',drift:'WILL DRIFT PAST'};
function windowStrip(){
  if(!quote.windows?.length)return '';
  const max=Math.max(...quote.windows.map(w=>Math.min(w.totalDvKms,20)));
  return `<div class="window-strip" aria-label="Lowest total delta-v for the next 12 turns"><div class="yard-label">LAUNCH WINDOWS · LOWER IS CHEAPER</div><div class="window-bars">${quote.windows.map(w=>`<span class="window-bar ${w.turn===state.turn?'now':''} ${w.safeDvKms!==null&&w.safeDvKms<=w.totalDvKms+0.6?'reachable':''}" style="--h:${Math.round(Math.min(w.totalDvKms,20)/max*100)}%" title="Turn ${w.turn} (${w.date}): ${w.totalDvKms} km/s total"><i></i><small>${w.turn}</small></span>`).join('')}</div></div>`;
}
function meter(label,value,limit,unit,good){
  const pct=limit?Math.min(100,Math.round(value/limit*100)):0;
  return `<div class="yard-meter ${good?'ok':'bad'}"><div><small>${label}</small><b>${value}<em> / ${limit} ${unit}</em></b></div><span><i style="width:${pct}%"></i></span></div>`;
}
function statusPanel() {
  const launch=`<button class="button primary yard-launch ${quote?.ok&&quote.outcome!=='go'?'risky':''}" data-action="launch" ${!quote?.ok||!quote?.affordable||pending?'disabled':''}>${quote?.ok&&quote.outcome!=='go'?'LAUNCH ANYWAY…':'LAUNCH ↗'}</button>`;
  if(!quote)return `<div class="quote-panel yard-verdict wait"><span>◌</span><b>Calculating…</b></div>${launch}`;
  if(!quote.ok)return `<div class="quote-panel yard-verdict invalid"><span>✕</span><b>Plan needs work</b><p>${esc(quote.error)}</p>${quote.requiredTech?`<button class="button secondary" data-action="tech-open" data-id="${esc(quote.requiredTech)}">VIEW REQUIRED TECHNOLOGY ↗</button>`:''}</div>${launch}`;
  const t=quote.transfer,n=quote.numbers,sw=quote.software,go=quote.outcome==='go';
  const swOk=sw.passedNominal,swText=swOk?'':(sw.hint||'Fix the rules on the Software screen.');
  const fit=quote.fit,place=world(fit.world).name,issues=fit.checks.filter(c=>c.status!=='ok');
  const massDeltaTag=massDelta&&Date.now()-massDelta.at<4000?` <span class="delta">${massDelta.kg>0?'+':''}${num(massDelta.kg)}</span>`:'';
  return `<div class="quote-panel yard-verdict ${go?'go':'nogo'}"><span>${go?'✓':'✕'}</span><b>${outcomeText[quote.outcome]}</b><p>Arrives turn ${quote.arrivalTurn} · ${esc(t.arrival)}</p></div>
    <ul class="check-list yard-checks">${quote.checks.map(c=>`<li class="${c.ok?'ok':'bad'}"><b>${c.ok?'✓':'✕'} ${esc(c.label)}</b>${c.ok?'':`<span>${esc(c.detail)}</span>`}</li>`).join('')}
      <li class="${swOk?(sw.passedHarsh?'ok':'warn'):'bad'}"><b>${swOk?(sw.passedHarsh?'✓':'!'):'✕'} ${esc(world(quote.destination).name)} flight rules</b>${swOk?'':`<span>${esc(swText)}</span>`}</li>
      <li class="${fit.status==='ok'?'ok':fit.status==='warn'?'warn':'bad'}"><b>${FIT_MARK[fit.status]} Built for ${esc(place)}</b>${issues.map(c=>`<span>${esc(c.label)}: ${esc(c.detail)}</span>`).join('')}</li></ul>
    ${n.vehicleCapacityKg!==null?meter(`LAUNCH MASS${massDeltaTag}`,num(n.launchKg),num(n.vehicleCapacityKg),'kg',n.launchKg<=n.vehicleCapacityKg):`<div class="yard-meter"><div><small>LAUNCH MASS${massDeltaTag}</small><b>${num(n.launchKg)}<em> kg</em></b></div></div>`}
    <div class="yard-meter ${n.dvHaveKms>=n.dvNeedKms?'ok':'bad'}"><div><small>DELTA-V HAVE / NEED</small><b>${n.dvHaveKms}<em> / ${n.dvNeedKms} km/s</em></b></div><span><i style="width:${Math.min(100,Math.round(n.dvHaveKms/Math.max(n.dvNeedKms,0.01)*100))}%"></i></span></div>
    <div class="yard-cost"><span><b>${quote.credits}</b> CR</span><span><b>${quote.fuel}</b> FUEL</span><span><b>${quote.materials}</b> MAT</span></div>
    ${draft.useLocalSpares?`<p class="yard-note">Workshop stock: ${quote.spares} spare parts save ${quote.creditSavings} credits.</p>`:''}
    ${windowStrip()}
    ${quote.rescue?`<div class="callout">Reopens the lost base at ${esc(quote.site)}.</div>`:''}
    ${!quote.affordable?'<div class="quote-warning">Not enough resources at the departure hub.</div>':''}
    ${launch}
    <div class="yard-label">THIS SHIP ELSEWHERE</div>
    <div class="fit-row">${quote.fitAll.map(r=>`<button class="fit-world fit-${r.status} ${r.world===fit.world?'is-current':''}" data-action="fit-world" data-id="${esc(r.world)}" title="${esc(world(r.world).name)}: ${FIT_WORD[r.status]} — click to plan for it"><span>${FIT_MARK[r.status]}</span>${esc(world(r.world).name)}</button>`).join('')}</div>`;
}

function plannerView() {
  const sourceNames=Object.fromEntries(state.hubs.map(h=>[h.id,h.name]));
  const fromEarth=hub(draft.source)?.world==='earth';
  const destinations=Object.keys(catalog.worlds).filter(x=>!fromEarth||x!=='earth');
  const w=world(draft.destination),atmosphere=w.mapLayer==='atmosphere';
  const gmat=fromEarth&&catalog.gmatDestinations.includes(draft.destination);
  const sites=draft.objective==='surface'?w.sites:[draft.objective==='orbital'?'Orbital Station':'Remote Survey'];
  const sc=catalog.ship,issues=new Set((quote?.ok&&quote.fit?quote.fit.checks:[]).filter(c=>c.status!=='ok').map(c=>c.id));
  const fresh=recentPart&&Date.now()-recentAt<900?recentPart:null;
  return `${ribbon('SHIPYARD',gmat?'NASA GMAT LAUNCH WINDOWS':'GAME-ESTIMATE TRANSFER')}
  <div class="yard">
  <section class="yard-col planner-form">
    <div class="yard-label">MISSION</div>
    ${selectField('source',Object.keys(sourceNames),draft.source,sourceNames)}${selectField('destination',destinations,draft.destination,Object.fromEntries(destinations.map(id=>[id,world(id).name])))}${selectField('objective',['surface','orbital','survey'],draft.objective,{surface:atmosphere?'Atmospheric platform':'Land a base',orbital:'Orbital station',survey:'Science survey'})}${draft.objective==='surface'?selectField('site',sites,draft.site):''}
    <div class="yard-label">ROCKET</div>
    ${fromEarth?selectField('vehicle',Object.keys(catalog.vehicles),draft.vehicle,Object.fromEntries(Object.entries(catalog.vehicles).map(([id,v])=>[id,unlockLabel('vehicle',id,`${v.name} · ${v.credits} CR`)]))):''}${selectField('hull',Object.keys(catalog.hulls),draft.hull,Object.fromEntries(Object.entries(catalog.hulls).map(([id,v])=>[id,unlockLabel('hull',id,v.name)])))}${selectField('engine',Object.keys(catalog.engines),draft.engine,Object.fromEntries(Object.entries(catalog.engines).map(([id,v])=>[id,unlockLabel('engine',id,v.name)])))}${selectField('trajectory',Object.keys(catalog.trajectories),draft.trajectory,Object.fromEntries(Object.entries(catalog.trajectories).map(([id,v])=>[id,v.name])))}
    <label class="field propellant-field"><span>PROPELLANT · ${num(draft.propellantKg)} KG</span><input type="range" data-field="propellantKg" min="0" max="${catalog.propellantMaxKg}" step="50" value="${draft.propellantKg}" aria-label="Propellant load in kilograms"></label>
    <label class="workshop-order"><input type="checkbox" data-field="useLocalSpares" ${draft.useLocalSpares?'checked':''}><span><b>Use local spare parts</b><small>${hub(draft.source)?.stocks.spares||0} at departure · each saves ${catalog.industry.creditsPerSpare} CR</small></span></label>
    ${atmosphere?'<p class="yard-note">Cloud platform: needs Deep-Space Engineering, a Survey Station and an Environmental Shield.</p>':''}
  </section>
  <section class="yard-stage">
    <div class="stage-head">${planetOrb(draft.destination,'small')}<div><b>${esc(w.name)}</b><small>${esc(catalog.hulls[draft.hull].name)} · ${esc(catalog.engines[draft.engine].name)}</small></div></div>
    <canvas class="ship-canvas" tabindex="0" aria-label="3D spacecraft. Drag or use arrow keys to rotate; click a part to change it."></canvas>
    <div class="stage-hint">⟲ Drag to rotate · click a part to change it</div>
    <div class="part-pickers">${sc.slots.map(slot=>`<label class="part-pick ${fresh===slot?'is-new':''}"><span class="part-icon" aria-hidden="true">${SLOT_ICON[slot]}</span><small>${esc(sc.slotNames[slot].toUpperCase())}${issues.has(slot)?' <i class="part-issue" title="Not a good fit for '+esc(w.name)+'">!</i>':''}</small><select data-field="part_${slot}">${Object.entries(sc.parts[slot]).map(([id,p])=>`<option value="${esc(id)}" ${draft.parts[slot]===id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="payload-chips" aria-label="Payload modules">${Object.entries(catalog.payloads).map(([id,p])=>`<button class="payload-chip ${draft.payload.includes(id)?'selected':''}" aria-pressed="${draft.payload.includes(id)}" data-action="payload" data-id="${id}" title="${esc(p.description)} · ${num(p.mass)} kg">${draft.payload.includes(id)?'✓':'+'} ${esc(p.name)}</button>`).join('')}</div>
  </section>
  <aside class="yard-col yard-status">${statusPanel()}</aside>
  </div>`;
}

function stockCards(h) {
  const cards = catalog.resources.map(key => {
    const delta = h.lastBalance?.[key];
    const change = delta == null ? '' : `<small class="stock-delta ${delta<0?'out':'in'}">${delta>0?'+':''}${delta} last turn</small>`;
    return `<div class="stock-item"><small>${esc(resourceName[key]||key)}</small><strong>${num(h.stocks[key])}</strong>${change}</div>`;
  });
  return `<div class="stock-grid">${cards.join('')}</div>${h.lastBalance?'<small class="balance-key">Local operations only · excludes shipments and player spending.</small>':''}`;
}

function tileLabel(tile,h) {
  const task=state.surveys.find(e=>e.hub===h.id&&e.tile===tile.id&&e.status==='en_route');
  if(!tile.revealed)return task?`<small>SURVEY</small><b>${until(task.arrivesAt)}</b>`:'<b class="question">?</b>';
  return `<small>${esc(terrainLabel[tile.terrain]||'BASE')}</small><b>${tile.building?esc(tile.building.type==='habitat'?'⌂':tile.building.type==='solar'?'☀':tile.building.type==='shield'?'⬡':'◈'):'·'}</b><span>${tile.id+1}</span>`;
}

function controlView() {
  const h=hub(selectedHub);
  return `${ribbon('MISSION CONTROL',world(h.world).name.toUpperCase()+' / OPERATIONS')}<div class="page-heading"><div><h1>${esc(h.name)}</h1><p>Design spacecraft, send supplies, and research technology for your outposts.</p></div>${pill('COMMAND HUB ONLINE','green')}</div>
    <div class="form-grid"><button class="button primary" data-action="map-plan">DESIGN MISSION ↗</button><button class="button secondary" data-action="map-supply" data-id="${esc(h.id)}">SEND RESOURCES →</button><button class="button secondary" data-action="nav" data-id="research">OPEN TECH TREE →</button></div>
    <section class="surface-card inventory-panel"><div class="subheading"><h2>${esc(world(h.world).name)} stockpile</h2><span>AVAILABLE FOR LAUNCHES &amp; SHIPMENTS</span></div>${stockCards(h)}</section>`;
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
  <div class="surface-card"><div class="subheading"><h2>Construction bay</h2><span>MATERIALS + TIME · NO AP</span></div><div class="building-grid">${Object.entries(catalog.buildings).map(([id,b])=>`<button class="building-card ${selectedBuilding===id?'selected':''}" data-action="build-mode" data-id="${id}"><span class="building-symbol">${id==='solar'?'☀':id==='heater'?'♨':id==='extractor'?'≋':id==='greenhouse'?'❀':id==='laboratory'?'✧':id==='shield'?'⬡':'▤'}</span><b>${esc(b.name)}</b><small>${b.materials} MAT · ${b.turns} TURN${b.turns>1?'S':''}</small><span>${esc(b.description)}</span></button>`).join('')}</div></div>`:`<section class="surface-card orbit-panel"><div class="orbital-symbol">◇</div><h2>${h.kind==='control'?world(h.world).name+' command center':'Orbital refueling and communications station'}</h2><p>${h.kind==='control'?'The central shipyard finances missions and manufactures launch materials and fuel each turn.':'Orbital hubs stock fuel and contribute scientific data each turn. They reduce flight costs and connect surface stations through cargo spacecraft.'}</p><button class="button primary" data-action="nav" data-id="logistics">SEND RESOURCES →</button></section>`}
  <section class="surface-card inventory-panel"><div class="subheading"><h2>Local inventories</h2><span>NO AUTOMATIC SHARING</span></div>${stockCards(h)}</section>
  ${h.crew.length?`<section class="surface-card"><div class="subheading"><h2>Astronaut assignments</h2><span>REAL-TIME COMMANDS · NO AP</span></div><div class="crew-grid">${h.crew.map((person,i)=>`<label class="crew-card"><span class="crew-avatar">${esc(person.name.split(' ').map(n=>n[0]).join(''))}</span><b>${esc(person.name)}</b><small>${esc(person.specialty)}</small><select data-field="crew" data-index="${i}">${['engineering','science','survival'].map(role=>`<option value="${role}" ${person.assigned===role?'selected':''}>${role.toUpperCase()}</option>`).join('')}</select></label>`).join('')}</div></section>`:''}
  <section class="surface-card"><div class="subheading"><h2>Regional surveys</h2><span>REMOTE SENSING</span></div>${state.surveys.filter(e=>e.hub===h.id&&e.status==='en_route').map(e=>`<div class="timeline-row"><span class="timeline-mark survey">⟡</span><div><b>Survey ${e.id} → Sector ${e.tile+1}</b><small>Survey in progress</small></div><span class="eta">${until(e.arrivesAt)}</span></div>`).join('')||'<p class="muted">No active regional survey. Select a sector on the map to inspect its survey cost.</p>'}</section>`;
}

function logisticsView() {
  if(state.hubs.length<2)return `${ribbon('RESOURCE NETWORK','TRANSIT / ROUTE MANAGEMENT')}<section class="surface-card"><h1>Your network begins at Mars HQ.</h1><p>Establish a second hub by landing a mission before sending supplies between outposts.</p><button class="button primary" data-action="nav" data-id="planner">PLAN A LANDING MISSION ↗</button></section>`;
  if(!hub(freight.source))freight.source=state.hubs[0].id;
  if(!hub(freight.target)||freight.target===freight.source)freight.target=state.hubs.find(h=>h.id!==freight.source).id;
  const hubNames=Object.fromEntries(state.hubs.map(h=>[h.id,h.name]));
  const routeLabels=state.routes.map(route=>{const [a,b]=route.split(':');return `${hub(a)?.name||a} ⇄ ${hub(b)?.name||b}`;});
  return `${ribbon('RESOURCE NETWORK','TRANSIT / ROUTE MANAGEMENT')}<div class="page-heading"><div><h1>Build a connected system.</h1><p>Each hub maintains its own inventory. Dispatch cargo via spacecraft, orbital shuttle, or surface convoy.</p></div>${pill(`${state.routes.length} ROUTES`,'green')}</div>
  <div class="dual-panels logistics-columns"><section class="surface-card"><div class="subheading"><h2>Dispatch a shipment</h2><span>SUPPLY TRANSFER</span></div><div class="form-grid">${selectField('freight_source',Object.keys(hubNames),freight.source,hubNames)}${selectField('freight_target',Object.keys(hubNames).filter(id=>id!==freight.source),freight.target,hubNames)}${selectField('freight_resource',catalog.resources,freight.resource,resourceName)}<label class="field"><span>CARGO QUANTITY</span><input data-field="freight_amount" type="number" min="1" max="80" value="${freight.amount}"></label></div>
    <div class="freight-visual"><div class="freight-node">${esc(hub(freight.source)?.name||'Origin')}</div><div class="freight-link"><span>◀── ◇ ──▶</span><small>SCHEDULED TRANSPORT</small></div><div class="freight-node">${esc(hub(freight.target)?.name||'Destination')}</div></div><p class="field-description">Cargo leaves the source immediately, travels over one or more turns, then appears at the destination. The first successful shipment establishes a reusable route.</p><button class="button primary full" data-action="shipment" ${pending?'disabled':''}>DISPATCH CARGO →</button></section>
    <section class="surface-card"><div class="subheading"><h2>Network links</h2><span>ESTABLISHED ROUTES</span></div>${routeLabels.length?routeLabels.map(r=>`<div class="route-row"><span>⇄</span><b>${esc(r)}</b>${pill('ACTIVE','green')}</div>`).join(''):'<div class="empty-state">No supply corridors yet. Send a shipment between two hubs to establish a connection.</div>'}<div class="subheading" style="margin-top:30px"><h2>Shipments in transit</h2><span>${activeCargo().length} ACTIVE</span></div>${activeCargo().length?activeCargo().map(s=>`<div class="timeline-row"><span class="timeline-mark cargo">⇄</span><div><b>${s.amount} ${esc(resourceName[s.resource])}</b><small>${esc(hub(s.source)?.name||s.source)} → ${esc(hub(s.target)?.name||s.target)}</small></div><span class="eta">${until(s.arrivesAt)}</span></div>`).join(''):'<div class="empty-state">No freight currently in transit.</div>'}</section></div>`;
}

function researchView(){
  return techTreeView({catalog,state,selected:techSelected,data:researchState===state?researchData:null,zoom:techZoom,pending});
}
async function refreshResearch(){
  if(tab!=='research'||researchState===state)return;
  const snapshot=state,ticket=++researchRequest;
  researchState=snapshot;researchData=null;
  try{
    const result=await api('/api/campaign/research',{state:snapshot});
    if(ticket===researchRequest&&snapshot===state){researchData=result;render();}
  }catch(error){if(ticket===researchRequest&&snapshot===state){researchData={error:error.message};render();}}
}
function unlockLabel(category,id,label){
  const tech=catalog.techUnlocks?.[category]?.[id];
  return tech&&!state.tech.includes(tech)?`${label} · Research ${catalog.research[tech].name}`:label;
}

function assistantMessage() {
  const topics={
    welcome:`Commander, ${state.hubs.length} hubs are online. Each has its own stockpile. Use the Mission Designer to launch new outposts; never assume resources teleport between worlds.`,
    ships:'Choose a hull, engine, trajectory, and payload. Mars departures use game-estimate transfers. Earth departures to Mars, Venus, Mercury and Europa use GMAT-derived windows and Atlas V 401 performance data. Outer-planet routes use game estimates. Check propellant and flight software for either route.',
    exploration:'Nearby fogged tiles can be scanned freely. Select a distant sector and start a regional survey: energy buys a regional scan in one to three turns. Wide-Area Mapping research expands its coverage from 3×3 to 5×5. Coasts supply water, fertile soil boosts food, and rocky terrain improves mining. Water plants feed greenhouses and oxygen plants. No action points limit your orders.',
    logistics:'Select two hubs in Logistics and dispatch a shipment. It consumes fuel and credits, travels for turns, and establishes a supply corridor when delivered.',
    survival:'Crewed outposts consume food, water, oxygen, heat and power each turn. Supply shortages lower crew health. Solar arrays, extractors, heaters and greenhouses help balance production.',
  };
  if(state.event)return `Warning: ${state.event.title}. Resolve the event before advancing. Defensive preparation costs local materials; enduring can damage reserves.`;
  if(assistantTopic==='welcome'&&activeFlights().length)return `${activeFlights().length} spacecraft in flight. Open the mission timeline to track their estimated arrival, or advance a turn to progress travel and production.`;
  return topics[assistantTopic]||topics.welcome;
}

function advisor(){return `<aside class="advisor-panel"><div class="advisor-head"><span class="aura-avatar">✺</span><div><b>A.U.R.A.</b><small>MISSION CONTROL ADVISOR</small></div>${pill('GUIDANCE','green')}</div><div class="advisor-body"><div class="aura-message">${esc(assistantMessage())}</div><p class="aura-caption">Ask AURA about:</p><div class="aura-topics">${[['ships','Ship design'],['exploration','Exploration'],['logistics','Cargo routes'],['survival','Survival']].map(([key,label])=>`<button data-action="advisor-topic" data-id="${key}" class="${assistantTopic===key?'selected':''}">${label}</button>`).join('')}</div><div class="advisor-notice">ⓘ AURA uses authored, state-aware guidance. Open JARVIS for campaign chat.</div></div><button class="advisor-manual" data-action="assistant">OPEN INTRODUCTION ↗</button></aside>`;}

function modalMarkup(){
  if(!modal)return '';
  if(modal==='intro')return `<div class="modal-scrim"><section class="aura-modal" role="dialog" aria-modal="true" aria-labelledby="aura-title"><div class="modal-aura">✺</div><div class="eyebrow">A.U.R.A. · INCOMING BRIEFING</div><h2 id="aura-title">Welcome to<br><em>interplanetary command.</em></h2><p>Commander, it is ${turnDate(state.turn)}. Each turn is three months. Earth launch windows follow the planets; Mars departures use game-estimate transfers. Missions can fail, storms can kill a crew, and a review board decides your budget every year.</p><div class="intro-steps"><div><span>01</span><b>WRITE RULES</b><small>Flight software and base orders react when Mission Control is too far away.</small></div><div><span>02</span><b>FLY THE WINDOWS</b><small>Check every flight plan; supported Earth routes use GMAT-derived data.</small></div><div><span>03</span><b>KEEP THEM ALIVE</b><small>Supply, repair and prepare bases before hazards strike.</small></div></div><div class="modal-buttons"><button class="button secondary" data-action="intro-skip">EXPLORE FREELY</button><button class="button primary" data-action="intro-plan">DESIGN FIRST MISSION ↗</button></div><div class="modal-disclaimer">Earth departures to Mars, Venus, Mercury and Europa use NASA GMAT's bundled DE421 ephemeris and Atlas V 401 data, solved as Sun-only two-body transfers. Outer-planet routes and other values are labelled game estimates.</div></section></div>`;
  if(modal==='event'&&state.event)return `<div class="modal-scrim"><section class="aura-modal event-modal" role="dialog" aria-modal="true" aria-labelledby="event-title"><div class="modal-aura danger">!</div><div class="eyebrow">ENVIRONMENTAL EVENT · TURN ${fmtTurn(state.turn)}</div><h2 id="event-title">${esc(state.event.title)}</h2><p>${esc(state.event.description)}</p><div class="event-options">${state.event.choices.map(c=>`<button class="event-option" data-action="event-choice" data-id="${esc(c.id)}"><b>${esc(c.label)} →</b><span>${esc(c.description)}</span></button>`).join('')}</div></section></div>`;
  if(modal==='confirm-launch'&&quote?.ok){const failed=quote.checks.filter(c=>!c.ok);return `<div class="modal-scrim"><section class="aura-modal compact" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><div class="modal-aura danger">!</div><div class="eyebrow">LAUNCH CHECK FAILED</div><h2 id="confirm-title">This mission ${esc((outcomeText[quote.outcome]||'').toLowerCase())}.</h2><ul class="check-list">${failed.map(c=>`<li class="bad"><b>✕ ${esc(c.label)}</b><span>${esc(c.detail)}</span></li>`).join('')}</ul><p>Launching anyway spends the credits${quote.outcome==='scrub'?'; the spacecraft is returned.':quote.outcome==='stranded'?', the spacecraft and its propellant.':' and the spacecraft will not achieve its objective.'}</p><div class="modal-buttons"><button class="button secondary" data-action="dismiss-modal">FIX THE PLAN</button><button class="button primary risky" data-action="confirm-launch">LAUNCH ANYWAY</button></div></section></div>`;}
  if(modal==='advisor')return advisorView({advice:adviceState===state?advice:null,topic:adviceTopic});
  if(modal==='credits')return creditsView();
  if(modal==='settings')return settingsView({tutorial:tutorial.progress(),mapMotion,guideHidden,music:music.settings});
  if(modal==='reset')return `<div class="modal-scrim"><section class="aura-modal compact" role="dialog" aria-modal="true" aria-labelledby="reset-title"><div class="eyebrow">CAMPAIGN RESET</div><h2 id="reset-title">Start a new space programme?</h2><p>Begin at Mars HQ with no Earth hub. Travel to Earth and land before building there. Your current browser save will be replaced.</p><div class="modal-buttons"><button class="button secondary" data-action="dismiss-modal">CANCEL</button><button class="button primary" data-action="confirm-reset">START ON MARS</button></div></section></div>`;
  return '';
}

function guideCard(){
  if(guideHidden||!catalog.faults||tutorial?.active())return '';
  const steps=guideSteps(state,{software:catalog.faults.example,orders:catalog.orders.example});
  const index=steps.findIndex(s=>!s.done);
  if(index<0)return '';
  const step=steps[index];
  return `<aside class="guide-card" aria-label="First mission guide"><div class="hud-kicker">FIRST MISSION GUIDE · STEP ${index+1} / ${steps.length} <button class="guide-close" data-action="guide-hide" aria-label="Hide guide">✕</button></div><p>${step.action?`<button data-action="nav" data-id="${step.action}">${esc(step.text)} →</button>`:esc(step.text)}</p></aside>`;
}

/** What the tutorial needs to know about the selected sector (read-only). */
function tutorialSelection(){
  const h=activeSurface(),tile=h?.tiles[selectedTile];
  if(!h||!tile||tab!=='system')return null;
  const ready=inspectionMatches()&&inspection?.ok?inspection:null;
  const plan=ready&&selectedBuilding?ready.buildings?.[selectedBuilding]:null;
  return {revealed:tile.revealed,free:ready&&!tile.revealed?ready.survey.turns===0:null,canBuild:Boolean(plan?.ok),reason:plan&&!plan.ok?plan.reason:''};
}

/** Tutorial "SHOW ME": select (not act on) a nearby sector that fits the step. The server still validates any action. */
function suggestTile(kind){
  const h=activeSurface();
  if(!h)return false;
  const size=catalog.mapSize||96,core=mapCore(),cx=core%size,cy=Math.floor(core/size);
  const working=h.tiles.filter(t=>t.building&&(t.building.condition??100)>0&&t.building.onlineFrom<=state.turn);
  const near=(t,list,reach)=>list.some(b=>Math.abs(t.id%size-b.id%size)+Math.abs(Math.floor(t.id/size)-Math.floor(b.id/size))<=reach);
  const open=t=>!catalog.biomes?.[t.biome]?.blocked&&t.terrain!=='hazard';
  const candidates=h.tiles.filter(t=>kind==='scan'?!t.revealed&&near(t,working,2):t.revealed&&!t.building&&open(t)&&near(t,h.tiles.filter(x=>x.building),1));
  if(!candidates.length)return false;
  const best=candidates.sort((a,b)=>(Math.abs(a.id%size-cx)+Math.abs(Math.floor(a.id/size)-cy))-(Math.abs(b.id%size-cx)+Math.abs(Math.floor(b.id/size)-cy)))[0];
  selectedTile=best.id;tab='system';render();
  mapController?.centerOn(best.id%size,Math.floor(best.id/size));
  return true;
}

function activeSurface(){const candidates=state.hubs.filter(h=>h.world===selectedWorld&&h.tiles.length);return candidates.find(h=>h.id===selectedHub)||candidates[0]||null;}

async function selectMapTile(index){
  selectedTile=index;
  const surface=activeSurface();
  if(!surface){
    const control=state.hubs.find(h=>h.world===selectedWorld&&h.kind==='control'),mid=Math.floor((catalog.mapSize||96)/2);
    if(control&&index===mid*(catalog.mapSize||96)+mid){selectedHub=control.id;tab='hubs';}
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

function mountGameMap(groundView){
  const canvas=document.querySelector('#planet-map');
  if(!canvas)return;
  const surface=activeSurface();
  const control=state.hubs.find(h=>h.world===selectedWorld&&h.kind==='control');
  mapController=mountPlanetMap(canvas,document.querySelector('#mini-map'),{
    world:selectedWorld,hubId:surface?.id||control?.id,size:catalog.mapSize||96,tiles:surface?.tiles||catalog.surfacePreviews[selectedWorld]||[],biomes:catalog.biomes,buildingMode:Boolean(selectedBuilding),groundView,motion:mapMotion,controlHub:Boolean(control&&!surface),
    selection:surface?selectedTile:null,turn:state.turn,
    surveys:state.surveys.filter(e=>surface&&e.hub===surface.id&&e.status==='en_route').map(e=>e.tile),
    onSelect:selectMapTile,
  });
}

function render(){
  if(!state||!catalog)return;
  music.select(solarOpen && catalog.worlds[solarSelected] ? solarSelected : selectedWorld);
  const focused=document.activeElement;
  const panel=document.querySelector('.game-screen-panel'),panelScroll=panel&&renderedTab===tab?panel.scrollTop:null;
  const tree=document.querySelector('.tech-viewport'),treeScroll=tree?{left:tree.scrollLeft,top:tree.scrollTop}:null;
  const techFocus=focused?.closest('.rd-screen')?{action:focused.dataset.action,id:focused.dataset.id}:null;
  const mapFocus=focused?.id==='planet-map';
  const solarFocus=focused?.closest('.solar-dialog')?{tag:focused.tagName,action:focused.dataset.action,id:focused.dataset.id}:null;
  solarController?.destroy();solarController=null;shipController?.destroy();shipController=null;
  const secondary=tab==='hubs'&&hub(selectedHub)?.kind==='control'?controlView():tab==='planner'?plannerView():tab==='logistics'?logisticsView():tab==='research'?researchView():tab==='software'?softwareView({catalog,state,softwareTab,softwareDraft,ordersDraft,softwareTest,dirtySoftware:!same(softwareDraft,savedSoftware()),dirtyOrders:!same(ordersDraft,state.orders),shipLabel:shipLabel()}):tab==='program'?programView({catalog,state,date:turnDate(state.turn)}):'';
  const groundView=Boolean(activeSurface())&&(groundViewPinned||Boolean(selectedBuilding));
  const lightWorld=selectedWorld==='earth'?null:selectedWorld;
  app.innerHTML=`<div class="campaign-app map-mode">${topbar()}<main class="map-main">${mapScreen({catalog,state,selectedWorld,selectedHub,selectedBuilding,selectedTile,pending,inspection:inspectionMatches()?inspection:null,mapMotion,groundView,date:turnDate(state.turn),lightMinutes:lightWorld?(catalog.lightMinutes?.[lightWorld]?.[(state.turn-1)%catalog.lightMinutes[lightWorld].length]??'—'):0,guide:guideCard()})}${secondary?`<div class="game-screen-dimmer"></div><section class="game-screen-panel"><button class="map-back" data-action="nav" data-id="system">← BACK TO MAP</button>${secondary}</section>`:''}</main></div>${solarOpen?solarSystemView({catalog,state,selected:solarSelected,showRoutes:solarRoutes,date:turnDate(state.turn)}):''}${modalMarkup()}`;
  if(panelScroll!==null){const fresh=document.querySelector('.game-screen-panel');if(fresh)fresh.scrollTop=panelScroll;}
  renderedTab=tab;
  document.querySelector('.campaign-app').inert=Boolean(modal||solarOpen);
  document.querySelector('[data-action="solar-open"]').setAttribute('aria-expanded',String(solarOpen));
  mountGameMap(groundView);
  const shipCanvas=tab==='planner'&&document.querySelector('.ship-canvas');
  if(shipCanvas)shipController=mountShip3d(shipCanvas,shipModel(),pickPart);
  if(mapFocus)document.querySelector('#planet-map')?.focus({preventScroll:true});
  refreshInspection();
  if(tab==='research'){
    const viewport=document.querySelector('.tech-viewport');
    if(viewport&&treeScroll){viewport.scrollLeft=treeScroll.left;viewport.scrollTop=treeScroll.top;}
    if(techFocus)[...document.querySelectorAll('.rd-screen [data-action]')].find(el=>el.dataset.action===techFocus.action&&el.dataset.id===techFocus.id)?.focus({preventScroll:true});
    refreshResearch();
  }
  tutorial?.sync();
  jarvis?.sync(state.turn, Boolean(modal||solarOpen));
  refreshAdvice();
  if(solarOpen){
    const panel=document.querySelector('.solar-dialog');
    solarController=mountSolarSystem(panel,solarCamera,solarMotion);
    const restored=solarFocus&&[...panel.querySelectorAll('[data-action]')].find(el=>el.tagName===solarFocus.tag&&el.dataset.action===solarFocus.action&&el.dataset.id===solarFocus.id);
    (restored||panel.querySelector('.solar-close')).focus({preventScroll:true});
  }
}

/** Fetch AURA's advice once per game state (Python computes it from the rules). */
async function refreshAdvice(){
  if(!state||adviceState===state)return;
  const snapshot=state,ticket=++adviceRequest;
  adviceState=snapshot;advice=null;
  try{const result=await api('/api/campaign/advice',{state:snapshot});if(ticket===adviceRequest&&snapshot===state){advice=result;render();}}
  catch(error){if(ticket===adviceRequest&&snapshot===state){advice={ok:false,error:error.message};render();}}
}

function followAdvice(item){
  const a=item?.action;if(!a)return;
  modal=null;
  if(a.type==='nav'){tab=a.tab;selectedBuilding=null;if(tab==='software')resetDrafts();render();if(tab==='planner')refreshQuote();return;}
  if(a.type==='prepare'){render();perform('prepare',{forecast:a.forecast});return;}
  if(a.type==='plan'){chooseDestination(a.destination);return;}
  if(a.type==='tech'){techSelected=a.tech;tab='research';render();return;}
  if(a.type==='hub'||a.type==='tile'){const h=hub(a.hub);if(!h){render();return;}openWorldMap(h.world,h.id);if(a.type==='tile'){selectedTile=a.tile;render();const size=catalog.mapSize||96;mapController?.centerOn(a.tile%size,Math.floor(a.tile/size));}return;}
  render();
}

let lastLaunchKg=null;
async function refreshQuote(){
  if(!state||!catalog)return;
  const ticket=++quoteId;
  try {const calculated=await api('/api/campaign/quote',{state,design:draft});if(ticket===quoteId){if(calculated.ok&&lastLaunchKg!==null&&calculated.numbers.launchKg!==lastLaunchKg)massDelta={kg:calculated.numbers.launchKg-lastLaunchKg,at:Date.now()};if(calculated.ok)lastLaunchKg=calculated.numbers.launchKg;quote=calculated;render();}}
  catch(error){if(ticket===quoteId){quote={ok:false,error:error.message};render();}}
}

async function perform(action,args={}){
  if(pending)return;
  pending=true;
  try{
    const result=await api('/api/campaign/action',{state,action,args});
    if(!result.ok){notify(result.message||'Mission command was rejected.',true);return;}
    const oldCount=state.hubs.length,oldTurn=state.turn,oldMissions=state.missions.length;
    state=result.state;await save();notify(result.message||'Mission control acknowledged.');
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

function chooseDestination(id){selectedWorld=id;if(!hub(draft.source)||id==='earth'&&hub(draft.source).world==='earth')draft.source=state.hubs.find(h=>h.world!=='earth'&&h.status==='active')?.id||homeHub().id;draft.destination=id;draft.site=freeSite(id);draft.objective='surface';tab='planner';quote=null;render();refreshQuote();}

function closeSolar(){solarOpen=false;render();document.querySelector('[data-action="solar-open"]')?.focus({preventScroll:true});}
function openWorldMap(id,hubId){
  selectedWorld=id;
  const established=hub(hubId)||state.hubs.find(h=>h.world===id&&h.tiles.length)||state.hubs.find(h=>h.world===id);
  if(established)selectedHub=established.id;
  selectedTile=mapCore();
  selectedBuilding=null;tab='system';solarOpen=false;render();
  document.querySelector('[data-action="solar-open"]')?.focus({preventScroll:true});
}

app.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');
  if(!button||button.disabled)return;
  const action=button.dataset.action,id=button.dataset.id;
  if(action==='home'){openHome();render();return;}
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
  if(action==='solar-operations'){const h=hub(id);if(!h||h.kind!=='control')return;solarOpen=false;selectedHub=id;selectedWorld=h.world;tab='hubs';render();document.querySelector('.map-back')?.focus();return;}
  if(action==='solar-hub'){
    const h=hub(id);if(!h)return;
    if(h.tiles.length){openWorldMap(h.world,id);return;}
    solarOpen=false;selectedHub=id;selectedWorld=h.world;freight.source=id;
    if(freight.target===id)freight.target=state.hubs.find(item=>item.id!==id)?.id||id;
    tab='logistics';render();document.querySelector('.map-back')?.focus();return;
  }
  if(action==='nav'){tab=id;selectedBuilding=null;if(tab==='software'&&same(softwareDraft,savedSoftware())&&same(ordersDraft,state.orders))resetDrafts();render();if(tab==='planner')refreshQuote();return;}
  if(action==='map-world'){openWorldMap(id);return;}
  if(action==='map-hub'){selectedHub=id;selectedWorld=hub(id).world;selectedTile=mapCore();selectedBuilding=null;tab='system';render();return;}
  if(action==='map-supply'){
    freight.source=id;
    if(freight.target===id)freight.target=state.hubs.find(h=>h.id!==id)?.id||id;
    tab='logistics';render();return;
  }
  if(action==='map-plan'){const control=state.hubs.find(h=>h.world===selectedWorld&&h.kind==='control');if(control)draft.source=control.id;chooseDestination(control?(control.world==='earth'?'mars':'earth'):selectedWorld);return;}
  if(action==='map-ground'){
    groundViewPinned=!groundViewPinned;
    render();
    document.querySelector('[data-action="map-ground"]')?.focus({preventScroll:true});
    return;
  }
  if(action==='map-motion'){mapMotion=!mapMotion;render();return;}
  if(action==='survey-sector'){const h=activeSurface();if(h)await perform('explore',{hub:h.id,tile:selectedTile});return;}
  if(action==='construct-sector'){const h=activeSurface();if(h&&selectedBuilding){const previous=state;await perform('construct',{hub:h.id,tile:selectedTile,building:selectedBuilding});if(state!==previous)selectedBuilding=null;render();}return;}
  if(action==='map-zoom-in'){mapController?.zoom(1.22);return;}
  if(action==='map-zoom-out'){mapController?.zoom(1/1.22);return;}
  if(action==='map-center'){mapController?.centerOn();return;}
  if(action==='map-overview'){mapController?.overview();return;}
  if(action==='select-world'){openWorldMap(id);return;}
  if(action==='select-hub'){selectedHub=id;selectedWorld=hub(id).world;selectedTile=mapCore();selectedBuilding=null;tab='hubs';render();return;}
  if(action==='choose-destination'){chooseDestination(id);return;}
  if(action==='fit-world'){draft.destination=id;selectedWorld=id;draft.site=draft.objective==='surface'?freeSite(id):draft.site;quote=null;render();refreshQuote();return;}
  if(action==='payload'){draft.payload=draft.payload.includes(id)?draft.payload.filter(item=>item!==id):[...draft.payload,id];quote=null;render();refreshQuote();return;}
  if(action==='quote'){refreshQuote();return;}
  if(action==='launch'){if(quote?.ok&&quote.outcome!=='go'){modal='confirm-launch';render();return;}await perform('launch',{design:draft});return;}
  if(action==='confirm-launch'){modal=null;await perform('launch',{design:draft,confirm:true});return;}
  if(action==='guide-hide'){guideHidden=true;try{localStorage.setItem(GUIDE_KEY,'1');}catch{/* ignore */}render();return;}
  if(action==='prepare'){await perform('prepare',{forecast:id});return;}
  if(action==='factory-mode'){const h=activeSurface();if(h)await perform('factoryMode',{hub:h.id,tile:selectedTile,mode:id});return;}
  if(action==='repair-spares'){const h=activeSurface();if(h)await perform('repair',{hub:h.id,tile:Number(id),resource:'spares'});return;}
  if(action==='repair'){const surface=activeSurface();if(surface)await perform('repair',{hub:surface.id,tile:Number(id)});return;}
  if(action==='pick-computer'){softwareDraft={...softwareDraft,computer:id};softwareTest=null;render();return;}
  if(action.startsWith('rule-')){
    const kind=button.dataset.kind;
    if(kind==='software'){
      const config={...softwareConfig(catalog),slots:catalog.computers[softwareDraft.computer].slots};
      const rules=applyRuleAction(softwareDraft.rules,action,button.dataset,config), index=Number(button.dataset.rule);
      if(action==='rule-add'&&rules.length>softwareDraft.rules.length)addedRule=softwareTab==='earth'&&tutorial?.editingEarthRule()?rules.length-1:-1;
      if(action==='rule-del'&&addedRule>=index)addedRule=addedRule===index?-1:addedRule-1;
      if(action==='rule-up'||action==='rule-down'){
        const other=index+(action==='rule-up'?-1:1);
        if(addedRule===index)addedRule=other;
        else if(addedRule===other)addedRule=index;
      }
      softwareDraft={...softwareDraft,rules};softwareTest=null;
    }else{ordersDraft=applyRuleAction(ordersDraft,action,button.dataset,ordersConfig(catalog,state));}
    render();
    const column=`.software-columns > section:${kind==='software'?'first':'last'}-child`,rule=Number(button.dataset.rule);
    if(action==='rule-add'){const card=[...document.querySelectorAll(`${column} .rule-card`)].at(-1);card?.scrollIntoView({block:'nearest',behavior:'smooth'});card?.querySelector('select')?.focus({preventScroll:true});}
    else{const target=action==='rule-up'?rule-1:action==='rule-down'?rule+1:rule;document.querySelector(`[data-action="${action}"][data-kind="${kind}"][data-rule="${target}"]:not(:disabled)`)?.focus({preventScroll:true});}
    return;}
  if(action==='software-tab'){softwareTab=id;softwareTest=null;resetSoftwareDraft();render();return;}
  if(action==='software-clear'){await perform('setSoftware',{world:softwareTab,clear:true});softwareTest=null;refreshQuote();return;}
  if(action==='software-test'){
    const shipPlan={parts:draft.parts,payload:draft.payload,objective:draft.objective};
    const design=softwareDraft, world=softwareTab;
    let result;
    try{
      if(world==='default'){
        const worlds=Object.keys(catalog.faults.planetDangers).filter(w=>!state.softwareProfiles?.[w]);
        const summary=[];
        for(const w of worlds){const r=await api('/api/campaign/faults/test',{design,world:w,ship:shipPlan});summary.push({world:w,passed:r.passed===r.results.length,results:r.results});}
        result={ok:true,summary};
      }else result=await api('/api/campaign/faults/test',{design,world,ship:shipPlan});
    }catch(error){result={ok:false,error:error.message};}
    if(world!==softwareTab||design!==softwareDraft)return;
    softwareTest=result;
    render();return;
  }
  if(action==='software-save'){await perform('setSoftware',softwareTab==='default'?softwareDraft:{...softwareDraft,world:softwareTab});refreshQuote();return;}
  if(action==='orders-save'){await perform('setOrders',{rules:ordersDraft});return;}
  if(action==='build-mode'){selectedBuilding=selectedBuilding===id?null:id;render();return;}
  if(action==='cancel-build'){selectedBuilding=null;render();return;}
  if(action==='tile'){await selectMapTile(Number(id));return;}
  if(action==='shipment'){await perform('shipment',{...freight,amount:Number(freight.amount)});return;}
  if(action==='tech-select'||action==='tech-open'){if(catalog.research[id])techSelected=id;if(action==='tech-open')tab='research';render();return;}
  if(action==='tech-zoom-in'||action==='tech-zoom-out'){techZoom=Math.max(.5,Math.min(1.3,techZoom*(action==='tech-zoom-in'?1.15:1/1.15)));render();return;}
  if(action==='tech-fit'){const width=document.querySelector('.tech-viewport')?.clientWidth||800;techZoom=Math.max(.5,Math.min(1,(width-12)/TREE.width));render();return;}
  if(action==='tech-refresh'){researchState=null;refreshResearch();return;}
  if(action==='tech-labs'){const home=homeHub();openWorldMap(home.world,home.id);selectedBuilding='laboratory';render();return;}
  if(action==='research'){await perform('research',{tech:id});return;}
  if(action==='advance'){await perform('advance');return;}
  if(action==='event-choice'){modal=null;await perform('eventChoice',{choice:id});if(state.event)modal='event';render();return;}
  if(action==='assistant'){modal='advisor';render();document.querySelector('.advisor-modal [data-action="dismiss-modal"]')?.focus();return;}
  if(action==='advisor-topic'){adviceTopic=id;render();return;}
  if(action==='advisor-dismiss'){if(event.target===button){modal=null;render();}return;}
  if(action==='advisor-briefing'){modal='intro';render();return;}
  if(action==='advice-go'){followAdvice(advice?.items?.[Number(button.dataset.index)]);return;}
  if(action==='intro-skip'){modal=state.event?'event':null;render();return;}
  if(action==='intro-plan'){modal=state.event?'event':null;tab='planner';render();refreshQuote();return;}
  if(action==='reset'){modal='reset';render();return;}
  if(action==='dismiss-modal'){modal=null;render();return;}
  if(action==='credits-open'){
    modal='credits';render();document.querySelector('[data-action="credits-back"]')?.focus();
    await loadMusicCredits();
    return;
  }
  if(action==='credits-back'){
    modal='settings';render();document.querySelector('[data-action="credits-open"]')?.focus();return;
  }
  if(action==='settings-open'){modal='settings';render();document.querySelector('.settings-modal [data-action="dismiss-modal"]')?.focus();return;}
  if(action==='tutorial-restart'){modal=null;openHome();tutorial.restart();render();return;}
  if(action==='tutorial-resume'){modal=null;tutorial.resume();render();return;}
  if(action==='tutorial-close'){tutorial.close();render();return;}
  if(action==='settings-guide'){guideHidden=!button.checked;try{localStorage.setItem(GUIDE_KEY,guideHidden?'1':'0');}catch{/* ignore */}render();return;}
  if(action==='settings-motion'){mapMotion=button.checked;render();return;}
  if(action==='confirm-reset'){
    try {state=(await api('/api/campaign/new',{seed:`HORIZON-${Date.now().toString(36).toUpperCase().slice(-6)}`})).state;jarvis?.reset();resetDrafts();softwareTest=null;openHome();await save();render();}
    catch(error){notify(error.message,true);}return;
  }
});

app.addEventListener('change',async event=>{
  const control=event.target,field=control.dataset.field;
  if(field==='music-volume')return;  // Handled live by the input event.
  if(field==='music-enabled'){music.setEnabled(control.checked);return;}
  if(control.dataset.ruleField){
    if(control.dataset.kind==='software'){softwareDraft={...softwareDraft,rules:applyRuleField(softwareDraft.rules,control.dataset,control.value,softwareConfig(catalog))};softwareTest=null;}
    else ordersDraft=applyRuleField(ordersDraft,control.dataset,control.value,ordersConfig(catalog,state));
    const {kind,rule,cond,ruleField}=control.dataset;
    render();
    document.querySelector(`[data-kind="${kind}"][data-rule="${rule}"]${cond!==undefined?`[data-cond="${cond}"]`:''}[data-rule-field="${ruleField}"]`)?.focus({preventScroll:true});
    return;
  }
  if(!field)return;
  if(field.startsWith('part_')){const slot=field.slice(5);draft.parts={...draft.parts,[slot]:control.value};recentPart=slot;recentAt=Date.now();quote=null;render();refreshQuote();return;}
  if(field==='useLocalSpares'){draft.useLocalSpares=control.checked;quote=null;render();refreshQuote();return;}
  if(field==='propellantKg'){draft.propellantKg=Math.max(0,Math.min(catalog.propellantMaxKg,Math.round(Number(control.value)||0)));quote=null;render();refreshQuote();return;}
  if(field==='hub'){selectedHub=control.value;selectedWorld=hub(selectedHub).world;selectedTile=mapCore();selectedBuilding=null;render();return;}
  if(field==='crew'){await perform('assignCrew',{hub:selectedHub,index:Number(control.dataset.index),assignment:control.value});return;}
  if(field.startsWith('freight_')){freight[field.slice(8)]=field==='freight_amount'?Number(control.value):control.value;render();return;}
  draft[field]=control.value;
  if(field==='source'&&hub(draft.source)?.world==='earth'&&draft.destination==='earth'){draft.destination='mars';draft.site=freeSite('mars');}
  if(field==='destination'){selectedWorld=draft.destination;draft.site=freeSite(draft.destination);}
  if(field==='objective'){draft.site=field==='objective'&&draft.objective==='surface'?freeSite(draft.destination):draft.objective==='orbital'?'Orbital Station':'Remote Survey';}
  quote=null;render();refreshQuote();
});

let propTimer=null;
app.addEventListener('input',event=>{
  if(event.target.dataset.field==='music-volume'){
    music.setVolume(Number(event.target.value));
    const output=document.querySelector('#music-level');
    if(output)output.value=music.settings.volume+'%';
    return;
  }
  const control=event.target;
  if(control.dataset.field!=='propellantKg'||control.type!=='range')return;
  draft.propellantKg=Number(control.value);
  const label=control.closest('.propellant-field')?.querySelector('span');
  if(label)label.textContent=`PROPELLANT · ${num(draft.propellantKg)} KG`;
  const shipCanvas=document.querySelector('.ship-canvas');
  if(shipCanvas){shipController?.destroy();shipController=mountShip3d(shipCanvas,shipModel(),pickPart);}
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
