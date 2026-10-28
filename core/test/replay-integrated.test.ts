import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {ReplayConsumerBridge,ReplayMixPlan} from '../src/index.js';
const rig=()=>JSON.parse(readFileSync('../experimental/integrated-combat/fixtures/skeleton.json','utf8'));
test('A17 Gate A exact four capabilities compose FFD slots events on native export',()=>{
const c=new ReplayConsumerBridge(rig(),'Idle',1n,undefined,{crossfade:true,weightedFfd:true,animatedSlots:true,animationEvents:true});const f=c.currentFrame();assert.equal(f.mixing!.kind,'integrated-crossfade/v1');assert(f.deformation&&f.slotState);assert.equal(c.eventStatus(c.context).pending,0);
});

const make=(options:any={crossfade:true,weightedFfd:true,animatedSlots:true,animationEvents:true},r=rig())=>new ReplayConsumerBridge(r,'Idle',1n,undefined,options);
const advance=(c:ReplayConsumerBridge,t:bigint)=>{if(c.currentFrame().state==='stopped')c.play(c.context,'Idle',false);c.requestTick(c.context,t);while(c.currentFrame().backlog&&c.currentFrame().health==='healthy')c.pump(c.context,8);};
const numeric=(c:ReplayConsumerBridge)=>{const f=c.currentFrame();return{tick:f.completed,bones:f.bones,prePhysics:f.prePhysics,records:f.records,mixing:f.mixing,slotState:f.slotState,deformation:f.deformation};};
const json=(v:any)=>JSON.parse(JSON.stringify(v,(_,v)=>typeof v==='bigint'?String(v):v));
const occurrence=(v:any)=>{const{session,epoch,id,actorId,...out}=v;return json(out);};
const assertNativeEvents=(actual:any[],expected:any[])=>{assert.equal(actual.length,expected.length);actual.forEach((a,i)=>{const b=expected[i];a.slotState.slots.forEach((v:any,j:number)=>v.color.forEach((x:number,k:number)=>assert(Math.abs(x-b.slotState.slots[j].color[k])<=1e-5)));const clean=(v:any)=>({...v,slotState:{...v.slotState,slots:v.slotState.slots.map(({color,...s}:any)=>s)}});assert.deepEqual(clean(a),clean(b));});};
const reference=(file:string)=>JSON.parse(readFileSync('../experimental/integrated-combat/fixtures/'+file,'utf8'));
test('A17 Gate A native1441 frames/events and complete numerical replay',()=>{
 const c=make(),ref=reference('rust-a.json'),states=new Map<bigint,any>(),events=new Map<bigint,any>();let count=0;
 c.play(c.context,'Idle',false);
 for(const f of ref.frames){if(f.tick)advance(c,BigInt(f.tick));const v=c.currentFrame();assert.equal(v.health,'healthy');assert.deepEqual(json(v.mixing),f.mixing);
  assert.deepEqual(v.slotState!.drawOrder,f.drawOrder);v.slotState!.slots.forEach((s,i)=>{const e=f.slots[i];assert.deepEqual([s.name,s.owner,s.attachment,s.visible],[e.name,e.owner,e.attachment,e.visible]);s.color.forEach((x,k)=>assert(Math.abs(x-e.color[k])<=1e-5));});
  v.bones.forEach((b,i)=>Object.values(b.world).forEach((x,k)=>assert(Math.abs(x-f.bones[i].world[k])<=(k<4?1e-4:.01))));
  v.records.forEach((v,i)=>[v.rotation,v.x,v.y,v.rotationVelocity,v.velocityX,v.velocityY,v.anchorX,v.anchorY].forEach((x,k)=>assert(Math.abs(x-f.records[i].values[k])<=(k===0||k===3?.001:.01))));
  v.deformation!.entries[0]!.offsets.forEach((x,i)=>assert(Math.abs(x-f.offsets[i])<=.01));
  const batch=c.drainEvents(c.context);assertNativeEvents(batch.map(occurrence),f.events);assert(batch.every(e=>e.session===c.eventStatus(c.context).session&&e.epoch===v.epoch&&e.slotState!.tick===v.completed));assert(!batch.some(e=>e.event.time===0));count+=batch.length;
  states.set(v.completed,numeric(c));events.set(v.completed,batch.map(occurrence));
  for(const q of ref.commands.filter((q:any)=>q.requestedTick===f.tick))c.requestTransition(c.context,{to:q.to,durationTicks:BigInt(q.durationTicks),incomingTick:BigInt(q.incomingTick)});
 }
 assert(count>30);const old=c.eventStatus(c.context).session;c.replayFromOrigin(c.context,1440n);assert.notEqual(c.eventStatus(c.context).session,old);assert.equal(c.eventStatus(c.context).pending,0);
 for(let t=1n;t<=1440n;t++){c.pump(c.context,1);assert.deepEqual(numeric(c),states.get(t));assert.deepEqual(c.drainEvents(c.context).map(occurrence),events.get(t));}
});
test('A17 Gate A incoming events coexist with source visuals before weight1',()=>{
 const c=make();advance(c,60n);c.drainEvents(c.context);c.requestTransition(c.context,{to:'Attack',durationTicks:48n});advance(c,61n);assert.deepEqual(c.drainEvents(c.context),[]);advance(c,85n);
 const events=c.drainEvents(c.context),impact=events.find(e=>e.event.name==='attack_impact')!;assert(impact);assert.equal(impact.clip,'Attack');assert.equal(impact.tick,85n);assert.equal(impact.clipTick,24n);assert.equal(impact.slotState!.clip,'Idle');assert.equal(impact.slotState!.slots.find(s=>s.name==='eye_left')!.attachment,'closed');assert(impact.mixing!.transition!.weight<1);assert(!events.some(e=>e.clip==='Idle'));assert.equal(impact.keyIndex,2);
 advance(c,109n);const completion=c.drainEvents(c.context);assert.equal(completion.filter(e=>e.event.name==='attack_recover').length,1);assert.equal(completion.at(-1)!.mixing!.transition!.weight,1);advance(c,110n);assert.deepEqual(c.drainEvents(c.context).map(e=>e.event.name),['attack_after']);
});
test('A17 Gate A nonzero incoming phase has empty initial window and no retroactive impact',()=>{
 const c=make();advance(c,60n);c.drainEvents(c.context);c.requestTransition(c.context,{to:'Attack',durationTicks:24n,incomingTick:24n});advance(c,61n);assert.deepEqual(c.drainEvents(c.context),[]);advance(c,86n);assert.deepEqual(c.drainEvents(c.context).map(e=>e.event.name),['attack_recover','attack_after']);
});
test('A17 Gate A atomic queue overflow keeps1023 pending and previous complete acceptance',()=>{
 const r=rig(),event=r.animations.Attack.events.find((e:any)=>e.event==='none'||e.name==='attack_prepare');r.animations.Attack.events=[...Array.from({length:1023},(_,i)=>({...event,int:i,time:.05})),{...event,time:Math.fround(7/120)},{...event,time:Math.fround(7/120)}];
 const c=make(undefined,r);advance(c,60n);c.drainEvents(c.context);c.requestTransition(c.context,{to:'Attack',durationTicks:48n});advance(c,67n);assert.equal(c.eventStatus(c.context).pending,1023);const before=numeric(c);c.requestTick(c.context,68n);assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(numeric(c),before);const batch=c.drainEvents(c.context);assert.equal(batch.length,1023);assert.deepEqual(batch.map(e=>e.keyIndex),Array.from({length:1023},(_,i)=>i));assert.equal(c.eventStatus(c.context).pending,0);assert.throws(()=>c.requestTick(c.context,68n),/faulted/);
});
for(const fault of ['color','pose','observer','offset','owner','drawOrder','visibility'])test('A17 Gate A '+fault+' on event tick preserves prior queue and Physics',()=>{
 const c=make();advance(c,60n);const pending=c.eventStatus(c.context).pending;c.requestTransition(c.context,{to:'Attack',durationTicks:48n});advance(c,66n);const before=numeric(c),sample=ReplayMixPlan.prototype.sample;
 ReplayMixPlan.prototype.sample=function(t){const s=sample.call(this,t);if(t===67n){if(fault==='color')(s.slotState!.slots[0]!.color as any)[0]=1.1;if(fault==='pose')(s.locals[0]as any).x=Infinity;if(fault==='offset')(s.deformation!.entries[0]!.offsets as any)[0]=NaN;if(fault==='owner')(s.deformation!.entries[0]as any).attachment='foreign';if(fault==='drawOrder')(s.slotState!.drawOrder as any)[0]='foreign';if(fault==='visibility')(s.slotState!.slots[0]as any).visible=false;}return s;};
 try{c.requestTick(c.context,67n,()=>{assert.throws(()=>c.drainEvents(c.context),/busy/);assert.throws(()=>c.eventStatus(c.context),/busy/);if(fault==='observer')throw Error('abort candidate');});assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(numeric(c),before);assert.equal(c.eventStatus(c.context).pending,pending);assert(!c.drainEvents(c.context).some(e=>e.event.name==='attack_prepare'));}finally{ReplayMixPlan.prototype.sample=sample;}
});
test('A17 Gate A same-time order, detached payload/mixing/slots and failed external handler',()=>{
 const c=make();advance(c,60n);c.drainEvents(c.context);c.requestTransition(c.context,{to:'Attack',durationTicks:48n});advance(c,85n);const before=numeric(c),batch=c.drainEvents(c.context),pair=batch.filter(e=>e.event.time===Math.fround(.2));assert.deepEqual(pair.map(e=>e.event.name),['attack_impact','attack_impact_echo']);assert.deepEqual(pair.map(e=>e.ordinal),[0,1]);
 const other=structuredClone(pair[1]);(pair[0]!.event as any).name='mutated';(pair[0]!.slotState!.slots[0]!.color as any)[0]=99;(pair[0]!.mixing as any).tick=0n;assert.deepEqual(pair[1],other);assert.deepEqual(numeric(c),before);assert.deepEqual(c.drainEvents(c.context),[]);
 assert.throws(()=>{throw Error('application handler failed after drain');});assert.deepEqual(c.drainEvents(c.context),[]);assert.deepEqual(numeric(c),before);
});
for(const mutation of ['float','time','name','audio','unknown','balance'])test('A17 Gate A invalid native event '+mutation+' in another clip is refused',()=>{
 const r=rig(),e=r.animations.Death.events[0];if(mutation==='float')e.float=Infinity;if(mutation==='time')e.time=-1;if(mutation==='name')e.name='';if(mutation==='audio')e.audio={};if(mutation==='unknown')e.code='unknown';if(mutation==='balance')e.balance=2;assert.throws(()=>make(undefined,r));
});

for(const mutation of ['ownerAttachment','ownerVisible','constantAttachment','constantVisible','emptyTrack','emptyKey','unknownChannel','missingClip','extraClip','slotBudget','eventBudget','wrongLength','nonfinite','twoOwners','linked','skin','darkTint'])test('A17 exact admission refuses '+mutation,()=>{
const r=rig(),a=r.animations.Attack,t=a.deform[0];
if(mutation==='ownerAttachment')r.slots[0].attachment='wrong';if(mutation==='ownerVisible'||mutation==='constantVisible')a.slots.push({name:'body',channel:'visible',keys:[{time:0,value:mutation==='constantVisible',curve:'stepped'}]});if(mutation==='constantAttachment')a.slots.push({name:'body',channel:'attachment',keys:[{time:0,name:'body',curve:'stepped'}]});
if(mutation==='emptyTrack')t.keys=[];if(mutation==='emptyKey')t.keys[1].offsets=[];if(mutation==='unknownChannel')a.unqualified=[1];if(mutation==='missingClip')delete r.animations.Death;if(mutation==='extraClip')r.animations.Extra=structuredClone(a);if(mutation==='slotBudget')r.slots=Array.from({length:33},()=>r.slots[0]);if(mutation==='eventBudget')a.events[0].string='x'.repeat(8193);if(mutation==='wrongLength')t.keys[0].offsets.pop();if(mutation==='nonfinite')t.keys[0].offsets[0]=Infinity;if(mutation==='twoOwners')a.deform.push(structuredClone(t));if(mutation==='linked')r.skins[0].attachments.find((e:any)=>e.slot==='body'&&e.name==='body').attachment.linked={skin:'default',slot:'body',attachment:'body',inherit_deform:true};if(mutation==='skin')r.skins.push({...r.skins[0],name:'other'});if(mutation==='darkTint')r.slots[0].dark_color=[.1,.2,.3,1];assert.throws(()=>make(undefined,r));
});
const makeB=(r=rig())=>make({crossfade:true,weightedFfd:true,animatedSlots:true,animationEvents:true,interruptible:true},r);
const activeB=()=>{const c=makeB();advance(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:96n});advance(c,73n);return c;};
for(const file of ['rust-single.json','rust-repeat.json'])test('A17 Gate B native1441 frames/events and complete numerical replay '+file,()=>{
 const c=makeB(),ref=reference(file),states=new Map<bigint,any>(),events=new Map<bigint,any>();let count=0;
 c.play(c.context,'Idle',false);
 for(const f of ref.frames){if(f.tick)advance(c,BigInt(f.tick));const v=c.currentFrame();assert.equal(v.health,'healthy');assert.deepEqual(json(v.mixing),f.mixing);
  assert.deepEqual(v.slotState!.drawOrder,f.drawOrder);v.slotState!.slots.forEach((s,i)=>{const e=f.slots[i];assert.deepEqual([s.name,s.owner,s.attachment,s.visible],[e.name,e.owner,e.attachment,e.visible]);s.color.forEach((x,k)=>assert(Math.abs(x-e.color[k])<=1e-5));});
  v.bones.forEach((b,i)=>Object.values(b.world).forEach((x,k)=>assert(Math.abs(x-f.bones[i].world[k])<=(k<4?1e-4:.01))));
  v.records.forEach((v,i)=>[v.rotation,v.x,v.y,v.rotationVelocity,v.velocityX,v.velocityY,v.anchorX,v.anchorY].forEach((x,k)=>assert(Math.abs(x-f.records[i].values[k])<=(k===0||k===3?.001:.01))));
  v.deformation!.entries[0]!.offsets.forEach((x,i)=>assert(Math.abs(x-f.offsets[i])<=.01));
  const batch=c.drainEvents(c.context);assertNativeEvents(batch.map(occurrence),f.events);assert(batch.every(e=>e.session===c.eventStatus(c.context).session&&e.epoch===v.epoch&&e.slotState!.tick===v.completed));assert(!batch.some(e=>e.event.time===0));count+=batch.length;
  states.set(v.completed,numeric(c));events.set(v.completed,batch.map(occurrence));
  for(const q of ref.commands.filter((q:any)=>q.requestedTick===f.tick)){const request={to:q.to,durationTicks:BigInt(q.durationTicks),incomingTick:BigInt(q.incomingTick)};if(q.interrupt)c.requestInterrupt(c.context,request);else c.requestTransition(c.context,request);}
 }
 assert(count>30);const old=c.eventStatus(c.context).session;c.replayFromOrigin(c.context,1440n);assert.notEqual(c.eventStatus(c.context).session,old);assert.equal(c.eventStatus(c.context).pending,0);
 for(let t=1n;t<=1440n;t++){c.pump(c.context,1);assert.deepEqual(numeric(c),states.get(t));assert.deepEqual(c.drainEvents(c.context).map(occurrence),events.get(t));}
});

test('A17 Gate B pre-impact interruption suppresses future Attack, retains accepted prepare',()=>{
 const c=activeB(),before=numeric(c),pending=c.eventStatus(c.context).pending;c.requestInterrupt(c.context,{to:'Hit',durationTicks:48n});assert.deepEqual(numeric(c),before);assert.equal(c.eventStatus(c.context).pending,pending);advance(c,74n);assert.equal(c.eventStatus(c.context).pending,pending);advance(c,150n);const batch=c.drainEvents(c.context);assert(batch.some(e=>e.event.name==='attack_prepare'));assert(!batch.some(e=>e.event.name==='attack_impact'||e.event.name==='attack_recover'));const hit=batch.find(e=>e.event.name==='hit_react')!;assert.equal(hit.tick,75n);assert.equal(hit.clipTick,1n);assert.equal(hit.slotState!.tick,75n);
});
test('A17 Gate B post-impact interruption keeps already accepted impact and its original slots',()=>{
 const c=makeB();advance(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:96n});advance(c,90n);const count=c.eventStatus(c.context).pending;c.requestInterrupt(c.context,{to:'Hit',durationTicks:48n});assert.equal(c.eventStatus(c.context).pending,count);advance(c,98n);c.requestInterrupt(c.context,{to:'Death',durationTicks:36n});advance(c,160n);
 const batch=c.drainEvents(c.context),impact=batch.filter(e=>e.event.name==='attack_impact');assert.equal(impact.length,1);assert.equal(impact[0]!.tick,85n);assert.equal(impact[0]!.slotState!.tick,85n);assert.equal(impact[0]!.slotState!.slots.find(s=>s.name==='eye_left')!.attachment,'closed');assert(!batch.some(e=>e.clip==='Attack'&&e.tick>90n));assert(batch.some(e=>e.event.name==='hit_react'&&e.tick===92n));assert(batch.some(e=>e.event.name==='death_start'&&e.tick===100n));
});
test('A17 Gate B exact1024 queue limit and all-or-none simultaneous overflowing batch',()=>{
 const r=rig(),e=r.animations.Hit.events.find((e:any)=>e.name==='hit_react');r.animations.Hit.events=[...Array.from({length:1024},(_,i)=>({...e,int:i,time:Math.fround(1/120)})),{...e,time:Math.fround(2/120)}];const c=makeB(r);advance(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:96n});advance(c,73n);c.drainEvents(c.context);c.requestInterrupt(c.context,{to:'Hit',durationTicks:48n});advance(c,75n);assert.equal(c.eventStatus(c.context).pending,1024);const before=numeric(c);c.requestTick(c.context,76n);assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(numeric(c),before);const batch=c.drainEvents(c.context);assert.equal(batch.length,1024);assert(batch.every(e=>e.tick===75n&&e.clip==='Hit'&&e.slotState!.tick===75n));
});
for(const fault of ['color','pose','observer','offset','owner','drawOrder','visibility'])test('A17 Gate B '+fault+' rejects Hit event tick with all prior occurrences intact',()=>{
 const c=activeB(),pending=c.eventStatus(c.context).pending;c.requestInterrupt(c.context,{to:'Hit',durationTicks:48n});advance(c,74n);const before=numeric(c),sample=ReplayMixPlan.prototype.sample;
 ReplayMixPlan.prototype.sample=function(t){const s=sample.call(this,t);if(t===75n){if(fault==='color')(s.slotState!.slots[0]!.color as any)[0]=-1;if(fault==='pose')(s.locals[0]as any).x=Infinity;if(fault==='offset')(s.deformation!.entries[0]!.offsets as any)[0]=NaN;if(fault==='owner')(s.deformation!.entries[0]as any).attachment='wrong';if(fault==='drawOrder')(s.slotState!.drawOrder as any)[0]='foreign';if(fault==='visibility')(s.slotState!.slots[0]as any).visible=false;}return s;};
 try{c.requestTick(c.context,75n,()=>{assert.throws(()=>c.drainEvents(c.context),/busy/);if(fault==='observer')throw Error('late abort');});assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(numeric(c),before);assert.equal(c.eventStatus(c.context).pending,pending);assert(!c.drainEvents(c.context).some(e=>e.event.name==='hit_react'));}finally{ReplayMixPlan.prototype.sample=sample;}
});
test('A17 Gate B pause permits a pending interrupt but no events until resume; reset/stop drop old queues',()=>{
 const c=activeB();c.pause(c.context);const before=numeric(c),pending=c.eventStatus(c.context).pending;c.requestInterrupt(c.context,{to:'Hit',durationTicks:48n});assert.deepEqual(numeric(c),before);assert.equal(c.eventStatus(c.context).pending,pending);assert.throws(()=>c.requestTick(c.context,74n));c.resume(c.context);advance(c,75n);assert(c.drainEvents(c.context).some(e=>e.event.name==='hit_react'));
 const session=c.eventStatus(c.context).session,old=c.context;c.stop(old);assert.equal(c.eventStatus(c.context).pending,0);assert.notEqual(c.eventStatus(c.context).session,session);assert.equal(c.transitionStatus(c.context).commands,0);assert.throws(()=>c.drainEvents(old),/context/);advance(c,30n);assert(c.eventStatus(c.context).pending>0);c.reset(c.context,c.context.epoch+1n);assert.equal(c.eventStatus(c.context).pending,0);assert.deepEqual(c.drainEvents(c.context),[]);
});
test('A17 Gate B replay discards old pending session; numerical trace can be consumed again explicitly',()=>{
 const c=activeB();c.requestInterrupt(c.context,{to:'Hit',durationTicks:48n});advance(c,90n);const oldSession=c.eventStatus(c.context).session,pending=c.eventStatus(c.context).pending;assert(pending>0);c.replayFromOrigin(c.context,90n);assert.equal(c.eventStatus(c.context).pending,0);assert.notEqual(c.eventStatus(c.context).session,oldSession);while(c.currentFrame().backlog)c.pump(c.context,8);const batch=c.drainEvents(c.context);assert.equal(batch.length,pending);assert(batch.every(e=>e.epoch===c.context.epoch&&e.session!==oldSession));assert.deepEqual(c.drainEvents(c.context),[]);
});
test('A17 Gate B independent actors own different queues, owners, snapshots and drains',()=>{
 const a=activeB(),b=activeB();a.requestInterrupt(a.context,{to:'Hit',durationTicks:48n});b.requestInterrupt(b.context,{to:'Death',durationTicks:24n});advance(a,100n);advance(b,100n);const before=numeric(b),pending=b.eventStatus(b.context).pending;const x=a.drainEvents(a.context);assert(x.some(e=>e.clip==='Hit'));assert(!x.some(e=>e.clip==='Death'));assert.equal(b.eventStatus(b.context).pending,pending);(x.at(-1)!.slotState!.slots[0]!.color as any)[0]=99;assert.deepEqual(numeric(b),before);const y=b.drainEvents(b.context);assert(y.some(e=>e.clip==='Death'));assert.notEqual(x[0]!.session,y[0]!.session);assert.throws(()=>a.drainEvents(b.context),/context/);
});
test('A17 Gate B65th command preserves64 paired sources and all previously accepted events',()=>{
 const c=activeB();const count=c.eventStatus(c.context).pending;for(let i=1;i<64;i++){const t=BigInt(72+i);advance(c,t);c.requestInterrupt(c.context,{to:i%2?'Hit':'Attack',durationTicks:120n});}advance(c,136n);const before=numeric(c);assert.equal(c.transitionStatus(c.context).commands,64);assert.throws(()=>c.requestInterrupt(c.context,{to:'Death',durationTicks:24n}),/capacity/);assert.deepEqual(numeric(c),before);assert.equal(c.eventStatus(c.context).pending,count);const expected=c.drainEvents(c.context).map(occurrence);c.replayFromOrigin(c.context,136n);while(c.currentFrame().backlog)c.pump(c.context,8);assert.deepEqual(c.drainEvents(c.context).map(occurrence),expected);
});
test('A17 Gate B stale/backlog/presentation/reentrance refusals leave accepted queue and command count',()=>{
 const c=activeB(),before=numeric(c),pending=c.eventStatus(c.context).pending,count=c.transitionStatus(c.context).commands;c.present(()=>assert.throws(()=>c.drainEvents(c.context),/presentation/));assert.deepEqual(numeric(c),before);assert.equal(c.eventStatus(c.context).pending,pending);assert.throws(()=>c.requestInterrupt(c.context,{to:'missing',durationTicks:24n}));assert.equal(c.transitionStatus(c.context).commands,count);c.requestTick(c.context,100n);assert(c.currentFrame().backlog>0n);const current=numeric(c);assert.throws(()=>c.requestInterrupt(c.context,{to:'Hit',durationTicks:24n}),/backlog/);assert.deepEqual(numeric(c),current);
});


import {ReplayFfdMixer,FFD_MIX_LIMITS} from '../src/replay-ffd-mixing.js';
for(const corrupt of ['offset','owner','tick','rigIdentity','version','nested','local','slot','order','root'])test('A17 Gate B invalid frozen '+corrupt+' restore is atomic',()=>{
 const r=rig(),m=new ReplayMixPlan(r,'Idle',true,true,true,true);m.request(60n,{to:'Attack',durationTicks:96n});m.requestInterrupt(90n,{to:'Hit',durationTicks:48n},m.sample(90n));const commands=m.commands(),bad=structuredClone(commands),f=bad[1]!.frozen!;
 if(corrupt==='offset')(f.ffd!.deformation.entries[0]!.offsets as any)[0]+=.01;if(corrupt==='owner')(f.ffd!.deformation.entries[0]as any).attachment='same-sized';if(corrupt==='tick')(f.ffd!.deformation as any).tick=89n;if(corrupt==='rigIdentity')(f.ffd as any).rigIdentity+='foreign';if(corrupt==='version')(f.ffd as any).admissionVersion='next';if(corrupt==='nested')(f.ffd as any).nested=f;if(corrupt==='slot')(f.slotState!.slots[1]as any).attachment='wrong';if(corrupt==='order')(f.slotState!.drawOrder as any)[0]='wrong';if(corrupt==='root')(f as any).extra={nested:true};if(corrupt==='local')(f.locals[0]as any).x+=.01;
 const restored=new ReplayMixPlan(r,'Idle',true,true,true,true);assert.throws(()=>restored.restore(bad));assert.equal(restored.commandCount,0);assert.deepEqual(m.commands(),commands);restored.restore(commands);assert.deepEqual(restored.sample(110n),m.sample(110n));
});
for(const corrupt of ['offset','owner','localsExtra'])test('A17 Gate B invalid live accepted capture '+corrupt+' preserves journal',()=>{
 const m=new ReplayMixPlan(rig(),'Idle',true,true,true,true);m.request(60n,{to:'Attack',durationTicks:96n});const before=m.commands(),f=m.sample(90n);
 if(corrupt==='offset')(f.deformation!.entries[0]!.offsets as any)[0]+=.5;if(corrupt==='owner')(f.deformation!.entries[0]as any).attachment='different';if(corrupt==='localsExtra')(f.locals[0]as any).extra={nested:true};assert.throws(()=>m.requestInterrupt(90n,{to:'Hit',durationTicks:48n},f));assert.deepEqual(m.commands(),before);
});
test('A17 Gate B capture budget refuses before append, detached return cannot mutate retained source',()=>{
 const m=new ReplayMixPlan(rig(),'Idle',true,true,true,true);m.request(60n,{to:'Attack',durationTicks:96n});const before=m.commands(),fn=ReplayFfdMixer.prototype.capture;
 ReplayFfdMixer.prototype.capture=function(d){const v=fn.call(this,d);return{...v,rigIdentity:v.rigIdentity.repeat(20)};};try{assert.throws(()=>m.requestInterrupt(90n,{to:'Hit',durationTicks:48n},m.sample(90n)),/budget/);assert.deepEqual(m.commands(),before);}finally{ReplayFfdMixer.prototype.capture=fn;}
 const q=m.requestInterrupt(90n,{to:'Hit',durationTicks:48n},m.sample(90n)),after=m.sample(91n);(q.frozen!.ffd!.deformation.entries[0]!.offsets as any)[0]=999;assert.deepEqual(m.sample(91n),after);
});
test('A17 Gate B journal64/65, paired replay-origin verification and no per-event entries',()=>{
 const c=makeB();advance(c,1n);c.requestTransition(c.context,{to:'Attack',durationTicks:7200n});for(let n=2;n<=64;n++){advance(c,BigInt(n));c.requestInterrupt(c.context,{to:n%2?'Hit':'Death',durationTicks:7200n});}advance(c,65n);const before=numeric(c),status=c.transitionStatus(c.context);assert.equal(status.commands,64);assert.throws(()=>c.requestInterrupt(c.context,{to:'Hit',durationTicks:7200n}),/capacity/);assert.deepEqual(numeric(c),before);c.replayFromOrigin(c.context,65n);while(c.currentFrame().backlog)c.pump(c.context,8);assert.deepEqual(numeric(c),before);
 const m=new ReplayMixPlan(rig(),'Idle',true,true,true,true);m.request(1n,{to:'Attack',durationTicks:48n});m.requestInterrupt(8n,{to:'Hit',durationTicks:24n},m.sample(8n));const wrong=m.sample(8n);(wrong.deformation!.entries[0]!.offsets as any)[0]+=.01;assert.throws(()=>m.verifyOrigin(wrong),/origin/);
});

for(const origin of [89n,90n,108n,110n,120n])test('A17 integrated frozen maximum/stepped/completion neighborhood '+origin,()=>{
const m=new ReplayMixPlan(rig(),'Idle',true,true,true,true);m.request(60n,{to:'Attack',durationTicks:48n});if(origin>=109n)m.request(109n,{to:'Idle',durationTicks:48n});const before=m.sample(origin);const q=m.requestInterrupt(origin,{to:'Hit',durationTicks:24n},before),zero=m.sample(origin+1n);assert.deepEqual(zero.locals,before.locals);assert.deepEqual(zero.deformation!.entries[0]!.offsets,before.deformation!.entries[0]!.offsets);assert.deepEqual(zero.slotState!.slots,before.slotState!.slots);assert.deepEqual(zero.slotState!.drawOrder,before.slotState!.drawOrder);assert.equal(zero.mixing.transition!.weight,0);assert(q.frozen!.ffd&&q.frozen!.slotState);const restored=new ReplayMixPlan(rig(),'Idle',true,true,true,true);restored.restore(m.commands());assert.deepEqual(restored.sample(origin+10n),m.sample(origin+10n));
});
