import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ReplayTransport } from "../src/index.js";
import { ReplayAnimationInstance,ReplayPhysicsInstance,parseRig } from "../src/index.js";
import type { SkinEvent, ReplayFrame } from "../src/index.js";

const load=(name="independent")=>parseRig(readFileSync(`test/fixtures/t840b5b1/${name}.native.json`,"utf8"));
const events=(visual=false):SkinEvent[]=>[{tick:0n,skin:"on"},{tick:120n,skin:visual?"visual":"off"},{tick:240n,skin:"on"},{tick:300n,skin:"partial"},{tick:330n,skin:"on"}];
const create=(name="independent",e=events())=>ReplayTransport.withSkins(load(name),"breathing",1n,e);
test("membership removes records; reactivation primes the moving parent and steps once",()=>{
 const rig=load(),t=create(),v=create("independent",events(true));
 t.play(t.context,"breathing",false);v.play(v.context,"breathing",false);
 for(let n=1n;n<=360n;n++){
  t.requestTick(t.context,n,()=>{});v.requestTick(v.context,n,()=>{});
  const f=t.frame();assert.equal(f.records.some(r=>r.constraint==="spring-A"),!(n>=120n&&n<240n));
  assert.deepEqual(f.records.find(r=>r.constraint==="spring-B"),v.frame().records.find(r=>r.constraint==="spring-B"));
  assert.deepEqual(f.records.map(r=>r.constraint),t.skinAt(n)!.active);
  if(n===240n){
   const input=new ReplayAnimationInstance(rig,"breathing",1n).sampleTick(n).bones.map(({world,...b})=>b);
   const fresh=new ReplayPhysicsInstance(rig,1n,input,[{tick:0n,skin:"on"}]);fresh.requestTick(fresh.context,1n,()=>input,()=>{});
   assert.deepEqual(f.records.find(r=>r.constraint==="spring-A"),fresh.frame().records.find(r=>r.constraint==="spring-A"));
  }
 }
});
test("visual variants retain records and mix zero still advances numerical state",()=>{
 const a=create("independent",events(true)),b=create("independent",[{tick:0n,skin:"on"}]),z=create("zero-mix",events(true));
 for(const t of [a,b,z])t.play(t.context,"breathing",false);
 for(let n=1n;n<300n;n++){
  for(const t of [a,b,z])t.requestTick(t.context,n,()=>{});
  assert.deepEqual(a.frame(),b.frame());assert.deepEqual(a.frame().records.find(r=>r.constraint==="spring-A"),z.frame().records.find(r=>r.constraint==="spring-A"));
 }
 assert.notEqual(z.frame().records[0]!.rotation,0);
 const pure=z.sampleTick(299n).bones.find(b=>b.name==="A")!,post=z.frame().pose.bones.find(b=>b.name==="A")!;assert.deepEqual(post,pure);
});
test("seek is pure; replay, pauses and three resets reproduce the complete trajectory",()=>{
 const t=create("dependent"),expected:ReplayFrame[]=[];t.play(t.context,"breathing",false);
 for(let n=1n;n<=360n;n++)t.requestTick(t.context,n,f=>expected.push(f));
 for(let repeat=0;repeat<3;repeat++){
  t.seekTick(t.context,180n);assert.equal(t.skinAt(t.snapshot().position!)!.skin,"off");assert.equal(t.frame().records.length,0);assert.equal(t.snapshot().clock!.completed,0n);
  t.replayTo(t.context,360n);t.pause(t.context);t.resume(t.context);const actual:ReplayFrame[]=[];
  while(t.snapshot().clock!.backlog)t.pump(t.context,17,f=>actual.push(f));assert.deepEqual(actual,expected);
  t.reset(t.context,t.context.epoch+1n);
 }
});
test("invalid calendars, references, contexts and observer faults cannot replace committed frames",()=>{
 const t=create(),other=create(),old=t.context;
 for(const e of [[],[{tick:1n,skin:"on"}],[{tick:0n,skin:"missing"}],[{tick:0n,skin:"on"},{tick:0n,skin:"off"}],[{tick:0n,skin:"on"},{tick:99999999n,skin:"off"}]] as SkinEvent[][])assert.throws(()=>create("independent",e));
 for(const mutation of [(r:ReturnType<typeof load>)=>r.skins[1]!.constraints.push("missing"),(r:ReturnType<typeof load>)=>r.skins.push(structuredClone(r.skins[1]!)),(r:ReturnType<typeof load>)=>r.defaultSkin=null]){const r=load();mutation(r);assert.throws(()=>ReplayTransport.withSkins(r,"breathing",1n,events()));}
 const r=load();(r.constraints[0] as unknown as {type:string}).type="ik";assert.throws(()=>ReplayTransport.withSkins(r,"breathing",1n,events()));
 t.play(t.context,"breathing",false);t.requestTick(t.context,100n,()=>{});t.pump(t.context,92,()=>{});
 const before={snapshot:t.snapshot(),frame:t.frame()};assert.throws(()=>t.setSkin(t.context,"off"));assert.throws(()=>t.play(other.context,"breathing",false));assert.deepEqual({snapshot:t.snapshot(),frame:t.frame()},before);
 const independent=other.frame();const result=t.requestTick(t.context,101n,()=>{throw Error("observer failure");});assert.equal(result.stop.kind,"failed");assert.equal(t.snapshot().state,"faulted");assert.deepEqual(t.frame(),before.frame);assert.deepEqual(other.frame(),independent);
 t.reset(t.context,2n);assert.throws(()=>t.play(old,"breathing",false));t.dispose(t.context);assert.throws(()=>t.skinAt(0n));assert.throws(()=>t.reset(t.context,3n));
});
test("calendar is privately copied and a backlog event applies at 120, never at 100 or 180",()=>{
 const e=events(),t=create("independent",e);e[1]={tick:1n,skin:"off"};t.play(t.context,"breathing",false);
 t.requestTick(t.context,100n,()=>{});t.pump(t.context,92,()=>{});assert.equal(t.skinAt(t.frame().tick)!.skin,"on");
 t.requestTick(t.context,180n,()=>{});assert.equal(t.frame().tick,108n);assert.equal(t.skinAt(t.frame().tick)!.skin,"on");
 const ticks:bigint[]=[];t.pump(t.context,72,f=>{ticks.push(f.tick);assert.equal(f.records.some(r=>r.constraint==="spring-A"),f.tick<120n);});assert.equal(ticks[11],120n);
});

test("opt-in native skin calendar is resolved at the executed tick",()=>{
 const rig=JSON.parse(readFileSync("test/fixtures/t840b5a/loop.native.json","utf8"));
 const t=ReplayTransport.withSkins(rig,"breathing",1n,[{tick:0n,skin:"default"}]);
 t.play(t.context,"breathing",false);t.requestTick(t.context,180n,()=>{});
 assert.equal(t.skinAt(t.snapshot().position!)!.skin,"default");
});
