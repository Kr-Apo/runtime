// Same-process control avoids interpreting machine drift as transaction speedup.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {ReplayPhysicsInstance,parseRig} from '../../core/dist/index.js';
const baseline=process.argv[2],out=resolve(process.argv[3]??'');if(!baseline||!process.argv[3])throw Error('paired-performance.mjs <verified baseline TS source> <new output>');await mkdir(out);
const source=await readFile(baseline,'utf8'),compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const baseURL=new URL('../../core/dist/replay-physics.js',import.meta.url),code=compiled.replace(/from "(\.[^"]+)"/g,(_,p)=>`from "${new URL(p,baseURL).href}"`),file=resolve(out,'baseline.mjs');await writeFile(file,code,{flag:'wx'});
const {ReplayPhysicsInstance:Baseline}=await import(pathToFileURL(file).href),rows=[];
for(const name of ['single','independent','medium','many']){
 const rig=parseRig(await readFile(new URL(`../../core/test/fixtures/t840b6/${name}.native.json`,import.meta.url),'utf8'));
 for(const ticks of [120n,1200n]){
  const samples={baseline:[],transaction:[]};let a,b;
  for(let repeat=0;repeat<13;repeat++)for(const kind of repeat%2?['transaction','baseline']:['baseline','transaction']){
   const s=kind==='baseline'?new Baseline(rig,1n,[]):new ReplayPhysicsInstance(rig,1n,[]),start=performance.now();s.requestTick(s.context,ticks,()=>[],()=>{});while(s.clock().backlog)s.pump(s.context,128,()=>[],()=>{});const duration=performance.now()-start;
   if(repeat>=3)samples[kind].push(duration);if(kind==='baseline')a=s;else b=s;
  }
  assert.deepEqual(a.frame(),b.frame());assert.deepEqual(a.numericalState(),b.numericalState());assert.deepEqual(a.clock(),b.clock());
  for(const values of Object.values(samples))values.sort((a,b)=>a-b);
  const summary=Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,{medianMs:v[v.length>>1],minMs:v[0],maxMs:v.at(-1),samplesMs:v}]));rows.push({rig:name,bones:rig.bones.length,constraints:rig.constraints.length,ticks:String(ticks),...summary});
 }
}
await writeFile(resolve(out,'results.json'),JSON.stringify({node:process.version,baselineSHA256:createHash('sha256').update(source).digest('hex'),typescript:ts.version,method:'alternating same-process direct B3, successful output exact',rows},null,2),{flag:'wx'});console.log(JSON.stringify(rows));
