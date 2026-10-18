import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../scripts/web-server.mjs';
export async function start(port=4176){const server=await serve(undefined,port);return {...server,exampleUrl:`${server.url}/examples/pixi-playback/`};}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const server=await start(Number(process.env.ANKHIMATE_PORT??4176));console.log(`Ankhimate PixiJS playback: ${server.exampleUrl} — Ctrl+C to stop`);}
