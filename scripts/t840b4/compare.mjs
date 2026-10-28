// Real native files from the Rust author/export pipeline; no JSON repair.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ReplayAnimationInstance,parseRig} from '../../core/dist/index.js';
const input=resolve(process.argv[2]??''),out=resolve(process.argv[3]??'');
if(!process.argv[2]||!process.argv[3])throw Error('compare.mjs <Rust reference> <new output>');
await mkdir(out);
const limits=JSON.parse(await readFile(new URL('./thresholds.json',import.meta.url),'utf8'));
const cases=JSON.parse(await readFile(resolve(input,'cases.json'),'utf8'));
const maxima=Object.fromEntries(['pure','post','spring'].map(s=>[s,Object.fromEntries(Object.keys(limits).map(k=>[k,{error:0}]))]));
const rows=[],traces=[];const grouping=new Map();
function pose(rig,p){return p.bones.map((b,i)=>({name:b.name,values:[b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY,b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty,b.world.tx+b.world.a*rig.bones[i].length,b.world.ty+b.world.b*rig.bones[i].length]}));}
function frame(rig,f){return {tick:String(f.tick),bones:pose(rig,f.pose),records:f.records.map(r=>({constraint:r.constraint,values:[r.rotation,r.x,r.y,r.rotationVelocity,r.velocityX,r.velocityY,r.anchorX,r.anchorY]}))};}
for(const c of cases){
 const bytes=await readFile(resolve(input,`${c.rig}.native.json`));
 assert.deepEqual(bytes,await readFile(new URL(`../../core/test/fixtures/t840b4/${c.rig}.native.json`,import.meta.url)));
 const rig=parseRig(bytes.toString()),s=new ReplayAnimationInstance(rig,'breathing',1n),ctx=s.context;
 const pure=c.pure.map((_,t)=>pose(rig,s.sampleTick(BigInt(t))));
 const trace=[frame(rig,s.frame())],progress=[];
 for(const op of c.ops){
   const observe=f=>trace.push(frame(rig,f));
   const p=op.op==='time'?s.requestTime(ctx,BigInt(op.n),BigInt(op.d),observe):s.pump(ctx,op.budget,observe);
   assert.notEqual(p.stop.kind,'failed');
   progress.push({completed:String(p.state.completed),requested:String(p.state.requested),backlog:String(p.state.backlog),processed:p.processed});
 }
 assert.deepEqual(progress,c.progress);assert.equal(trace.length,c.trace.length);
 if(grouping.has(c.rig))assert.deepEqual(trace,grouping.get(c.rig),'same JS per-tick poses regardless of request grouping');else grouping.set(c.rig,trace);
 let first=null;
 function compare(a,b,stage,t,group){
  assert.equal(a.length,b.length);
  a.forEach((entry,i)=>{
   const key=group==='spring'?'constraint':'name';assert.equal(entry[key],b[i][key]);
   entry.values.forEach((x,j)=>{
    const field=group==='spring'?(j===0?'rotation':j<3?'localTranslation':j===3?'angularVelocity':j<6?'linearVelocity':'anchor')
     :j<2?'localTranslation':j===2?'rotation':j<7?'scaleShear':j<11?'worldLinear':j<13?'worldTranslation':'tip';
    const y=b[i].values[j];assert.ok(Number.isFinite(x)&&Number.isFinite(y));
    const error=field==='rotation'?Math.abs(Math.atan2(Math.sin(x-y),Math.cos(x-y))):Math.abs(x-y);
    if(error>maxima[stage][field].error)maxima[stage][field]={error,case:c.name,tick:t,subject:entry[key],component:j};
    if(error>limits[field]&&!first)first={stage,tick:t,subject:entry[key],component:j,field,error,rust:y,typescript:x};
   });
  });
 }
 pure.forEach((p,t)=>compare(p,c.pure[t],'pure',t,'bones'));
 trace.forEach((f,t)=>{assert.equal(f.tick,c.trace[t].tick);compare(f.bones,c.trace[t].bones,'post',t,'bones');compare(f.records,c.trace[t].records,'spring',t,'spring');});
 rows.push({name:c.name,frames:trace.length,status:first?'DIVERGENCE':'PASS',first});traces.push({name:c.name,pure,trace,progress});
}
await writeFile(resolve(out,'typescript-traces.json'),JSON.stringify(traces));
await writeFile(resolve(out,'results.json'),JSON.stringify({limits,maxima,rows},null,2));
console.log(JSON.stringify({cases:rows.length,frames:rows.reduce((n,r)=>n+r.frames,0),maxima,failures:rows.filter(r=>r.first)},null,2));
assert.ok(rows.every(r=>!r.first),'parity exceeds limits fixed before measurements');
