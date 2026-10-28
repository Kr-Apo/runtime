import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {ReplayConsumerBridge} from '../src/index.js';
const rig=()=>JSON.parse(readFileSync('../experimental/ffd-crossfade/fixtures/skeleton.json','utf8'));
for(const interruptible of [false,true])test(`A16 Gate ${interruptible?'B':'A'} weighted FFD crossfade explicit admission exists`,()=>{
 const c=new ReplayConsumerBridge(rig(),'Idle',1n,undefined,{crossfade:true,weightedFfd:true,...(interruptible?{interruptible:true}:{})} as any);
 assert.equal(c.currentFrame().mixing!.kind,interruptible?'interruptible-crossfade-ffd/v1':'crossfade-ffd/v1');assert(c.currentFrame().deformation);
});

import {ReplayMixPlan} from '../src/replay-mixing.js';
import {ReplayFfdMixer,FFD_MIX_LIMITS} from '../src/replay-ffd-mixing.js';
const make=(r=rig())=>new ReplayConsumerBridge(r,'Idle',1n,undefined,{crossfade:true,weightedFfd:true});
const state=(c:ReplayConsumerBridge)=>{const f=c.currentFrame();return{tick:f.completed,bones:f.bones,records:f.records,mixing:f.mixing,prePhysics:f.prePhysics,deformation:f.deformation};};
const advance=(c:ReplayConsumerBridge,t:bigint)=>{if(c.currentFrame().state==='stopped')c.play(c.context,'Idle',false);c.requestTick(c.context,t);while(c.currentFrame().backlog&&c.currentFrame().health==='healthy')c.pump(c.context,8);};
test('A16 Gate A native1441 states offset/bone/Physics parity and exact whole replay',()=>{
 const c=make(),ref=JSON.parse(readFileSync('../experimental/ffd-crossfade/fixtures/rust-a.json','utf8')),rows:any[]=[];c.play(c.context,'Idle',false);
 for(const e of ref.frames){if(e.tick)advance(c,BigInt(e.tick));const f=c.currentFrame();assert.equal(f.health,'healthy');assert.equal(f.deformation!.clip,f.clip);assert.equal(f.deformation!.tick,f.completed);assert.equal(f.deformation!.entries.length,1);
 const d=f.deformation!.entries[0]!;assert.deepEqual({owner:d.owner,slot:d.slot,attachment:d.attachment},e.owner);d.offsets.forEach((v,i)=>assert(Math.abs(v-e.offsets[i])<=.01,e.tick+'/offset/'+i));
 f.bones.forEach((b,i)=>Object.values(b.world).forEach((v,k)=>assert(Math.abs(v-e.bones[i].world[k])<=(k<4?.0001:.01),e.tick+'/world/'+k)));
 f.records.forEach((v,i)=>[v.rotation,v.x,v.y,v.rotationVelocity,v.velocityX,v.velocityY,v.anchorX,v.anchorY].forEach((v,k)=>assert(Math.abs(v-e.records[i].values[k])<=(k===0||k===3?.001:.01),e.tick+'/Physics')));
 rows.push(state(c));for(const cmd of ref.commands.filter((v:any)=>v.requestedTick===e.tick))c.requestTransition(c.context,{to:cmd.to,durationTicks:BigInt(cmd.durationTicks),incomingTick:BigInt(cmd.incomingTick)});
 }
 c.replayFromOrigin(c.context,1440n);let checked=0;while(c.currentFrame().backlog)c.pump(c.context,1,f=>{checked++;assert.deepEqual({tick:f.tick,bones:f.pose.bones,records:f.records,mixing:f.mixing,prePhysics:f.prePhysics,deformation:f.deformation},rows[checked]);});assert.equal(checked,1440);
});
test('A16 Gate A exact endpoints, both nonzero phases and absent whole track rest',()=>{
 const r=rig(),m=new ReplayMixPlan(r,'Idle',false,false,false,true),ffd=new ReplayFfdMixer(r);m.request(60n,{to:'Attack',durationTicks:48n,incomingTick:24n});
 assert.deepEqual(m.sample(61n).deformation!.entries[0]!.offsets,ffd.sampleClip('Idle',61n));assert.deepEqual(m.sample(109n).deformation!.entries[0]!.offsets,ffd.sampleClip('Attack',72n));
 const f=m.sample(85n),tr=f.mixing.transition!,a=ffd.sampleClip('Idle',tr.fromTick),b=ffd.sampleClip('Attack',tr.toTick);assert(a.some(v=>v!==0)&&b.some(v=>v!==0));assert.deepEqual(f.deformation!.entries[0]!.offsets,a.map((x,i)=>x+(b[i]!-x)*tr.weight));
 m.request(120n,{to:'Hit',durationTicks:12n});assert(m.sample(133n).deformation!.entries[0]!.offsets.every(v=>v===0));
});
for(const mutation of ['foreignOwner','emptyFull','emptyTrack','twoOwners','linked','attachment','unknownTimeline','nonfiniteKey','wrongLength','componentBudget','storedBudget','skin','darkTint','slots','events','clipping','sequence','singularBind'])test('A16 Gate A refuses '+mutation+' before any consumer',()=>{
 const r=rig(),a=r.animations.Attack,t=a.deform[0],target=r.skins[0].attachments.find((e:any)=>e.slot===t.slot&&e.name===t.attachment);
 if(mutation==='foreignOwner'){const twin=structuredClone(target);twin.name='same-sized-twin';r.skins[0].attachments.push(twin);t.attachment=twin.name;}
 if(mutation==='emptyFull')t.keys[1].offsets=[];if(mutation==='emptyTrack')t.keys=[];if(mutation==='twoOwners')a.deform.push(structuredClone(t));
 if(mutation==='linked')target.attachment.linked={skin:'default',slot:t.slot,attachment:t.attachment,inherit_deform:true};
 if(mutation==='attachment')r.slots.find((s:any)=>s.name===t.slot).attachment=null;
 if(mutation==='unknownTimeline')a.unqualified=[1];if(mutation==='nonfiniteKey')t.keys[0].offsets[0]=NaN;if(mutation==='wrongLength')t.keys[0].offsets.pop();
 if(mutation==='componentBudget'){const m=target.attachment;for(const row of m.weights){const b=row.bones[0];if(b){row.bones=Array.from({length:180},()=>({...b}));row.count=180;}}for(const clip of Object.values(r.animations) as any[])for(const track of clip.deform)for(const k of track.keys)k.offsets=Array(2*m.weights.reduce((n:number,row:any)=>n+row.bones.length,0)).fill(0);}
 if(mutation==='storedBudget')t.keys=Array.from({length:FFD_MIX_LIMITS.keys+1},(_,i)=>({...structuredClone(t.keys[0]),time:i/1e5}));
 if(mutation==='skin')r.skins.push({...structuredClone(r.skins[0]),name:'alternate'});if(mutation==='darkTint')r.slots[0].dark_color=[.2,.3,.4,1];
 if(mutation==='slots')a.slots=[{name:r.slots[0].name,channel:'visible',keys:[{time:0,value:false}]}];if(mutation==='events')a.events=[{time:.1,name:'impact'}];
 if(mutation==='clipping')target.attachment={type:'clipping',vertices:[0,0,1,0,0,1],end_slot:null};if(mutation==='sequence')target.attachment.sequence={count:2};if(mutation==='singularBind')r.bones[0].scaleX=0;
 assert.throws(()=>make(r));
});
for(const options of [{crossfade:true},{crossfade:true,weightedFfd:false},{crossfade:true,weightedFfd:true,animatedSlots:true},{crossfade:true,weightedFfd:true,animationEvents:true},{crossfade:true,weightedFfd:true,clipping:true},{crossfade:true,weightedFfd:true,linkedMeshes:true}])test('A16 Gate A exact capability refusal '+JSON.stringify(options),()=>assert.throws(()=>new ReplayConsumerBridge(rig(),'Idle',1n,undefined,options as any)));
for(const fault of ['offset','owner','observer','pose'])test('A16 Gate A B6 '+fault+' rolls back complete numerical candidate',()=>{
 const c=make();advance(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:48n});const before=state(c),fn=ReplayMixPlan.prototype.sample;
 ReplayMixPlan.prototype.sample=function(t){const s=fn.call(this,t);if(t===61n){if(fault==='offset')(s.deformation!.entries[0]!.offsets as any)[0]=Infinity;if(fault==='owner')(s.deformation!.entries[0]as any).attachment='same-sized-twin';if(fault==='pose')(s.locals[0]as any).x=NaN;}return s;};
 try{c.requestTick(c.context,61n,()=>{if(fault==='observer')throw Error('audit fails');});assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(state(c),before);}finally{ReplayMixPlan.prototype.sample=fn;}
});
test('A16 Gate A finite native-domain keys and Bezier handles overflow sampled f32, candidate rejected',()=>{
 const r=rig();for(const a of Object.values(r.animations)as any[])for(const t of a.deform){t.keys=[{time:0,offsets:t.keys[0].offsets.map(()=>1e30),curve:{type:'bezier',handles:[.2,1e30,.8,1e30]}},{time:1,offsets:t.keys[0].offsets.map(()=>2e30),curve:'linear'}];a.duration=1.5;}
 const c=make(r),before=state(c);advance(c,1n);assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(state(c),before);
});
test('A16 Gate A pause/backlog/reset and independent detached accepted arrays',()=>{
 const c=make(),d=make();advance(c,60n);advance(d,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:48n});advance(c,85n);advance(d,85n);assert.notDeepEqual(c.currentFrame().deformation,d.currentFrame().deformation);
 const before=state(c);(c.currentFrame().deformation!.entries[0]!.offsets as any)[0]=999;assert.deepEqual(state(c),before);c.pause(c.context);assert.throws(()=>c.requestTick(c.context,86n));assert.deepEqual(state(c),before);c.resume(c.context);advance(c,86n);c.reset(c.context,2n);assert.equal(c.currentFrame().completed,0n);
});

const makeB=(r=rig())=>new ReplayConsumerBridge(r,'Idle',1n,undefined,{crossfade:true,weightedFfd:true,interruptible:true});
for(const mode of ['single','repeat'])test('A16 Gate B native1441 offsets/Physics/poses and full exact replay '+mode,()=>{
 const c=makeB(),ref=JSON.parse(readFileSync('../experimental/ffd-crossfade/fixtures/rust-'+mode+'.json','utf8')),rows:any[]=[];c.play(c.context,'Idle',false);
 for(const e of ref.frames){if(e.tick)advance(c,BigInt(e.tick));const f=c.currentFrame();assert.equal(f.health,'healthy');assert.deepEqual(JSON.parse(JSON.stringify(f.mixing,(_,v)=>typeof v==='bigint'?String(v):v)),e.mixing);const d=f.deformation!.entries[0]!;assert.deepEqual({owner:d.owner,slot:d.slot,attachment:d.attachment},e.owner);d.offsets.forEach((v,i)=>assert(Math.abs(v-e.offsets[i])<=.01));f.bones.forEach((b,i)=>Object.values(b.world).forEach((v,k)=>assert(Math.abs(v-e.bones[i].world[k])<=(k<4?.0001:.01))));f.records.forEach((v,i)=>[v.rotation,v.x,v.y,v.rotationVelocity,v.velocityX,v.velocityY,v.anchorX,v.anchorY].forEach((v,k)=>assert(Math.abs(v-e.records[i].values[k])<=(k===0||k===3?.001:.01))));rows.push(state(c));
 for(const q of ref.commands.filter((v:any)=>v.requestedTick===e.tick)){const request={to:q.to,durationTicks:BigInt(q.durationTicks),incomingTick:BigInt(q.incomingTick)};if(q.interrupt)c.requestInterrupt(c.context,request);else c.requestTransition(c.context,request);}}
 c.replayFromOrigin(c.context,1440n);let n=0;while(c.currentFrame().backlog)c.pump(c.context,1,f=>{n++;assert.deepEqual({tick:f.tick,bones:f.pose.bones,records:f.records,mixing:f.mixing,prePhysics:f.prePhysics,deformation:f.deformation},rows[n]);});assert.equal(n,1440);
});
test('A16 Gate B source is flat exact accepted prePhysics and offsets, abandoned sampler not used',()=>{
 const c=makeB();advance(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:96n});advance(c,90n);const before=c.currentFrame(),q=c.requestInterrupt(c.context,{to:'Hit',durationTicks:48n});
 assert.deepEqual(q.frozen!.locals,before.prePhysics);assert.deepEqual(q.frozen!.ffd!.deformation,before.deformation);assert(q.frozen!.ffd!.rigIdentity.length<=FFD_MIX_LIMITS.identityUnits);assert.equal(q.frozen!.ffd!.admissionVersion,FFD_MIX_LIMITS.admissionVersion);
 const sample=ReplayFfdMixer.prototype.sampleClip,calls:string[]=[];ReplayFfdMixer.prototype.sampleClip=function(clip,t){calls.push(clip);return sample.call(this,clip,t);};
 try{advance(c,91n);assert.deepEqual(c.currentFrame().prePhysics,before.prePhysics);assert.deepEqual(c.currentFrame().deformation!.entries[0]!.offsets,before.deformation!.entries[0]!.offsets);advance(c,98n);assert(calls.every(n=>n==='Hit'));const second=c.currentFrame();c.requestInterrupt(c.context,{to:'Death',durationTicks:36n});calls.length=0;advance(c,99n);assert.deepEqual(c.currentFrame().prePhysics,second.prePhysics);assert.deepEqual(c.currentFrame().deformation!.entries[0]!.offsets,second.deformation!.entries[0]!.offsets);assert.deepEqual(calls,['Death']);}finally{ReplayFfdMixer.prototype.sampleClip=sample;}
});
for(const corrupt of ['offset','owner','tick','rigIdentity','version','nested','local'])test('A16 Gate B invalid frozen '+corrupt+' restore is atomic',()=>{
 const r=rig(),m=new ReplayMixPlan(r,'Idle',true,false,false,true);m.request(60n,{to:'Attack',durationTicks:96n});m.requestInterrupt(90n,{to:'Hit',durationTicks:48n},m.sample(90n));const commands=m.commands(),bad=structuredClone(commands),f=bad[1]!.frozen!;
 if(corrupt==='offset')(f.ffd!.deformation.entries[0]!.offsets as any)[0]+=.01;if(corrupt==='owner')(f.ffd!.deformation.entries[0]as any).attachment='same-sized';if(corrupt==='tick')(f.ffd!.deformation as any).tick=89n;if(corrupt==='rigIdentity')(f.ffd as any).rigIdentity+='foreign';if(corrupt==='version')(f.ffd as any).admissionVersion='next';if(corrupt==='nested')(f.ffd as any).nested=f;if(corrupt==='local')(f.locals[0]as any).x+=.01;
 const restored=new ReplayMixPlan(r,'Idle',true,false,false,true);assert.throws(()=>restored.restore(bad));assert.equal(restored.commandCount,0);assert.deepEqual(m.commands(),commands);restored.restore(commands);assert.deepEqual(restored.sample(110n),m.sample(110n));
});
for(const corrupt of ['offset','owner','localsExtra'])test('A16 Gate B invalid live accepted capture '+corrupt+' preserves journal',()=>{
 const m=new ReplayMixPlan(rig(),'Idle',true,false,false,true);m.request(60n,{to:'Attack',durationTicks:96n});const before=m.commands(),f=m.sample(90n);
 if(corrupt==='offset')(f.deformation!.entries[0]!.offsets as any)[0]+=.5;if(corrupt==='owner')(f.deformation!.entries[0]as any).attachment='different';if(corrupt==='localsExtra')(f.locals[0]as any).extra={nested:true};assert.throws(()=>m.requestInterrupt(90n,{to:'Hit',durationTicks:48n},f));assert.deepEqual(m.commands(),before);
});
test('A16 Gate B capture budget refuses before append, detached return cannot mutate retained source',()=>{
 const m=new ReplayMixPlan(rig(),'Idle',true,false,false,true);m.request(60n,{to:'Attack',durationTicks:96n});const before=m.commands(),fn=ReplayFfdMixer.prototype.capture;
 ReplayFfdMixer.prototype.capture=function(d){const v=fn.call(this,d);return{...v,rigIdentity:v.rigIdentity.repeat(20)};};try{assert.throws(()=>m.requestInterrupt(90n,{to:'Hit',durationTicks:48n},m.sample(90n)),/budget/);assert.deepEqual(m.commands(),before);}finally{ReplayFfdMixer.prototype.capture=fn;}
 const q=m.requestInterrupt(90n,{to:'Hit',durationTicks:48n},m.sample(90n)),after=m.sample(91n);(q.frozen!.ffd!.deformation.entries[0]!.offsets as any)[0]=999;assert.deepEqual(m.sample(91n),after);
});
test('A16 Gate B journal64/65, paired replay-origin verification and no per-event entries',()=>{
 const c=makeB();advance(c,1n);c.requestTransition(c.context,{to:'Attack',durationTicks:7200n});for(let n=2;n<=64;n++){advance(c,BigInt(n));c.requestInterrupt(c.context,{to:n%2?'Hit':'Death',durationTicks:7200n});}advance(c,65n);const before=state(c),status=c.transitionStatus(c.context);assert.equal(status.commands,64);assert.throws(()=>c.requestInterrupt(c.context,{to:'Hit',durationTicks:7200n}),/capacity/);assert.deepEqual(state(c),before);c.replayFromOrigin(c.context,65n);while(c.currentFrame().backlog)c.pump(c.context,8);assert.deepEqual(state(c),before);
 const m=new ReplayMixPlan(rig(),'Idle',true,false,false,true);m.request(1n,{to:'Attack',durationTicks:48n});m.requestInterrupt(8n,{to:'Hit',durationTicks:24n},m.sample(8n));const wrong=m.sample(8n);(wrong.deformation!.entries[0]!.offsets as any)[0]+=.01;assert.throws(()=>m.verifyOrigin(wrong),/origin/);
});
test('A16 Gate B paused interrupt, backlog, stale context, resets preserve accepted pairing',()=>{
 const c=makeB();advance(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:96n});advance(c,90n);c.pause(c.context);const before=state(c);c.requestInterrupt(c.context,{to:'Hit',durationTicks:48n});assert.deepEqual(state(c),before);c.resume(c.context);advance(c,91n);assert.deepEqual(c.currentFrame().deformation!.entries[0]!.offsets,before.deformation!.entries[0]!.offsets);const old=c.context;c.reset(old,2n);assert.throws(()=>c.requestInterrupt(old,{to:'Death',durationTicks:24n}));assert.equal(c.currentFrame().completed,0n);
});

import {isEventMixKind,isSlotMixKind,isInterruptibleMixKind,isFfdMixKind} from '../src/replay-mixing.js';
test('A16 kinds do not open A14/A15 slot or event capabilities',()=>{for(const kind of ['crossfade-ffd/v1','interruptible-crossfade-ffd/v1']){assert(isFfdMixKind(kind));assert(!isEventMixKind(kind));assert(!isSlotMixKind(kind));assert.equal(isInterruptibleMixKind(kind),kind.startsWith('interruptible'));}const c=makeB();assert.throws(()=>c.drainEvents(c.context),/capability/);});

for(const field of ['offset','handle'])test('A16 nonrepresentable native f32 '+field+' refuses at admission',()=>{const r=rig(),k=r.animations.Attack.deform[0].keys[0];if(field==='offset')k.offsets[0]=1e308;else k.curve={type:'bezier',handles:[.2,1e308,.8,1]};assert.throws(()=>make(r),/native f32/);});
