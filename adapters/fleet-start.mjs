import {publishFleet} from './fleet-publish.mjs';
publishFleet({configPath:process.env.OFFICE_FLEET_CONFIG,outputDir:process.env.OFFICE_PUBLIC_DIR}).catch(()=>{console.error('Fleet collection failed; no private details logged');process.exitCode=1;});
