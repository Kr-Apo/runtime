import {readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {ReplayPhysicsInstance,ReplayConsumerBridge,parseRig} from '../../core/dist/index.js';
const output=process.argv[2];if(!output)throw Error('performance.mjs <new output file>');
const rows=[];let sink;global.gc?.();const before=process.memoryUsage();
for(const name of ['single','independent','dependent','medium','many']){
 const rig=parseRig(await readFile(new URL(`../../core/test/fixtures/t840b6/${name}.native.json`,import.meta.url),'utf8'));
 const operations=['one-tick','advance-120','advance-1200','snapshot-100','failure-second','failure-observer','eight-owners'];
 if(name==='single')operations.push('advance-36000');
 const values=new Map(operations.map(op=>[op,[]]));
 for(let repeat=0;repeat<13;repeat++)for(let j=0;j<operations.length;j++){
  const op=operations[(j+repeat)%operations.length];if(name==='single'&&op==='failure-second')continue;
  const s=new ReplayPhysicsInstance(rig,1n,[]),start=performance.now();
  switch(op){
   case'one-tick':sink=s.requestTick(s.context,1n,()=>[],()=>{});break;
   case'snapshot-100':for(let n=0;n<100;n++)sink=s.numericalState();break;
   case'failure-second':{const b=rig.bones.find(b=>b.name==='pivot-B');sink=s.requestTick(s.context,1n,()=>[{name:b.name,x:b.x,y:b.y,rotation:b.rotation*Math.PI/180,scaleX:0,scaleY:b.scaleY,shearX:b.shearX*Math.PI/180,shearY:b.shearY*Math.PI/180}],()=>{});break;}
   case'failure-observer':sink=s.requestTick(s.context,1n,()=>[],()=>{throw Error('benchmark audit');});break;
   default:{const owners=Array.from({length:op==='eight-owners'?8:1},()=>new ReplayConsumerBridge(rig,'breathing',1n));for(const b of owners){b.play(b.context,'breathing',false);const target=op==='advance-36000'?36000n:op==='advance-1200'?1200n:120n;b.requestTick(b.context,target);while(b.transportStatus().clock.backlog)sink=b.pump(b.context,128);}}
  }
  if(repeat>=3)values.get(op).push(performance.now()-start);
 }
 for(const operation of operations){const v=values.get(operation);if(!v.length)continue;v.sort((a,b)=>a-b);rows.push({rig:name,bones:rig.bones.length,constraints:rig.constraints.length,operation,medianMs:v[v.length>>1],minMs:v[0],maxMs:v.at(-1),samplesMs:v});}
}
global.gc?.();const after=process.memoryUsage();await writeFile(output,JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,before,after,rows,sinkStop:sink?.stop?.kind},null,2),{flag:'wx'});console.log(JSON.stringify({rows:rows.length,before,after}));
