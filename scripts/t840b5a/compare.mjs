import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ReplayTransport,parseRig} from '../../core/dist/index.js';
const input=resolve(process.argv[2]??''),out=resolve(process.argv[3]??'');
if(!process.argv[2]||!process.argv[3])throw Error('compare.mjs <Rust reference> <new output>');
await mkdir(out);
const limits=JSON.parse(await readFile(new URL('./thresholds.json',import.meta.url),'utf8'));
const cases=JSON.parse(await readFile(resolve(input,'cases.json'),'utf8'));
const maxima=Object.fromEntries(['pure','spring','post'].map(s=>[s,Object.fromEntries(Object.keys(limits).map(k=>[k,{error:0}]))]));
function pose(rig,p){return p.bones.map((b,i)=>({name:b.name,values:[b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY,b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty,b.world.tx+b.world.a*rig.bones[i].length,b.world.ty+b.world.b*rig.bones[i].length]}));}
function frame(rig,f){return {tick:String(f.tick),bones:pose(rig,f.pose),records:f.records.map(r=>({constraint:r.constraint,values:[r.rotation,r.x,r.y,r.rotationVelocity,r.velocityX,r.velocityY,r.anchorX,r.anchorY]}))};}
function snapshot(t){
 const s=t.snapshot(),c=s.clock;return {...s,position:s.position===null?null:String(s.position),replayTarget:s.replayTarget===null?null:String(s.replayTarget),previewTime:s.previewTime?[String(s.previewTime.numerator),String(s.previewTime.denominator)]:null,
 clock:c?{epoch:String(c.epoch),requested:String(c.requested),completed:String(c.completed),backlog:String(c.backlog),next:c.next===null?null:String(c.next),time:c.time?[String(c.time.numerator),String(c.time.denominator)]:null}:null};
}
function current(rig,t){try{return frame(rig,t.frame());}catch{return null;}}
const rows=[],traces=[];const groupings=new Map();
for(const c of cases){
 const bytes=await readFile(resolve(input,`${c.rig}.native.json`));assert.deepEqual(bytes,await readFile(new URL(`../../core/test/fixtures/t840b5a/${c.rig}.native.json`,import.meta.url)));
 const rig=parseRig(bytes.toString()),t=new ReplayTransport(rig,'breathing',1n),tokens=new Map(),steps=[],frames=[];
 for(const [index,o]of c.ops.entries()){
  const ctx=o.context?tokens.get(o.context):t.context,before={snapshot:snapshot(t),frame:current(rig,t)};
  const observe=f=>frames.push({op:index,pre:pose(rig,t.sampleTick(f.tick)),post:frame(rig,f)});
  let failed=false;
  try{
   switch(o.op){
    case'play':t.play(ctx,o.clip,o.restart);break;case'pause':t.pause(ctx);break;case'resume':t.resume(ctx);break;case'stop':t.stop(ctx);break;
    case'reset':t.reset(ctx,BigInt(o.epoch));break;case'seek':t.seekTime(ctx,BigInt(o.n),BigInt(o.d));break;case'replay':t.replayTo(ctx,BigInt(o.tick));break;
    case'request':assert.notEqual(t.requestTime(ctx,BigInt(o.n),BigInt(o.d),observe).stop.kind,'failed');break;case'pump':assert.notEqual(t.pump(ctx,o.budget,observe).stop.kind,'failed');break;
    case'capture':tokens.set(o.name,ctx);break;case'observe':for(let i=0;i<20;i++)assert.deepEqual({snapshot:snapshot(t),frame:current(rig,t)},before);break;
    case'crossfade':t.crossFade(ctx,'held',.25);break;case'skin':t.setSkin(ctx,'default');break;case'rest_start':t.startFromPreview(ctx);break;case'dispose':t.dispose(ctx);break;default:assert.fail(o.op);
   }
  }catch(error){failed=true;if(!o.error)throw error;}
  assert.equal(failed,o.error??false,JSON.stringify(o));if(failed)assert.deepEqual({snapshot:snapshot(t),frame:current(rig,t)},before);
  const s=t.snapshot();if(s.poseKind==='simulated')assert.equal(t.frame().tick,s.clock.completed);
  steps.push({snapshot:snapshot(t),frame:current(rig,t),pre:s.position===null?null:pose(rig,t.sampleTick(s.position)),outcome:failed?'error':'ok'});
 }
 const actual={steps,frames},expected=c.result;assert.equal(steps.length,expected.steps.length);assert.equal(frames.length,expected.frames.length);
 let first=null;
 function compare(a,b,stage,tick){
  assert.equal(a.length,b.length);a.forEach((entry,i)=>{
   const key=stage==='spring'?'constraint':'name';assert.equal(entry[key],b[i][key]);assert.equal(entry.values.length,b[i].values.length);
   entry.values.forEach((x,j)=>{
    const field=stage==='spring'?(j===0?'rotation':j<3?'localTranslation':j===3?'angularVelocity':j<6?'linearVelocity':'anchor'):j<2?'localTranslation':j===2?'rotation':j<7?'scaleShear':j<11?'worldLinear':j<13?'worldTranslation':'tip';
    const y=b[i].values[j];assert.ok(Number.isFinite(x)&&Number.isFinite(y));const error=field==='rotation'?Math.abs(Math.atan2(Math.sin(x-y),Math.cos(x-y))):Math.abs(x-y);
    if(error>maxima[stage][field].error)maxima[stage][field]={error,case:c.name,tick,subject:entry[key],component:j};
    if(error>limits[field]&&!first)first={stage,tick,subject:entry[key],component:j,field,error,rust:y,typescript:x};
   });
  });
 }
 function compareFrame(a,b,tick){
  if(!a||!b){assert.equal(a,b);return;}assert.equal(a.tick,b.tick);compare(a.bones,b.bones,'post',tick);compare(a.records,b.records,'spring',tick);
 }
 steps.forEach((step,i)=>{assert.deepEqual(step.snapshot,expected.steps[i].snapshot,`${c.name}/${i} transport state, time, counters must be exact`);assert.equal(step.outcome,expected.steps[i].outcome);compareFrame(step.frame,expected.steps[i].frame,`command-${i}`);if(step.pre)compare(step.pre,expected.steps[i].pre,'pure',`command-${i}`);else assert.equal(step.pre,expected.steps[i].pre);});
 frames.forEach((f,i)=>{const e=expected.frames[i];assert.equal(f.op,e.op);compare(f.pre,e.pre,'pure',f.post.tick);compareFrame(f.post,e.post,f.post.tick);});
 if(c.name.includes('/')){const trace=frames.map(f=>f.post);if(groupings.has(c.rig))assert.deepEqual(trace,groupings.get(c.rig));else groupings.set(c.rig,trace);}
 rows.push({name:c.name,commands:steps.length,frames:frames.length,status:first?'DIVERGENCE':'PASS',first});traces.push({name:c.name,...actual});
}
await writeFile(resolve(out,'typescript-traces.json'),JSON.stringify(traces));await writeFile(resolve(out,'results.json'),JSON.stringify({limits,maxima,rows},null,2));
console.log(JSON.stringify({cases:rows.length,commands:rows.reduce((n,r)=>n+r.commands,0),frames:rows.reduce((n,r)=>n+r.frames,0),maxima,failures:rows.filter(r=>r.first)},null,2));
assert.ok(rows.every(r=>!r.first),'B5A parity exceeds limits fixed before measurements');
