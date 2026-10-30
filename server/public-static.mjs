// Standalone public, read-only asset server. No credentials, execution or private APIs.
import {createServer} from 'node:http';
import {open,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseFleetSnapshot} from '../src/fleet-state.js';
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',png:'image/png',ico:'image/x-icon',woff2:'font/woff2'};
async function boundedFile(root,path,maxBytes){
 const target=join(root,path);const actual=await realpath(target);if(actual!==target||!actual.startsWith(root+'/'))throw Error('Invalid public path');
 const file=await open(target,constants.O_RDONLY|constants.O_NOFOLLOW);try{const st=await file.stat();if(!st.isFile()||st.size>maxBytes)throw Error('Invalid public file');const bytes=await file.readFile();if(bytes.length>maxBytes)throw Error('Oversized public file');return bytes;}finally{await file.close();}
}
export async function createPublicStaticServer({publicDir,manifest}){
 const root=await realpath(resolve(publicDir));const assets=new Map();
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||Object.keys(manifest).length>100)throw Error('Invalid asset manifest');
 for(const [path,sha] of Object.entries(manifest)){
  if(!/^(?:assets\/[A-Za-z0-9_.-]+|index\.html|favicon\.ico)$/.test(path)||!mime[path.split('.').at(-1)]||!/^[a-f0-9]{64}$/.test(sha))throw Error('Invalid asset manifest');
  const bytes=await boundedFile(root,path,4*1024*1024);if(createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('Asset digest mismatch');assets.set('/'+path,{bytes,type:mime[path.split('.').at(-1)]});
 }
 if(!assets.has('/index.html'))throw Error('Missing index');
 const server=createServer(async(req,res)=>{
  const headers={'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",'Referrer-Policy':'no-referrer','Cache-Control':'no-store'};
  const send=(status,body='',type='text/plain; charset=utf-8')=>{res.writeHead(status,{...headers,'Content-Type':type});res.end(req.method==='HEAD'?'':body);};
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return send(405);}
  if(req.url==='/fleet-status.json'){
   try{const bytes=await boundedFile(root,'fleet-status.json',16384);const data=parseFleetSnapshot(JSON.parse(bytes.toString('utf8')));return send(200,JSON.stringify(data),'application/json; charset=utf-8');}catch{return send(503,'Observation data unavailable');}
  }
  const asset=assets.get(req.url==='/'?'/index.html':req.url);
  if(!asset)return send(404);
  return send(200,asset.bytes,asset.type);
 });
 server.requestTimeout=10000;server.headersTimeout=10000;
 return server;
}
