import {serve} from '../../scripts/web-server.mjs';
const server=await serve(undefined,Number(process.env.ANKHIMATE_PORT??4180));
console.log(`Manual only: ${server.url}/examples/phaser-pixi-parity/ — Ctrl+C to stop. No browser opened.`);
