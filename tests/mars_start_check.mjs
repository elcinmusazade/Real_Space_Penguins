import assert from 'node:assert/strict';
import {createPlanetMusic} from '../web/planet-music.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {mapScreen} from '../web/map-ui.js';
import {solarSystemView} from '../web/solar-system.js';
import {guideSteps} from '../web/program-ui.js';
import {colonyObjective} from '../web/tutorial.js';
import {advisorView,badgeCount} from '../web/advisor.js';

const fixture=JSON.parse(readFileSync(0,'utf8'));
const source=readFileSync(new URL('../web/campaign.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/initialize\(\);\s*$/,'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const tutorialSource=readFileSync(new URL('../web/tutorial.js',import.meta.url),'utf8').replace(/^export /gm,'');
async function session(previous,prefs=new Map()){
  const handlers={},requests=[],saves=[];
  const el={dataset:{},tagName:'BUTTON',inert:false,style:{},setAttribute(){},focus(){},getClientRects(){return []},closest(){return null},querySelector(){return el},querySelectorAll(){return []},append(){}};
  let tutorialRoot;
  const app={...el,innerHTML:'',addEventListener(type,callback){handlers[type]=callback;}};
  const context=vm.createContext({performance,createPlanetMusic,console,Date,Math,Number,String,JSON,Map,Set,Promise,setTimeout,clearTimeout,
    localStorage:{getItem:k=>prefs.get(k)??null,setItem:(k,v)=>prefs.set(k,v)},window:{setTimeout(){},addEventListener(){}},
    document:{activeElement:null,body:{append(node){tutorialRoot=node}},querySelector(s){return s==='#app'?app:el},querySelectorAll(){return []},addEventListener(){},createElement(){return {...el,innerHTML:'',addEventListener(){},querySelector(){return null},remove(){}}}},
    mountPlanetMap(){return {destroy(){}}},mountSolarSystem(){return {destroy(){}}},mapScreen,solarSystemView,guideSteps,advisorView,badgeCount,mountShip3d(){return {destroy(){}}},
    loadCampaign:async()=>structuredClone(previous),saveCampaign:async state=>saves.push(structuredClone(state)),
    apiStub:async(path,payload)=>{
      requests.push({path,payload});
      if(path.endsWith('/advice'))return {ok:true,items:[],counts:{critical:0,warning:0}};
    if(path.endsWith('/catalog'))return {catalog:structuredClone(fixture.catalog)};
      if(path.endsWith('/new'))return {state:structuredClone(fixture.fresh)};
      if(path.endsWith('/validate'))return {ok:true,state:structuredClone(payload.state)};
      if(path.endsWith('/inspect'))return {...structuredClone(fixture.inspection),hub:payload.hub,tile:payload.tile};
      if(path.endsWith('/quote'))return {ok:false,error:'Preview quote'};
      throw new Error(`Unexpected API request ${path}`);
    }
  });
  vm.runInContext(`{ ${tutorialSource}
globalThis.createTutorial=createTutorial; globalThis.settingsView=settingsView; }`,context);
  vm.runInContext(source+`\napi=apiStub;globalThis.initialize=initialize;globalThis.view=()=>({tab,selectedWorld,selectedHub,selectedTile,modal,solarOpen,freight,draft,state,track:music.settings.title});`,context);
  await context.initialize();await tick();
  const click=async(action,id)=>{await handlers.click({target:{closest(){return {dataset:{action,id},disabled:false}}}});await tick();};
  const change=async(field,value)=>{await handlers.change({target:{dataset:{field},value,checked:value===true}});await tick();};
  return {context,app,requests,saves,click,change,tutorialRoot};
}
function onMars(s,hubId='H1'){
  const v=s.context.view();
  assert.equal(v.selectedWorld,'mars');assert.equal(v.selectedHub,hubId);assert.equal(v.tab,'system');assert.equal(v.modal,null);
  assert.equal(v.selectedTile,fixture.catalog.mapSize/2*(fixture.catalog.mapSize+1));
  assert.ok(s.app.innerHTML.includes('map-theme-mars'));
  assert.equal(s.app.innerHTML.includes('Explore Mars HQ'), !s.tutorialRoot.innerHTML,
    'the first-mission guide appears when the tutorial is closed');
  assert.ok(!s.app.innerHTML.includes('class="modal-scrim"'));
  assert.ok(!s.app.innerHTML.includes('class="game-screen-panel"'));
}
const prefs=new Map(), tutorialKey='ares.first-light.tutorial.v1';
const s=await session(null,prefs);onMars(s);
assert.match(s.tutorialRoot.innerHTML,/Welcome, Commander/);
assert.match(s.tutorialRoot.innerHTML,/Win by colonizing all planets/);
assert.match(s.tutorialRoot.innerHTML,/1 \/ 8 planets colonized/);
assert.match(s.tutorialRoot.innerHTML,/Mars · colonized/);
const completedObjective=colonyObjective({catalog:fixture.catalog,state:{colonizedPlanets:fixture.catalog.colonyPlanets}});
assert.match(completedObjective,/Victory! All planets colonized/);
assert.match(completedObjective,/8 \/ 8 planets colonized/);
assert.deepEqual(JSON.parse(prefs.get(tutorialKey)),{status:'active',step:0});
const reload=await session(s.saves.at(-1),prefs);
assert.match(reload.tutorialRoot.innerHTML,/Welcome, Commander/);
await reload.click('settings-open');await reload.click('tutorial-close');await reload.click('dismiss-modal');
assert.equal(reload.tutorialRoot.innerHTML,'');
const closed=await session(reload.saves.at(-1),prefs);
assert.equal(closed.tutorialRoot.innerHTML,'');
await closed.click('settings-open');await closed.click('tutorial-resume');
assert.match(closed.tutorialRoot.innerHTML,/Welcome, Commander/);
prefs.set(tutorialKey,JSON.stringify({status:'active',step:1}));
assert.match((await session(s.saves.at(-1),prefs)).tutorialRoot.innerHTML,/Time and resources/);
prefs.set(tutorialKey,JSON.stringify({status:'done',step:1}));
assert.equal((await session(null,prefs)).tutorialRoot.innerHTML,'');
assert.equal(s.context.view().track,'Peaceful Village · Stefan Grossmann');
await s.click('solar-open');await s.click('solar-select','saturn');
assert.equal(s.context.view().track,'Gymnopédie No. 3 · Michael Laucke');
await s.click('solar-close');assert.equal(s.context.view().track,'Peaceful Village · Stefan Grossmann');
assert.equal(s.context.view().state.hubs.length,1);
assert.ok(!s.requests.some(r=>r.path.endsWith('/quote')),'startup must not open or prefetch the mission designer');
await s.click('solar-open');
assert.ok(s.app.innerHTML.includes('solar-dialog'));
await s.click('solar-select','earth');
assert.ok(s.app.innerHTML.includes('data-action="solar-plan" data-id="earth"'));
assert.ok(!s.app.innerHTML.includes('data-action="solar-operations"'));
await s.click('solar-map','earth');
assert.equal(s.context.view().selectedWorld,'earth');assert.equal(s.context.view().tab,'system');
assert.ok(s.app.innerHTML.includes('NO SURFACE STATION'));
assert.ok(s.app.innerHTML.includes('DEPLOY A LANDER FIRST'));
assert.ok(!s.app.innerHTML.includes('data-action="construct-sector"'));
assert.equal(s.context.view().state.hubs.length,1,'preview must not create an outpost');
await s.click('map-plan');assert.equal(s.context.view().draft.destination,'earth');assert.equal(s.context.view().draft.source,'H1');
assert.ok(s.app.innerHTML.includes('GAME-ESTIMATE TRANSFER'));
assert.ok(s.app.innerHTML.includes('value="earth" selected'));
await s.click('home');onMars(s);
await s.click('solar-open');await s.click('solar-operations','H1');
assert.equal(s.context.view().selectedWorld,'mars');assert.match(s.app.innerHTML,/Mars stockpile/);
await s.click('home');onMars(s);
await s.click('select-world','earth');assert.equal(s.context.view().tab,'system','world selection must not auto-open the planner');
await s.click('nav','logistics');
assert.ok(s.app.innerHTML.includes('Establish a second hub'));
assert.ok(!s.app.innerHTML.includes('data-action="shipment"'),'one-hub start must not offer invalid cargo orders');
await s.click('nav','planner');assert.equal(s.context.view().tab,'planner');
assert.ok(s.app.innerHTML.includes('class="game-screen-panel"'));
assert.ok(s.requests.some(r=>r.path.endsWith('/quote')));
assert.match(s.app.innerHTML,/Use local spare parts/);
await s.change('useLocalSpares',true);
assert.equal(s.requests.filter(r=>r.path.endsWith('/quote')).at(-1).payload.design.useLocalSpares,true);
await s.click('assistant');assert.equal(s.context.view().modal,'advisor');
await s.click('advisor-briefing');assert.equal(s.context.view().modal,'intro','AURA briefing remains available on request');
await s.click('reset');assert.ok(s.app.innerHTML.includes('START ON MARS'));
await s.click('confirm-reset');onMars(s);assert.equal(s.context.view().state.hubs.length,1);
assert.equal(s.saves.at(-1).hubs.length,1);

const old=await session(fixture.existing);onMars(old,'H2');
assert.equal(old.tutorialRoot.innerHTML,'','an existing campaign can start the tutorial from Settings');
await old.click('settings-open');assert.match(old.app.innerHTML,/START TUTORIAL/);await old.click('dismiss-modal');
assert.deepEqual(old.context.view().state,fixture.existing,'loading must preserve existing hubs and progress');
assert.ok(!old.requests.some(r=>r.path.endsWith('/new')),'loading a campaign must not reset it');
await old.click('nav','logistics');
assert.ok(old.app.innerHTML.includes('data-action="shipment"'));
assert.equal(old.context.view().freight.target,'H1');
await old.click('confirm-reset');onMars(old);assert.equal(old.context.view().state.hubs.length,1);
const earthOnly=await session(fixture.earthOnly);
assert.deepEqual(earthOnly.context.view().state,fixture.earthOnly,'old Earth-only saves remain intact until explicit reset');
await earthOnly.click('confirm-reset');onMars(earthOnly);
assert.ok(earthOnly.context.view().state.hubs.every(h=>h.world!=='earth'));
const arrived=await session(fixture.arrived);
assert.equal(arrived.context.view().selectedWorld,'mars','home stays Mars after establishing Earth');
const earth=fixture.arrived.hubs.find(h=>h.world==='earth');
assert.ok(earth);
await arrived.click('solar-hub',earth.id);
assert.equal(arrived.context.view().selectedWorld,'earth');
assert.ok(arrived.app.innerHTML.includes('data-action="build-mode"'),'landed Earth hub is now playable');
assert.ok(!arrived.app.innerHTML.includes('NO SURFACE STATION'));
await arrived.click('nav','planner');await arrived.change('source',earth.id);
assert.equal(arrived.context.view().draft.destination,'mars','an Earth source cannot target itself');
assert.ok(arrived.app.innerHTML.includes('GMAT LAUNCH WINDOWS'));
await arrived.change('source','H1');await arrived.change('destination','earth');
assert.equal(arrived.context.view().draft.site,'Pacific Coast','a new mission selects an unoccupied Earth site');
await arrived.click('home');assert.equal(arrived.context.view().selectedWorld,'mars');
console.log('Mars startup/home/reset, Earth preview and travel planning, old-save preservation, optional overlays and one-hub logistics passed.');

// Every formerly decorative planet now opens a map and a correctly labelled deployment plan.
const outer=await session(null);
for(const platform of fixture.platforms){
 const world=platform.world;
 await outer.click('solar-open');await outer.click('solar-select',world);
 assert.ok(outer.app.innerHTML.includes('PREVIEW CLOUD MAP'));
 assert.ok(outer.app.innerHTML.includes(`data-action="solar-plan" data-id="${world}"`));
 await outer.click('solar-map',world);
 assert.equal(outer.context.view().selectedWorld,world);
 assert.ok(outer.app.innerHTML.includes('NO CLOUD PLATFORM'));
 assert.ok(outer.app.innerHTML.includes('DEPLOY A PLATFORM FIRST'));
 assert.ok(outer.app.innerHTML.includes('EST. '));
 assert.ok(!outer.app.innerHTML.includes('data-action="build-mode"'));
 assert.equal(outer.context.view().state.hubs.length,1);
 await outer.click('map-plan');
 assert.equal(outer.context.view().draft.destination,world);
 assert.equal(outer.context.view().draft.site,fixture.catalog.worlds[world].sites[0]);
 assert.ok(outer.app.innerHTML.includes('value="surface" selected>Atmospheric platform</option>'));
 assert.ok(outer.app.innerHTML.includes('GAME-ESTIMATE TRANSFER'));
 assert.ok(!outer.app.innerHTML.includes('GMAT LAUNCH WINDOWS'));
 await outer.click('home');onMars(outer);
 const deployed=await session({...structuredClone(fixture.fresh),hubs:[structuredClone(fixture.fresh.hubs[0]),platform]});
 await deployed.click('solar-hub',platform.id);
 assert.equal(deployed.context.view().selectedWorld,world);
 assert.ok(deployed.app.innerHTML.includes('PLATFORM CONTROL'));
 assert.ok(deployed.app.innerHTML.includes('Atmospheric Refinery'));
 assert.ok(deployed.app.innerHTML.includes('Cloud Condenser'));
 assert.ok(deployed.app.innerHTML.includes('data-action="build-mode"'));
 assert.ok(!deployed.app.innerHTML.includes('NO CLOUD PLATFORM'));
 await deployed.click('build-mode','drill');
 assert.equal(deployed.context.view().selectedHub,platform.id);
}
await arrived.click('nav','planner');await arrived.change('source',earth.id);await arrived.change('destination','neptune');
assert.ok(arrived.app.innerHTML.includes('GAME-ESTIMATE TRANSFER'));
assert.ok(!arrived.app.innerHTML.includes('GMAT LAUNCH WINDOWS'));
assert.ok(arrived.app.innerHTML.includes('data-field="vehicle"'),'estimated Earth departures still require a rocket');
console.log('Outer-planet previews, earned platform controls, build selectors and Earth route attribution passed.');
