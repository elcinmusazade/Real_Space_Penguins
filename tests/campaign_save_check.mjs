import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCampaignStore} from '../web/campaign-save.js';
const state=JSON.parse(readFileSync(0,'utf8')),key='ares.first-light.campaign.v2';
let legacy=JSON.stringify({version:2,turn:17}),saved=null,failCommit=false,commits=0;
const storage={getItem:()=>legacy,removeItem(){legacy=null;},setItem(k,v){legacy=v;}};
// Event-driven IDB mock distinguishes request success from transaction commit.
const indexedDB={open(){
  const request={};
  queueMicrotask(()=>{
    request.result={close(){},transaction(name,mode){
      const tx={};
      tx.objectStore=()=>({
        get(){const read={result:structuredClone(saved)};queueMicrotask(()=>tx.oncomplete());return read;},
        put(value){
          const write={result:key},copy=structuredClone(value);
          queueMicrotask(()=>{
            write.onsuccess?.();
            if(failCommit){tx.error=new Error('Disk full');tx.onabort();}
            else{saved=copy;commits++;tx.oncomplete();}
          });
          return write;
        }
      });
      return tx;
    }};
    request.onsuccess();
  });
  return request;
}};
const store=createCampaignStore({indexedDB,storage:()=>storage});
assert.equal((await store.load()).turn,17,'must load the pre-upgrade save');
failCommit=true;
await assert.rejects(store.save(state),/Disk full/);
assert.equal(JSON.parse(legacy).turn,17,'failed commit must preserve the old save');
assert.equal(saved,null);
failCommit=false;
await store.save(state);
assert.equal(legacy,null,'remove legacy data only after commit');
assert.deepEqual(await store.load(),state);
// More than localStorage typically holds, without a localStorage write.
const large=structuredClone(state);large.hubs.push(...structuredClone(state.hubs),...structuredClone(state.hubs));
assert.ok(JSON.stringify(large).length>5_000_000);
storage.setItem=()=>{throw new Error('localStorage quota');};
await store.save(large);
const reloaded=createCampaignStore({indexedDB,storage:()=>storage});
assert.deepEqual(await reloaded.load(),large);
legacy=JSON.stringify({turn:1});
assert.equal((await reloaded.load()).hubs.length,large.hubs.length,'IDB is authoritative after migration');
failCommit=true;
await assert.rejects(store.save({...large,turn:99}),/Disk full/);
assert.deepEqual(await store.load(),large,'failed overwrite must retain the last committed game');
assert.equal(commits,2);
const unavailable={open(){const request={};queueMicrotask(()=>{request.error=new Error('Storage denied');request.onerror();});return request;}};
await assert.rejects(createCampaignStore({indexedDB:unavailable,storage:()=>storage}).load(),/Storage denied/,'do not start a fresh game over an unreadable database');
const fallback=createCampaignStore({indexedDB:null,storage:()=>storage});
assert.equal((await fallback.load()).turn,1);
await assert.rejects(fallback.save(large),/localStorage quota/);
storage.setItem=(k,v)=>{legacy=v;};
await fallback.save(state);assert.deepEqual(await fallback.load(),state);
console.log('Legacy migration, commit failure recovery, large saves, reload and fallback passed.');
