import {readFile,writeFile} from 'node:fs/promises';
import {ReplayAnimationInstance,ReplayPhysicsInstance,parseRig} from '../../core/dist/index.js';
const rows=[];
if(!process.argv[2])throw Error('performance.mjs <new output.json>');
for(const name of ['idle','ABC']){
 const rig=parseRig(await readFile(new URL(`../../core/test/fixtures/t840b4/${name}.native.json`,import.meta.url),'utf8'));
 const sampler=new ReplayAnimationInstance(rig,'breathing',1n),direct=Array.from({length:121},(_,i)=>sampler.sampleTick(BigInt(i)).bones.map(({world,...local})=>local));
 for(const profile of ['B3-direct','B4-clip','pure-clip']){
  const times=[];const before=process.memoryUsage();
  for(let r=0;r<55;r++){
   const start=performance.now();
   if(profile==='B3-direct'){
    const s=new ReplayPhysicsInstance(rig,1n,direct[0]),ctx=s.context;
    s.requestTick(ctx,120n,t=>direct[Number(t.index)],()=>{});s.pump(ctx,120,t=>direct[Number(t.index)],()=>{});
   }else if(profile==='B4-clip'){
    const s=new ReplayAnimationInstance(rig,'breathing',1n),ctx=s.context;
    s.requestTick(ctx,120n,()=>{});s.pump(ctx,120,()=>{});
   }else for(let i=1;i<=120;i++)sampler.sampleTick(BigInt(i));
   if(r>=5)times.push(performance.now()-start);
  }
  times.sort((a,b)=>a-b);rows.push({rig:name,profile,warmup:5,runs:50,ticks:120,minMs:times[0],medianMs:times[25],p95Ms:times[47],maxMs:times.at(-1),memoryBefore:before,memoryAfter:process.memoryUsage()});
 }
}
await writeFile(process.argv[2],JSON.stringify(rows,null,2),{flag:'wx'});console.log(JSON.stringify(rows.map(({memoryBefore,memoryAfter,...r})=>r),null,2));
