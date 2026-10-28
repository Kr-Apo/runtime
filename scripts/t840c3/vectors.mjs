import {ReplayHostTimeBridge} from '@ankhimate/runtime/experimental-host-time';
import {ReplayConsumerBridge,parseRig} from '@ankhimate/runtime';
import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import assert from 'node:assert/strict';
const out=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('vectors.mjs NEW_OUTPUT');await mkdir(out);
const rig=parseRig(await readFile(new URL('../../examples/replay-pixi-pilot/assets/skeleton.json',import.meta.url),'utf8')),c=new ReplayConsumerBridge(rig,'sway',1n);c.play(c.context,'sway',false);const bridge=new ReplayHostTimeBridge(c,0);
const expected=JSON.parse(await readFile(new URL('../../core/test/fixtures/t840c3/time-vectors.json',import.meta.url),'utf8')),rows=[];
for(const v of expected){const actual=String(bridge.preview(v.ms).targetTick);rows.push({...v,actual,pass:actual===v.tick});assert.equal(actual,v.tick,v.name);}
const segments=JSON.parse(await readFile(new URL('../../core/test/fixtures/t840c3/segments.json',import.meta.url),'utf8'));for(let i=0;i<1000;i++){bridge.pause(i+.0009);bridge.resume(i+1);}const f=bridge.observe().elapsedMilliseconds;assert.equal(String(f.numerator),segments.numerator);assert.equal(String(f.denominator),segments.denominator);
await writeFile(resolve(out,'results.json'),JSON.stringify({vectors:rows.length,allPassed:true,completed:String(c.currentFrame().completed),requested:String(c.currentFrame().requested),segments:{...segments,observedNumerator:String(f.numerator),observedDenominator:String(f.denominator)},rows},null,2));bridge.dispose();c.dispose(c.context);
