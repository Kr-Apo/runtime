import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {ReplayTransport,parseRig} from '../../core/dist/index.js';
const output=process.argv[2];if(!output)throw Error('performance.mjs <new JSON file>');
const rig=parseRig(await readFile(new URL('../../core/test/fixtures/t840b5b1/control.native.json',import.meta.url),'utf8'));
const events=visual=>[{tick:0n,skin:'on'},{tick:120n,skin:visual?'visual':'off'},{tick:240n,skin:'on'},{tick:300n,skin:'partial'},{tick:330n,skin:'on'}];
const make=profile=>profile==='B5A'?new ReplayTransport(rig,'breathing',1n):ReplayTransport.withSkins(rig,'breathing',1n,profile==='fixed'?[{tick:0n,skin:'default'}]:events(profile==='visual'));
const rows=[];let sink;
function record(label,run){const values=[];for(let i=0;i<35;i++){const s=performance.now();run();if(i>=5)values.push(performance.now()-s);}values.sort((a,b)=>a-b);rows.push({label,medianMs:values[values.length>>1],samplesMs:values});}
global.gc?.();const before=process.memoryUsage();
// Rotate the profile order between repetitions to limit warm-up/drift bias.
for(const ticks of [120n,600n,1200n]){
 const profiles=['B5A','fixed','visual','membership'],values=new Map(profiles.map(p=>[p,[]]));
 for(let repeat=0;repeat<35;repeat++)for(let j=0;j<4;j++){
  const profile=profiles[(j+repeat)%4],start=performance.now();
  const t=make(profile);t.play(t.context,'breathing',false);t.requestTick(t.context,ticks,f=>{sink=f;});t.pump(t.context,Number(ticks),f=>{sink=f;});
  if(repeat>=5)values.get(profile).push(performance.now()-start);
 }
 for(const profile of profiles){const v=values.get(profile);v.sort((a,b)=>a-b);rows.push({label:`${profile}/${ticks}`,medianMs:v[v.length>>1],samplesMs:v});}
}
const t=make('membership');
for(const operation of ['skin-resolution','pure-sampling','frame-copy'])record(operation+'/1000',()=>{for(let n=0n;n<1000n;n++)sink=operation==='skin-resolution'?t.skinAt(n):operation==='pure-sampling'?t.sampleTick(n):t.frame();});
// Boundary timings include author sampling, FK and the active Physics work.
// They are deliberately not mislabeled as isolated delete/prime allocator costs.
for(const [label,n,profile]of [['no-change',120n,'fixed'],['visual-event',120n,'visual'],['delete-records',120n,'membership'],['prime-records',240n,'membership']]){
 const values=[];
 for(let i=0;i<35;i++){
  const t=make(profile);t.play(t.context,'breathing',false);t.requestTick(t.context,n-1n,()=>{});t.pump(t.context,Number(n),()=>{});
  const start=performance.now();t.requestTick(t.context,n,f=>{sink=f;});if(i>=5)values.push(performance.now()-start);
 }
 values.sort((a,b)=>a-b);rows.push({label:'boundary/'+label,medianMs:values[values.length>>1],samplesMs:values});
}
const a=make('B5A'),b=make('fixed');for(const t of[a,b]){t.play(t.context,'breathing',false);t.requestTick(t.context,360n,()=>{});t.pump(t.context,360,()=>{});}assert.deepEqual(a.frame(),b.frame());
global.gc?.();const after=process.memoryUsage();
await writeFile(output,JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,rig:{bones:rig.bones.length,constraints:rig.constraints.length},before,after,rows,sinkTick:String(sink?.tick??'none')},null,2),{flag:'wx'});
console.log(JSON.stringify({rows:rows.length,before,after}));
