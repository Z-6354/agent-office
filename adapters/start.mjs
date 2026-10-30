import {startMcp} from './mcp.mjs';
startMcp().catch(()=>{console.error('Office MCP adapter failed; check local credential and endpoint configuration');process.exitCode=1;});
