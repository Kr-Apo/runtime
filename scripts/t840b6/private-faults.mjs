// Test-only sidecar: production modules and public APIs receive NO injection hook.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const out=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('private-faults.mjs <new output dir>');await mkdir(out);
const sourceURL=new URL('../../core/dist/replay-physics.js',import.meta.url),source=await readFile(sourceURL,'utf8');
let code=source.replace(/from "(\.[^"]+)"/g,(_,p)=>`from "${new URL(p,sourceURL).href}"`);
assert.ok(code.includes('import { replayPhysicsStep, replayWorlds }'));
code=code.replace('import { replayPhysicsStep, replayWorlds }','import { replayPhysicsStep as nativeStep, replayWorlds }');
code='let testAccess, armed=null;\n'+code;
code=code.replace('export class ReplayPhysicsInstance {',`export class ReplayPhysicsInstance {
 static {testAccess={
  arm:(s,spec)=>{armed={rig:s.#rig,count:0,...spec};},
  read:s=>structuredClone({active:s.#active.map(c=>c.name),records:[...s.#records],frame:s.#frame,rig:s.#rig}),
  candidate:s=>({records:cloneRecords(s.#records),active:s.#active.slice()}),
  accept:(s,c)=>s.#accept(c.records,c.active,s.#frame)
 };}
`);
code+=`
function replayPhysicsStep(rig,pose,c,state,prime){
 nativeStep(rig,pose,c,state,prime);
 if(!prime&&armed?.rig===rig&&armed.count++===armed.point){
  switch(armed.field){case 0:state.x=NaN;break;case 1:state.velocityY=Infinity;break;case 2:state.rotation=NaN;break;case 3:state.rotationVelocity=-Infinity;break;case 4:state.anchorX=NaN;break;default:pose.bones[0].world.tx=Infinity;pose.drawOrder.push('injected');}
  throw Error('test-only post-integration fault');
 }
}
export {testAccess};
`;
const sidecar=resolve(out,'instrumented.mjs');await writeFile(sidecar,code,{flag:'wx'});
const {ReplayPhysicsInstance:Instance,testAccess:access}=await import(pathToFileURL(sidecar).href);
const rig=JSON.parse(await readFile(new URL('../../core/test/fixtures/t840b6/dependent.native.json',import.meta.url),'utf8')),rows=[];
for(const transition of ['stable','remove','prime']){
 const calendar=[{tick:0n,skin:transition==='prime'?'off':'on'},{tick:9n,skin:transition==='remove'?'off':'on'}];
 const points=transition==='remove'?1:3;
 for(let point=0;point<points;point++)for(let field=0;field<6;field++){
  const s=new Instance(rig,1n,[],calendar),other=new Instance(rig,1n,[],calendar);s.requestTick(s.context,8n,()=>[],()=>{});other.requestTick(other.context,8n,()=>[],()=>{});
  const before=access.read(s),unaffected=access.read(other);access.arm(s,{point,field});
  const p=s.requestTick(s.context,60n,()=>[],()=>assert.fail('no refused candidate observer'));
  assert.equal(p.stop.kind,'failed');assert.equal(s.faulted,true);assert.equal(s.clock().completed,8n);assert.equal(s.clock().backlog,52n);assert.deepEqual(access.read(s),before);assert.deepEqual(access.read(other),unaffected);
  assert.throws(()=>s.pump(s.context,1,()=>[],()=>{}));rows.push({transition,point,field,status:'PASS',completed:'8',requested:'60',backlog:'52',privateExact:true});
 }
 for(const fault of ['observer','provider','nonfinite-input','mutating-successful-observer']){
  const s=new Instance(rig,1n,[],calendar);s.requestTick(s.context,8n,()=>[],()=>{});const before=access.read(s);
  const p=s.requestTick(s.context,9n,()=>{if(fault==='provider')throw Error('provider');if(fault==='nonfinite-input')return [{name:rig.bones[0].name,x:NaN,y:0,rotation:0,scaleX:1,scaleY:1,shearX:0,shearY:0}];return [];},f=>{
   assert.deepEqual(access.read(s),before,'candidate numerics must stay hidden during audit');assert.equal(s.clock().completed,8n);
   f.pose.bones[0].world.tx=Infinity;f.pose.drawOrder.push('external');f.records.splice(0);if(fault==='observer')throw Error('observer');
  });
  if(fault==='mutating-successful-observer'){
   assert.equal(p.stop.kind,'target_reached');const control=new Instance(rig,1n,[],calendar);control.requestTick(control.context,8n,()=>[],()=>{});control.requestTick(control.context,9n,()=>[],()=>{});assert.deepEqual(access.read(s),access.read(control));
  }else{assert.equal(p.stop.kind,'failed');assert.deepEqual(access.read(s),before);assert.equal(s.clock().completed,8n);}
  rows.push({transition,fault,status:'PASS',privateExact:true});
 }
}
// Actual production clone/accept functions, accessible only inside this throwaway sidecar.
const component=[];
for(const name of ['single','independent','many']){
 const r=JSON.parse(await readFile(new URL(`../../core/test/fixtures/t840b6/${name}.native.json`,import.meta.url),'utf8')),s=new Instance(r,1n,[]);
 for(const operation of ['candidate','accept','discard']){
  const values=[];
  for(let repeat=0;repeat<23;repeat++){
   let prepared=operation==='candidate'?null:Array.from({length:1000},()=>access.candidate(s));const start=performance.now();
   if(operation==='candidate'){for(let n=0;n<1000;n++)access.candidate(s);}
   else if(operation==='accept'){for(const c of prepared)access.accept(s,c);}
   else prepared=null; // Reachability release only; GC is not synchronous destruction.
   if(repeat>=3)values.push(performance.now()-start);
  }
  values.sort((a,b)=>a-b);component.push({rig:name,constraints:r.constraints.length,operation,iterations:1000,medianMs:values[values.length>>1],minMs:values[0],maxMs:values.at(-1)});
 }
}
await writeFile(resolve(out,'results.json'),JSON.stringify({source:fileURLToPath(sourceURL),sourceSHA256:createHash('sha256').update(source).digest('hex'),testOnly:true,rows,component},null,2),{flag:'wx'});console.log(JSON.stringify({cases:rows.length,allPassed:true,component}));
