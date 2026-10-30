import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createPublicStaticServer} from '../server/public-static.mjs';
import {collectFleet} from '../adapters/fleet-observer.mjs';
test('public static uses verified assets and exact live JSON, strips secrets and rejects writes/path traversal',async()=>{
 const root=await mkdtemp(join(tmpdir(),'public-office-'));let server;
 try{await writeFile(join(root,'index.html'),'test');const manifest={'index.html':createHash('sha256').update('test').digest('hex')};server=await createPublicStaticServer({publicDir:root,manifest});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/fleet-status.json')).status,503);
 const data=await collectFleet();data.secret='PRIVATE';await writeFile(join(root,'fleet-status.json'),JSON.stringify(data));let r=await fetch(base+'/fleet-status.json');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(r.headers.get('content-security-policy').includes("connect-src 'self'"));assert.ok(!(await r.text()).includes('PRIVATE'));
 data.servers[0].summary='new summary';await writeFile(join(root,'fleet-status.json'),JSON.stringify(data));assert.equal((await (await fetch(base+'/fleet-status.json')).json()).servers[0].summary,'new summary');
 assert.equal((await fetch(base+'/fleet-status.json',{method:'POST'})).status,405);assert.equal((await fetch(base+'/fleet-status.json?x=1')).status,404);assert.equal((await fetch(base+'/private.json')).status,404);
 await unlink(join(root,'fleet-status.json'));await symlink(join(root,'index.html'),join(root,'fleet-status.json'));assert.equal((await fetch(base+'/fleet-status.json')).status,503);
 await assert.rejects(createPublicStaticServer({publicDir:root,manifest:{'index.html':'0'.repeat(64)}}));
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await rm(root,{recursive:true,force:true});}
});
