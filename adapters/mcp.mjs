import {McpServer} from '@modelcontextprotocol/server';
import {StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import {createOfficeClient} from './office-client.mjs';
const identifier=z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export function createObservationMcp(client) {
  const server=new McpServer({name:'agent-office-observer',version:'0.1.0'});
  const result=async fn=>{try{return {content:[{type:'text',text:JSON.stringify(await fn())}]};}catch{return {isError:true,content:[{type:'text',text:'Observation request failed; check local backend configuration and event/run sequence. No automatic retry was performed.'}]};}};
  server.registerTool('report_event',{description:'Report observed activity for the agent bound to this adapter credential. Does not execute work or invoke any AI. Start each new run at sequence 1; subsequent progress increments sequence exactly by 1. Terminal runs cannot be changed.',inputSchema:z.object({eventId:identifier,runId:identifier,sequence:z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),type:z.enum(['start','progress']),status:z.enum(['idle','working','waiting','meeting','done','blocked','failed','cancelled']),message:z.string().max(1000).optional(),progress:z.number().min(0).max(100).nullable().optional()}).strict()},args=>result(()=>client.reportEvent(args)));
  server.registerTool('heartbeat',{description:'Report liveness of this credential-bound agent and current run only. Does not change progress or prove successful work.',inputSchema:z.object({runId:identifier}).strict()},args=>result(()=>client.heartbeat(args)));
  server.registerTool('get_status',{description:'Read observation state for this credential-bound agent only. No dispatch or file access.',inputSchema:z.object({}).strict()},()=>result(()=>client.getStatus()));
  return server;
}
export async function startMcp(){const client=createOfficeClient({url:process.env.OFFICE_URL,token:process.env.OFFICE_AGENT_TOKEN});await createObservationMcp(client).connect(new StdioServerTransport());}
