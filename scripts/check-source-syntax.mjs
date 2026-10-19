import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
for(const dir of ['phaser/test','examples/phaser-pixi-parity','scripts'])for(const file of readdirSync(dir).filter(p=>p.endsWith('.mjs'))){const result=spawnSync(process.execPath,['--check',resolve(dir,file)],{stdio:'inherit'});if(result.status)process.exit(result.status);}
console.log('Node source syntax checks passed; repository has no ESLint configuration.');
