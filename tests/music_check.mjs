import assert from 'node:assert/strict';
import {createPlanetMusic} from '../web/planet-music.js';
import {settingsView} from '../web/tutorial.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const doc = Object.assign(new EventTarget(), {hidden:false});
const loads = [], voices = [], gains = [], contexts = [];
const prefs = new Map();
class Audio {
  constructor() { this.currentTime=0; this.state='suspended'; contexts.push(this); }
  async resume() { this.state='running'; }
  async suspend() { this.state='suspended'; }
  async decodeAudioData(value) { return value; }
  createGain() {
    const gain={value:0,ramps:[],setValueAtTime(v){this.value=v;},
      linearRampToValueAtTime(v,t){this.ramps.push([v,t]);},
      setTargetAtTime(v){this.value=v;},cancelScheduledValues(){}};
    gains.push(gain);
    return {gain,connect(){},disconnect(){}};
  }
  createBufferSource() {
    const source={connect(){},disconnect(){},start(t){this.started=t;},stop(t){this.stopped=t;}};
    voices.push(source);
    return source;
  }
}
const host={AudioContext:Audio,localStorage:{getItem:k=>prefs.get(k)??null,setItem:(k,v)=>prefs.set(k,v)},
  fetch:(url,{signal})=>new Promise(resolve=>{
    loads.push({id:url.pathname.split('/').pop(),signal,finish:()=>resolve({ok:true,arrayBuffer:async()=>url.pathname})});
  })};
const player=createPlanetMusic(host,doc);
const ui=()=>settingsView({tutorial:{status:'offer'},music:player.settings,mapMotion:true,guideHidden:false});
assert.match(ui(),/data-field="music-enabled" checked/);
assert.match(ui(),/Peaceful Village · Stefan Grossmann/);
assert.match(ui(),/href="\.\/music\/credits\.txt"/);
player.select('earth');
assert.equal(contexts.length,0,'no autoplay or network requests on startup');
assert.equal(loads.length,0);
doc.dispatchEvent(new Event('click'));await tick();
assert.equal(loads[0].id,'earth.mp3');loads[0].finish();await tick();
assert.equal(voices.length,1);assert.equal(voices[0].loop,true);
player.select('earth');assert.equal(voices.length,1);assert.equal(loads.length,1);
contexts[0].currentTime=2;
player.select('mars');player.select('venus');
assert.equal(loads[1].signal.aborted,true);loads[1].finish();await tick();
assert.equal(voices.length,1,'superseded response must not start playing');
loads[2].finish();await tick();
assert.equal(voices.length,2);
assert.ok(voices[0].stopped>voices[1].started,'outgoing and incoming cues overlap');
assert.deepEqual(gains[1].ramps.at(-1),[0,voices[0].stopped]);
assert.deepEqual(gains[2].ramps.at(-1),[1,voices[0].stopped]);
player.select('earth');assert.equal(loads.length,3,'recently decoded cue is reused');
player.select('saturn');doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));await tick();
assert.equal(contexts[0].state,'suspended');assert.ok(loads.at(-1).signal.aborted);
const previous=voices.length;loads.at(-1).finish();await tick();assert.equal(voices.length,previous);
doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await tick();
assert.equal(loads.at(-1).id,'saturn.mp3');loads.at(-1).finish();await tick();
player.setVolume(23);await tick();assert.equal(gains[0].value,.23);
player.setEnabled(false);await tick();assert.equal(contexts[0].state,'suspended');
assert.doesNotMatch(ui(),/data-field="music-enabled" checked/);
const reloadedDoc=Object.assign(new EventTarget(),{hidden:false});
const reloaded=createPlanetMusic(host,reloadedDoc);
assert.equal(reloaded.settings.volume,23);assert.equal(reloaded.settings.enabled,false);
reloadedDoc.dispatchEvent(new Event('click'));await tick();assert.equal(contexts.length,1);
reloaded.select('europa');reloaded.setEnabled(true);await tick();
assert.equal(loads.at(-1).id,'europa.mp3');
console.log('Gesture unlock, scores, crossfades, superseded loads, mute, volume and tab visibility passed.');
