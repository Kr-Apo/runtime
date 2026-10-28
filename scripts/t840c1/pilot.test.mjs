import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PilotController,DemoTime,validatePilot} from '../../examples/replay-pixi-pilot/contract.mjs';
import {PixiRigAsset} from '../../pixi/dist/index.js';
const rig=JSON.parse(readFileSync(new URL('../../examples/replay-pixi-pilot/assets/skeleton.json',import.meta.url))),refs=JSON.parse(readFileSync(new URL('../../examples/replay-pixi-pilot/assets/rust-reference.json',import.meta.url)));
function owner(){return new PilotController(validatePilot(rig,'sway'),'sway');}
function drain(p){while(p.frame.backlog>0n)p.pump(128);}
test('native static gate unchanged, strict experimental capabilities, source immutable',()=>{
 const source=JSON.stringify(rig);assert.throws(()=>PixiRigAsset.from(rig,new Map()),/Constraints/);validatePilot(rig,'sway');assert.equal(JSON.stringify(rig),source);
 for(const edit of [r=>r.skins.push({...r.skins[0],name:'other'}),r=>r.slots[0].blend='add',r=>r.skins[0].attachments[0].attachment.type='mesh',r=>r.animations.sway.slots.push({name:'body',channel:'visible',keys:[]}),r=>r.constraints[0].type='path']){const r=structuredClone(rig);edit(r);assert.throws(()=>validatePilot(r,'sway'));}
});
test('all721 committed poses match independent native Rust reference',()=>{
 const p=owner();p.play();for(let tick=0;tick<=720;tick++){if(tick)p.request(BigInt(tick));const f=p.frame,r=refs[tick];assert.equal(f.completed,BigInt(tick));for(const b of f.bones){const expected=r.bones.find(x=>x.name===b.name).world;Object.values(b.world).forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<=(i<4?.0001:.01),`${tick}/${b.name}/${i}`));}}
});
test('30/60/120/144 and irregular rational render schedules reach identical physical prefix',()=>{
 const reference=owner();reference.play();reference.request(240n);drain(reference);
 for(const fps of [30,60,120,144]){const p=owner();p.play();for(let frame=1;frame<=fps*2;frame++)p.requestTime(BigInt(frame),BigInt(fps));drain(p);assert.deepEqual(p.frame.bones,reference.frame.bones);assert.deepEqual(p.frame.records,reference.frame.records);}
 const p=owner();p.play();for(const tick of [1,2,5,8,68,69,144,145,240])p.request(BigInt(tick));drain(p);assert.deepEqual(p.frame.bones,reference.frame.bones);
});
test('500ms hitch, bounded pumps, pause/resume, seek-only preview, replay/reset',()=>{
 const p=owner();p.play();p.requestTime(1n,2n);assert.equal(p.frame.completed,8n);assert.equal(p.frame.backlog,52n);const before=p.frame;p.pause();assert.throws(()=>p.pump());assert.deepEqual(p.frame.bones,before.bones);p.resume();p.pump(3);assert.equal(p.frame.completed,11n);drain(p);p.seek(60n);assert.equal(p.capture().kind,'pure-preview');assert.equal(p.frame.completed,0n);assert.throws(()=>p.resume());p.replay(60n);drain(p);assert.equal(p.frame.completed,60n);assert.equal(p.status.state,'paused');p.stop();assert.equal(p.frame.completed,0n);p.reset();assert.equal(p.frame.completed,0n);p.dispose();assert.throws(()=>p.capture());
});
test('two independent instances and B6 fault retains last frame until explicit reset',()=>{
 const p=owner(),q=owner();p.play();q.play();p.request(8n);q.request(30n);drain(q);const before=p.frame,other=q.frame;
 const result=p.request(60n,()=>{throw Error('precommit fault');});assert.equal(result.stop.kind,'failed');assert.equal(p.frame.health,'faulted');assert.equal(p.frame.backlog,52n);assert.deepEqual(p.frame.bones,before.bones);assert.deepEqual(p.frame.records,before.records);assert.deepEqual(q.frame,other);assert.throws(()=>p.pump());p.reset();p.play();p.request(8n);assert.deepEqual(p.frame.bones,before.bones);
});
test('demo clock uses monotonic absolute integer microseconds, pauses exclude elapsed wall time',()=>{
 const c=new DemoTime();c.start(10);assert.equal(c.value(510),500000n);c.pause(510);assert.equal(c.value(10000),500000n);c.start(10000);assert.equal(c.value(10500),1000000n);assert.throws(()=>c.value(10499));const t=new DemoTime();t.start(0);assert.throws(()=>t.value(70000000));
});

import {ReplayAnimationInstance} from '@ankhimate/runtime';
test('secondary motion is actual Replay Physics, zero pose is primed, retained snapshots stay detached',()=>{
 const p=owner(),pure=new ReplayAnimationInstance(rig,'sway',1n);p.play();assert.deepEqual(p.frame.bones,pure.sampleTick(0n).bones);const retained=p.frame;p.request(60n);drain(p);assert.ok(p.frame.records.some(r=>Math.abs(r.rotation)>1e-5||Math.abs(r.x)>1e-5||Math.abs(r.y)>1e-5));assert.notDeepEqual(p.frame.bones,pure.sampleTick(60n).bones);assert.equal(retained.completed,0n);assert.deepEqual(retained.bones,pure.sampleTick(0n).bones);
});

test('genuine exported singular-parent clip faults at9 after8 committed ticks',()=>{
 const p=new PilotController(validatePilot(rig,'fault_at_9'),'fault_at_9');p.play();p.request(8n);const before=p.frame,result=p.request(60n);assert.equal(result.stop.kind,'failed');assert.equal(p.frame.completed,8n);assert.equal(p.frame.backlog,52n);assert.equal(p.frame.health,'faulted');assert.deepEqual(p.frame.bones,before.bones);assert.deepEqual(p.frame.records,before.records);assert.throws(()=>p.pump());
});

test('public presentation surface used by migrated pilot',()=>{assert.equal(typeof validatePilot,'function');});
