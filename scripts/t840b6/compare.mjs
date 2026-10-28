import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ReplayPhysicsInstance,ReplayAnimationInstance,parseRig} from '../../core/dist/index.js';
const input=resolve(process.argv[2]??''),out=resolve(process.argv[3]??'');if(!process.argv[2]||!process.argv[3])throw Error('compare.mjs <reference> <new output>');await mkdir(out);
const limits=JSON.parse(await readFile(new URL('./thresholds.json',import.meta.url),'utf8'));
const cases=JSON.parse(await readFile(resolve(input,'cases.json'),'utf8')),maxima={},rows=[],traces=[];
const events=[{tick:0n,skin:'on'},{tick:120n,skin:'off'},{tick:240n,skin:'on'}];
const local=p=>p.bones.map(({world,...b})=>b);
const records=rs=>rs.map(r=>({constraint:r.constraint,values:[r.rotation,r.x,r.y,r.rotationVelocity,r.velocityX,r.velocityY,r.anchorX,r.anchorY]}));
function state(rig,s){const c=s.clock(),f=s.frame(),n=s.numericalState();return {epoch:String(c.epoch),requested:String(c.requested),completed:String(c.completed),backlog:String(c.backlog),faulted:s.faulted,skin:s.skinAt(f.tick)?.skin??rig.defaultSkin,active:n.active,private:records(n.records),frame:{tick:String(f.tick),records:records(f.records),bones:f.pose.bones.map(b=>({name:b.name,values:[b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY,b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty]}))}};}
for(const c of cases){
 const bytes=await readFile(resolve(input,c.rig+'.native.json'));assert.deepEqual(bytes,await readFile(new URL(`../../core/test/fixtures/t840b6/${c.rig}.native.json`,import.meta.url)));
 const rig=parseRig(bytes.toString()),source=JSON.stringify(rig),pure=new ReplayAnimationInstance(rig,'breathing',1n,events),initial=local(pure.sampleTick(0n)),s=new ReplayPhysicsInstance(rig,1n,initial,events),other=new ReplayPhysicsInstance(rig,1n,initial,events),unaffected=state(rig,other);
 for(let n=1n;n<BigInt(c.tick);n++)s.requestTick(s.context,n,t=>local(pure.sampleTick(t.index)),()=>{});
 const before=state(rig,s),privateBefore=s.numericalState(),old=s.context,target=BigInt(c.target);
 if(c.fault==='cancel'){assert.equal(s.queueTime(s.context,target,120n).stop.kind,'cancelled');}
 else{
  const p=s.requestTick(s.context,target,t=>{
   if(c.fault==='provider')throw Error('sampler error');const values=local(pure.sampleTick(t.index));
   if(c.fault==='second')values.find(v=>v.name==='pivot-B').scaleX=0;
   if(c.fault==='nonfinite')values[0].x=NaN;
   if(c.fault==='unknown')values.push({name:'missing',x:0,y:0,rotation:0,scaleX:1,scaleY:1,shearX:0,shearY:0});
   return values;
  },()=>{throw Error(c.fault==='observer'?'precommit rejection':'failed computation must not notify');});
  assert.equal(p.stop.kind,'failed');
 }
 const after=state(rig,s);assert.deepEqual(s.numericalState(),privateBefore);assert.deepEqual(after.frame,before.frame);assert.equal(s.clock().completed,BigInt(c.tick)-1n);assert.equal(s.clock().backlog,52n);assert.equal(s.faulted,c.fault!=='cancel');assert.deepEqual(state(rig,other),unaffected);assert.equal(JSON.stringify(rig),source);
 if(c.fault!=='cancel')assert.throws(()=>s.pump(s.context,1,()=>[],()=>{}));
 s.reset(rig,2n,initial);assert.throws(()=>s.requestTick(old,1n,()=>[],()=>{}));const control=new ReplayPhysicsInstance(rig,2n,initial);
 for(let n=1n;n<=360n;n++){const provider=t=>local(pure.sampleTick(t.index));s.requestTick(s.context,n,provider,()=>{});control.requestTick(control.context,n,provider,()=>{});assert.deepEqual(state(rig,s),state(rig,control));}
 const actual={name:c.name,rig:c.rig,fault:c.fault,tick:c.tick,target:c.target,before,after,reconstructed:state(rig,s),rollbackExact:true};let first=null;
 function compare(a,e,path='root'){
  if(typeof a==='number'){
   assert.ok(Number.isFinite(a)&&Number.isFinite(e));const m=path.match(/\.values\.(\d+)$/);let field='unknown';if(m){const n=Number(m[1]);field=path.includes('.private.')||path.includes('.records.')?(n===0?'rotation':n<3?'localTranslation':n===3?'angularVelocity':n<6?'linearVelocity':'anchor'):n<2?'localTranslation':n===2?'rotation':n<7?'scaleShear':n<11?'worldLinear':'worldTranslation';}
   const error=field==='rotation'?Math.abs(Math.atan2(Math.sin(a-e),Math.cos(a-e))):Math.abs(a-e);if(!maxima[field]||error>maxima[field].error)maxima[field]={error,case:c.name,path};if(error>(limits[field]??0)&&!first)first={field,error,path,rust:e,typescript:a};return;
  }
  if(Array.isArray(a)){assert.equal(a.length,e.length,path);a.forEach((v,i)=>compare(v,e[i],path+'.'+i));return;}
  if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(e).sort());for(const k of Object.keys(a))compare(a[k],e[k],path+'.'+k);return;}
  assert.equal(a,e,path);
 }
 compare(actual,c);rows.push({name:c.name,status:first?'DIVERGENCE':'PASS',first});traces.push(actual);
}
await writeFile(resolve(out,'typescript-traces.json'),JSON.stringify(traces));await writeFile(resolve(out,'results.json'),JSON.stringify({limits,maxima,rows},null,2));console.log(JSON.stringify({cases:rows.length,maxima,failures:rows.filter(r=>r.first)},null,2));assert.ok(rows.every(r=>!r.first));
