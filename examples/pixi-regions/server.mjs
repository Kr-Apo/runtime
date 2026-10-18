import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../scripts/web-server.mjs';

export async function start(port = 4175) {
  const server = await serve(undefined, port);
  return { ...server, exampleUrl: `${server.url}/examples/pixi-regions/` };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await start(Number(process.env.ANKHIMATE_PORT ?? 4175));
  console.log(`Ankhimate PixiJS regions: ${server.exampleUrl} — Ctrl+C to stop`);
}
