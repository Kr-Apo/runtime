import {ReplayHostTimeBridge} from '../src/replay-host-time.js';
import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{ReplayConsumerBridge,parseRig,EVENT_QUEUE_CAPACITY}from'../src/index.js';
const rig=()=>{const r=parseRig(readFileSync('../experimental/animated-slots/fixtures/skeleton.json','utf8'));const a=r.animations.costume!;a.slots=[];a.drawOrder=[];a.events=[{time:.25,name:'impact',int:7,float:.5,string:'sol',audio:'impact',volume:.75,balance:-.5}];return r;};
const create=(r=rig())=>new ReplayConsumerBridge(r,'costume',1n,undefined,{animationEvents:true} as any);
test('A5 native events require explicit capability and committed drain',()=>{const c=create();assert.equal(typeof(c as any).drainEvents,'function');c.play(c.context,'costume',false);c.requestTick(c.context,30n);while(c.currentFrame().backlog)c.pump(c.context,8);const e=(c as any).drainEvents(c.context);assert.equal(e.length,1);assert.equal(e[0].tick,30n);assert.equal(e[0].event.name,'impact');assert.deepEqual((c as any).drainEvents(c.context),[]);});

const drain=(c:ReplayConsumerBridge)=>(c as any).drainEvents(c.context) as any[];
const status=(c:ReplayConsumerBridge)=>(c as any).eventStatus(c.context);
const advance=(c:ReplayConsumerBridge,t:bigint)=>{if(c.currentFrame().state==='stopped')c.play(c.context,'costume',false);c.requestTick(c.context,t);while(c.currentFrame().backlog&&c.currentFrame().health==='healthy')c.pump(c.context,8);};
const eventRig=(keys:any[],duration=1.5,looping=true)=>{const r=rig();Object.assign(r.animations.costume!,{events:keys,duration,looping});return r;};
test('A5 origin ignored, first positive/exact tick, stable authored ties and end belong to ending lap',()=>{
 const c=create(eventRig([{time:0,name:'origin'},{time:.5,name:'a'},{time:.001,name:'first'},{time:.5,name:'b'},{time:1.5,name:'end'}]));advance(c,360n);const es=drain(c);
 assert.deepEqual(es.map(e=>[e.tick,e.lap,e.event.name]),[[1n,0n,'first'],[60n,0n,'a'],[60n,0n,'b'],[180n,0n,'end'],[181n,1n,'first'],[240n,1n,'a'],[240n,1n,'b'],[360n,1n,'end']]);assert.equal(new Set(es.map(e=>e.id)).size,es.length);assert.deepEqual(es.filter(e=>e.tick===60n).map(e=>e.ordinal),[0,1]);
});
test('A5 multiple short clip laps inside one tick retain chronological lap/key order',()=>{
 const c=create(eventRig([{time:.001,name:'a'},{time:.002,name:'b'}],.002));advance(c,1n);const es=drain(c);assert.equal(es.length,8);assert.deepEqual(es.map(e=>e.event.name),['a','b','a','b','a','b','a','b']);assert.deepEqual(es.map(e=>e.lap),[0n,0n,1n,1n,2n,2n,3n,3n]);
});
test('A5 nonlooping end fires once and empty windows remain empty',()=>{const c=create(eventRig([{time:1.5,name:'end'}],1.5,false));advance(c,240n);assert.deepEqual(drain(c).map(e=>e.tick),[180n]);advance(c,480n);assert.deepEqual(drain(c),[]);});
test('A5 backlog publishes completed prefix only; pause and repeated frames never duplicate',()=>{
 const c=create(eventRig([{time:1/120,name:'one'},{time:.1,name:'twelve'}]));c.play(c.context,'costume',false);c.requestTick(c.context,30n);assert.equal(c.currentFrame().completed,8n);assert.deepEqual(drain(c).map(e=>e.tick),[1n]);c.pause(c.context);const before=c.currentFrame();for(let i=0;i<10;i++){c.currentFrame();c.present(()=>{});}assert.deepEqual(c.currentFrame(),before);assert.deepEqual(drain(c),[]);assert.throws(()=>c.pump(c.context,8));c.resume(c.context);while(c.currentFrame().backlog)c.pump(c.context,8);assert.deepEqual(drain(c).map(e=>e.tick),[12n]);
});
test('A5 rejected candidate never leaks; accepted prefix can drain despite fault',()=>{
 const c=create(eventRig([{time:1/120,name:'one'},{time:2/120,name:'two'}]));c.play(c.context,'costume',false);const p=c.requestTick(c.context,4n,f=>{assert(!('events'in f));if(f.tick===2n)throw Error('precommit failure');});assert.equal(p.stop.kind,'failed');assert.equal(c.currentFrame().completed,1n);assert.deepEqual(drain(c).map(e=>e.event.name),['one']);assert.deepEqual(drain(c),[]);
});
test('A5 precommit observer cannot drain or mutate by reentrance',()=>{
 const c=create(eventRig([{time:1/120,name:'one'}]));c.play(c.context,'costume',false);c.requestTick(c.context,1n,()=>{assert.throws(()=>drain(c),/busy/);assert.throws(()=>status(c),/busy/);assert.throws(()=>c.reset(c.context,2n),/busy/);assert.equal(c.currentFrame().completed,0n);});assert.equal(drain(c).length,1);
});
test('A5 queue overflow refuses candidate without dropping accepted prefix',()=>{
 const c=create(eventRig(Array.from({length:1536},(_,i)=>({time:(1+Math.floor(i/512))/120,name:'e'+i})),1.5));advance(c,8n);assert.equal(c.currentFrame().health,'faulted');assert.equal(c.currentFrame().completed,2n);assert.equal(status(c).pending,EVENT_QUEUE_CAPACITY);assert.equal(drain(c).length,1024);assert.deepEqual(drain(c),[]);c.reset(c.context,2n);assert.equal(status(c).pending,0);
});
test('A5 pathological tiny duration fails bounded enumeration before first commit',()=>{const c=create(eventRig([{time:1e-8,name:'tiny'}],1e-8));advance(c,1n);assert.equal(c.currentFrame().completed,0n);assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(drain(c),[]);});
test('A5 user handler exception happens after acknowledgement, never rolls back Physics',()=>{
 const c=create();advance(c,30n);const before=c.currentFrame();assert.throws(()=>{for(const e of drain(c)){assert.equal(e.event.name,'impact');throw Error('user');}},/user/);assert.deepEqual(c.currentFrame(),before);assert.deepEqual(drain(c),[]);advance(c,31n);assert.equal(c.currentFrame().health,'healthy');
});
test('A5 source and delivered payload are detached; snapshots cannot enqueue events',()=>{
 const r=rig(),c=create(r);r.animations.costume!.events[0]!.name='tampered';r.animations.costume!.events[0]!.time=0;advance(c,30n);const f=c.currentFrame() as any;assert.throws(()=>{f.events=[{name:'forged'}];});const es=drain(c);assert.equal(es[0].event.name,'impact');es[0].event.name='changed';assert.deepEqual(drain(c),[]);advance(c,210n);assert.equal(drain(c)[0].event.name,'impact');
});
for(const op of ['stop','reset','restart','replay'] as const)test('A5 '+op+' discards old pending queue, renews session/epoch and permits new occurrences',()=>{
 const c=create();advance(c,30n);const old=status(c),ctx=c.context;
 if(op==='stop')c.stop(ctx);else if(op==='reset')c.reset(ctx,2n);else if(op==='restart')c.play(ctx,'costume',true);else c.replayFromOrigin(ctx,30n);
 assert.notEqual(status(c).session,old.session);assert.equal(c.context.epoch,2n);assert.equal(status(c).pending,0);assert.throws(()=>(c as any).drainEvents(ctx),/context/);
 if(op==='replay'){while(c.currentFrame().backlog)c.pump(c.context,8);}else advance(c,30n);
 const es=drain(c);assert.equal(es.length,1);assert.equal(es[0].epoch,2n);assert.equal(es[0].session,status(c).session);
});
test('A5 foreign context and destroyed consumer reject drain, status and all further work',()=>{const a=create(),b=create();assert.throws(()=>(a as any).drainEvents(b.context),/context/);advance(a,30n);a.dispose(a.context);assert.throws(()=>drain(a),/disposed/);assert.throws(()=>status(a),/disposed/);assert.equal(status(b).pending,0);});
test('A5 two actors preserve independent occurrences, IDs and queues',()=>{const a=create(),b=create();advance(a,30n);advance(b,30n);assert.notEqual(status(a).session,status(b).session);assert.equal(drain(a).length,1);assert.equal(status(b).pending,1);assert.equal(drain(b).length,1);});
test('A5 pure seek is refused without deleting pending events or changing state',()=>{const c=create();advance(c,30n);const before=c.currentFrame();assert.throws(()=>c.seekTick(c.context,60n),/pure seek/);assert.deepEqual(c.currentFrame(),before);assert.equal(drain(c).length,1);});
for(const [label,change]of Object.entries({
 'unknown clip':(r:any):any=>{r.animations={other:r.animations.costume};},'slots':(r:any):any=>r.animations.costume.slots.push({name:'body',channel:'visible',keys:[]}), 'deform':(r:any):any=>r.animations.costume.deform.push({}), 'events not array':(r:any):any=>r.animations.costume.events={},'sparse event':(r:any):any=>r.animations.costume.events=Array(1), 'negative time':(r:any):any=>r.animations.costume.events[0].time=-1,'NaN time':(r:any):any=>r.animations.costume.events[0].time=NaN,'past end':(r:any):any=>r.animations.costume.events[0].time=2,'empty name':(r:any):any=>r.animations.costume.events[0].name='', 'invalid int':(r:any):any=>r.animations.costume.events[0].int=2147483648,'noninteger':(r:any):any=>r.animations.costume.events[0].int=.5,'infinite float':(r:any):any=>r.animations.costume.events[0].float=Infinity,'invalid string':(r:any):any=>r.animations.costume.events[0].string={},'invalid audio':(r:any):any=>r.animations.costume.events[0].audio=null,'long text':(r:any):any=>r.animations.costume.events[0].string='x'.repeat(1025),'negative volume':(r:any):any=>r.animations.costume.events[0].volume=-1,'invalid balance':(r:any):any=>r.animations.costume.events[0].balance=2,'extra payload':(r:any):any=>r.animations.costume.events[0].secret='x','too many keys':(r:any):any=>r.animations.costume.events=Array.from({length:4097},()=>({time:.5,name:'x'})), 'dynamic skin':(r:any):any=>r.skins.push({...r.skins[0],name:'other'})
}))test('A5 rejects '+label,()=>{const r=rig();change(r);assert.throws(()=>create(r));});
for(const options of [{animationEvents:true,weightedFfd:true},{animationEvents:true,animatedSlots:true},{animationEvents:false},{animationEvents:true,extra:true}])test('A5 rejects unqualified option '+JSON.stringify(options),()=>assert.throws(()=>new ReplayConsumerBridge(rig(),'costume',1n,undefined,options as any)));
test('A5 default/A3/A4 capabilities keep event admission closed',()=>{for(const opts of [undefined,{weightedFfd:true},{animatedSlots:true}])assert.throws(()=>new ReplayConsumerBridge(rig(),'costume',1n,undefined,opts as any));});

const native=()=>parseRig(readFileSync('../experimental/replay-events/fixtures/skeleton.json','utf8'));
const reference=JSON.parse(readFileSync('../experimental/replay-events/fixtures/rust.json','utf8'));
test('A5 authentic A2 event payloads and selected frames match independent Rust',()=>{
 const c=new ReplayConsumerBridge(native(),'signals',1n,undefined,{animationEvents:true});c.play(c.context,'signals',false);let actual:any[]=[];
 for(const r of reference.frames){if(r.tick){c.requestTick(c.context,BigInt(r.tick));while(c.currentFrame().backlog)c.pump(c.context,8);}actual.push(...drain(c));
  for(const b of c.currentFrame().bones){const expected=r.bones.find((v:any)=>v.name===b.name);Object.values(b.world).forEach((v,i)=>assert(Math.abs(v-expected.world[i])<=(i<4?.0001:.01)));}
 }
 assert.equal(actual.length,28);const impact=actual.find(v=>v.event.name==='impact');assert.equal(impact.event.string,'Sol "or" \\ Unicode 🐸\n');assert.equal(impact.event.audio,'impact_cue');assert.equal(impact.event.float,Math.fround(.3));
});
const vectors=JSON.parse(readFileSync('../experimental/replay-events/fixtures/event-vectors.json','utf8'));
for(const [i,v]of vectors.entries())test('A5 independent Rust windows vector '+i,()=>{
 const r=native();Object.assign(r.animations.signals!,{duration:v.duration,looping:v.looping,events:v.keys});const c=new ReplayConsumerBridge(r,'signals',1n,undefined,{animationEvents:true});c.play(c.context,'signals',false);
 for(const expected of v.ticks){c.requestTick(c.context,BigInt(expected.tick));const actual=drain(c).map(e=>({lap:Number(e.lap),keyIndex:e.keyIndex,event:e.event}));assert.deepEqual(actual,expected.events,'tick '+expected.tick);}
});

test('A5 host-time backlog and suspension emit at completed ticks only',()=>{
 const c=create(eventRig([{time:.125,name:'prepare'},{time:.5,name:'impact'}]));c.play(c.context,'costume',false);const h=new ReplayHostTimeBridge(c,0);h.advance(1000);assert.equal(c.currentFrame().completed,8n);assert.equal(status(c).pending,0);for(let i=1;i<=20&&c.currentFrame().backlog;i++)h.advance(1000+i*10);assert.equal(c.currentFrame().backlog,0n);assert.deepEqual(drain(c).map(e=>e.tick),[15n,60n]);h.pause(1300);const frame=c.currentFrame();assert.deepEqual(drain(c),[]);h.resume(100000);h.advance(100000);assert.equal(c.currentFrame().completed,frame.completed);assert.deepEqual(drain(c),[]);h.advance(100010);for(let i=1;i<=20&&c.currentFrame().backlog;i++)h.advance(100010+i*10);assert.equal(c.currentFrame().backlog,0n);assert.deepEqual(drain(c),[]);h.dispose();
});
test('A5 old frame data cannot serve as a drain context',()=>{const c=create();advance(c,30n);assert.throws(()=>(c as any).drainEvents(c.currentFrame()),/context/);assert.equal(drain(c).length,1);});

test('A5 refuses duration that underflows the native positive f32 domain',()=>assert.throws(()=>create(eventRig([],1e-50))));
