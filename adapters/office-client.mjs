// Observation transport only: no model calls, commands or file operations.
export function createOfficeClient({url='http://127.0.0.1:8787',token,fetchImpl=fetch}={}) {
  const base=new URL(url);
  if(base.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(base.hostname)||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw new Error('Office URL must be a literal loopback HTTP origin');
  if(typeof token!=='string'||token.length<32||token.length>256||/\s/.test(token))throw new Error('Agent credential required');
  async function request(path,body){
    const response=await fetchImpl(new URL(path,base),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000),redirect:'error'});
    if(!response.ok)throw new Error('Office observation request rejected (HTTP '+response.status+')');
    const chunks=[]; let size=0;
    for await (const chunk of response.body) { size+=chunk.length; if(size>2097152)throw new Error('Office response exceeds limit'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  return {reportEvent:e=>request('/api/events',e),heartbeat:e=>request('/api/heartbeat',e),getStatus:()=>request('/api/snapshot')};
}
