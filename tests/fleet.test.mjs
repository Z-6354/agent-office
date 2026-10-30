import test from 'node:test';
import assert from 'node:assert/strict';
import {collectFleet} from '../adapters/fleet-observer.mjs';
import {createDshObserverClient,DSH_ENDPOINTS} from '../adapters/dsh-observer.mjs';
import {parseFleetSnapshot,effectiveFleetCard} from '../src/fleet-state.js';
import {publishFleet} from '../adapters/fleet-publish.mjs';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const now=()=>Date.parse('2026-10-30T18:00:00Z');
test('fleet isolates source failures, unknown tasks and approved summaries; never leaks raw output',async()=>{
 const calls=[];
 const result=await collectFleet({now,sources:{cn1:{token:'SECRET',runId:'private_run',publicSummaryApproved:true,publicSummary:'检查服务'},cn2:{token:'SECRET',publicSummary:'UNAPPROVED'},us1:{token:'SECRET'}},clientFactory:({sourceId})=>({initialize:async()=>{calls.push(sourceId);if(sourceId==='cn2')throw Error('SECRET');},probe:async()=>true,status:async()=>({structuredContent:{runId:'private_run',status:'completed',text:'SECRET LOG'}})})});
 assert.equal(calls.length,3);assert.deepEqual(result.servers.map(s=>s.connection),['reachable','unavailable','reachable']);assert.deepEqual(result.servers.map(s=>s.task),['done','unknown','unknown']);
 const text=JSON.stringify(result);for(const secret of ['SECRET','private_run','UNAPPROVED'])assert.ok(!text.includes(secret));assert.equal(result.servers[0].summary,'检查服务');
});
test('missing credentials makes no requests, malformed status cannot become success',async()=>{
 let calls=0;const result=await collectFleet({now,clientFactory:()=>{calls++;}});assert.equal(calls,0);assert.ok(result.servers.every(s=>s.connection==='unknown'&&s.checkedAt===null));
 const bad=await collectFleet({now,sources:{us1:{token:'fixture',runId:'r'}},clientFactory:()=>({initialize:async()=>{},probe:async()=>{},status:async()=>({structuredContent:{runId:'r',status:'success'}})})});assert.equal(bad.servers[2].task,'unknown');
});
test('public parser whitelists every level; stale or future observations do not imply working',async()=>{
 const data=await collectFleet({now});data.token='secret';data.servers[0].logs='secret';
 const parsed=parseFleetSnapshot(data);assert.ok(!JSON.stringify(parsed).includes('secret'));
 for(const checkedAt of [null,'2026-10-30T17:00:00Z','2026-10-31T18:00:00Z']){const card=effectiveFleetCard({connection:'reachable',task:'working',checkedAt},now());assert.equal(card.connection,'unknown');assert.equal(card.task,'unknown');}
 assert.throws(()=>parseFleetSnapshot({...data,servers:[data.servers[0],data.servers[0],data.servers[0]]}));
});
test('allowlisted destinations only; health probe never calls dsh_run',async()=>{
 assert.throws(()=>createDshObserverClient({sourceId:'https://evil.test',token:'fixture'}));
 for(const sourceId of Object.keys(DSH_ENDPOINTS)){
 const calls=[];const client=createDshObserverClient({sourceId,token:'fixture',fetchImpl:async(url,options)=>{assert.equal(url,DSH_ENDPOINTS[sourceId]);assert.equal(options.redirect,'error');const body=JSON.parse(options.body);calls.push(body.method);if(body.method==='notifications/initialized')return new Response(null,{status:202});return new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,result:body.method==='initialize'?{protocolVersion:'2025-03-26',capabilities:{}}:{tools:[{name:'dsh_status'}]}}),{headers:{'content-type':'application/json'}});}});await client.initialize();await client.probe();assert.deepEqual(calls,['initialize','notifications/initialized','tools/list']);}
});
test('publisher requires private 0600/0700 config, writes only whitelisted snapshot atomically',async()=>{
 const root=await mkdtemp(join(tmpdir(),'office-fleet-'));try{const priv=join(root,'private'),pub=join(root,'public');await mkdir(priv,{mode:0o700});await mkdir(pub);const configPath=join(priv,'config.json');await writeFile(configPath,'{"sources":{}}',{mode:0o600});const collect=async()=>({...await collectFleet({now}),secret:'must-not-appear'});await publishFleet({configPath,outputDir:pub,collect});const result=await readFile(join(pub,'fleet-status.json'),'utf8');assert.ok(!result.includes('secret'));await assert.rejects(publishFleet({configPath,outputDir:root,collect}));}finally{await rm(root,{recursive:true,force:true});}
});
