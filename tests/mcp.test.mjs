import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {randomBytes} from 'node:crypto';
import {createOfficeServer} from '../server/http.mjs';
import {AGENTS} from '../server/store.mjs';
import {createOfficeClient} from '../adapters/office-client.mjs';
test('adapter rejects remote destinations, URL credentials and missing tokens',()=>{const token=randomBytes(32).toString('hex');for(const url of ['https://example.com','http://localhost:8787','http://127.0.0.1:8787/?token=x','http://user:pass@127.0.0.1'])assert.throws(()=>createOfficeClient({url,token}));assert.throws(()=>createOfficeClient());});
test('official MCP stdio exposes only observation tools, reports through authenticated HTTP',async t=>{
 const agentTokens=Object.fromEntries(AGENTS.map(a=>[a,randomBytes(32).toString('hex')]));
 const o=createOfficeServer({viewerToken:randomBytes(32).toString('hex'),agentTokens});await new Promise(r=>o.server.listen(0,'127.0.0.1',r));t.after(()=>o.close());
 const child=spawn(process.execPath,['adapters/start.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,OFFICE_URL:'http://127.0.0.1:'+o.server.address().port,OFFICE_AGENT_TOKEN:agentTokens.coder},stdio:['pipe','pipe','pipe']});t.after(()=>child.kill());
 const pending=new Map();let n=0,stderr='';child.stderr.on('data',b=>stderr+=b);const lines=createInterface({input:child.stdout});t.after(()=>lines.close());lines.on('line',line=>{const msg=JSON.parse(line);if(pending.has(msg.id)){pending.get(msg.id)(msg);pending.delete(msg.id);}});
 function rpc(method,params){const id=++n;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('MCP timeout: '+stderr));},5000);pending.set(id,v=>{clearTimeout(timer);resolve(v);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});}
 const init=await rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'fixture',version:'1'}});assert.ok(init.result,JSON.stringify(init));child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 const listed=await rpc('tools/list',{});assert.deepEqual(listed.result.tools.map(x=>x.name).sort(),['get_status','heartbeat','report_event']);
 const args={eventId:'mcp-1',runId:'mock-run',sequence:1,type:'start',status:'working',message:'MOCK FIXTURE; no model called'};
 const report=await rpc('tools/call',{name:'report_event',arguments:args});assert.equal(report.result.isError,undefined);assert.equal(o.store.snapshot().agents[2].runId,'mock-run');
 const spoof=await rpc('tools/call',{name:'report_event',arguments:{...args,agentId:'supervisor'}});assert.ok(spoof.error||spoof.result.isError);
 const status=await rpc('tools/call',{name:'get_status',arguments:{}});assert.equal(JSON.parse(status.result.content[0].text).agents.length,1);
 const heart=await rpc('tools/call',{name:'heartbeat',arguments:{runId:'mock-run'}});assert.equal(heart.result.isError,undefined);
 assert.equal(stderr,'');
});

test('adapter accepts bounded maximum Unicode event history',async t=>{
 const agentTokens=Object.fromEntries(AGENTS.map(a=>[a,randomBytes(32).toString('hex')]));
 const o=createOfficeServer({viewerToken:randomBytes(32).toString('hex'),agentTokens});await new Promise(r=>o.server.listen(0,'127.0.0.1',r));t.after(()=>o.close());
 for(let sequence=1;sequence<=200;sequence++)o.store.report('coder',{eventId:'unicode-'+sequence,runId:'unicode-run',sequence,type:sequence===1?'start':'progress',status:'working',message:'\ud800'.repeat(1000)});
 const expected=o.store.snapshot('coder');assert.ok(Buffer.byteLength(JSON.stringify(expected))>1048576);
 const client=createOfficeClient({url:'http://127.0.0.1:'+o.server.address().port,token:agentTokens.coder});
 const result=await client.getStatus();assert.equal(result.events.length,200);assert.equal(result.events[199].message,'\ud800'.repeat(1000));
});
test('adapter still rejects responses above two MiB',async()=>{
 const client=createOfficeClient({token:randomBytes(32).toString('hex'),fetchImpl:async()=>new Response('x'.repeat(2097153))});
 await assert.rejects(client.getStatus(),/exceeds limit/);
});
