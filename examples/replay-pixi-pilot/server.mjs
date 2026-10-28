import {serve} from '../../scripts/web-server.mjs';
const server=await serve(undefined,Number(process.env.PORT??4188));console.log(`Experimental ReplayV1 pilot: ${server.url}/examples/replay-pixi-pilot/`);
