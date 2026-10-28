// Test-only schedule experiment over shipped evaluate; NOT a production adapter.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseRig,evaluate,createEvaluationState} from '../../core/dist/index.js';
import {ClockModel} from './clock-model.mjs';
const input=resolve(process.argv[2]??'');if(!process.argv[2]||!process.argv[3])throw Error('Usage: <Rust reference dir> <new result file>');
const limits=JSON.parse(await readFile(new URL('./thresholds.json',import.meta.url),'utf8'));
const flat=p=>p.bones.flatMap(b=>[b.x,b.y,b.rotation,b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty]);
const rows=[];
for(const name of ['single','multiple','parent']){
  const rig=parseRig(await readFile(resolve(input,`${name}.native.json`),'utf8'));
  const refs=JSON.parse(await readFile(resolve(input,`${name}.reference.json`),'utf8'));
  const reference=refs.find(r=>r.scenario==='canonical-120').trace;
  const run=(hz,hitch=false)=>{
    const clock=new ClockModel(),state=createEvaluationState();
    const samples=[flat(evaluate(rig,[{animation:'move',time:0,alpha:1}],{state,deltaSeconds:0}))];
    const tick=n=>samples.push(flat(evaluate(rig,[{animation:'move',time:Math.fround(n/120),alpha:1}],{state,deltaSeconds:1/120})));
    if(hitch){clock.request(1,2,tick);assert.equal(clock.tick,8);clock.request(1,2,tick);assert.equal(clock.tick,8);while(clock.tick<clock.target)clock.pump(tick);}
    else for(let i=1;i<=hz;i++)clock.request(i,hz,tick);
    return samples;
  };
  const baseline=run(120);
  for(const hz of[30,60,120,144]){
    const samples=run(hz);assert.deepEqual(samples,baseline,'Same TS tick history regardless of display rate');
    const max={localTranslationUnits:0,rotationRadians:0,worldLinearCoefficientAbsolute:0,worldTranslationUnits:0};
    samples.forEach((r,i)=>r.forEach((x,j)=>{
      const k=j%9,field=k<2?'localTranslationUnits':k===2?'rotationRadians':k<7?'worldLinearCoefficientAbsolute':'worldTranslationUnits';
      const delta=x-reference[i][j];const error=k===2?Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta))):Math.abs(delta);
      max[field]=Math.max(max[field],error);
    }));
    for(const k of Object.keys(max))assert.ok(max[k]<=limits[k],`${name}/${hz}/${k}: ${max[k]}`);
    rows.push({fixture:name,displayHz:hz,ticks:120,identicalTsTickHistory:true,max,status:'WITHIN_DECLARED_THRESHOLDS'});
  }
  const hitch=run(60,true);assert.deepEqual(hitch,baseline.slice(0,61));
  rows.push({fixture:name,scenario:'half-second hitch, explicit drain',ticks:60,zeroDtDrained:false,identicalToContinuousTickPrefix:true,status:'PASS_SCHEDULE_EXPERIMENT_ONLY'});
}
await writeFile(resolve(process.argv[3]),JSON.stringify({scope:'Shadow test model only. No shipping transport, solver, cap or lifecycle changed; does not certify long-run/clip/skin/safety behavior.',rows},null,2),{flag:'wx'});
console.log(JSON.stringify(rows,null,2));
