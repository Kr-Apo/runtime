import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ReplayConsumerBridge,parseRig} from "../src/index.js";
import type {SkinEvent} from "../src/index.js";
const events:SkinEvent[]=[{tick:0n,skin:"on"},{tick:120n,skin:"off"},{tick:240n,skin:"on"}];
const rig=()=>parseRig(readFileSync("test/fixtures/t840b5b1/control.native.json","utf8"));
const create=()=>new ReplayConsumerBridge(rig(),"breathing",1n,events);
test("consumer snapshot belongs to completed tick, not future target",()=>{
 const rig=parseRig(readFileSync("test/fixtures/t840b5b1/control.native.json","utf8"));
 const b=new ReplayConsumerBridge(rig,"breathing",1n);b.play(b.context,"breathing",false);
 b.requestTick(b.context,60n);const f=b.currentFrame();
 assert.deepEqual([f.requested,f.completed,f.backlog,f.poseTick],[60n,8n,52n,8n]);assert.equal(f.targetReached,false);
});
test("seek publishes a separate pure preview, never as a committed frame",()=>{
 const b=create();b.play(b.context,"breathing",false);b.requestTick(b.context,60n);
 b.seekTick(b.context,180n);const f=b.currentFrame(),p=b.previewFrame()!;
 assert.equal(f.poseTick,0n);assert.equal(f.completed,0n);assert.equal(f.skin,"on");assert.equal(p.tick,180n);assert.equal(p.skin,"off");assert.equal(p.epoch,f.epoch);
 assert.throws(()=>b.resume(b.context));b.replayFromOrigin(b.context,360n);assert.equal(b.previewFrame(),null);
 while(b.transportStatus().clock!.backlog)b.pump(b.context,64);
 assert.equal(b.currentFrame().skin,"on");assert.equal(b.currentFrame().poseTick,360n);
});
test("hundred redraws, detached snapshots and failed presentation cannot advance",()=>{
 const b=create();b.play(b.context,"breathing",false);b.requestTick(b.context,150n);b.pump(b.context,110);b.pause(b.context);
 const before=b.currentFrame();assert.equal(before.poseTick,118n);assert.equal(before.skin,"on");
 for(let n=0;n<100;n++){assert.deepEqual(b.currentFrame(),before);b.present(f=>assert.deepEqual(f,before));}
 assert.throws(()=>b.present(()=>{throw Error("renderer failed");}));assert.deepEqual(b.currentFrame(),before);
 b.present(()=>assert.throws(()=>b.resume(b.context)));
 const copy=b.currentFrame();copy.bones[0]!.x=999;copy.bones[0]!.world.tx=999;assert.deepEqual(b.currentFrame(),before);
 b.resume(b.context);b.pump(b.context,1);assert.equal(b.currentFrame().skin,"on");b.pump(b.context,1);assert.equal(b.currentFrame().poseTick,120n);assert.equal(b.currentFrame().skin,"off");
});
test("faulted controller retains only committed data and requires reset",()=>{
 const b=create();b.play(b.context,"breathing",false);b.requestTick(b.context,118n);b.pump(b.context,110);const old=b.context,before=b.currentFrame();
 const p=b.requestTick(b.context,150n,f=>{if(f.tick===120n)throw Error("audit failure");});
 assert.equal(p.stop.kind,"failed");const f=b.currentFrame();assert.equal(f.poseTick,119n);assert.equal(f.completed,119n);assert.equal(f.skin,"on");assert.equal(f.health,"faulted");assert.equal(f.targetReached,false);
 assert.throws(()=>b.pump(b.context,1));assert.throws(()=>b.resume(b.context));b.reset(b.context,2n);assert.throws(()=>b.play(old,"breathing",false));assert.equal(b.currentFrame().health,"healthy");
 assert.notEqual(before.context,b.context);b.dispose(b.context);assert.throws(()=>b.currentFrame());assert.throws(()=>b.previewFrame());assert.throws(()=>b.reset(b.context,3n));
});
test("independent owners and repeated exact updates preserve identity and debt",()=>{
 const shared=rig(),a=new ReplayConsumerBridge(shared,"breathing",1n,events),b=new ReplayConsumerBridge(shared,"breathing",1n,events);
 assert.throws(()=>a.play(b.context,"breathing",false));for(const t of[a,b])t.play(t.context,"breathing",false);
 a.requestTime(a.context,1n,2n);const debt=a.currentFrame();a.requestTime(a.context,2n,4n);assert.deepEqual(a.currentFrame(),debt);
 b.requestTick(b.context,360n);b.pump(b.context,352);a.pause(a.context);a.reset(a.context,2n);assert.equal(b.currentFrame().completed,360n);
 const before=b.currentFrame();for(const bad of [()=>b.requestTime(b.context,1n,0n),()=>b.requestTick(b.context,1n),()=>b.pump(b.context,0)]){assert.throws(bad);assert.deepEqual(b.currentFrame(),before);}
 const held=b.currentFrame();b.stop(b.context);assert.equal(b.currentFrame().completed,0n);assert.equal(held.completed,360n);
});
test("bounded catch-up cancellation is explicit pause between whole committed pumps",()=>{
 const b=create();b.play(b.context,"breathing",false);b.requestTick(b.context,150n);
 b.pump(b.context,1);b.pause(b.context);const paused=b.currentFrame();assert.equal(paused.completed,9n);assert.equal(paused.backlog,141n);assert.throws(()=>b.pump(b.context,64));assert.deepEqual(b.currentFrame(),paused);
 b.resume(b.context);while(b.currentFrame().backlog)b.pump(b.context,1);assert.equal(b.currentFrame().completed,150n);assert.equal(b.currentFrame().skin,"off");
});
