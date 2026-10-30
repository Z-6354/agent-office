// Explicit, read-only DSH observation. Never dispatches a model turn.
import {createHash, randomUUID} from 'node:crypto';
import {createOfficeClient} from './office-client.mjs';

export const DSH_ENDPOINTS = Object.freeze({cn1:'https://dsh.wannian.fun/dsh-minimal-mcp/mcp',cn2:'https://panel.wannian.fun/dsh-minimal-mcp/mcp',us1:'https://vps.wannian.fun/dsh-minimal-mcp/mcp'});
export const DSH_ENDPOINT = DSH_ENDPOINTS.us1;
const MAX_BYTES = 262144;
const terminal = new Set(['done', 'failed', 'cancelled']);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const validRunId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(x);
const fail = message => { throw new Error(message); };

// Bounded JSON / Streamable HTTP SSE parser. Never treats text as instructions.
export async function readRpcResponse(response, expectedId) {
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
  if (!['application/json', 'text/event-stream'].includes(contentType)) fail('Unsupported DSH response format');
  const reader = response.body?.getReader();
  if (!reader) fail('Missing DSH response');
  const decoder = new TextDecoder();
  let text = '', bytes = 0;
  function match(value) {
    if (!object(value) || value.jsonrpc !== '2.0') fail('Invalid DSH RPC envelope');
    if (value.id !== expectedId) return null;
    if ('error' in value) fail('DSH RPC rejected request');
    if (!('result' in value)) fail('Missing DSH RPC result');
    return {result:value.result};
  }
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (value) { bytes += value.byteLength; if (bytes > MAX_BYTES) fail('DSH response exceeds limit'); text += decoder.decode(value, {stream:true}); }
      if (done) text += decoder.decode();
      if (contentType === 'application/json') {
        if (done) { const found = match(JSON.parse(text)); if (!found) fail('Mismatched DSH response ID'); return found.result; }
      } else {
        text = text.replace(/\r\n/g, '\n');
        let boundary;
        while ((boundary = text.indexOf('\n\n')) >= 0) {
          const event = text.slice(0,boundary); text = text.slice(boundary+2);
          const data = event.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');
          if (!data) continue;
          const found = match(JSON.parse(data)); if (found) return found.result;
        }
        if (done) fail('Incomplete DSH SSE response');
      }
    }
  } catch { fail('Invalid, incomplete or rejected DSH response'); }
  finally { await reader.cancel().catch(()=>{}); }
}

export function createDshObserverClient({token, sourceId='us1', fetchImpl=fetch, timeoutMs=15000}={}) {
  if (!Object.hasOwn(DSH_ENDPOINTS,sourceId)) fail('Unknown DSH source');
  if (typeof token !== 'string' || !token || token.length > 8192 || /\s/.test(token)) fail('DSH_MCP_TOKEN is required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) fail('Invalid request timeout');
  let session, initialized = false, id = 0;
  async function request(method, params, notification=false) {
    const requestId = ++id;
    try {
      const response = await fetchImpl(DSH_ENDPOINTS[sourceId], {
        method:'POST', redirect:'error', signal:AbortSignal.timeout(timeoutMs),
        headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json', Accept:'application/json, text/event-stream',
          ...(initialized ? {'MCP-Protocol-Version':'2025-03-26'} : {}), ...(session ? {'Mcp-Session-Id':session} : {})},
        body:JSON.stringify({jsonrpc:'2.0', ...(notification ? {} : {id:requestId}), method, params}),
      });
      if (!response.ok) { await response.body?.cancel(); fail('DSH HTTP request rejected'); }
      if (notification) { await response.body?.cancel(); return; }
      const result = await readRpcResponse(response, requestId);
      if (method === 'initialize') {
        if (!object(result) || result.protocolVersion !== '2025-03-26' || !object(result.capabilities)) fail('Unsupported DSH MCP initialization');
        const header = response.headers.get('mcp-session-id');
        if (header && !/^[\x21-\x7e]{1,256}$/.test(header)) fail('Invalid DSH session');
        session = header || undefined;
      }
      return result;
    } catch { fail('DSH observation transport failed'); }
  }
  return {
    async initialize() {
      await request('initialize', {protocolVersion:'2025-03-26', capabilities:{}, clientInfo:{name:'agent-office-observer',version:'1.0.0'}});
      initialized = true;
      await request('notifications/initialized', {}, true);
    },
    async probe() {
      if (!initialized) fail('DSH not initialized');
      const result=await request('tools/list', {});
      if (!Array.isArray(result?.tools) || !result.tools.some(t=>t.name==='dsh_status')) fail('DSH status tool missing');
      return true;
    },
    async status(runId) {
      if (!initialized || !validRunId(runId)) fail('Invalid DSH observation request');
      return request('tools/call', {name:'dsh_status', arguments:{runId}});
    },
  };
}

// Strict metadata parser; only explicit known states are recognized.
// No natural-language guessing, tool text execution or forwarding of model output.
export function parseDshStatus(result, expectedRunId) {
  if (!object(result) || result.isError === true) fail('DSH status tool error');
  let data = result.structuredContent;
  if (data === undefined) {
    if (!Array.isArray(result.content) || result.content.length !== 1 || result.content[0]?.type !== 'text' || typeof result.content[0].text !== 'string') fail('Unknown DSH status envelope');
    const text = result.content[0].text;
    try { data = JSON.parse(text); } catch {
      // Only the fixed server metadata header is authoritative; all Assistant / Next
      // sections are untrusted model content and must never influence status.
      const lines = text.split(/\r?\n/);
      if (lines.shift() !== '【remote VPS result — not local】') fail('Unknown DSH status payload');
      const boundary = lines.indexOf('');
      if (boundary < 0 || boundary > 16) fail('Unknown DSH metadata boundary');
      const metadata = {};
      const allowed = new Set(['runId','status','sessionId','route','routeSource','cwd','privilege']);
      for (const line of lines.slice(0,boundary)) {
        const match = /^([A-Za-z]+): ([^\r\n]*)$/.exec(line);
        if (!match || !allowed.has(match[1]) || Object.hasOwn(metadata,match[1])) fail('Unknown DSH metadata');
        metadata[match[1]] = match[2];
      }
      data = metadata;
    }
  }
  if (!object(data) || data.runId !== expectedRunId || typeof data.status !== 'string') fail('Unknown or mismatched DSH status');
  const mapping = {queued:'waiting', running:'working', completed:'done', failed:'failed', cancelled:'cancelled'};
  if (!Object.hasOwn(mapping, data.status)) fail('Unknown DSH run state');
  return {status:mapping[data.status], message:`DSH reported ${data.status}; remote output withheld.`, progress:null};
}

export async function observeRun({runId,dsh,office,pollMs=5000,maxDurationMs=300000,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
  if (!validRunId(runId)) fail('Invalid run ID');
  if (!Number.isInteger(pollMs) || pollMs < 100 || pollMs > 30000 || !Number.isInteger(maxDurationMs) || maxDurationMs < 1 || maxDurationMs > 3600000) fail('Invalid observation window');
  const snapshot = await office.getStatus();
  if (snapshot?.schemaVersion !== 1 || !Array.isArray(snapshot.agents) || snapshot.agents.length !== 1 || snapshot.agents[0].agentId !== 'planner') fail('A planner-scoped Office credential is required');
  const officeRunId = 'dsh_' + createHash('sha256').update(runId).digest('hex').slice(0,40);
  const previous = snapshot.agents[0];
  if (previous.runId && previous.runId !== officeRunId && !terminal.has(previous.status)) fail('Planner already has an active run');
  if (previous.runId === officeRunId && terminal.has(previous.status)) return {outcome:'already-terminal',status:previous.status};
  let sequence = previous.runId === officeRunId ? previous.sequence : 0;
  let lastState = previous.runId === officeRunId ? previous.status : null;
  async function report(status,message) {
    await office.reportEvent({eventId:randomUUID(),runId:officeRunId,sequence:sequence+1,type:sequence ? 'progress':'start',status,message,progress:null});
    sequence++; lastState = status;
  }
  if (!sequence) await report('waiting','Observing an existing DSH run; no model turn dispatched.');
  const started = now();
  try {
    await dsh.initialize();
    while (now() - started < maxDurationMs) {
      const parsed = parseDshStatus(await dsh.status(runId),runId);
      if (parsed.status !== lastState) await report(parsed.status,parsed.message);
      else await office.heartbeat({runId:officeRunId});
      if (terminal.has(parsed.status)) return {outcome:'terminal',status:parsed.status};
      await sleep(Math.min(pollMs, Math.max(0,maxDurationMs-(now()-started))));
    }
    await report('blocked','Observation window ended; DSH task outcome remains unknown.');
    return {outcome:'unknown',reason:'observation-timeout'};
  } catch {
    // A blocked observer is NOT evidence that the underlying task failed.
    await report('blocked','Observation interrupted or response unrecognized; DSH task outcome remains unknown.');
    return {outcome:'unknown',reason:'observation-error'};
  }
}

export async function main(argv=process.argv.slice(2), env=process.env) {
  if (argv.length !== 2 || argv[0] !== '--run-id' || !validRunId(argv[1])) fail('Usage: node adapters/dsh-observer.mjs --run-id EXISTING_RUN_ID');
  const office = createOfficeClient({url:env.OFFICE_URL,token:env.OFFICE_PLANNER_TOKEN});
  const dsh = createDshObserverClient({token:env.DSH_MCP_TOKEN});
  const result = await observeRun({runId:argv[1],office,dsh});
  process.stdout.write(JSON.stringify(result)+'\n');
  if (result.outcome === 'unknown') process.exitCode = 2;
}
