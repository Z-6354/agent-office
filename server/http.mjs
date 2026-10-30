import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {AGENTS, ApiError, createStore} from './store.mjs';
export function validateConfig({host='127.0.0.1',viewerToken,agentTokens}={}) {
  if(!['127.0.0.1','::1'].includes(host)) throw new Error('Only literal loopback binding is supported');
  const good=t=>typeof t==='string'&&t.length>=32&&t.length<=256&&!/\s/.test(t);
  if(!good(viewerToken)||!agentTokens||Object.keys(agentTokens).length!==4||AGENTS.some(a=>!good(agentTokens[a])))throw new Error('Viewer and all four agent credentials required (32-256 non-whitespace characters)');
  if(new Set([viewerToken,...Object.values(agentTokens)]).size!==5)throw new Error('Credentials must be unique');
  return {host,viewerToken,agentTokens};
}
function same(a,b){const x=Buffer.from(a), y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function createOfficeServer(options) {
  const config=validateConfig(options), store=options.store??createStore(), clients=new Set(), staticDir=options.staticDir?resolve(options.staticDir):null;
  function identity(req) { const raw=req.headers.authorization; if(typeof raw!=='string'||!raw.startsWith('Bearer '))throw new ApiError(401,'authentication required'); const token=raw.slice(7); if(same(token,config.viewerToken))return {viewer:true}; for(const [agentId,t] of Object.entries(config.agentTokens))if(same(token,t))return {agentId};throw new ApiError(401,'invalid credential'); }
  const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  const broadcast=()=>{for(const res of clients){if(res.writableLength>65536){res.destroy();clients.delete(res);continue;}res.write('event: snapshot\ndata: '+JSON.stringify(store.snapshot())+'\n\n');}};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    try {
      const address=server.address(), authority=(config.host==='::1'?'[::1]':config.host)+':'+address.port;
      if(req.headers.host!==authority)throw new ApiError(403,'invalid host');
      if(req.headers.origin && req.headers.origin!=='http://'+authority)throw new ApiError(403,'cross-origin forbidden');
      const url=new URL(req.url,'http://'+authority);
      if(url.search)throw new ApiError(400,'query parameters forbidden');
      if(!url.pathname.startsWith('/api/')){
        if(!staticDir||!['GET','HEAD'].includes(req.method))throw new ApiError(404,'not found');
        let path;try{path=resolve(staticDir,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));}catch{throw new ApiError(400,'invalid path');}
        if(!path.startsWith(staticDir+sep))throw new ApiError(403,'invalid path');
        const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
        if(!types[extname(path)])throw new ApiError(404,'not found');
        let bytes;try{bytes=await readFile(path);}catch{throw new ApiError(404,'not found');}
        res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
        res.writeHead(200,{'Content-Type':types[extname(path)]});res.end(req.method==='HEAD'?undefined:bytes);return;
      }
      const auth=identity(req);
      if(req.method==='GET'&&url.pathname==='/api/snapshot'){send(res,200,store.snapshot(auth.agentId));return;}
      if(req.method==='GET'&&url.pathname==='/api/events'){
        if(!auth.viewer)throw new ApiError(403,'viewer credential required');
        if(clients.size>=10)throw new ApiError(429,'stream capacity reached');
        res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive','X-Accel-Buffering':'no'});clients.add(res);res.write('event: snapshot\ndata: '+JSON.stringify(store.snapshot())+'\n\n');res.on('close',()=>clients.delete(res));return;
      }
      if(req.method==='POST'&&['/api/events','/api/heartbeat'].includes(url.pathname)){
        if(!auth.agentId)throw new ApiError(403,'agent credential required');
        if(req.headers['content-type']?.split(';')[0]!=='application/json')throw new ApiError(415,'JSON required');
        const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw new ApiError(413,'request too large');chunks.push(chunk);}
        let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ApiError(400,'invalid JSON');}
        const result=url.pathname==='/api/events'?store.report(auth.agentId,data):store.heartbeat(auth.agentId,data);send(res,200,result);broadcast();return;
      }
      throw new ApiError(404,'not found');
    }catch(error){if(!res.headersSent)send(res,error instanceof ApiError?error.status:500,{error:error instanceof ApiError?error.message:'internal error'});else res.destroy();}
  });
  server.requestTimeout=10000;server.headersTimeout=10000;server.maxConnections=32;
  const timer=setInterval(broadcast,5000);timer.unref();server.on('close',()=>{clearInterval(timer);for(const res of clients)res.destroy();});
  return {server,store,host:config.host,close:()=>{for(const res of clients)res.destroy();server.close();server.closeAllConnections();}};
}
