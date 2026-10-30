// Private collector. Tokens/run IDs stay here; only the explicit public projection leaves.
import {createDshObserverClient, parseDshStatus} from './dsh-client.mjs';
export const SOURCE_IDS=Object.freeze(['cn1','cn2','us1']);
export async function collectFleet({sources={},now=Date.now,clientFactory=createDshObserverClient}={}) {
  const servers=await Promise.all(SOURCE_IDS.map(async sourceId=>{
    const config=sources[sourceId];
    const card={sourceId,connection:'unknown',task:'unknown',summary:'',checkedAt:null};
    if(!config?.token)return card;
    // Only human-curated, explicitly public summaries are eligible; never MCP text.
    if(config.publicSummaryApproved===true && typeof config.publicSummary==='string')card.summary=config.publicSummary.slice(0,240);
    try {
      const client=clientFactory({sourceId,token:config.token});
      await client.initialize();await client.probe();card.connection='reachable';
      if(config.runId) {
        try {card.task=parseDshStatus(await client.status(config.runId),config.runId).status;}catch {card.task='unknown';}
      }
    }catch {card.connection='unavailable';}
    card.checkedAt=new Date(now()).toISOString();
    return card;
  }));
  return {schemaVersion:1,observedAt:new Date(now()).toISOString(),servers};
}
