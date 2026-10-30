import {createOfficeServer} from './http.mjs';
try {
  const port=Number(process.env.OFFICE_PORT??8787);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('invalid port');
  const office=createOfficeServer({host:process.env.OFFICE_HOST??'127.0.0.1',viewerToken:process.env.OFFICE_VIEWER_TOKEN,agentTokens:JSON.parse(process.env.OFFICE_AGENT_TOKENS??'null'),staticDir:new URL('../dist',import.meta.url).pathname});
  office.server.on('error',()=>{console.error('Office server startup failed');process.exitCode=1;});
  office.server.listen(port,office.host,()=>console.error('Office observation server listening on loopback port '+port));
  process.on('SIGINT',office.close);process.on('SIGTERM',office.close);
} catch {console.error('Office server configuration invalid; see server/README.md');process.exitCode=1;}
