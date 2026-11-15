import assert from 'node:assert/strict';
import {createPlanetMusic} from '../web/planet-music.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {techTreeView,TREE,treeLayout,treeEdges,ancestry} from '../web/tech-tree.js';
import {mapScreen} from '../web/map-ui.js';
import {solarSystemView} from '../web/solar-system.js';
import {guideSteps} from '../web/program-ui.js';
import {advisorView,badgeCount} from '../web/advisor.js';

const f=JSON.parse(readFileSync(0,'utf8'));
const before=JSON.stringify(f),layout=treeLayout(f.catalog);
const html=techTreeView({catalog:f.catalog,state:f.fresh,data:f.plans});
assert.equal((html.match(/class="rd-node state-/g)||[]).length,16);
assert.equal((html.match(/class="rd-node state-ready/g)||[]).length,4);
assert.match(html,/Scrollable technology tree/);
assert.match(html,/data-action="research" data-id="surveying" >START RESEARCH/);
assert.ok(!techTreeView({catalog:f.catalog,state:f.fresh}).includes('data-id="surveying" >START RESEARCH'));
const locked=techTreeView({catalog:f.catalog,state:f.fresh,data:f.plans,selected:'wideband'});
assert.match(locked,/data-id="wideband" disabled/);
assert.match(locked,/12 new sectors/);
assert.match(locked,/5×5/);
const active=techTreeView({catalog:f.catalog,state:f.active,data:f.activePlans});
assert.match(active,/RESEARCH IN PROGRESS/);
assert.match(active,/role="progressbar"/);
const escaped=structuredClone(f.catalog);
escaped.research.surveying.name='<img onerror="oops">';
assert.ok(!techTreeView({catalog:escaped,state:f.fresh,data:f.plans}).includes('<img'));
assert.equal(JSON.stringify(f),before,'rendering cannot change campaign state');
assert.deepEqual([...ancestry(f.catalog,'fission')].sort(),['fission','modular','refining','solar_cells','thermal']);
const edges=treeEdges(f.catalog,'fission');
for(const [id,t] of Object.entries(f.catalog.research)){
  const p=layout[id];
  assert.ok(p.x>=0&&p.y>=0&&p.x+TREE.nodeWidth<=TREE.width&&p.y+TREE.nodeHeight<=TREE.height);
  assert.deepEqual(edges.filter(e=>e.to===id).map(e=>e.from),t.requires.length?t.requires:[null]);
}
// Verify every routed line stays out of card interiors, including cross-branch paths.
for(const edge of edges){
  let x=0,y=0;
  for(const segment of edge.d.matchAll(/([MVH])([\d.]+)(?: ([\d.]+))?/g)){
    const [,command,a,b]=segment,nx=command==='V'?x:Number(a),ny=command==='H'?y:Number(command==='M'?b:a);
    if(command!=='M')for(const [id,p] of Object.entries(layout)){
      const left=p.x+.1,right=p.x+TREE.nodeWidth-.1,top=p.y+.1,bottom=p.y+TREE.nodeHeight-.1;
      const overlaps=nx===x?x>left&&x<right&&Math.max(y,ny)>top&&Math.min(y,ny)<bottom:
        y>top&&y<bottom&&Math.max(x,nx)>left&&Math.min(x,nx)<right;
      assert.ok(!overlaps,`${edge.from} → ${edge.to} crosses ${id}`);
    }
    x=nx;y=ny;
  }
}

const source=readFileSync(new URL('../web/campaign.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/initialize\(\);\s*$/,'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const handlers={},requests=[],saves=[],reads=[];
const el={dataset:{},tagName:'BUTTON',inert:false,style:{},setAttribute(){},focus(){},closest(){return null},querySelector(){return el},querySelectorAll(){return []},append(){}};
const viewport={...el,clientWidth:720,scrollLeft:30,scrollTop:75};
const app={...el,innerHTML:'',addEventListener(type,callback){handlers[type]=callback;}};
const context=vm.createContext({performance,createPlanetMusic,console,Date,Math,Number,String,JSON,Map,Set,Promise,setTimeout,clearTimeout,
  localStorage:{getItem(){return null},setItem(){}},window:{setTimeout(){}},
  document:{activeElement:null,querySelector(s){return s==='#app'?app:s==='.tech-viewport'?viewport:el},querySelectorAll(){return []},addEventListener(){},createElement(){return {...el,remove(){}}}},
  mountPlanetMap(){return {destroy(){}}},mountSolarSystem(){return {destroy(){}}},mapScreen,solarSystemView,guideSteps,advisorView,badgeCount,mountShip3d(){return {destroy(){}}},
    createTutorial:()=>({sync(){},active:()=>false}),techTreeView,TREE,
  loadCampaign:async()=>null,saveCampaign:async state=>saves.push(structuredClone(state)),
  apiStub:async(path,payload)=>{
    requests.push({path,payload});
    if(path.endsWith('/advice'))return {ok:true,items:[],counts:{critical:0,warning:0}};
    if(path.endsWith('/catalog'))return {catalog:structuredClone(f.catalog)};
    if(path.endsWith('/new'))return {state:structuredClone(f.fresh)};
    if(path.endsWith('/inspect'))return {...structuredClone(f.inspection),hub:payload.hub,tile:payload.tile};
    if(path.endsWith('/research'))return new Promise((resolve,reject)=>reads.push({resolve,reject}));
    if(path.endsWith('/quote'))return {ok:false,error:'Research required',requiredTech:'deep_space'};
    if(path.endsWith('/action')){
      assert.equal(payload.action,'research');assert.equal(payload.args.tech,'surveying');
      return {ok:true,state:structuredClone(f.active),message:'Research started'};
    }
    throw new Error(`Unexpected API request ${path}`);
  }
});
vm.runInContext(source+`\napi=apiStub;globalThis.initialize=initialize;globalThis.view=()=>({tab,techSelected,techZoom,researchData,pending,selectedWorld,selectedBuilding,state});`,context);
await context.initialize();await tick();
const click=async(action,id)=>{await handlers.click({target:{closest(){return {dataset:{action,id},disabled:false}}}});await tick();};
assert.equal(reads.length,0,'no research fetch until opened');
await click('nav','research');
assert.equal(reads.length,1);assert.match(app.innerHTML,/Checking project requirements/);
await click('tech-select','wideband');await click('tech-zoom-in');
assert.equal(reads.length,1,'selection/zoom reuse read-only plans');
assert.equal(context.view().techSelected,'wideband');assert.ok(context.view().techZoom>.85);
assert.equal(viewport.scrollTop,75);assert.equal(viewport.scrollLeft,30);
reads.shift().resolve(f.plans);await tick();
assert.match(app.innerHTML,/12 new sectors/);
assert.equal(requests.filter(r=>r.path.endsWith('/action')).length,0,'selecting never spends science');
await click('tech-fit');assert.ok(context.view().techZoom*960<=viewport.clientWidth);
await click('tech-select','surveying');await click('research','surveying');
assert.equal(saves.at(-1).research.id,'surveying');assert.equal(context.view().pending,false);
assert.match(app.innerHTML,/RESEARCH IN PROGRESS/);
assert.equal(reads.length,1,'new state requires fresh authoritative eligibility');
await click('tech-refresh');assert.equal(reads.length,2);
reads.shift().resolve(f.plans);await tick();
assert.equal(context.view().researchData,null,'stale response cannot overwrite latest request');
reads.shift().reject(new Error('Connection interrupted'));await tick();
assert.match(app.innerHTML,/Connection interrupted/);assert.match(app.innerHTML,/RETRY REQUIREMENTS/);
await click('tech-refresh');reads.shift().resolve(f.activePlans);await tick();
assert.equal(context.view().researchData.plans.surveying.status,'active');
await click('tech-labs');assert.equal(context.view().tab,'system');assert.equal(context.view().selectedWorld,'mars');assert.equal(context.view().selectedBuilding,'laboratory');
await click('nav','planner');assert.match(app.innerHTML,/VIEW REQUIRED TECHNOLOGY/);
await click('tech-open','deep_space');assert.equal(context.view().tab,'research');assert.equal(context.view().techSelected,'deep_space');
assert.match(app.innerHTML,/Complete a mission reaching Mars/);
console.log('Tree topology, non-overlapping edges, status/effects, escaping, immutable rendering, navigation, zoom, API actions, stale replies and retry passed.');
