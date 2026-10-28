import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ReplayPhysicsInstance,ReplayConsumerBridge,parseRig} from "../src/index.js";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
test("second constraint failure restores private records, not only public frame",()=>{
 const rig=parseRig(readFileSync("test/fixtures/t840b6/independent.native.json","utf8")),s=new ReplayPhysicsInstance(rig,1n,[]);
 const before=s.numericalState(),frame=s.frame(),b=rig.bones.find(b=>b.name==="pivot-B")!;
 const result=s.requestTick(s.context,1n,()=>[{name:b.name,x:b.x,y:b.y,rotation:b.rotation*Math.PI/180,scaleX:0,scaleY:b.scaleY,shearX:b.shearX*Math.PI/180,shearY:b.shearY*Math.PI/180}],()=>assert.fail("refused frame must not be observed"));
 assert.equal(result.stop.kind,"failed");assert.equal(s.clock().completed,0n);assert.equal(s.clock().backlog,1n);assert.deepEqual(s.frame(),frame);
 console.log(JSON.stringify({before,after:s.numericalState()}));assert.deepEqual(s.numericalState(),before,"private state changed after A succeeded and B failed");
});
test("test-only sidecar injects post-solver and nested observer faults without production hooks",()=>{
 const dir=mkdtempSync(join(tmpdir(),"ankhimate-b6-private-"));
 const result=spawnSync(process.execPath,["../scripts/t840b6/private-faults.mjs",join(dir,"proof")],{encoding:"utf8",maxBuffer:2*1024*1024});
 assert.equal(result.status,0,result.stderr+result.stdout);
 const proof=JSON.parse(readFileSync(join(dir,"proof/results.json"),"utf8"));assert.equal(proof.rows.length,54);assert.ok(proof.rows.every((r:{status:string})=>r.status==="PASS"));
});
test("three successful ticks in a failing request remain committed; intent is retained",()=>{
 const rig=parseRig(readFileSync("test/fixtures/t840b6/independent.native.json","utf8")),s=new ReplayPhysicsInstance(rig,1n,[]),control=new ReplayPhysicsInstance(rig,1n,[]);control.requestTick(control.context,3n,()=>[],()=>{});
 const b=rig.bones.find(b=>b.name==="pivot-B")!,bad={name:b.name,x:b.x,y:b.y,rotation:b.rotation*Math.PI/180,scaleX:0,scaleY:b.scaleY,shearX:b.shearX*Math.PI/180,shearY:b.shearY*Math.PI/180};
 const p=s.requestTick(s.context,60n,t=>t.index===4n?[bad]:[],()=>{});
 assert.equal(p.stop.kind,"failed");assert.equal(p.processed,3);assert.equal(s.clock().requested,60n);assert.equal(s.clock().completed,3n);assert.equal(s.clock().backlog,57n);assert.equal(s.faulted,true);assert.deepEqual(s.numericalState(),control.numericalState());assert.deepEqual(s.frame(),control.frame());
});
test("finite but unrepresentable negative force case fails native integration after A",()=>{
 // Deliberate negative runtime input, not a patched positive export/parity fixture.
 const rig=parseRig(readFileSync("test/fixtures/t840b6/independent.native.json","utf8"));const b=rig.constraints.find(c=>c.name==="spring-B")!;
 if(b.type!=="physics")assert.fail("physics fixture");b.forces.wind_x=Number.MAX_VALUE;b.physics.mass=0.01;
 const s=new ReplayPhysicsInstance(rig,1n,[]),before=s.numericalState(),frame=s.frame();
 const p=s.requestTick(s.context,1n,()=>[],()=>assert.fail("nonfinite candidate must not publish"));assert.equal(p.stop.kind,"failed");assert.deepEqual(s.numericalState(),before);assert.deepEqual(s.frame(),frame);assert.equal(s.clock().completed,0n);assert.equal(s.faulted,true);
});
test("precommit skin audit sees old committed bridge data, then clock and pose advance together",()=>{
 const rig=parseRig(readFileSync("test/fixtures/t840b6/independent.native.json","utf8")),b=new ReplayConsumerBridge(rig,"breathing",1n,[{tick:0n,skin:"on"},{tick:9n,skin:"off"}]);b.play(b.context,"breathing",false);b.requestTick(b.context,8n);
 const before=b.currentFrame();assert.equal(before.skin,"on");
 b.requestTick(b.context,9n,candidate=>{
  assert.equal(candidate.tick,9n);assert.equal(candidate.records.length,1);
  for(let i=0;i<100;i++)assert.deepEqual(b.currentFrame(),{...before,requested:9n,backlog:1n,targetReached:false});
 });
 assert.equal(b.currentFrame().poseTick,9n);assert.equal(b.currentFrame().completed,9n);assert.equal(b.currentFrame().skin,"off");assert.equal(b.currentFrame().records.length,1);assert.equal(before.poseTick,8n);
});
