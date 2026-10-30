// Backward-compatible CLI; pure implementation is safe to bundle.
import {pathToFileURL} from 'node:url';
import {main} from './dsh-client.mjs';
export * from './dsh-client.mjs';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(()=>{process.stderr.write('DSH observation could not complete. Check local configuration and scoped access.\n');process.exitCode=1;});
}
