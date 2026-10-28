import {ReplayHostTimeBridge} from '@ankhimate/runtime/experimental-host-time';
import {ReplayConsumerBridge,parseRig} from '@ankhimate/runtime';
import {DemoTime} from '../../examples/replay-pixi-pilot/contract.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance,PerformanceObserver} from 'node:perf_hooks';
import assert from 'node:assert/strict';
const out=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('conversion-performance.mjs NEW_OUTPUT');await mkdir(out);
const rig=parseRig(await readFile(new URL('../../examples/replay-pixi-pilot/assets/skeleton.json',import.meta.url),'utf8'));
const rows=[],events=[];const observer=new PerformanceObserver(list=>events.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration,detail:e.detail}))));observer.observe({entryTypes:['gc']});
for(const implementation of ['C2','C3']){
 const c=new ReplayConsumerBridge(rig,'sway',1n);c.play(c.context,'sway',false);const bridge=new ReplayHostTimeBridge(c,0),demo=new DemoTime();demo.start(0);
 const before=process.memoryUsage(),samples=[],start=performance.now();let checksum=0n;
 // 10 warmup batches, 100 measured batches of 1000 calls. Pure conversion and
 // validation only: never request/pump the numerical consumer in this experiment.
 for(let batch=0;batch<110;batch++){const t=performance.now();for(let i=0;i<1000;i++){const ms=(batch*1000+i)/10;checksum+=implementation==='C2'?demo.value(ms)*120n/1000000n:bridge.preview(ms).targetTick;}if(batch>=10)samples.push((performance.now()-t)/1000);}
 const end=performance.now(),after=process.memoryUsage();await new Promise(setImmediate);
 assert.equal(c.currentFrame().completed,0n);assert.equal(c.currentFrame().requested,0n);bridge.dispose();c.dispose(c.context);
 rows.push({implementation,unit:'milliseconds-per-call',warmupCalls:10000,measuredCalls:100000,samples,checksum:String(checksum),memoryBefore:before,memoryAfter:after,gc:events.filter(e=>e.start>=start&&e.start<=end),completed:'0',requested:'0'});
}
observer.disconnect();await writeFile(resolve(out,'results.json'),JSON.stringify({node:process.version,platform:process.platform,architecture:process.arch,notes:'C3 preview includes exact binary64 conversion, binding validation, transport metadata and immutable rational snapshot; C2 is demo microsecond flooring. Neither invokes a solver. This is not an equivalent-capability speedup comparison. Memory and GC are process observations, not exact allocation counts.',rows},null,2));
