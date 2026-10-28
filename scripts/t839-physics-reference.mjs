// Controlled native Rust replay comparison. Known divergences are reported,
// never disguised as parity. No browser, rendering or integrator replacement.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createEvaluationState, evaluate, parseRig} from '../core/dist/index.js';

if (!process.argv[2]) throw Error('Usage: node scripts/t839-physics-reference.mjs <new Rust fixture directory>');
const rows=[];
for (const name of ['single','multiple','parent']) {
  const source=await readFile(resolve(process.argv[2],`${name}.native.json`));
  assert.deepEqual(source,await readFile(new URL(`../core/test/fixtures/t839/${name}.native.json`,import.meta.url)), 'Use the unmodified native export');
  const rig=parseRig(source.toString('utf8'));
  const references=JSON.parse(await readFile(resolve(process.argv[2],`${name}.reference.json`),'utf8'));
  for (const {label,samples} of references) {
    const run=()=>{
      const state=createEvaluationState();
      return samples.map(s=>evaluate(rig,[{animation:'move',time:s.time,alpha:1}],{state,deltaSeconds:s.dt}));
    };
    const poses=run(); assert.deepEqual(poses,run(),'Reset replay must be deterministic');
    let local=0,rotation=0,world=0,first=null;
    samples.forEach((s,i)=>s.bones.forEach((b,j)=>{
      const p=poses[i].bones[j]; assert.equal(p.name,b.name);
      const dl=Math.max(Math.abs(p.x-b.x),Math.abs(p.y-b.y));
      const dr=Math.abs(p.rotation-b.rotation);
      const dw=Math.max(...Object.keys(b.world).map(k=>Math.abs(p.world[k]-b.world[k])));
      assert.ok(Number.isFinite(dl+dr+dw),'Reference and runtime must remain finite');
      local=Math.max(local,dl);rotation=Math.max(rotation,dr);world=Math.max(world,dw);
      if(first===null&&Math.max(dl,dr,dw)>.01)first={sample:i,bone:b.name,time:s.time};
    }));
    // One constraint at 60Hz has neither cap nor shared-remainder ambiguity.
    if(name!=='multiple'&&label==='60fps')assert.ok(Math.max(local,rotation,world)<.01,'Bounded 60Hz parity regression');
    rows.push({fixture:name,sequence:label,samples:samples.length,resetReplay:'PASS',maxLocalUnits:local,maxRotationRadians:rotation,maxWorldComponent:world,withinPoint01:Math.max(local,rotation,world)<.01,firstDifference:first});
  }
}
console.log(JSON.stringify({scope:'Numerical controlled replays only; no adapter physics qualification',rows},null,2));
