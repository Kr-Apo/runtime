import {readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {ReplayConsumerBridge,ReplayTransport,parseRig} from '../../core/dist/index.js';
const output=process.argv[2];if(!output)throw Error('performance.mjs <new output JSON>');
const events=[{tick:0n,skin:'on'},{tick:120n,skin:'off'},{tick:240n,skin:'on'}],visual=[{tick:0n,skin:'on'},{tick:120n,skin:'visual'},{tick:240n,skin:'on'}];
const rows=[];let sink;global.gc?.();const before=process.memoryUsage();
for(const size of [5,32,128]){
 const rig=parseRig(await readFile(new URL(`../../core/test/fixtures/t840b5b2/rig-${size}.native.json`,import.meta.url),'utf8'));
 const make=(e=events)=>new ReplayConsumerBridge(rig,'breathing',1n,e),b=make(),owned=b.currentFrame();
 const operations=['request-unchanged','status','snapshot','snapshot-copy','bridge-without-physics','transport-physics','bridge-physics','visual-skin-physics','eight-instances','catch-up'];
 const values=new Map(operations.map(op=>[op,[]]));
 for(let repeat=0;repeat<18;repeat++)for(let j=0;j<operations.length;j++){
  const operation=operations[(j+repeat)%operations.length],start=performance.now();
  switch(operation){
   case'request-unchanged':{const b=make();b.play(b.context,'breathing',false);for(let i=0;i<1000;i++)sink=b.requestTick(b.context,0n);break;}
   case'status':for(let i=0;i<1000;i++)sink=b.transportStatus();break;
   case'snapshot':for(let i=0;i<100;i++)sink=b.currentFrame();break;
   case'snapshot-copy':for(let i=0;i<100;i++)sink=structuredClone({bones:owned.bones,records:owned.records});break;
   case'bridge-without-physics':{const b=make();b.play(b.context,'breathing',false);for(let i=0;i<100;i++){b.requestTick(b.context,0n);sink=b.currentFrame();}break;}
   case'transport-physics':{const t=ReplayTransport.withSkins(rig,'breathing',1n,events);t.play(t.context,'breathing',false);t.requestTick(t.context,120n,()=>{});sink=t.pump(t.context,112,()=>{});break;}
   default:{const count=operation==='eight-instances'?8:1,owners=Array.from({length:count},()=>make(operation==='visual-skin-physics'?visual:events));for(const t of owners){t.play(t.context,'breathing',false);const ticks=operation==='catch-up'?600n:120n;t.requestTick(t.context,ticks);while(t.transportStatus().clock.backlog){t.pump(t.context,64);sink=t.currentFrame();}}}
  }
  if(repeat>=3)values.get(operation).push(performance.now()-start);
 }
 for(const operation of operations){const samples=values.get(operation).sort((a,b)=>a-b);rows.push({rig:`rig-${size}`,operation,medianMs:samples[samples.length>>1],minMs:samples[0],maxMs:samples.at(-1),samplesMs:samples});}
}
global.gc?.();const after=process.memoryUsage();await writeFile(output,JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,before,after,rows,sinkTick:String(sink?.poseTick??'none')},null,2),{flag:'wx'});console.log(JSON.stringify({rows:rows.length,before,after}));
