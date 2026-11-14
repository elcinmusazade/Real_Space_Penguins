/** Large campaign saves use IndexedDB; old localStorage saves migrate on commit. */
const KEY='ares.first-light.campaign.v2';

export function createCampaignStore({indexedDB=globalThis.indexedDB,storage=()=>globalThis.localStorage}={}){
  let connection=null;
  function database(){
    if(!connection)connection=new Promise((resolve,reject)=>{
      const request=indexedDB.open('ares-first-light',1);
      let failed=false;
      request.onupgradeneeded=()=>request.result.createObjectStore('saves');
      request.onerror=()=>{failed=true;reject(request.error);};
      request.onblocked=()=>{failed=true;reject(new Error('Close other Ares tabs and retry saving.'));};
      request.onsuccess=()=>{
        const db=request.result;
        if(failed){db.close();return;}
        db.onversionchange=()=>{db.close();connection=null;};
        resolve(db);
      };
    }).catch(error=>{connection=null;throw error;});
    return connection;
  }
  async function transaction(mode,state){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('saves',mode),store=tx.objectStore('saves');
      const request=mode==='readonly'?store.get(KEY):store.put(state,KEY);
      // A successful put request alone does not guarantee the data was committed.
      tx.oncomplete=()=>resolve(request.result??null);
      tx.onabort=()=>reject(tx.error||new Error('Campaign save was interrupted.'));
      tx.onerror=()=>reject(tx.error||new Error('Campaign storage is unavailable.'));
    });
  }
  return {
    async load(){
      if(indexedDB){const saved=await transaction('readonly');if(saved)return saved;}
      return JSON.parse(storage().getItem(KEY)||'null');
    },
    async save(state){
      if(!indexedDB){storage().setItem(KEY,JSON.stringify(state));return;}
      await transaction('readwrite',state);
      // Keep the old save intact until the larger replacement is safely stored.
      try{storage().removeItem(KEY);}catch{/* IndexedDB already holds the save. */}
    }
  };
}

const store=createCampaignStore();
export const loadCampaign=()=>store.load();
export const saveCampaign=state=>store.save(state);
