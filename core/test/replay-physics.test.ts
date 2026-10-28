import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ReplayPhysicsInstance, parseRig, ReplayError, ClockError } from "../src/index.js";
import type { RuntimeRigData, ReplayFrame, ReplayLocal } from "../src/index.js";

test("ReplayV1 performs one whole-instance tick after explicit priming",()=>{
  const rig=parseRig(JSON.parse(readFileSync("test/fixtures/t839/single.native.json","utf8")));
  const instance=new ReplayPhysicsInstance(rig,1n,[]);
  const context=instance.context;
  const p=instance.requestTick(context,1n,()=>[],()=>{});
  assert.equal(p.state.completed,1n);
  const r=instance.frame().records[0]!;
  assert.ok(Math.abs(r.rotationVelocity-(10/120)*Math.exp(-.5*12/120))<1e-12,"exactly one spring step");
});

const load=(name:string)=>parseRig(JSON.parse(readFileSync(`test/fixtures/t840b3/${name}.native.json`,"utf8")));
function inputs(rig:RuntimeRigData,tick:bigint,motion:boolean):ReplayLocal[]{
  return rig.bones.map(b=>({name:b.name,x:b.x+(motion&&b.parent<0?50+Number(tick%16n)*.25:0),y:b.y+(motion&&b.parent<0?-20+Number((tick/4n)%8n)*.125:0),
    rotation:b.rotation*Math.PI/180+(motion&&b.parent<0?(Number(tick%8n)-4)*.01:0),scaleX:b.scaleX,scaleY:b.scaleY,shearX:b.shearX*Math.PI/180,shearY:b.shearY*Math.PI/180}));
}
function trace(rig:RuntimeRigData,hz:number,motion:boolean,hitch=false):ReplayFrame[]{
  const s=new ReplayPhysicsInstance(rig,1n,inputs(rig,0n,motion)),ctx=s.context;
  const frames=[s.frame()];const provider=(t:{index:bigint})=>inputs(rig,t.index,motion);const observe=(f:ReplayFrame)=>frames.push(f);
  if(hitch){
    const p=s.requestTime(ctx,1n,2n,provider,observe);assert.equal(p.processed,8);assert.equal(p.state.backlog,52n);assert.equal(s.frame().tick,8n);
    const snapshot=s.frame();const same=s.requestTime(ctx,2n,4n,()=>{throw Error("unexpected provider")},()=>{throw Error("unexpected observer")});
    assert.equal(same.processed,0);assert.deepEqual(s.frame(),snapshot);
    s.pump(ctx,7,provider,observe);s.pump(ctx,45,provider,observe);
  }else{
    for(let i=1;i<=hz;i++)s.requestTime(ctx,BigInt(i),BigInt(hz),provider,observe);
    s.pump(ctx,128,provider,observe);
  }
  assert.equal(s.frame().tick,s.clock().completed);return frames;
}
test("ReplayV1 independent springs retain exact states and poses in any order",()=>{
  const all=["A","B","AB","BA","ABC"].map(n=>trace(load(n),144,false));
  for(const [constraint,bone,reference] of [["spring-A","A",0],["spring-B","B",1]] as const){
    const records=(frames:ReplayFrame[])=>frames.map(f=>f.records.find(r=>r.constraint===constraint));
    const poses=(frames:ReplayFrame[])=>frames.map(f=>f.pose.bones.find(b=>b.name===bone));
    for(const other of all.slice(2)){assert.deepEqual(records(other),records(all[reference]!));assert.deepEqual(poses(other),poses(all[reference]!));}
  }
});
test("ReplayV1 all exact cadences and hitches preserve each per-tick trajectory",()=>{
  for(const name of ["AB","ABC","single","parent","multiple","dependent-reversed"]){
    for(const motion of [false,true]){
      const rig=load(name),baseline=trace(rig,120,motion);
      for(const hz of [30,60,120,144])assert.deepEqual(trace(rig,hz,motion),baseline,`${name}/${motion}/${hz}`);
      assert.deepEqual(trace(rig,120,motion,true),baseline.slice(0,61));
    }
  }
  assert.notDeepEqual(trace(load("multiple"),120,true),trace(load("dependent-reversed"),120,true));
});
test("ReplayV1 context identity, reset and recreation are instance-local",()=>{
  const rig=load("AB"),a=new ReplayPhysicsInstance(rig,1n,[]),b=new ReplayPhysicsInstance(rig,1n,[]);
  const old=a.context,other=b.context,initial=a.clock();
  assert.throws(()=>a.requestTick(other,1n,()=>[],()=>{}),ReplayError);assert.deepEqual(a.clock(),initial);
  assert.throws(()=>a.requestTime(old,(1n<<64n)-1n,1n,()=>[],()=>{}),ClockError);assert.deepEqual(a.clock(),initial);assert.equal(a.faulted,false);
  b.requestTick(other,3n,()=>[],()=>{});const retained=b.frame();
  a.reset(rig,2n,[]);assert.throws(()=>a.requestTick(old,1n,()=>[],()=>{}),ReplayError);assert.deepEqual(b.frame(),retained);
  b.requestTick(other,120n,()=>[],()=>{});b.pump(other,128,()=>[],()=>{});
  assert.deepEqual(b.frame(),trace(rig,120,false).at(-1),"B continues after A reset");
  const recreated=new ReplayPhysicsInstance(rig,1n,[]);assert.throws(()=>b.pump(recreated.context,1,()=>[],()=>{}),ReplayError);
});
test("ReplayV1 provider failure keeps completed prefix and requires explicit reset",()=>{
  const rig=load("AB"),s=new ReplayPhysicsInstance(rig,1n,[]),ctx=s.context;
  const p=s.requestTick(ctx,4n,t=>{if(t.index===3n)throw Error("provider");return [];},()=>{});
  assert.equal(p.stop.kind,"failed");assert.equal(s.clock().completed,2n);assert.equal(s.frame().tick,2n);assert.equal(s.faulted,true);
  assert.throws(()=>s.pump(ctx,8,()=>[],()=>{}),ReplayError);
  s.reset(rig,2n,[]);assert.equal(s.frame().tick,0n);assert.equal(s.faulted,false);
});
test("ReplayV1 detects partial numerical failure without publishing a false tick",()=>{
  const rig=load("AB"),second=rig.constraints[1]!;assert.equal(second.type,"physics");
  if(second.type!=="physics")throw Error();second.physics.mass=.01;second.forces.wind_x=Number.MAX_VALUE;
  const s=new ReplayPhysicsInstance(rig,1n,[]);let observed=0;
  const p=s.requestTick(s.context,1n,()=>[],()=>observed++);
  assert.equal(p.stop.kind,"failed");assert.equal(observed,0);assert.equal(s.clock().completed,0n);assert.equal(s.frame().tick,0n);assert.equal(s.faulted,true);
  assert.throws(()=>s.requestTick(s.context,1n,()=>[],()=>{}),ReplayError);
});
test("ReplayV1 snapshots, inputs and contexts cannot alias mutable caller data",()=>{
  const rig=load("AB"),before=JSON.stringify(rig),s=new ReplayPhysicsInstance(rig,1n,[]);
  const ctx=s.context,forged={...ctx};assert.throws(()=>s.requestTick(forged,1n,()=>[],()=>{}),ReplayError);
  const frame=s.frame();frame.pose.bones[0]!.x=999;assert.notEqual(s.frame().pose.bones[0]!.x,999);
  s.requestTick(ctx,1n,()=>[],f=>{f.pose.bones[0]!.x=999;});assert.notEqual(s.frame().pose.bones[0]!.x,999);
  assert.equal(JSON.stringify(rig),before);
  rig.bones[0]!.x=999;assert.notEqual(s.frame().pose.bones[0]!.x,999);
});
test("ReplayV1 rejects malformed references, order, inputs and reentrant mutation",()=>{
  const rig=load("AB");rig.constraintOrder.push(rig.constraintOrder[0]!);assert.throws(()=>new ReplayPhysicsInstance(rig,1n,[]),ReplayError);
  const invalid=load("AB");invalid.constraints[0]!.target="missing";assert.throws(()=>new ReplayPhysicsInstance(invalid,1n,[]));
  const s=new ReplayPhysicsInstance(load("AB"),1n,[]),ctx=s.context;
  s.requestTick(ctx,1n,()=>{assert.throws(()=>s.reset(load("AB"),2n,[]),ReplayError);return [];},()=>{});
  const p=s.requestTick(ctx,2n,()=>[{...inputs(load("AB"),0n,false)[0]!,x:NaN}],()=>{});
  assert.equal(p.stop.kind,"failed");assert.equal(s.clock().completed,1n);assert.equal(s.faulted,true);
});

test("ReplayV1 fixed default skin membership and zero mix do not consume extra time",()=>{
  const rig=load("AB");rig.skins.push({name:"inactive",bones:[],constraints:["spring-B"],attachments:[]});
  rig.constraints[0]!.mix=0;
  const s=new ReplayPhysicsInstance(rig,1n,[]),c=s.context;
  s.requestTick(c,1n,()=>[],()=>{});
  assert.deepEqual(s.frame().records.map(r=>r.constraint),["spring-A"]);
  assert.ok(s.frame().records[0]!.rotation>0);assert.equal(s.frame().pose.bones.find(b=>b.name==="A")!.rotation,0);
  const mixed=load("AB");mixed.constraints[0]!.type="ik";
  assert.throws(()=>new ReplayPhysicsInstance(mixed,1n,[]));
});
