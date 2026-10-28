import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{ReplayConsumerBridge,parseRig}from'../src/index.js';
const fixture=()=>{const r=parseRig(readFileSync('../experimental/animated-slots/fixtures/skeleton.json','utf8'));r.skins[0]!.attachments.push({slot:'body',name:'mask',attachment:{type:'clipping',vertices:[-30,-30,30,-30,30,30,-30,30],vertex_count:4,end_slot:'cape'}} as any);r.slots.find(s=>s.name==='body')!.attachment='mask';return r;};
test('A7 explicit clipping plus accepted slots capability',()=>{const c=new ReplayConsumerBridge(fixture(),'costume',1n,undefined,{animatedSlots:true,clipping:true} as any);assert.equal(c.currentFrame().slotState!.slots.find(s=>s.name==='body')!.attachment,'mask');});

const native=()=>parseRig(readFileSync('../experimental/replay-clipping/fixtures/skeleton.json','utf8'));
const make=(r=native(),options:any={animatedSlots:true,clipping:true})=>new ReplayConsumerBridge(r,'masked_frog',1n,undefined,options);
const mask=(r:any):any=>r.skins[0].attachments.find((e:any)=>e.slot==='mask'&&e.name==='convex').attachment;
const advance=(c:ReplayConsumerBridge,t:bigint)=>{if(c.currentFrame().state==='stopped')c.play(c.context,'masked_frog',false);c.requestTick(c.context,t);while(c.currentFrame().backlog&&c.currentFrame().health==='healthy')c.pump(c.context,8);};
for(const options of [undefined,{animatedSlots:true},{animationEvents:true},{animatedSlots:true,animationEvents:true},{weightedFfd:true},{clipping:true},{animatedSlots:false,clipping:true},{animatedSlots:true,clipping:true,animationEvents:true},{animatedSlots:true,clipping:true,weightedFfd:true},{animatedSlots:true,clipping:true,unknown:true}])test('A7 standalone/extra capabilities remain closed '+JSON.stringify(options),()=>{assert.throws(()=>new ReplayConsumerBridge(native(),'masked_frog',1n,undefined,options as any));});
for(const[name,change]of Object.entries({
 'nonfinite':(r:any):any=>mask(r).vertices[0]=Infinity,
 'NaN':(r:any):any=>mask(r).vertices[0]=NaN,
 'degenerate':(r:any):any=>mask(r).vertices=[0,0,1,0,2,0,3,0],
 'duplicate point':(r:any):any=>mask(r).vertices=[0,0,1,0,1,1,0,0],
 'self intersection':(r:any):any=>mask(r).vertices=[0,0,2,2,0,2,2,0],
 'count mismatch':(r:any):any=>mask(r).vertex_count=5,
 'too few':(r:any):any=>{mask(r).vertices=[0,0,1,1];mask(r).vertex_count=2;},
 'unknown end':(r:any):any=>mask(r).end_slot='missing',
 'self end':(r:any):any=>mask(r).end_slot='mask',
 'missing end':(r:any):any=>delete mask(r).end_slot,
 'holes':(r:any):any=>mask(r).holes=[],
 'wrong slot owner':(r:any):any=>r.skins[0].attachments[0].slot='missing',
 'unknown bone':(r:any):any=>r.slots[0].bone='missing',
 'unknown attachment':(r:any):any=>r.slots[0].attachment='missing',
 'invalid order':(r:any):any=>r.drawOrder[0]=r.drawOrder[1],
 'FFD':(r:any):any=>r.animations.masked_frog.deform.push({}),
 'events':(r:any):any=>r.animations.masked_frog.events.push({time:.5,name:'not admitted'}),
 'linked':(r:any):any=>r.skins[0].attachments.find((e:any)=>e.attachment.type==='mesh').attachment.linked={name:'other'},
 'dynamic skin':(r:any):any=>r.skins.push({...r.skins[0],name:'other'}),
 'blend':(r:any):any=>r.slots[0].blend='multiply',
 'dark':(r:any):any=>r.slots[0].dark_color=[0,0,0,1],
 'oversized polygon':(r:any):any=>{mask(r).vertex_count=65;mask(r).vertices=Array.from({length:65},(_,i)=>[Math.cos(i/65*2*Math.PI),Math.sin(i/65*2*Math.PI)]).flat();}
}))test('A7 refuses '+name+' without modifying source',()=>{const r=native();change(r);const before=structuredClone(r);assert.throws(()=>make(r));assert.deepEqual(r,before);});
test('A7 authentic export matches721 Rust accepted slot states, including hidden mask/null end and loops',()=>{const refs=JSON.parse(readFileSync('../experimental/replay-clipping/fixtures/rust.json','utf8')).frames,c=make();for(const r of refs){if(r.tick)advance(c,BigInt(r.tick));const f=c.currentFrame();assert.equal(f.completed,BigInt(r.tick));assert.deepEqual(f.slotState!.drawOrder,r.drawOrder);for(const s of f.slotState!.slots){const e=r.slots.find((x:any)=>x.name===s.name);assert.deepEqual([s.attachment,s.visible,s.owner],[e.attachment,e.visible,e.owner]);s.color.forEach((v,i)=>assert(Math.abs(v-e.color[i])<=1e-5));}}});
test('A7 late numerical observer failure keeps old slot/bone/Physics state, no events',()=>{const c=make();advance(c,59n);const before=c.currentFrame();c.requestTick(c.context,60n,()=>{throw Error('late observer');});const after=c.currentFrame();assert.equal(after.health,'faulted');for(const k of ['completed','bones','records','slotState']as const)assert.deepEqual(after[k],before[k]);assert.throws(()=>c.drainEvents(c.context),/not enabled|disabled|events/i);});
test('A7 snapshots/source detached and reset/replay retains clipping capability',()=>{const r=native(),c=make(r);mask(r).vertices[0]=999;advance(c,80n);const before=c.currentFrame(),changed=c.currentFrame();(changed.slotState!.drawOrder as string[]).reverse();assert.deepEqual(c.currentFrame(),before);const old=c.context;c.reset(old,2n);assert.throws(()=>c.requestTick(old,1n));advance(c,80n);assert.deepEqual(c.currentFrame().slotState,before.slotState);});
