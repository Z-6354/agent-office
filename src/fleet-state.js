export const fleetIds=Object.freeze(['cn1','cn2','us1']);
const connectionStates=new Set(['unknown','reachable','unavailable']);
const taskStates=new Set(['unknown','waiting','working','done','failed','cancelled']);
const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
export function parseFleetSnapshot(input) {
  if(input?.schemaVersion!==1||!date(input.observedAt)||!Array.isArray(input.servers)||input.servers.length!==3)throw Error('Invalid fleet snapshot');
  const seen=new Set();
  const servers=input.servers.map(s=>{
    if(!fleetIds.includes(s?.sourceId)||seen.has(s.sourceId)||!connectionStates.has(s.connection)||!taskStates.has(s.task)||(s.checkedAt!==null&&!date(s.checkedAt))||typeof s.summary!=='string')throw Error('Invalid fleet server');
    seen.add(s.sourceId);
    return {sourceId:s.sourceId,connection:s.connection,task:s.task,summary:s.summary.slice(0,240),checkedAt:s.checkedAt};
  });
  return {schemaVersion:1,observedAt:input.observedAt,servers};
}
export function effectiveFleetCard(card,now=Date.now()) {
  const stale=!card.checkedAt||now-Date.parse(card.checkedAt)>90000||Date.parse(card.checkedAt)>now+5000;
  return {...card,stale,connection:stale?'unknown':card.connection,task:stale||card.connection!=='reachable'?'unknown':card.task};
}
