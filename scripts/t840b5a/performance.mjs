import {readFile,writeFile} from 'node:fs/promises';
import {ReplayTransport,ReplayAnimationInstance,parseRig} from '../../core/dist/index.js';
if(!process.argv[2])throw Error('performance.mjs <new output.json>');
const rows=[];
function measure(rig,metric,iterations,ticks,work){
 const samples=[],before=process.memoryUsage();for(let r=0;r<55;r++){const start=performance.now();work();if(r>=5)samples.push(performance.now()-start);}
 samples.sort((a,b)=>a-b);rows.push({rig,metric,iterations,ticks,warmup:5,runs:50,minMs:samples[0],medianMs:samples[25],p95Ms:samples[47],maxMs:samples.at(-1),...(ticks?{medianUsPerTick:samples[25]*1000/ticks}:{medianUsPerCommand:samples[25]*1000/iterations}),memoryBefore:before,memoryAfter:process.memoryUsage()});
}
for(const name of ['idle','ABC']){
 const rig=parseRig(await readFile(new URL(`../../core/test/fixtures/t840b5a/${name}.native.json`,import.meta.url),'utf8'));
 for(const ticks of [120,600,1200])for(const metric of ['B4-advance','B5A-advance','B4-replay','B5A-replay'])measure(name,metric,1,ticks,()=>{
  if(metric.startsWith('B4')){
   const s=new ReplayAnimationInstance(rig,'breathing',1n);
   if(metric.endsWith('replay')){s.reset(rig,'breathing',2n);s.queueTime(s.context,BigInt(ticks),120n);while(s.clock().backlog>0n)s.pump(s.context,64,()=>{});}
   else{s.requestTick(s.context,BigInt(ticks),()=>{});s.pump(s.context,ticks,()=>{});}
  }else{
   const t=new ReplayTransport(rig,'breathing',1n);
   if(metric.endsWith('replay')){t.replayTo(t.context,BigInt(ticks));while(t.snapshot().clock.backlog>0n)t.pump(t.context,64,()=>{});}
   else{t.play(t.context,'breathing',false);t.requestTick(t.context,BigInt(ticks),()=>{});t.pump(t.context,ticks,()=>{});}
  }
 });
 for(const metric of ['play-same','pause-resume-pair','snapshot','frame-copy','frame-owned-copy','pure-pose-query','restart','stop','seek','reset']){
  const t=new ReplayTransport(rig,'breathing',1n);t.play(t.context,'breathing',false);
  measure(name,metric,100,0,()=>{for(let i=0;i<100;i++){
   const c=t.context;switch(metric){
    case'play-same':t.play(c,'breathing',false);break;
    case'pause-resume-pair':t.pause(c);t.resume(c);break;
    case'snapshot':t.snapshot();break;case'frame-copy':t.frame();break;case'frame-owned-copy':structuredClone(t.frame());break;
    case'pure-pose-query':t.sampleTick(30n);break;case'restart':t.play(c,'breathing',true);break;case'stop':t.stop(c);break;case'seek':t.seekTick(c,30n);break;case'reset':t.reset(c,c.epoch+1n);break;
   }
  }});
 }
}
await writeFile(process.argv[2],JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,rows},null,2),{flag:'wx'});
console.log(JSON.stringify(rows.map(({memoryBefore,memoryAfter,...r})=>r),null,2));
