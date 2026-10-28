import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{ReplayConsumerBridge,parseRig,EVENT_QUEUE_CAPACITY}from'../src/index.js';
const combined=()=>{const r=parseRig(readFileSync('../experimental/animated-slots/fixtures/skeleton.json','utf8'));r.animations.costume!.events=[{time:.5,name:'impact',string:'badge'}];const t=r.animations.costume!.slots.find(t=>t.channel==='attachment')!;t.keys.push({time:.5,name:'sun',curve:'stepped'});t.keys.sort((a,b)=>a.time-b.time);return r;};
const make=(r=combined())=>new ReplayConsumerBridge(r,'costume',1n,undefined,{animatedSlots:true,animationEvents:true});
test('A6 explicit combined capability produces accepted slots and committed events in one consumer',()=>{const c=make();c.play(c.context,'costume',false);c.requestTick(c.context,60n);while(c.currentFrame().backlog)c.pump(c.context,8);const es=c.drainEvents(c.context);assert.equal(es.length,1);assert.equal((es[0] as any).slotState.tick,60n);assert.equal(c.currentFrame().slotState!.tick,60n);});

const advance=(c:ReplayConsumerBridge,t:bigint)=>{if(c.currentFrame().state==='stopped')c.play(c.context,'costume',false);c.requestTick(c.context,t);while(c.currentFrame().backlog&&c.currentFrame().health==='healthy')c.pump(c.context,8);};
const accepted=(c:ReplayConsumerBridge)=>{const f=c.currentFrame();return{tick:f.completed,bones:f.bones,records:f.records,slots:f.slotState};};
const badge=(state:any)=>state.slots.find((s:any)=>s.name==='badge');
test('A6 critical A: slot validation fails at impact/attachment tick60, neither publishes',()=>{
 const r=combined();r.animations.costume!.slots.find(t=>t.channel==='color'&&t.name==='body')!.keys=[{time:Math.fround(59/120),color:[0,0,0,1],curve:{type:'bezier',handles:[.25,3,.75,3]}},{time:Math.fround(61/120),color:[1,1,1,1],curve:'linear'}];
 const c=make(r);advance(c,59n);const before=accepted(c);assert.equal(badge(before.slots).attachment,'moon');assert.deepEqual(c.drainEvents(c.context),[]);c.requestTick(c.context,60n);assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(accepted(c),before);assert.equal(c.eventStatus(c.context).pending,0);assert.deepEqual(c.drainEvents(c.context),[]);
});
test('A6 critical B: saturated queue rejects tick60 slots and event atomically, preserving prefix',()=>{
 const r=combined();r.animations.costume!.events=[...Array.from({length:EVENT_QUEUE_CAPACITY},(_,i)=>({time:Math.fround(1/120),name:'filler'+i})),{time:.5,name:'impact',string:'badge'}];const c=make(r);advance(c,59n);assert.equal(c.eventStatus(c.context).pending,1024);const before=accepted(c);c.requestTick(c.context,60n);assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(accepted(c),before);assert.equal(c.eventStatus(c.context).pending,1024);const es=c.drainEvents(c.context);assert(es.every(e=>e.tick===1n&&e.slotState!.tick===1n));assert(!es.some(e=>e.event.name==='impact'));assert.equal(c.currentFrame().completed,59n);c.reset(c.context,2n);assert.equal(c.eventStatus(c.context).pending,0);
});
test('A6 observer failure after both preparations keeps slot frame and event queue private',()=>{
 const c=make();advance(c,59n);const before=accepted(c);c.requestTick(c.context,60n,f=>{assert.equal(f.slotState!.tick,60n);assert.equal(badge(f.slotState).attachment,'sun');assert.deepEqual(accepted(c),before);assert.throws(()=>c.drainEvents(c.context),/busy/);throw Error('late precommit audit');});assert.deepEqual(accepted(c),before);assert.deepEqual(c.drainEvents(c.context),[]);
});
test('A6 delayed drain retains attachment/order of each event tick instead of latest frame',()=>{
 const r=combined();r.animations.costume!.events.push({time:.65,name:'removed',string:'badge'});const c=make(r);advance(c,120n);const es=c.drainEvents(c.context);assert.deepEqual(es.map(e=>[e.tick,badge(e.slotState).attachment]),[[60n,'sun'],[78n,null]]);assert.notEqual(c.currentFrame().completed,60n);assert.equal(badge(c.currentFrame().slotState).attachment,'sun');assert.equal(es[0]!.slotState!.tick,es[0]!.tick);
});
test('A6 event slot snapshots are independently detached from other events and current state',()=>{
 const r=combined();r.animations.costume!.events.push({time:.5,name:'detail'});const c=make(r);advance(c,60n);const before=c.currentFrame(),es=c.drainEvents(c.context);const other=structuredClone(es[1]);(es[0] as any).slotState.slots[0].color[0]=100;(es[0] as any).slotState.drawOrder.reverse();(es[0] as any).event.name='changed';assert.deepEqual(es[1],other);assert.deepEqual(c.currentFrame(),before);assert.deepEqual(c.drainEvents(c.context),[]);
});
test('A6 application error after drain leaves completed Physics/slots and no re-delivery',()=>{const c=make();advance(c,60n);const before=accepted(c);assert.throws(()=>{for(const e of c.drainEvents(c.context)){assert.equal(e.slotState!.tick,60n);throw Error('application');}},/application/);assert.deepEqual(accepted(c),before);assert.deepEqual(c.drainEvents(c.context),[]);advance(c,61n);assert.equal(c.currentFrame().health,'healthy');});
test('A6 backlog/pause/repeated presentation never emits premature or duplicate events',()=>{
 const c=make();c.play(c.context,'costume',false);c.requestTick(c.context,120n);assert.equal(c.currentFrame().completed,8n);assert.deepEqual(c.drainEvents(c.context),[]);c.pause(c.context);const before=accepted(c);for(let i=0;i<20;i++)c.present(()=>{});assert.deepEqual(accepted(c),before);assert.deepEqual(c.drainEvents(c.context),[]);c.resume(c.context);while(c.currentFrame().backlog)c.pump(c.context,8);assert.deepEqual(c.drainEvents(c.context).map(e=>e.tick),[60n]);
});
for(const action of ['stop','reset','restart','replay'] as const)test('A6 '+action+' renews session and clears old event/slot history',()=>{
 const c=make();advance(c,60n);const old=c.context,session=c.eventStatus(old).session;if(action==='stop')c.stop(old);else if(action==='reset')c.reset(old,2n);else if(action==='restart')c.play(old,'costume',true);else c.replayFromOrigin(old,60n);assert.notEqual(c.eventStatus(c.context).session,session);assert.equal(c.eventStatus(c.context).pending,0);assert.throws(()=>c.drainEvents(old),/context/);if(action==='replay'){while(c.currentFrame().backlog)c.pump(c.context,8);}else advance(c,60n);const e=c.drainEvents(c.context)[0]!;assert.equal(e.epoch,2n);assert.equal(e.slotState!.tick,60n);
});
test('A6 two owners, source mutation and destruction preserve independent authoritative state',()=>{
 const r=combined(),a=make(r),b=make(r);r.animations.costume!.events[0]!.name='mutated';r.animations.costume!.slots=[];advance(a,60n);advance(b,60n);assert.notEqual(a.eventStatus(a.context).session,b.eventStatus(b.context).session);const e=a.drainEvents(a.context);assert.equal(e[0]!.event.name,'impact');assert.throws(()=>a.drainEvents(b.context),/context/);a.dispose(a.context);assert.throws(()=>a.drainEvents(a.context),/disposed/);assert.equal(b.drainEvents(b.context).length,1);
});
test('A6 invalid event at slot-change time is refused at admission, original input untouched',()=>{const r=combined();r.animations.costume!.events[0]!.float=NaN;const before=structuredClone(r);assert.throws(()=>make(r));assert.deepEqual(r,before);});
test('A6 exact capability and two actual channel families required, no implicit fallback',()=>{
 const r=combined();for(const opts of [undefined,{animatedSlots:true},{animationEvents:true},{animatedSlots:true,animationEvents:true,weightedFfd:true},{animatedSlots:true,animationEvents:false},{animatedSlots:true,animationEvents:true,other:true}])assert.throws(()=>new ReplayConsumerBridge(r,'costume',1n,undefined,opts as any));
 const x=combined();x.animations.costume!.events=[];assert.throws(()=>make(x),/both nonempty/);const y=combined();y.animations.costume!.slots=[];y.animations.costume!.drawOrder=[];assert.throws(()=>make(y),/both nonempty/);
});
for(const [name,mutate]of Object.entries({'FFD':(r:any):any=>r.animations.costume.deform.push({}),'linked':(r:any):any=>r.skins[0].attachments.find((a:any)=>a.attachment.type==='mesh').attachment.linked={name:'x'},'sequence':(r:any):any=>r.skins[0].attachments[0].attachment.sequence={},'dark tint':(r:any):any=>r.slots[0].dark_color=[0,0,0,1],'blend':(r:any):any=>r.slots[0].blend='add','dynamic skin':(r:any):any=>r.skins.push({...r.skins[0],name:'extra'}),'unknown attachment':(r:any):any=>r.animations.costume.slots.find((t:any)=>t.channel==='attachment').keys[0].name='unknown','unknown channel':(r:any):any=>r.animations.costume.custom=[]}))test('A6 refuses '+name,()=>{const r=combined();mutate(r);assert.throws(()=>make(r));});

const native=()=>parseRig(readFileSync('../experimental/slots-events/fixtures/skeleton.json','utf8'));
const refs=JSON.parse(readFileSync('../experimental/slots-events/fixtures/rust.json','utf8')).frames;
const windows=JSON.parse(readFileSync('../experimental/slots-events/fixtures/event-vectors.json','utf8'))[0].ticks;
test('A6 authentic A2 full trajectory slots/events remain coherent with independent Rust',()=>{
 const c=new ReplayConsumerBridge(native(),'signal_costume',1n,undefined,{animatedSlots:true,animationEvents:true});c.play(c.context,'signal_costume',false);let total=0;
 for(let t=0;t<=720;t++){if(t)c.requestTick(c.context,BigInt(t));const f=c.currentFrame(),es=c.drainEvents(c.context);total+=es.length;if(t)assert.deepEqual(es.map(e=>({lap:Number(e.lap),keyIndex:e.keyIndex,event:e.event})),windows[t-1].events);
  for(const e of es)assert.deepEqual(e.slotState,f.slotState);
  const r=refs.find((r:any)=>r.tick===t);if(r){assert.deepEqual(f.slotState!.drawOrder,r.drawOrder);for(const s of f.slotState!.slots){const expected=r.slots.find((x:any)=>x.name===s.name);assert.deepEqual([s.attachment,s.visible,s.owner],[expected.attachment,expected.visible,expected.owner]);s.color.forEach((v,i)=>assert(Math.abs(v-expected.color[i])<=1e-5));}}
  if(t===60){assert.equal(badge(f.slotState).attachment,'moon');assert.equal(badge(f.slotState).visible,true);assert.deepEqual(f.slotState!.drawOrder,['body','cape','badge']);assert.equal(es.filter(e=>e.event.name==='impact').length,1);}
 }assert.equal(total,36);
});

test('A6 nonlooping end event carries final slot pose; later ticks emit nothing',()=>{
 const r=native();r.animations.signal_costume!.looping=false;const c=new ReplayConsumerBridge(r,'signal_costume',1n,undefined,{animatedSlots:true,animationEvents:true});c.play(c.context,'signal_costume',false);c.requestTick(c.context,240n);while(c.currentFrame().backlog)c.pump(c.context,8);const es=c.drainEvents(c.context);assert.equal(es.length,9);const end=es.find(e=>e.event.name==='clip_end')!;assert.equal(end.tick,180n);assert.equal(end.lap,0n);assert.equal(badge(end.slotState).attachment,'sun');assert.equal(badge(end.slotState).visible,true);assert.deepEqual(end.slotState!.drawOrder,['body','cape','badge']);c.requestTick(c.context,248n);assert.deepEqual(c.drainEvents(c.context),[]);
});
