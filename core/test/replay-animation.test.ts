import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ReplayAnimationInstance, ReplayPhysicsInstance, canonicalTime, MAX_SAMPLE_TICK, parseRig, evaluate } from "../src/index.js";

test("canonical clip supplies every executed tick",()=>{
  const rig=parseRig(readFileSync("test/fixtures/t840b4/idle.native.json","utf8"));
  const s=new ReplayAnimationInstance(rig,"breathing",1n), ticks:bigint[]=[];
  s.requestTick(s.context,60n,f=>ticks.push(f.tick));s.pump(s.context,120,f=>ticks.push(f.tick));
  assert.deepEqual(ticks,Array.from({length:60},(_,i)=>BigInt(i+1)));
  assert.equal(s.clock().completed,60n);
});

const load=(name="idle")=>parseRig(readFileSync(`test/fixtures/t840b4/${name}.native.json`,"utf8"));
function run(name:string,hz=144){
  const s=new ReplayAnimationInstance(load(name),"breathing",1n),frames=[s.frame()];
  for(let n=1;n<=hz*4;n++)s.requestTime(s.context,BigInt(n),BigInt(hz),f=>frames.push(f));
  s.pump(s.context,1024,f=>frames.push(f));return frames;
}
test("all seven independent channels reuse native evaluator and retain setup",()=>{
 const rig=load("parent"),s=new ReplayAnimationInstance(rig,"breathing",1n);
 for(const tick of [0n,1n,29n,30n,31n,59n,60n,61n,95n,96n,97n,120n,121n,480n]){
  assert.deepEqual(s.sampleTick(tick),evaluate(rig,[{animation:"breathing",time:canonicalTime(tick,1,false),alpha:1}]));
  const p=s.sampleTick(tick);for(const i of [2,3,4]){assert.equal(p.bones[i]!.x,rig.bones[i]!.x);assert.equal(p.bones[i]!.scaleY,rig.bones[i]!.scaleY);}
 }
 const idle=new ReplayAnimationInstance(load(),"breathing",1n);assert.notDeepEqual(idle.sampleTick(15n),idle.sampleTick(0n));
 for(const name of ["idle","parent","loop","A","B","AB","ABC","CBA","angles"]){
  const rig=load(name),clip=new ReplayAnimationInstance(rig,"breathing",1n);
  const direct=new ReplayPhysicsInstance(rig,1n,clip.sampleTick(0n).bones),actual=[direct.frame()];
  direct.requestTick(direct.context,480n,t=>clip.sampleTick(t.index).bones,f=>actual.push(f));
  direct.pump(direct.context,1024,t=>clip.sampleTick(t.index).bones,f=>actual.push(f));
  assert.deepEqual(actual,run(name),"optimized provider must equal full pure pose inputs at every tick");
 }
});
test("loop boundaries, fractional duration, zero duration, hold and time limits",()=>{
 assert.equal(canonicalTime(120n,1,true),0);assert.equal(canonicalTime(121n,1,false),1);assert.equal(canonicalTime(50n,0,true),0);
 assert.equal(canonicalTime(100n,.83,true),Math.fround((100/120)%Math.fround(.83)));
 assert.throws(()=>canonicalTime(MAX_SAMPLE_TICK+1n,1,true));assert.throws(()=>canonicalTime(-1n,1,true));
 assert.throws(()=>canonicalTime(1n,Infinity,true));assert.throws(()=>canonicalTime(1n,1e300,true));
 const rig=load();rig.animations.breathing!.duration=0;
 const s=new ReplayAnimationInstance(rig,"breathing",1n);assert.deepEqual(s.sampleTick(0n),s.sampleTick(480n));
 const frames=run("idle");assert.ok(frames[120]!.records.some(r=>Math.abs(r.rotationVelocity)>1e-6));
 assert.notDeepEqual(frames[120]!.records,frames[0]!.records,"loop does not reset springs");
 const instance=new ReplayAnimationInstance(load(),"breathing",1n);assert.throws(()=>instance.requestTick(instance.context,MAX_SAMPLE_TICK+1n,()=>{}));assert.equal(instance.clock().requested,0n);
});
test("cadences and hitches produce bit-identical trajectories",()=>{
 for(const name of ["idle","parent","loop"]){
  const expected=run(name);for(const hz of [30,60,120])assert.deepEqual(run(name,hz),expected);
  const s=new ReplayAnimationInstance(load(name),"breathing",1n),frames=[s.frame()];
  for(let n=1;n<=8;n++){
   const p=s.requestTime(s.context,BigInt(n),2n,f=>frames.push(f));assert.equal(p.state.backlog,52n);
   assert.equal(s.requestTime(s.context,BigInt(2*n),4n,()=>assert.fail()).processed,0);
   s.pump(s.context,7,f=>frames.push(f));s.pump(s.context,45,f=>frames.push(f));
  }
  assert.deepEqual(frames,expected);
 }
});
test("animated independent springs survive order, reset and repeat",()=>{
 const traces=["A","B","AB","ABC","CBA"].map(n=>run(n));
 for(let t=0;t<=480;t++)for(const [name,source]of [["spring-A",0],["spring-B",1]]as const){
  const expected=traces[source]![t]!.records.find(r=>r.constraint===name)!;
  for(const i of [2,3,4]){assert.deepEqual(traces[i]![t]!.records.find(r=>r.constraint===name),expected);assert.deepEqual(traces[i]![t]!.pose.bones.find(b=>b.name===expected.bone),traces[source]![t]!.pose.bones.find(b=>b.name===expected.bone));}
 }
 const rig=load("loop"),s=new ReplayAnimationInstance(rig,"breathing",1n),old=s.context;
 s.requestTick(old,480n,()=>{});s.pump(old,1024,()=>{});const end=s.frame();s.reset(rig,"breathing",2n);
 assert.throws(()=>s.requestTick(old,1n,()=>{}));s.requestTick(s.context,480n,()=>{});s.pump(s.context,1024,()=>{});assert.deepEqual(s.frame(),end);
});
test("invalid clips and unsupported channels refuse before simulation",()=>{
 assert.throws(()=>new ReplayAnimationInstance(load(),"absent",1n));
 for(const mutate of [
  (r:ReturnType<typeof load>)=>{r.animations.breathing!.bones[0]!.name="absent";},
  (r:ReturnType<typeof load>)=>{r.animations.breathing!.bones.push(r.animations.breathing!.bones[0]!);},
  (r:ReturnType<typeof load>)=>{r.animations.breathing!.bones[0]!.translate_x![0]!.value=NaN;},
  (r:ReturnType<typeof load>)=>{r.animations.breathing!.bones[0]!.rotate![1]!.time=Infinity;},
  (r:ReturnType<typeof load>)=>{r.animations.breathing!.bones[0]!.rotate![1]!.time=0;},
  (r:ReturnType<typeof load>)=>{r.animations.breathing!.bones[0]!.rotate![0]!.curve={type:"bezier",handles:[-1,0,1,1]};},
  (r:ReturnType<typeof load>)=>{r.animations.breathing!.events.push({time:0,name:"event"});},
  (r:ReturnType<typeof load>)=>{r.animations.breathing!.slots.push({name:"slot",channel:"visible",keys:[]});},
  (r:ReturnType<typeof load>)=>{r.constraints[0]!.type="ik";},
  (r:ReturnType<typeof load>)=>{r.bones[0]!.parent=99;},
  (r:ReturnType<typeof load>)=>{r.animations.breathing!.duration=-1;},
  (r:ReturnType<typeof load>)=>{r.bones[0]!.x=NaN;},
 ]){const rig=load();mutate(rig);assert.throws(()=>new ReplayAnimationInstance(rig,"breathing",1n));}
 const v1=parseRig(readFileSync("test/fixtures/t839/single.native.json","utf8"));delete v1.format_version;assert.throws(()=>new ReplayAnimationInstance(v1,"breathing",1n));
});
test("snapshots, context identity, faults, last pose and reset stay isolated",()=>{
 const rig=load(),before=structuredClone(rig),s=new ReplayAnimationInstance(rig,"breathing",1n),other=new ReplayAnimationInstance(rig,"breathing",1n);
 assert.throws(()=>s.requestTick(other.context,1n,()=>{}));assert.equal(s.clock().completed,0n);
 rig.bones[0]!.x=999;assert.notEqual(s.sampleTick(1n).bones[0]!.x,999);
 const p=s.sampleTick(1n);p.bones[0]!.x=888;assert.notEqual(s.sampleTick(1n).bones[0]!.x,888);
 s.requestTick(s.context,1n,()=>{assert.throws(()=>s.reset(before,"breathing",2n),/busy/);throw Error("observer failure");});
 assert.equal(s.clock().completed,0n);assert.equal(s.frame().tick,0n);assert.equal(s.faulted,true);assert.throws(()=>s.requestTick(s.context,1n,()=>{}));
 other.requestTick(other.context,1n,()=>{});assert.equal(other.clock().completed,1n);
 s.reset(before,"breathing",2n);s.requestTick(s.context,1n,()=>{});assert.equal(s.clock().completed,1n);
 const direct=new ReplayPhysicsInstance(before,1n,s.sampleTick(0n).bones);
 direct.requestTick(direct.context,1n,t=>s.sampleTick(t.index).bones,()=>{});assert.deepEqual(direct.frame(),s.frame());
 assert.deepEqual(before,load());
});
