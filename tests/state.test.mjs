import {test} from 'node:test';import assert from 'node:assert/strict';import {roles,stages,snapshot,createPageCleanup} from '../src/state.js';
test('four unique roles across all eight stages',()=>{assert.equal(roles.length,4);assert.equal(new Set(roles.map(x=>x.id)).size,4);assert.equal(stages.length,8);for(let i=0;i<stages.length;i++)assert.equal(snapshot(i).length,4);});
test('review is independent from coding',()=>{let s=snapshot(3);assert.equal(s.find(x=>x.id==='reviewer').status,'working');assert.equal(s.find(x=>x.id==='coder').status,'waiting');});
test('offline fault never presents coder as working',()=>{assert.equal(snapshot(2,'offline').find(x=>x.id==='coder').status,'offline');});
test('blocking fault surfaces reviewer issue',()=>{assert.equal(snapshot(3,'blocked').find(x=>x.id==='reviewer').status,'blocked');});
test('completed and index bounds',()=>{assert.ok(snapshot(999).every(x=>x.status==='done'));assert.ok(snapshot(-1).every(x=>x.status==='meeting'));});
test('snapshots do not mutate role or stage definitions',()=>{snapshot(2)[0].name='x';assert.equal(roles[0].name,'主管');assert.equal(stages[2].statuses[2],'working');});

test('bfcache does not dispose live document; final unload cleans exactly once',()=>{let calls=0;const onHide=createPageCleanup(()=>calls++);onHide({persisted:true});assert.equal(calls,0);onHide({persisted:true});assert.equal(calls,0);onHide({persisted:false});assert.equal(calls,1);onHide({persisted:false});assert.equal(calls,1);});
