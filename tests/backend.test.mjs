import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createStore,AGENTS} from '../server/store.mjs';
import {createOfficeServer,validateConfig} from '../server/http.mjs';
const event=(extra={})=>({eventId:'event-1',runId:'run-1',sequence:1,type:'start',status:'working',message:'fixture only',...extra});
const config=()=>({viewerToken:randomBytes(32).toString('hex'),agentTokens:Object.fromEntries(AGENTS.map(a=>[a,randomBytes(32).toString('hex')]))});
test('event identity is credential-bound; payload spoofing and unexpected fields rejected',()=>{
 const s=createStore();assert.throws(()=>s.report('coder',event({agentId:'supervisor'})));s.report('coder',event());assert.equal(s.snapshot().agents[2].status,'working');assert.equal(s.snapshot().agents[0].runId,null);
});
test('duplicates are idempotent, conflicting event IDs rejected',()=>{const s=createStore();assert.equal(s.report('coder',event()).duplicate,false);assert.equal(s.report('coder',event()).duplicate,true);assert.throws(()=>s.report('coder',event({message:'changed'})));assert.equal(s.snapshot().events.length,1);});
test('run fencing, strict sequences and terminal immutability',()=>{
 const s=createStore();s.report('coder',event());
 for(const e of [event({eventId:'two',type:'progress',sequence:3}),event({eventId:'two',runId:'wrong',type:'progress',sequence:2}),event({eventId:'two',runId:'new'})])assert.throws(()=>s.report('coder',e));
 s.report('coder',event({eventId:'two',type:'progress',sequence:2,status:'done'}));
 assert.throws(()=>s.report('coder',event({eventId:'three',type:'progress',sequence:3})));
 s.report('coder',event({eventId:'three',runId:'new'}));
 assert.throws(()=>s.heartbeat('coder',{runId:'run-1'}));
 assert.throws(()=>s.report('coder',event({eventId:'four',runId:'run-1'})));
});
test('heartbeat freshness never fabricates progress',()=>{let clock=1000;const s=createStore({now:()=>clock,staleMs:100});assert.equal(s.snapshot().agents[2].stale,true);s.report('coder',event());const before=s.snapshot().agents[2];clock+=101;assert.equal(s.snapshot().agents[2].stale,true);s.heartbeat('coder',{runId:'run-1'});const after=s.snapshot().agents[2];assert.equal(after.stale,false);assert.equal(after.lastProgressAt,before.lastProgressAt);assert.equal(after.sequence,before.sequence);});
test('input, history and run bounds',()=>{const s=createStore({maxEvents:2,maxRuns:1});for(const e of [event({message:'x'.repeat(1001)}),event({progress:101}),event({sequence:1.5}),event({eventId:'bad\n'})])assert.throws(()=>s.report('coder',e));s.report('coder',event());for(let i=2;i<=4;i++)s.report('coder',event({eventId:'e'+i,type:'progress',sequence:i,status:i===4?'done':'working'}));assert.equal(s.snapshot().events.length,2);assert.throws(()=>s.report('coder',event({eventId:'next',runId:'next'})),/capacity/);});
test('server fails closed for missing, shared credentials or public bind',()=>{assert.throws(()=>validateConfig());assert.throws(()=>validateConfig({...config(),host:'0.0.0.0'}));const c=config();c.agentTokens.coder=c.viewerToken;assert.throws(()=>validateConfig(c));});
async function fixture(t){const c=config(),o=createOfficeServer(c);await new Promise(r=>o.server.listen(0,'127.0.0.1',r));t.after(()=>o.close());return {...o,...c,url:'http://127.0.0.1:'+o.server.address().port};}
test('HTTP auth, read/write scopes, spoofing, origin and query rejection',async t=>{const o=await fixture(t);const call=(path,token,body,headers={})=>fetch(o.url+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
 assert.equal((await call('/api/snapshot')).status,401);
 assert.equal((await call('/api/events',o.viewerToken,event())).status,403);
 assert.equal((await call('/api/events',o.agentTokens.coder,event({agentId:'reviewer'}))).status,400);
 assert.equal((await call('/api/events',o.agentTokens.coder,event())).status,200);
 const all=await (await call('/api/snapshot',o.viewerToken)).json();assert.equal(all.agents.length,4);
 const own=await (await call('/api/snapshot',o.agentTokens.coder)).json();assert.deepEqual(own.agents.map(a=>a.agentId),['coder']);
 assert.equal((await call('/api/events',o.agentTokens.coder)).status,403);
 assert.equal((await call('/api/snapshot',o.viewerToken,null,{Origin:'https://evil.example'})).status,403);
 assert.equal((await call('/api/snapshot?token=not-accepted',o.viewerToken)).status,400);
 assert.equal((await call('/api/execute',o.agentTokens.coder,{})).status,404);
});
test('SSE sends authenticated initial snapshot and closes cleanly',async t=>{const o=await fixture(t),controller=new AbortController();const res=await fetch(o.url+'/api/events',{headers:{Authorization:'Bearer '+o.viewerToken},signal:controller.signal});assert.equal(res.headers.get('content-type'),'text/event-stream');const reader=res.body.getReader();const first=new TextDecoder().decode((await reader.read()).value);assert.match(first,/event: snapshot/);assert.match(first,/memory-only/);controller.abort();});

test('malformed JSON, oversized bodies and Host header cannot bypass guards',async t=>{
 const o=await fixture(t),headers={Authorization:'Bearer '+o.agentTokens.coder,'Content-Type':'application/json'};
 assert.equal((await fetch(o.url+'/api/events',{method:'POST',headers,body:'{'})).status,400);
 const large=await fetch(o.url+'/api/events',{method:'POST',headers,body:JSON.stringify({message:'x'.repeat(9000)})});assert.equal(large.status,413);
 const wrongHost=await new Promise((resolve,reject)=>{const request=http.get(o.url+'/api/snapshot',{headers:{Authorization:'Bearer '+o.viewerToken,Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});request.on('error',reject);});assert.equal(wrongHost,403);
 assert.equal(o.store.snapshot().events.length,0);
});
