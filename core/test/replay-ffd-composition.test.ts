import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{ReplayConsumerBridge,parseRig}from'../src/index.js';
const native=()=>parseRig(readFileSync('../experimental/composed-ffd/fixtures/gate-a/skeleton.json','utf8'));
const make=(r=native(),options:any={weightedFfd:true,animatedSlots:true})=>new ReplayConsumerBridge(r,'morphing_frog',1n,undefined,options);
test('A8 Gate A explicit weighted FFD plus animated slots commits both families',()=>{const c=make(),f=c.currentFrame();assert.equal(f.deformation!.tick,0n);assert.equal(f.slotState!.tick,0n);assert.equal(f.deformation!.entries.length,1);assert.equal(f.deformation!.entries[0]!.attachment,'body');});

const advance=(c:ReplayConsumerBridge,t:bigint)=>{if(c.currentFrame().state==='stopped')c.play(c.context,'morphing_frog',false);c.requestTick(c.context,t);while(c.currentFrame().backlog&&c.currentFrame().health==='healthy')c.pump(c.context,8);};
const accepted=(c:ReplayConsumerBridge)=>{const f=c.currentFrame();return{completed:f.completed,bones:f.bones,records:f.records,deformation:f.deformation,slotState:f.slotState};};
const animation=(r:any)=>r.animations.morphing_frog;
for(const[name,change]of Object.entries({
 'no deformation':(r:any):any=>animation(r).deform=[],
 'empty deformation keys':(r:any):any=>animation(r).deform[0].keys=[],
 'duplicate target':(r:any):any=>animation(r).deform.push(structuredClone(animation(r).deform[0])),
 'unknown target':(r:any):any=>animation(r).deform[0].attachment='absent',
 'wrong target slot':(r:any):any=>animation(r).deform[0].slot='badge',
 'target switches to null':(r:any):any=>animation(r).slots.push({name:'body',channel:'attachment',keys:[{time:.5,name:null,curve:'stepped'}]}),
 'target switches hidden':(r:any):any=>animation(r).slots.push({name:'body',channel:'attachment',keys:[{time:.7,name:'other',curve:'stepped'}]}),
 'nonfinite offsets':(r:any):any=>animation(r).deform[0].keys[1].offsets[0]=NaN,
 'wrong offset count':(r:any):any=>animation(r).deform[0].keys[1].offsets.pop(),
 'infinite key time':(r:any):any=>animation(r).deform[0].keys[1].time=Infinity,
 'no slot family':(r:any):any=>{animation(r).slots=[];animation(r).drawOrder=[];},
 'events':(r:any):any=>animation(r).events.push({time:.5,name:'excluded'}),
 'dynamic skin':(r:any):any=>r.skins.push({...r.skins[0],name:'other'}),
 'linked mesh':(r:any):any=>r.skins[0].attachments.find((e:any)=>e.slot==='body').attachment.linked={name:'other'},
 'dark color':(r:any):any=>r.slots[0].dark_color=[0,0,0,1],
 'nonNormal':(r:any):any=>r.slots[0].blend='add',
 'singular bind':(r:any):any=>r.bones.find((b:any)=>b.name==='b0').scaleX=0,
 'zero total row':(r:any):any=>r.skins[0].attachments.find((e:any)=>e.slot==='body').attachment.weights[0].bones.forEach((w:any)=>w.weight=0)
}))test('A8 Gate A refuses '+name+' atomically at admission',()=>{const r=native();change(r);const before=structuredClone(r);assert.throws(()=>make(r));assert.deepEqual(r,before);});
test('A8 Gate A allows explicit constant reselection of exact target',()=>{const r=native();animation(r).slots.push({name:'body',channel:'attachment',keys:[{time:0,name:'body',curve:'stepped'},{time:.5,name:'body',curve:'stepped'}]});const c=make(r);advance(c,60n);assert.equal(c.currentFrame().deformation!.entries[0]!.attachment,'body');});
for(const options of [undefined,{weightedFfd:true},{animatedSlots:true},{weightedFfd:true,animatedSlots:true,clipping:true},{weightedFfd:true,animatedSlots:true,animationEvents:true},{weightedFfd:true,animatedSlots:false},{weightedFfd:true,animatedSlots:true,other:true}])test('A8 standalone/unknown capabilities remain closed '+JSON.stringify(options),()=>assert.throws(()=>new ReplayConsumerBridge(native(),'morphing_frog',1n,undefined,options as any)));
test('A8 Gate A nonfinite sampled FFD at impact rolls back Physics and slots',()=>{const r=native(),a=animation(r),zero=Array(20).fill(0);a.deform[0].keys=[{time:0,offsets:zero,curve:'linear'},{time:Math.fround(59/120),offsets:zero,curve:{type:'bezier',handles:[.25,1e308,.75,1e308]}},{time:Math.fround(61/120),offsets:Array(20).fill(10),curve:'linear'}];const c=make(r);advance(c,59n);assert.equal(c.currentFrame().health,'healthy');const before=accepted(c);c.requestTick(c.context,60n);assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(accepted(c),before);assert.equal(c.currentFrame().slotState!.tick,59n);});
test('A8 Gate A invalid sampled slot color at FFD impact publishes neither family',()=>{const r=native(),a=animation(r);a.slots.find((t:any)=>t.name==='body'&&t.channel==='color').keys=[{time:Math.fround(59/120),color:[0,0,0,1],curve:{type:'bezier',handles:[.25,3,.75,3]}},{time:Math.fround(61/120),color:[1,1,1,1],curve:'linear'}];const c=make(r);advance(c,59n);const before=accepted(c);c.requestTick(c.context,60n);assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(accepted(c),before);assert.equal(c.currentFrame().deformation!.tick,59n);});
test('A8 Gate A observer sees both candidate families before a single abort boundary',()=>{const c=make();advance(c,59n);const before=accepted(c);let observed=false;c.requestTick(c.context,60n,f=>{assert.equal(f.deformation!.tick,60n);assert.equal(f.slotState!.tick,60n);assert.deepEqual(accepted(c),before);observed=true;throw Error('after both samples');});assert(observed);assert.deepEqual(accepted(c),before);});
test('A8 Gate A authentic Rust trajectory has one owner/tick including hidden FFD target and loops',()=>{const refs=JSON.parse(readFileSync('../experimental/composed-ffd/fixtures/gate-a/rust.json','utf8')).frames,c=make();for(const r of refs){if(r.tick)advance(c,BigInt(r.tick));const f=c.currentFrame();assert.equal(f.completed,BigInt(r.tick));assert.equal(f.slotState!.tick,f.completed);assert.equal(f.deformation!.tick,f.completed);assert.equal(f.deformation!.entries.length,1);const d=f.deformation!.entries[0]!;assert.deepEqual([d.owner,d.slot,d.attachment],['default','body','body']);d.offsets.forEach((v,i)=>assert(Math.abs(v-r.offsets[i])<=.0001));assert.deepEqual(f.slotState!.drawOrder,r.drawOrder);for(const s of f.slotState!.slots){const e=r.slots.find((x:any)=>x.name===s.name);assert.deepEqual([s.attachment,s.visible,s.owner],[e.attachment,e.visible,e.owner]);}}});
test('A8 Gate A source/snapshots detached; refusal, redraw and reset preserve ownership',()=>{const r=native(),c=make(r),d=make();animation(r).deform[0].keys[1].offsets[0]=999;advance(c,60n);advance(d,60n);assert.deepEqual(accepted(c),accepted(d));const before=accepted(c),snapshot=c.currentFrame();(snapshot.deformation!.entries[0]!.offsets as number[])[0]=999;(snapshot.slotState!.drawOrder as string[]).reverse();for(let i=0;i<3;i++)c.present(()=>{});assert.deepEqual(accepted(c),before);const context=c.context;c.reset(context,2n);assert.throws(()=>c.requestTick(context,1n));advance(c,60n);assert.deepEqual(accepted(c),before);});
