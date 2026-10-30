export const AGENTS = ['supervisor', 'planner', 'coder', 'reviewer'];
const STATES = ['idle', 'working', 'waiting', 'meeting', 'done', 'blocked', 'failed', 'cancelled'];
const TERMINAL = new Set(['done', 'failed', 'cancelled']);
export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (message, status=400) => { throw new ApiError(status, message); };
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
export function validateEvent(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) fail('invalid event');
  if (Object.keys(e).some(k => !['eventId','runId','sequence','type','status','message','progress'].includes(k))) fail('unknown field');
  if (!id(e.eventId) || !id(e.runId) || !Number.isSafeInteger(e.sequence) || e.sequence < 1) fail('invalid event identity');
  if (!['start','progress'].includes(e.type) || !STATES.includes(e.status)) fail('invalid event type or status');
  if (e.message !== undefined && (typeof e.message !== 'string' || e.message.length > 1000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(e.message))) fail('invalid message');
  if (e.progress !== undefined && e.progress !== null && (!Number.isFinite(e.progress) || e.progress < 0 || e.progress > 100)) fail('invalid progress');
  return {eventId:e.eventId, runId:e.runId, sequence:e.sequence, type:e.type, status:e.status, message:e.message ?? '', progress:e.progress ?? null};
}
export function createStore({now=()=>Date.now(), staleMs=45000, maxEvents=200, maxRuns=1024}={}) {
  const agents = new Map(AGENTS.map(agentId=>[agentId,{agentId,runId:null,status:'idle',sequence:0,message:'',progress:null,lastHeartbeatAt:null,lastProgressAt:null}]));
  const seen = new Map(), runs = new Map(AGENTS.map(a=>[a,new Set()])), events = [];
  function agent(a) { if (!agents.has(a)) fail('unknown agent'); return agents.get(a); }
  function snapshot(onlyAgent) { const time=now(); return {schemaVersion:1,observedAt:new Date(time).toISOString(),durability:'memory-only',agents:[...agents.values()].filter(a=>!onlyAgent||a.agentId===onlyAgent).map(a=>({...a,stale:a.lastHeartbeatAt===null || time-Date.parse(a.lastHeartbeatAt)>staleMs})),events:events.filter(e=>!onlyAgent||e.agentId===onlyAgent).map(e=>({...e}))}; }
  function report(agentId,input) {
    const a=agent(agentId), e=validateEvent(input), key=agentId+':'+e.eventId, fingerprint=JSON.stringify(e);
    if(seen.has(key)) { if(seen.get(key)!==fingerprint) fail('eventId conflict',409); return {duplicate:true}; }
    if(e.type==='start') {
      if(e.sequence!==1 || runs.get(agentId).has(e.runId) || (a.runId && !TERMINAL.has(a.status))) fail('run start conflict',409);
      if(runs.get(agentId).size>=maxRuns) fail('run capacity reached; operator restart required',503);
      runs.get(agentId).add(e.runId);
    } else if(e.runId!==a.runId || TERMINAL.has(a.status) || e.sequence!==a.sequence+1) fail('run or sequence conflict',409);
    const time=new Date(now()).toISOString();
    Object.assign(a,{runId:e.runId,status:e.status,sequence:e.sequence,message:e.message,progress:e.progress,lastProgressAt:time,lastHeartbeatAt:time});
    events.push({...e,agentId,receivedAt:time}); if(events.length>maxEvents)events.shift();
    seen.set(key,fingerprint); if(seen.size>maxEvents*4)seen.delete(seen.keys().next().value);
    return {duplicate:false};
  }
  function heartbeat(agentId,input) { const a=agent(agentId); if(!input || Object.keys(input).some(k=>k!=='runId') || !id(input.runId))fail('invalid heartbeat'); if(input.runId!==a.runId)fail('run conflict',409); a.lastHeartbeatAt=new Date(now()).toISOString(); return {ok:true}; }
  return {snapshot,report,heartbeat};
}
