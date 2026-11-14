import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setMaxListeners} from 'node:events';
import {mountPlanetMap} from '../web/planet-map.js';
import {mapScreen} from '../web/map-ui.js';
setMaxListeners(0);
const fixture=JSON.parse(readFileSync(0,'utf8')),{state,catalog,inspection}=fixture;
const original=JSON.stringify(fixture);
const size=catalog.mapSize,mid=Math.floor(size/2),core=mid*(size+1);
let calls=[],frame=0,observers=[],reduced={matches:false};
const frames=new Map();
globalThis.window={devicePixelRatio:1,matchMedia:()=>reduced};
globalThis.devicePixelRatio=1;
globalThis.document={hidden:false};
globalThis.ResizeObserver=class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};
globalThis.requestAnimationFrame=fn=>{frames.set(++frame,fn);return frame;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
function call(name,args){for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v),`${name} received non-finite coordinate`);calls.push([name,...args]);}
const context=new Proxy({}, {
 get(target,key){if(key.startsWith('create'))return (...args)=>{call(key,args);return {addColorStop(...stops){call('colorStop',stops);}};};return (...args)=>call(key,args);},
 set(target,key,value){assert.ok(!String(value).includes('NaN'));calls.push([key,value]);return true;}
});
function canvas(){return Object.assign(new EventTarget(),{style:{},getContext:()=>context,getBoundingClientRect:()=>({left:0,top:0,width:1200,height:800}),setPointerCapture(){}});}
function dispatch(target,type,props){const e=new Event(type,{cancelable:true});Object.assign(e,props);target.dispatchEvent(e);return e;}
const props={world:'earth',hubId:'H1',size,tiles:state.hubs[0].tiles,biomes:catalog.biomes,selection:core,turn:1,motion:true,onSelect(){}};
const main=canvas(),mini=canvas();let selected=null;
const map=mountPlanetMap(main,mini,{...props,onSelect:i=>selected=i});
for(const scale of [.4,1.25,2.5]){
 map.cam.scale=scale;map.centerOn(mid,mid);map.draw(0);
 for(const i of [core,core+2,core+size,core+4*size+4]){
  const pt=map.geometry(i%size,Math.floor(i/size));
  if(pt.x<0||pt.y<0||pt.x>1200||pt.y>800)continue;
  assert.equal(map.pick(pt.x,pt.y),i,`wrong sector at scale ${scale}`);
 }
}
map.cam.scale=1.25;map.centerOn(mid,mid);map.draw(0);
const pt=map.geometry(mid,mid);
dispatch(main,'pointerdown',{button:0,clientX:pt.x,clientY:pt.y,pointerId:1});
dispatch(main,'pointerup',{clientX:pt.x,clientY:pt.y});assert.equal(selected,core);
selected=null;
dispatch(main,'pointerdown',{button:0,clientX:pt.x,clientY:pt.y,pointerId:1});
dispatch(main,'pointermove',{clientX:pt.x+30,clientY:pt.y+20});
dispatch(main,'pointerup',{clientX:pt.x+30,clientY:pt.y+20});assert.equal(selected,null,'drag must not select');
dispatch(main,'keydown',{key:'ArrowRight'});assert.equal(selected,core+1);
map.zoom(100);assert.equal(map.cam.scale,3.2);map.zoom(.0001);assert.equal(map.cam.scale,map.minScale());
map.overview();assert.ok(map.cam.scale*size*60<=1200);
assert.equal(map.hits.length,size*size,'overview must include every sector');
for(const hit of map.hits)for(const [x,y] of hit.points){assert.ok(x>=0&&x<=1200&&y>=0&&y<=800,'overview tile is clipped');}
map.width=375;map.height=650;map.overview();
for(const hit of map.hits)for(const [x,y] of hit.points){assert.ok(x>=0&&x<=375&&y>=0&&y<=650,'phone overview is clipped');}
map.width=1200;map.height=800;
dispatch(mini,'click',{clientX:1190,clientY:790});
const edge=map.coord(95,95);assert.ok(Math.abs(edge.x-600)<20&&Math.abs(edge.y-485)<20,'minimap should reach the far corner');
map.cam.scale=1;map.centerOn(mid,mid);
const drawing=time=>{calls=[];map.draw(time);return JSON.stringify(calls);};
assert.notEqual(drawing(0),drawing(1000),'water/vegetation should animate');
map.props.motion=false;assert.equal(drawing(0),drawing(1000),'Pause must freeze ambient motion');
map.props.motion=true;reduced.matches=true;assert.equal(drawing(0),drawing(1000));
reduced.matches=false;document.hidden=true;assert.equal(drawing(0),drawing(1000));document.hidden=false;
map.destroy();assert.equal(frames.size,0);assert.ok(observers.at(-1).disconnected);
selected=null;dispatch(main,'keydown',{key:'ArrowRight'});assert.equal(selected,null,'destroy must remove handlers');
for(const world of Object.keys(catalog.worlds).filter(w=>w!=='earth')){
 const preview=mountPlanetMap(canvas(),null,{...props,world,tiles:catalog.surfacePreviews[world]});preview.draw(1000);assert.ok(preview.hits.length>100);
 if(catalog.worlds[world].mapLayer==='atmosphere'){
  assert.equal(preview.palette.atmosphere,true,'giants must not use the Mars palette');
  const paint=t=>{calls=[];preview.draw(t);return JSON.stringify(calls);};
  assert.notEqual(paint(0),paint(1800),'clouds should move');
  preview.props.motion=false;assert.equal(paint(0),paint(1800),'Pause must freeze clouds');
  preview.cam.scale=1.25;preview.centerOn(mid,mid);preview.draw(0);
  const p=preview.geometry(mid,mid);assert.equal(preview.pick(p.x,p.y),core,'cloud motion must not move sector hit targets');
 }
 preview.destroy();
}
const screen=(overrides={})=>mapScreen({...fixture,selectedWorld:'earth',selectedHub:'H1',selectedTile:core+1,selectedBuilding:'greenhouse',pending:false,date:'TEST',lightMinutes:0,guide:'',...overrides});
const html=screen();assert.ok(html.includes('data-action="construct-sector"'));assert.ok(html.includes('18 MAT'));assert.ok(html.includes('+8 food'));assert.ok(!/rover/i.test(html));
const scan=screen({selectedTile:0,selectedBuilding:null,inspection:{...inspection,survey:{ok:true,turns:3,energy:16,area:9}}});assert.ok(scan.includes('START REGIONAL SURVEY'));assert.ok(scan.includes('16 ENERGY'));
assert.ok(screen({pending:true}).includes('data-action="construct-sector" disabled'));
assert.ok(screen({inspection:{...inspection,buildings:{...inspection.buildings,greenhouse:{...inspection.buildings.greenhouse,ok:false,reason:'Test blocked'}}}}).includes('Test blocked'));
assert.ok(screen({inspection:null}).includes('Reading site conditions'));
assert.equal(JSON.stringify(fixture),original,'rendering must not mutate authoritative state');
console.log('Surface rendering, elevated picking, input, camera, motion, cleanup and cost inspector passed.');

// Exercise the real campaign controller with delayed inspection replies.
const {default:vm}=await import('node:vm');
const handlers={},requests=[],actions=[];
const el={dataset:{},tagName:'BUTTON',inert:false,style:{},classList:{},setAttribute(){},focus(){},closest(){return null},querySelector(){return el},querySelectorAll(){return []}};
const app={...el,innerHTML:'',addEventListener(type,callback){handlers[type]=callback}};
const controllerContext=vm.createContext({console,Date,Math,Number,String,JSON,Map,Set,Promise,setTimeout,clearTimeout,localStorage:{getItem(){return null},setItem(){}},document:{activeElement:el,querySelector(s){return s==='#app'?app:el},querySelectorAll(){return []},addEventListener(){}},mountPlanetMap(){return {}},mountSolarSystem(){return {destroy(){}}},mapScreen(){return ''},solarSystemView(){return ''},fixture:structuredClone(fixture),requests,actions});
let source=readFileSync(new URL('../web/campaign.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/initialize\(\);\s*$/,'');
source+=`\nstate=fixture.state;catalog=fixture.catalog;selectedWorld='earth';selectedHub='H1';selectedTile=mapCore();modal=null;guideHidden=true;refreshQuote=()=>Promise.resolve();\napi=(path,payload)=>new Promise(resolve=>requests.push({path,payload,resolve}));perform=async(action,args)=>actions.push({action,args});globalThis.inspectState=()=>({selectedTile,selectedBuilding,inspection,mapMotion});globalThis.selectMapTile=selectMapTile;`;
vm.runInContext(source,controllerContext);
async function click(action,id){await handlers.click({target:{closest(){return {dataset:{action,id},disabled:false}}}});}
await controllerContext.selectMapTile(0);
assert.equal(actions.length,0,'selecting a sector must not spend resources');
await controllerContext.selectMapTile(1);
assert.equal(requests.length,2);
requests[1].resolve({...inspection,tile:1});await new Promise(r=>setImmediate(r));
assert.equal(controllerContext.inspectState().inspection.tile,1);
requests[0].resolve({...inspection,tile:0});await new Promise(r=>setImmediate(r));
assert.equal(controllerContext.inspectState().inspection.tile,1,'late response must not replace current sector');
await click('survey-sector');assert.equal(actions.at(-1).action,'explore');assert.equal(actions.at(-1).args.tile,1);assert.equal(actions.at(-1).args.hub,'H1');
await click('build-mode','recycler');await controllerContext.selectMapTile(core+1);assert.equal(actions.length,1);
requests[2].resolve({...inspection,tile:core+1});await new Promise(r=>setImmediate(r));
await click('construct-sector');assert.equal(actions.at(-1).action,'construct');assert.equal(actions.at(-1).args.building,'recycler');assert.equal(actions.at(-1).args.tile,core+1);
await click('map-motion');assert.equal(controllerContext.inspectState().mapMotion,false);
await controllerContext.selectMapTile(core);
await click('solar-map','venus');
requests[3].resolve({...inspection,tile:core});await new Promise(r=>setImmediate(r));
await click('solar-map','earth');
assert.equal(requests.length,5,'returning from an uncolonized world must restart a discarded inspection');
requests[4].resolve({...inspection,tile:core});await new Promise(r=>setImmediate(r));
assert.equal(controllerContext.inspectState().inspection.tile,core);
console.log('Controller selection, separate survey/build actions, motion toggle and stale-request protection passed.');
