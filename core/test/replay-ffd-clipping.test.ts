import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{ReplayConsumerBridge,parseRig}from'../src/index.js';
const native=()=>parseRig(readFileSync('../experimental/composed-ffd/fixtures/gate-b/skeleton.json','utf8'));
const make=(r=native(),options:any={weightedFfd:true,animatedSlots:true,clipping:true})=>new ReplayConsumerBridge(r,'morphing_frog',1n,undefined,options);
test('A8 Gate B explicit weighted FFD plus slots plus clipping',()=>{const c=make(),f=c.currentFrame();assert.equal(f.deformation!.tick,0n);assert.equal(f.slotState!.tick,0n);assert.equal(f.slotState!.slots.find(s=>s.name==='mask')!.attachment,'convex');});

const advance=(c:ReplayConsumerBridge,t:bigint)=>{if(c.currentFrame().state==='stopped')c.play(c.context,'morphing_frog',false);c.requestTick(c.context,t);while(c.currentFrame().backlog&&c.currentFrame().health==='healthy')c.pump(c.context,8);};
const accepted=(c:ReplayConsumerBridge)=>{const f=c.currentFrame();return{completed:f.completed,bones:f.bones,records:f.records,deformation:f.deformation,slotState:f.slotState};};
const mask=(r:any)=>r.skins[0].attachments.find((e:any)=>e.slot==='mask'&&e.name==='convex').attachment;
for(const[name,change]of Object.entries({
 'nonfinite mask':(r:any):any=>mask(r).vertices[0]=NaN,
 'degenerate polygon':(r:any):any=>mask(r).vertices=[0,0,1,0,2,0,3,0],
 'self intersection':(r:any):any=>mask(r).vertices=[0,0,2,2,0,2,2,0],
 'holes':(r:any):any=>mask(r).holes=[],
 'unknown end':(r:any):any=>mask(r).end_slot='absent',
 'self end':(r:any):any=>mask(r).end_slot='mask',
 'mask weighted':(r:any):any=>mask(r).weights=[],
 'mask targeted by FFD':(r:any):any=>{r.animations.morphing_frog.deform[0].slot='mask';r.animations.morphing_frog.deform[0].attachment='convex';},
 'changing FFD identity':(r:any):any=>r.animations.morphing_frog.slots.push({name:'body',channel:'attachment',keys:[{time:.5,name:null,curve:'stepped'}]}),
 'two owners':(r:any):any=>r.animations.morphing_frog.deform.push(structuredClone(r.animations.morphing_frog.deform[0])),
 'no FFD':(r:any):any=>r.animations.morphing_frog.deform=[],
 'wrong FFD size':(r:any):any=>r.animations.morphing_frog.deform[0].keys[1].offsets.pop(),
 'events':(r:any):any=>r.animations.morphing_frog.events.push({time:.5,name:'excluded'}),
 'dynamic skin':(r:any):any=>r.skins.push({...r.skins[0],name:'alternate'}),
 'linked target':(r:any):any=>r.skins[0].attachments.find((e:any)=>e.slot==='body').attachment.linked={name:'other'},
 'invalid draw order':(r:any):any=>r.drawOrder[0]=r.drawOrder[1],
 'unknown attachment':(r:any):any=>r.slots[0].attachment='absent'
}))test('A8 Gate B refuses '+name+' without source mutation',()=>{const r=native();change(r);const before=structuredClone(r);assert.throws(()=>make(r));assert.deepEqual(r,before);});
for(const options of [{weightedFfd:true,animatedSlots:true},{animatedSlots:true,clipping:true},{weightedFfd:true},{weightedFfd:true,animatedSlots:true,clipping:false},{weightedFfd:true,animatedSlots:true,clipping:true,animationEvents:true},{weightedFfd:true,animatedSlots:true,clipping:true,other:true}])test('A8 Gate B requires exact three-family capability '+JSON.stringify(options),()=>assert.throws(()=>make(native(),options)));
test('A8 Gate B full native Rust trajectory keeps FFD, masks, slots and order on one tick',()=>{const refs=JSON.parse(readFileSync('../experimental/composed-ffd/fixtures/gate-b/rust.json','utf8')).frames,c=make();for(const r of refs){if(r.tick)advance(c,BigInt(r.tick));const f=c.currentFrame();assert.equal(f.completed,BigInt(r.tick));assert.equal(f.slotState!.tick,f.completed);assert.equal(f.deformation!.tick,f.completed);assert.equal(f.deformation!.entries.length,1);f.deformation!.entries[0]!.offsets.forEach((v,i)=>assert(Math.abs(v-r.offsets[i])<=.0001));assert.deepEqual(f.slotState!.drawOrder,r.drawOrder);for(const s of f.slotState!.slots){const e=r.slots.find((x:any)=>x.name===s.name);assert.deepEqual([s.attachment,s.visible,s.owner],[e.attachment,e.visible,e.owner]);}}});
test('A8 Gate B late observer abort rejects impact FFD and concave mask selection together',()=>{const c=make();advance(c,59n);const before=accepted(c);let both=false;c.requestTick(c.context,60n,f=>{assert.equal(f.deformation!.tick,60n);assert.equal(f.slotState!.tick,60n);assert.equal(f.slotState!.slots.find(s=>s.name==='mask')!.attachment,'concave');both=true;throw Error('before shared commit');});assert(both);assert.deepEqual(accepted(c),before);assert.equal(c.currentFrame().slotState!.slots.find(s=>s.name==='mask')!.attachment,'convex');});
test('A8 Gate B invalid sampled color at impact cannot publish FFD or concave mask',()=>{const r=native(),track=r.animations.morphing_frog!.slots.find(t=>t.name==='body'&&t.channel==='color')!;track.keys=[{time:Math.fround(59/120),color:[0,0,0,1],curve:{type:'bezier',handles:[.25,3,.75,3]}},{time:Math.fround(61/120),color:[1,1,1,1],curve:'linear'}];const c=make(r);advance(c,59n);const before=accepted(c);c.requestTick(c.context,60n);assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(accepted(c),before);});
test('A8 Gate B FFD keeps sampling while owner is hidden; current offsets match visible control',()=>{const r=native(),t=r.animations.morphing_frog!.slots.find(t=>t.name==='body'&&t.channel==='visible')!;t.keys=[{time:0,value:true,curve:'stepped'},{time:.75,value:false,curve:'stepped'},{time:Math.fround(1.05),value:true,curve:'stepped'}];const c=make(r),control=make();advance(c,90n);advance(control,90n);const start=c.currentFrame().deformation;assert.equal(c.currentFrame().slotState!.slots.find(s=>s.name==='body')!.visible,false);assert.deepEqual(start,control.currentFrame().deformation);advance(c,120n);advance(control,120n);assert.equal(c.currentFrame().slotState!.slots.find(s=>s.name==='body')!.visible,false);assert.deepEqual(c.currentFrame().deformation,control.currentFrame().deformation);assert.notDeepEqual(c.currentFrame().deformation!.entries[0]!.offsets,start!.entries[0]!.offsets);advance(c,126n);advance(control,126n);assert.equal(c.currentFrame().slotState!.slots.find(s=>s.name==='body')!.visible,true);assert.deepEqual(c.currentFrame().deformation,control.currentFrame().deformation);});
