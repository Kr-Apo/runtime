import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ReplayTransport,ReplayAnimationInstance,parseRig,MAX_SAMPLE_TICK} from "../src/index.js";
import type {TransportContext,ReplayFrame} from "../src/index.js";
const rig=(name="loop")=>parseRig(readFileSync(`test/fixtures/t840b5a/${name}.native.json`,"utf8"));
test("transport pause preserves requested debt without work",()=>{
 const t=new ReplayTransport(rig(),"breathing",1n),c=t.context;
 assert.equal(t.snapshot().state,"stopped");t.play(c,"breathing",false);
 t.requestTime(c,1n,2n,()=>{});t.pause(c);const before=t.snapshot();
 assert.equal(before.clock!.completed,8n);assert.equal(before.clock!.backlog,52n);
 for(let i=0;i<20;i++){t.pause(c);assert.deepEqual(t.snapshot(),before);t.frame();}
 assert.throws(()=>t.pump(c,52,()=>{}));assert.deepEqual(t.snapshot(),before);
 t.resume(c);t.pump(c,52,()=>{});assert.equal(t.snapshot().clock!.completed,60n);
});

interface Op {op:string;context?:string;name?:string;clip?:string;restart?:boolean;epoch?:string;n?:string;d?:string;tick?:string;budget?:number;error?:boolean}
function current(t:ReplayTransport){try{return t.frame();}catch{return null;}}
function simulate(name:string,ops:Op[]){
 const source=rig(name),t=new ReplayTransport(source,"breathing",1n),tokens=new Map<string,TransportContext>(),frames:ReplayFrame[]=[];
 for(const [i,o]of ops.entries()){
  const c=o.context?tokens.get(o.context)!:t.context,before={snapshot:t.snapshot(),frame:current(t)};
  let error=false;
  try{
   switch(o.op){
    case"play":t.play(c,o.clip!,o.restart!);break;
    case"pause":t.pause(c);break;case"resume":t.resume(c);break;case"stop":t.stop(c);break;
    case"reset":t.reset(c,BigInt(o.epoch!));break;case"seek":t.seekTime(c,BigInt(o.n!),BigInt(o.d!));break;
    case"replay":t.replayTo(c,BigInt(o.tick!));break;
    case"request":assert.notEqual(t.requestTime(c,BigInt(o.n!),BigInt(o.d!),f=>frames.push(f)).stop.kind,"failed");break;
    case"pump":assert.notEqual(t.pump(c,o.budget!,f=>frames.push(f)).stop.kind,"failed");break;
    case"capture":tokens.set(o.name!,c);break;
    case"observe":for(let n=0;n<20;n++)assert.deepEqual({snapshot:t.snapshot(),frame:current(t)},before);break;
    case"crossfade":t.crossFade(c,"held",.25);break;case"skin":t.setSkin(c,"default");break;case"rest_start":t.startFromPreview(c);break;case"dispose":t.dispose(c);break;
    default:assert.fail(o.op);
   }
  }catch{error=true;}
  assert.equal(error,o.error??false,`${i} ${JSON.stringify(o)}`);
  if(error)assert.deepEqual({snapshot:t.snapshot(),frame:current(t)},before);
  if(t.snapshot().poseKind==="simulated")assert.equal(t.frame().tick,t.snapshot().clock!.completed);
 }
 return {t,frames};
}
test("130 shared lifecycle/refusal commands are atomic and preserve context identity",()=>{
 const vectors=JSON.parse(readFileSync("test/fixtures/t840b5a/transport-vectors.json","utf8"))as{cases:{name:string;ops:Op[]}[]};
 for(const c of vectors.cases)simulate("loop",c.ops);
 const t=new ReplayTransport(rig(),"breathing",1n),before={s:t.snapshot(),f:t.frame()};
 assert.throws(()=>t.play(t.context,"breathing",undefined as unknown as boolean));
 assert.throws(()=>t.play(t.context,"breathing","false"as unknown as boolean));
 assert.deepEqual({s:t.snapshot(),f:t.frame()},before);
});
test("exact 30/60/120/144Hz and paused hitches produce identical full trajectories",()=>{
 for(const name of ["idle","parent","loop","A","B","AB","ABC","CBA","angles"]){
  let baseline:ReplayFrame[]|undefined;
  for(const hz of [30,60,120,144,0]){
   const ops:Op[]=[{op:"play",clip:"breathing",restart:false}];
   if(hz===0)for(let n=1;n<=10;n++)ops.push({op:"request",n:String(n),d:"2"},{op:"pause"},{op:"observe"},{op:"resume"},{op:"pump",budget:52});
   else for(let n=1;n<=5*hz;n++)ops.push({op:"request",n:String(n),d:String(hz)});
   ops.push({op:"pump",budget:1024});const result=simulate(name,ops);assert.equal(result.frames.length,600);
   if(baseline)assert.deepEqual(result.frames,baseline);else baseline=result.frames;
  }
 }
});
test("historical replay matches all 600 frames, can pause before tick 1 and at tick 137",()=>{
 const source=rig(),t=new ReplayTransport(source,"breathing",1n),c=t.context;t.play(c,"breathing",false);const normal:ReplayFrame[]=[];
 for(let n=1;n<=600;n++)t.requestTick(c,BigInt(n),f=>normal.push(f));
 t.replayTo(c,600n);const next=t.context;assert.equal(t.snapshot().clock!.completed,0n);assert.equal(t.snapshot().clock!.backlog,600n);
 t.pause(next);const before={snapshot:t.snapshot(),frame:t.frame()};assert.throws(()=>t.pump(next,1,()=>{}));assert.deepEqual({snapshot:t.snapshot(),frame:t.frame()},before);t.resume(next);
 const actual:ReplayFrame[]=[];
 for(let n=1;n<=600;n++){t.pump(next,1,f=>actual.push(f));assert.equal(t.snapshot().clock!.completed,BigInt(n));if(n===137){t.pause(next);t.resume(next);}}
 assert.deepEqual(actual,normal);assert.equal(t.snapshot().state,"paused");assert.equal(t.snapshot().replayComplete,true);assert.throws(()=>t.pump(next,1,()=>{}));
 t.resume(next);t.requestTick(next,601n,()=>{});assert.equal(t.snapshot().clock!.completed,601n);
});
test("pure preview clears old simulation, clamps nonlooping clip, rejects implicit continuation",()=>{
 const source=rig(),t=new ReplayTransport(source,"breathing",1n);t.play(t.context,"held",false);const c=t.context;
 t.requestTick(c,600n,()=>{});t.pump(c,1024,()=>{});assert.equal(t.snapshot().clipTime,1);assert.equal(t.snapshot().state,"playing");
 t.seekTime(c,2401n,480n);const s=t.snapshot();assert.equal(s.position,600n);assert.equal(s.clock!.completed,0n);assert.equal(s.poseKind,"pure");assert.equal(s.previewTime!.numerator,2401n);
 assert.deepEqual(t.frame().records,[]);const pure=new ReplayAnimationInstance(source,"held",1n);assert.deepEqual(t.frame().pose,pure.sampleTick(600n));
 assert.throws(()=>t.resume(t.context));assert.throws(()=>t.startFromPreview(t.context));assert.throws(()=>t.play(t.context,"held",false));
 const before={s:t.snapshot(),f:t.frame()};assert.throws(()=>t.seekTick(t.context,MAX_SAMPLE_TICK+1n));assert.deepEqual({s:t.snapshot(),f:t.frame()},before);
 t.play(t.context,"held",true);assert.equal(t.snapshot().position,0n);
});
test("snapshots, pause, reset and faults cannot contaminate another instance",()=>{
 const source=rig(),original=structuredClone(source),a=new ReplayTransport(source,"breathing",1n),b=new ReplayTransport(source,"breathing",1n),ca=a.context,cb=b.context;
 assert.throws(()=>a.play(cb,"breathing",false));assert.throws(()=>a.play({epoch:1n}as TransportContext,"breathing",false));
 a.play(ca,"breathing",false);b.play(cb,"breathing",false);a.requestTick(ca,60n,()=>{});a.pause(ca);const before={s:a.snapshot(),f:a.frame()};
 source.bones[0]!.x=999;const detached=a.frame();detached.pose.bones[0]!.x=888;
 for(let n=1;n<=600;n++)b.requestTick(cb,BigInt(n),()=>{});assert.deepEqual({s:a.snapshot(),f:a.frame()},before);
 a.resume(ca);a.pump(ca,52,f=>{if(f.tick===11n){assert.throws(()=>a.stop(ca),/busy/);throw Error("observer failure");}});
 assert.equal(a.snapshot().state,"faulted");assert.equal(a.snapshot().clock!.completed,10n);assert.equal(a.frame().tick,10n);
 assert.throws(()=>a.resume(ca));assert.throws(()=>a.stop(ca));assert.throws(()=>a.replayTo(ca,60n));const unaffected=b.frame();a.reset(ca,2n);
 assert.throws(()=>a.play(ca,"breathing",false));a.dispose(a.context);assert.equal(a.snapshot().state,"disposed");assert.equal(a.snapshot().clock,null);assert.throws(()=>a.frame());assert.throws(()=>a.reset(ca,3n));assert.deepEqual(b.frame(),unaffected);
 const alone=new ReplayTransport(original,"breathing",1n);alone.play(alone.context,"breathing",false);alone.requestTick(alone.context,600n,()=>{});alone.pump(alone.context,1024,()=>{});assert.deepEqual(alone.frame(),b.frame());
});
test("sampler and Physics failures expose no failed frame and require explicit reset",()=>{
 for(const sampler of [true,false]){
  const source=rig();if(sampler){const keys=source.animations.breathing!.bones[0]!.translate_x!;keys[0]!.value=Number.MAX_VALUE;keys[1]!.value=-Number.MAX_VALUE;}
  else{const p=source.constraints[0]!;assert.equal(p.type,"physics");if(p.type==="physics"){p.forces.wind_x=Number.MAX_VALUE;p.physics.mass=.01;}}
  const t=new ReplayTransport(source,"breathing",1n),c=t.context;t.play(c,"breathing",false);const before=t.frame();
  const p=t.requestTick(c,1n,()=>assert.fail("must not notify failed tick"));assert.equal(p.stop.kind,"failed");assert.equal(t.snapshot().clock!.completed,0n);assert.equal(t.snapshot().state,"faulted");assert.deepEqual(t.frame(),before);
  assert.throws(()=>t.pump(c,1,()=>{}));t.reset(c,2n);assert.equal(t.snapshot().state,"stopped");
 }
});
