// One bounded collection, suitable for a service timer (recommended every 60 seconds).
// No dispatch, retries, shell evaluation, or raw remote data persistence.
import {readFile,stat,realpath,writeFile,rename,unlink} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {collectFleet} from './fleet-observer.mjs';
import {parseFleetSnapshot} from '../src/fleet-state.js';
export async function publishFleet({configPath,outputDir,collect=collectFleet}) {
  if(!configPath||!outputDir)throw Error('Missing fleet paths');
  const [privatePath,publicDir]=await Promise.all([realpath(resolve(configPath)),realpath(resolve(outputDir))]);
  if(privatePath===publicDir||privatePath.startsWith(publicDir+'/'))throw Error('Private config cannot be public');
  const [file,dir]=await Promise.all([stat(privatePath),stat(dirname(privatePath))]);
  if(!file.isFile()||(file.mode&0o777)!==0o600||(dir.mode&0o777)!==0o700||file.size>32768)throw Error('Private config permissions invalid');
  const config=JSON.parse(await readFile(privatePath,'utf8'));
  const publicSnapshot=parseFleetSnapshot(await collect({sources:config.sources}));
  const temp=join(publicDir,`.fleet-${randomUUID()}.tmp`);
  try{await writeFile(temp,JSON.stringify(publicSnapshot),{mode:0o644,flag:'wx'});await rename(temp,join(publicDir,'fleet-status.json'));}finally{await unlink(temp).catch(()=>{});}
}
