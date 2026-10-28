// Calls production ReplayV1 with exact per-tick native-local inputs from Rust.
// No renderer, clip sampler or integrator implementation in this driver.
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ReplayPhysicsInstance,parseRig,evaluate,createEvaluationState } from '../../core/dist/index.js';
const input=resolve(process.argv[2]??''),output=resolve(process.argv[3]??'');
if(!process.argv[2]||!process.argv[3])throw Error('Usage: compare.mjs <new Rust reference dir> <new result dir>');
await mkdir(output);
const limits=JSON.parse(await readFile(new URL('./thresholds.json',import.meta.url),'utf8'));
const cases=JSON.parse(await readFile(resolve(input,'cases.json'),'utf8'));
const max=Object.fromEntries(Object.keys(limits).map(k=>[k,0]));
const rows=[],traces=[];
function error(a,b,field){
  assert.ok(Number.isFinite(a)&&Number.isFinite(b),'nonfinite is always a failure');
  const e=field==='rotation'?Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b))):Math.abs(a-b);
  max[field]=Math.max(max[field],e);return e;
}
function frame(f){return {tick:String(f.tick),bones:f.pose.bones.map(b=>({name:b.name,values:[b.x,b.y,b.rotation,b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty]})),
  records:f.records.map(r=>({constraint:r.constraint,bone:r.bone,values:[r.rotation,r.x,r.y,r.rotationVelocity,r.velocityX,r.velocityY,r.anchorX,r.anchorY]}))};}
for(const c of cases){
  const bytes=await readFile(resolve(input,`${c.rig}.native.json`));
  assert.deepEqual(bytes,await readFile(new URL(`../../core/test/fixtures/t840b3/${c.rig}.native.json`,import.meta.url)),'actual native bytes only');
  if(['single','parent','multiple'].includes(c.rig))assert.deepEqual(bytes,await readFile(new URL(`../../core/test/fixtures/t839/${c.rig}.native.json`,import.meta.url)),'historical native untouched');
  const rig=parseRig(bytes.toString('utf8')),s=new ReplayPhysicsInstance(rig,1n,c.inputs[0]),ctx=s.context;
  const actual=[frame(s.frame())],progress=[];
  const provider=t=>{const v=c.inputs[Number(t.index)];assert.ok(v,'missing canonical inputs');return v;};
  const observer=f=>actual.push(frame(f));
  for(const op of c.ops){
    const p=op.op==='time'?s.requestTime(ctx,BigInt(op.n),BigInt(op.d),provider,observer):s.pump(ctx,op.budget,provider,observer);
    assert.notEqual(p.stop.kind,'failed');assert.equal(s.frame().tick,p.state.completed);
    progress.push({completed:String(p.state.completed),requested:String(p.state.requested),backlog:String(p.state.backlog),processed:p.processed});
  }
  assert.deepEqual(progress,c.progress,'integer scheduling must match exactly');assert.equal(actual.length,c.trace.length);
  let failure=null;
  actual.forEach((a,t)=>{
    const b=c.trace[t];assert.equal(a.tick,b.tick);
    for(const group of ['bones','records']){
      assert.equal(a[group].length,b[group].length);
      a[group].forEach((v,i)=>{
        assert.equal(v[group==='bones'?'name':'constraint'],b[group][i][group==='bones'?'name':'constraint']);
        v.values.forEach((n,j)=>{
          const field=group==='bones'?(j<2?'localTranslation':j===2?'rotation':j<7?'worldLinear':'worldTranslation')
            :(j===0?'rotation':j<3?'localTranslation':j===3?'angularVelocity':j<6?'linearVelocity':'anchor');
          const e=error(n,b[group][i].values[j],field);
          if(e>limits[field]&&!failure)failure={tick:t,group,index:i,component:j,field,error:e};
        });
      });
    }
  });
  rows.push({name:c.name,ticks:actual.length-1,status:failure?'DIVERGENCE':'PASS',first:failure});
  traces.push({name:c.name,trace:actual,progress});
}
await writeFile(resolve(output,'typescript-traces.json'),JSON.stringify(traces));
await writeFile(resolve(output,'results.json'),JSON.stringify({limits,max,rows},null,2));
console.log(JSON.stringify({cases:rows.length,perTickComparisons:rows.reduce((n,r)=>n+r.ticks+1,0),max,failures:rows.filter(r=>r.first)},null,2));
assert.ok(rows.every(r=>r.status==='PASS'),'B3 parity outside predeclared thresholds');
// Descriptive CPU timing, not an acceptance threshold or hardware certification.
const perf=[];
for(const name of ['single','ABC']){
  const rig=parseRig(await readFile(resolve(input,`${name}.native.json`),'utf8'));
  for(const profile of ['LegacyT839','ReplayV1']){
    const samples=[];
    for(let run=0;run<55;run++){
      const start=performance.now();
      if(profile==='LegacyT839'){
        const state=createEvaluationState();for(let i=1;i<=120;i++)evaluate(rig,[],{state,deltaSeconds:1/120});
      }else{
        const s=new ReplayPhysicsInstance(rig,1n,[]),ctx=s.context;
        s.requestTick(ctx,120n,()=>[],()=>{});s.pump(ctx,120,()=>[],()=>{});
      }
      if(run>=5)samples.push(performance.now()-start);
    }
    samples.sort((a,b)=>a-b);perf.push({rig:name,profile,runs:50,ticksPerRun:120,medianMs:samples[25],minMs:samples[0],maxMs:samples.at(-1)});
  }
}
await writeFile(resolve(output,'performance.json'),JSON.stringify(perf,null,2));
