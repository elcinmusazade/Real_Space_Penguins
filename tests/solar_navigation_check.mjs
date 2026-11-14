import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setMaxListeners} from 'node:events';
import {mountSolarSystem,solarPositions,solarSystemView} from '../web/solar-system.js';

const fixture=JSON.parse(readFileSync(0,'utf8'));
fixture.state.turn=5;
fixture.state.missions.push({id:'TEST-M1',status:'in_flight',source:'H1',destination:'mars',departed:1,arrivesAt:9});
const original=JSON.stringify(fixture.state);
const html=solarSystemView({...fixture,selected:'earth',showRoutes:true,date:'TEST'});
const svg=html.match(/<svg[\s\S]*?<\/svg>/)[0];
for(const id of ['mercury','venus','earth','mars','europa']){
  const view=solarSystemView({...fixture,selected:id,showRoutes:true,date:'TEST'});
  assert.ok(view.includes(`data-action="solar-map" data-id="${id}"`));
}
for(const id of ['sun','jupiter','saturn','uranus','neptune']){
  assert.ok(!solarSystemView({...fixture,selected:id,showRoutes:true,date:'TEST'}).includes('data-action="solar-map"'));
}
assert.ok(!solarSystemView({...fixture,selected:'earth',showRoutes:false,date:'TEST'}).includes('class="solar-flight"'));

// Full orbits fit the chart, including artwork and labels, instead of leaving the viewport.
const initial=solarPositions();
for(let ms=0;ms<=200000;ms+=500){
  for(const [id,p] of Object.entries(solarPositions(ms))){
    assert.ok(p.x>55&&p.x<1045&&p.y>40&&p.y<570,`${id} left the fitted chart at ${ms}`);
  }
}
assert.ok(Math.hypot(solarPositions(52000).earth.x-initial.earth.x,solarPositions(52000).earth.y-initial.earth.y)<1e-8);
const offset=p=>({x:p.europa.x-p.jupiter.x,y:p.europa.y-p.jupiter.y});
assert.ok(Math.hypot(offset(initial).x-offset(solarPositions(4500)).x,offset(initial).y-offset(solarPositions(4500)).y)>40);

// A controlled frame scheduler exercises actual SVG transform/path writes, not just math.
setMaxListeners(0);
let now=0,nextFrame=0,observer;
const frames=new Map();
globalThis.performance={now:()=>now};
globalThis.requestAnimationFrame=fn=>{frames.set(++nextFrame,fn);return nextFrame;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
function step(ms){now+=ms;const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(now);}
const preference=new EventTarget();preference.matches=false;
globalThis.window={matchMedia:()=>preference};
globalThis.document=new EventTarget();document.hidden=false;
globalThis.ResizeObserver=class{constructor(fn){this.fn=fn;observer=this;}observe(){}disconnect(){this.disconnected=true;}};
function element(){
  const el=new EventTarget(),classes=new Set(),styles={};
  return Object.assign(el,{attrs:{},dataset:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c);}},style:{setProperty(k,v){styles[k]=v;},getPropertyValue:k=>styles[k]},setAttribute(k,v){this.attrs[k]=String(v);},clientWidth:1100,clientHeight:650,setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0,width:1100,height:650,right:1100,bottom:650};}});
}
function mount(motion){
  const root=element(),viewport=element(),chart=element(),output=element(),pause=element(),hint=element(),moon=element(),out=element(),into=element();
  const nodes=[...html.matchAll(/<g class="solar-body [^>]+data-id="([^"]+)"/g)].map(([,id])=>{
    const node=element(),hit=element();node.dataset.id=id;
    node.closest=selector=>selector==='.solar-body'?node:null;
    node.matches=selector=>selector===':focus-visible';
    node.querySelector=selector=>selector==='.solar-hit'?hit:null;
    return node;
  });
  const paths=[...html.matchAll(/<g class="solar-flight"[^>]+data-from="([^"]+)" data-to="([^"]+)" data-progress="([^"]+)"/g)].map(([,from,to,progress])=>{
    const el=element(),path=element(),marker=element();el.dataset={from,to,progress};el.querySelector=s=>s==='path'?path:marker;return el;
  });
  const elements={'.solar-viewport':viewport,'.solar-chart':chart,'.solar-zoom-label':output,'.solar-motion-hint':hint,'.solar-moon-track':moon,'[data-action="solar-motion"]':pause,'[data-action="solar-zoom-out"]':out,'[data-action="solar-zoom-in"]':into};
  root.querySelector=s=>elements[s]||null;root.querySelectorAll=s=>s==='.solar-body'?nodes:paths;
  const camera={x:0,y:0,zoom:1};
  return {root,viewport,chart,output,pause,hint,moon,nodes,paths,out,into,camera,controller:mountSolarSystem(root,camera,motion)};
}
function point(node){const [,x,y]=node.attrs.transform.match(/translate\(([-\d.e]+) ([-\d.e]+)\)/);return {x:Number(x),y:Number(y)};}
function fire(m,type,target,relatedTarget=null,extra={}){
  const event=new Event(type,{cancelable:true});Object.defineProperty(event,'target',{value:target});Object.assign(event,{relatedTarget,...extra});m.viewport.dispatchEvent(event);return event;
}
const motion={paused:false,elapsedMs:0};let m=mount(motion);
assert.equal(m.nodes.length,10);assert.equal(m.paths.length,1);assert.equal(frames.size,1);
const start=Object.fromEntries(m.nodes.map(node=>[node.dataset.id,point(node)]));
step(1000);
for(const node of m.nodes){
  const p=point(node),a=start[node.dataset.id];
  if(node.dataset.id==='sun')assert.deepEqual(p,a);
  else assert.ok(Math.hypot(p.x-a.x,p.y-a.y)>3,`${node.dataset.id} image did not move`);
}
assert.equal(m.moon.attrs.transform,m.nodes.find(n=>n.dataset.id==='jupiter').attrs.transform);
const earth=m.nodes.find(n=>n.dataset.id==='earth'),mars=m.nodes.find(n=>n.dataset.id==='mars');
const route=m.paths[0],path=route.querySelector('path'),marker=route.querySelector('circle');
assert.ok(path.attrs.d.startsWith(`M${point(earth).x} ${point(earth).y} `));
assert.ok(path.attrs.d.endsWith(` ${point(mars).x} ${point(mars).y}`));
assert.equal(route.dataset.progress,'0.5');
assert.ok(Math.abs(Number(marker.attrs.cx)-(point(earth).x+point(mars).x)/2)<1e-8);

m.controller.toggleMotion();const paused=earth.attrs.transform;
assert.equal(frames.size,0);step(5000);assert.equal(earth.attrs.transform,paused);assert.equal(motion.elapsedMs,1000);
m.controller.toggleMotion();step(1000);assert.notEqual(earth.attrs.transform,paused);

// Hover/focus holds moving click targets; leaving resumes, including after re-render.
fire(m,'pointerover',earth,null,{pointerType:'mouse'});assert.equal(frames.size,0);
const held=earth.attrs.transform;step(3000);assert.equal(earth.attrs.transform,held);
assert.match(m.hint.textContent,/HELD/);
fire(m,'pointerout',earth,null,{pointerType:'mouse'});step(1000);assert.notEqual(earth.attrs.transform,held);
fire(m,'focusin',earth);assert.equal(frames.size,0);
const focused=earth.attrs.transform;step(2000);assert.equal(earth.attrs.transform,focused);
fire(m,'focusout',earth);assert.equal(frames.size,1);

document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(frames.size,0);
const hiddenTime=motion.elapsedMs;step(10000);assert.equal(motion.elapsedMs,hiddenTime);
document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));assert.equal(frames.size,1);
step(1000);preference.matches=true;preference.dispatchEvent(new Event('change'));
assert.equal(frames.size,0);assert.equal(m.pause.disabled,true);const reducedTime=motion.elapsedMs;
m.controller.toggleMotion();step(10000);assert.equal(motion.elapsedMs,reducedTime);assert.equal(motion.paused,false);
preference.matches=false;preference.dispatchEvent(new Event('change'));step(1000);

const last=earth.attrs.transform;m.controller.destroy();assert.equal(frames.size,0);assert.equal(observer.disconnected,true);
const elapsed=motion.elapsedMs;step(5000);assert.equal(motion.elapsedMs,elapsed);
fire(m,'pointerover',earth);assert.equal(frames.size,0); // Listeners removed on teardown.
m=mount(motion);assert.equal(m.nodes.find(n=>n.dataset.id==='earth').attrs.transform,last);
assert.equal(m.root.style.getPropertyValue('--solar-time'),`${-elapsed}ms`);

// Camera controls and keyboard recentering use current orbital coordinates.
m.controller.zoom(5);assert.equal(m.camera.zoom,4);assert.equal(m.into.disabled,true);
m.controller.zoom(.01);assert.equal(m.camera.zoom,1);assert.equal(m.out.disabled,true);
m.controller.zoom(2,100,50);assert.deepEqual(m.camera,{x:-100,y:-50,zoom:2});m.controller.fit();
const currentEarth=m.nodes.find(n=>n.dataset.id==='earth');
currentEarth.querySelector('.solar-hit').getBoundingClientRect=()=>({left:-100,top:0,right:-40,bottom:60});
fire(m,'focusin',currentEarth);
assert.equal(m.camera.x,-(point(currentEarth).x-550));assert.equal(m.camera.y,-(point(currentEarth).y-325));
m.controller.fit();m.controller.destroy();assert.equal(frames.size,0);

preference.matches=true;m=mount({paused:false,elapsedMs:0});assert.equal(frames.size,0);assert.equal(m.pause.disabled,true);m.controller.destroy();
assert.equal(JSON.stringify(fixture.state),original);
process.stdout.write(JSON.stringify({svg}));
