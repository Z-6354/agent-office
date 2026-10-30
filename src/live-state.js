import {roles} from './state.js';
const ids=new Set(roles.map(r=>r.id));
const statuses=new Set(['idle','working','waiting','meeting','done','blocked','failed','cancelled']);
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const short=(value,max=1000)=>typeof value==='string'?value.slice(0,max):'';
export function parseLiveSnapshot(value){
  if(!value||value.schemaVersion!==1||!iso(value.observedAt)||!Array.isArray(value.agents)||!Array.isArray(value.events))throw new Error('invalid snapshot');
  const seen=new Set();
  const agents=value.agents.map(a=>{
    if(!a||!ids.has(a.agentId)||seen.has(a.agentId)||!statuses.has(a.status)||typeof a.stale!=='boolean'||!Number.isSafeInteger(a.sequence)||a.sequence<0)throw new Error('invalid agent');
    seen.add(a.agentId);
    if(a.lastHeartbeatAt!==null&&!iso(a.lastHeartbeatAt)||a.lastProgressAt!==null&&!iso(a.lastProgressAt))throw new Error('invalid clock');
    return {...a,message:short(a.message),runId:short(a.runId,128)||null,progress:typeof a.progress==='number'&&a.progress>=0&&a.progress<=100?a.progress:null};
  });
  if(agents.length!==4)throw new Error('missing agents');
  const events=value.events.slice(-100).filter(e=>e&&ids.has(e.agentId)&&iso(e.receivedAt)).map(e=>({...e,message:short(e.message),type:short(e.type,40),status:short(e.status,40)}));
  return {schemaVersion:1,observedAt:value.observedAt,agents,events,durability:'memory-only'};
}
export function liveAgents(snapshot,connected,now=Date.now(),receivedAt=0){
  const transportStale=!connected||now-receivedAt>10000;
  return roles.map(role=>{const report=snapshot?.agents.find(a=>a.agentId===role.id);const stale=transportStale||!report||report.stale;
    return {...role,report,status:stale?'offline':report.status==='failed'?'blocked':report.status==='cancelled'?'waiting':report.status,stale};});
}
// Token is held only by this connection closure, never URL/storage. Failed requests
// stop polling; reconnect is explicit and older requests cannot revive a session.
export function safeLiveOrigin(origin){try{const url=new URL(origin);return url.protocol==='https:'||url.protocol==='http:'&&['127.0.0.1','[::1]','localhost'].includes(url.hostname);}catch{return false;}}
export function createLiveConnection({fetcher=fetch,onChange,schedule=setTimeout,unschedule=clearTimeout,now=Date.now,origin=globalThis.location?.origin}){
  let generation=0,abort=null,timer=null,token='',state={phase:'disconnected',snapshot:null,receivedAt:0};
  const emit=()=>onChange({...state});
  function stop(phase='disconnected'){generation++;abort?.abort();unschedule(timer);timer=null;token='';state={...state,phase};emit();}
  async function request(id){
    const requestAbort=new AbortController();abort=requestAbort;const timeout=schedule(()=>requestAbort.abort(),8000);
    try{
      const response=await fetcher('/api/snapshot',{headers:{Authorization:'Bearer '+token},signal:requestAbort.signal,cache:'no-store',credentials:'omit',redirect:'error'});
      if(!response.ok)throw new Error(response.status===401||response.status===403?'unauthorized':'unavailable');
      const snapshot=parseLiveSnapshot(await response.json());if(id!==generation)return;
      state={phase:'connected',snapshot,receivedAt:now()};emit();timer=schedule(()=>request(id),3000);
    }catch(error){if(id!==generation)return;token='';state={...state,phase:error.message==='unauthorized'?'unauthorized':'error'};emit();}
    finally{unschedule(timeout);}
  }
  return {connect(value){stop();if(!safeLiveOrigin(origin)){state.phase='insecure';emit();return;}token=typeof value==='string'?value.trim():'';if(!token||token.length>4096){token='';state.phase='unauthorized';emit();return;}state={phase:'connecting',snapshot:null,receivedAt:0};emit();request(generation);},disconnect:()=>stop(),getState:()=>({...state})};
}
