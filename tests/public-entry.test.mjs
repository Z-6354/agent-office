import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('public entry mounts only real fleet with no demo or credential UI',async()=>{
 const source=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(source,/mountFleetView/);
 for(const forbidden of ['createDemoController','mountLiveView','viewer-token','connection-form','localStorage','模拟','演示'])assert.ok(!source.includes(forbidden),forbidden);
 const view=await readFile(new URL('../src/fleet-view.js',import.meta.url),'utf8');
 assert.match(view,/credentials:'omit'/);assert.match(view,/effectiveFleetCard/);
 assert.ok(!view.includes('与上方演示'));
});
