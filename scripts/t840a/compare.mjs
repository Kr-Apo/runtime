// Measurement driver only. Calls shipped evaluate; no integrator implementation.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createEvaluationState,evaluate,parseRig} from '../../core/dist/index.js';

const limits=JSON.parse(await readFile(new URL('./thresholds.json',import.meta.url),'utf8'));
const input=resolve(process.argv[2]??'');const output=resolve(process.argv[3]??'');
if(!process.argv[2]||!process.argv[3])throw Error('Usage: node scripts/t840a/compare.mjs <new Rust reference dir> <new result dir>');
await mkdir(output); // Do not overwrite an earlier run.
const plan=JSON.parse(await readFile(resolve(input,'plan.json'),'utf8'));
const rows=[];
const flatten=pose=>pose.bones.flatMap(b=>[b.x,b.y,b.rotation,b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty]);
function replay(source,scenario){
  let rig=structuredClone(source),state=createEvaluationState(),last,time=0,current='move',outgoing,fade=0,skin=rig.defaultSkin;
  const otherInstance=createEvaluationState();
  const trace=[];
  for(const s of scenario.steps){
    switch(s.action){
      case'mix-off':for(const c of rig.constraints)c.mix=0;break;
      case'inactive':skin='inactive';break;
      case'pause':break;
      case'resume':for(const c of rig.constraints)c.mix=1;skin=rig.defaultSkin;break;
      case'play':current='other';outgoing=undefined;state=createEvaluationState();break;
      case'crossfade':outgoing=time;current='other';fade=0;break;
      case'reset':state=createEvaluationState();break;
      case'replace':rig=structuredClone(source);state=createEvaluationState();current='move';outgoing=undefined;skin=rig.defaultSkin;break;
    }
    if(scenario.name==='instances-interleaved')evaluate(rig,[{animation:'move',time:.75,alpha:1}],{state:otherInstance,deltaSeconds:.5});
    let layers=[{animation:current,time:s.time,alpha:1}];
    if(outgoing!==undefined){fade+=s.dt;outgoing+=s.dt;const a=Math.min(1,fade/.5);layers=[{animation:'move',time:outgoing,alpha:1-a},{animation:'other',time:s.time,alpha:a}];}
    // TS core has no paused flag. The real high-level playback freezes its last
    // pose; explicit low-level seek retains state. Separate API tests pin this.
    if(s.action!=='paused'&&s.action!=='pause')last=evaluate(rig,layers,{state,deltaSeconds:s.dt,skin});
    trace.push(flatten(last));time=s.time;
  }
  return trace;
}
function compare(a,b){
  const max={localTranslationUnits:0,rotationRadians:0,worldLinearCoefficientAbsolute:0,worldTranslationUnits:0};let first=null,nonfinite=0;
  assert.equal(a.length,b.length);
  a.forEach((row,step)=>{assert.equal(row.length,b[step].length,'Reference component layout must match');row.forEach((v,j)=>{
    const k=j%9;
    const field=k<2?'localTranslationUnits':k===2?'rotationRadians':k<7?'worldLinearCoefficientAbsolute':'worldTranslationUnits';
    let error=Math.abs(v-b[step][j]);
    if(k===2)error=Math.abs(Math.atan2(Math.sin(v-b[step][j]),Math.cos(v-b[step][j])));
    if(!Number.isFinite(error)){nonfinite++;error=Infinity;}
    max[field]=Math.max(max[field],error);
    if(first===null&&error>limits[field])first={step,bone:Math.floor(j/9),component:k,error};
  });});
  return{max,nonfinite,first,status:first?'DIVERGENCE':'WITHIN_DECLARED_THRESHOLDS'};
}
for(const name of ['single','multiple','parent']){
  const native=await readFile(resolve(input,`${name}.native.json`));
  assert.deepEqual(native,await readFile(new URL(`../../core/test/fixtures/t839/${name}.native.json`,import.meta.url)),'Unchanged genuine T839 bytes');
  const rig=parseRig(native.toString('utf8'));const context=parseRig(await readFile(resolve(input,`${name}-context.native.json`),'utf8'));
  const refs=JSON.parse(await readFile(resolve(input,`${name}.reference.json`),'utf8'));
  const traces=[];
  for(const scenario of plan){
    const source=scenario.context?context:rig;const trace=replay(source,scenario);
    assert.deepEqual(trace,replay(source,scenario),'Repeated fresh-state replay must be deterministic');
    const ref=refs.find(r=>r.scenario===scenario.name).trace;
    rows.push({fixture:name,scenario:scenario.name,samples:trace.length,repeatability:'PASS',...compare(trace,ref)});
    traces.push({scenario:scenario.name,trace});
  }
  const trace=label=>traces.find(r=>r.scenario===label).trace;
  assert.deepEqual(trace('rate-144'),trace('instances-interleaved'),'Other instance must not alter this pose history');
  const repeated=trace('repeated-reset');assert.deepEqual(repeated.slice(0,21),repeated.slice(21,42));assert.deepEqual(repeated.slice(0,21),repeated.slice(42,63));
  await writeFile(resolve(output,`${name}.typescript-trace.json`),JSON.stringify(traces));
}
await writeFile(resolve(output,'results.json'),JSON.stringify({scope:'Current kernels and explicit characterization drivers; not normative transport conformance',limits,rows},null,2));
console.log(JSON.stringify(rows.map(r=>({fixture:r.fixture,scenario:r.scenario,status:r.status,max:r.max})),null,2));
