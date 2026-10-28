import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {ReplayConsumerBridge,ReplayAnimationInstance} from '../src/index.js';
import {ReplayMixPlan} from '../src/replay-mixing.js';
import {mixSlotStates} from '../src/replay-slot-mixing.js';
const rig=()=>JSON.parse(readFileSync('../experimental/slot-crossfade/fixtures/skeleton.json','utf8'));
for(const interruptible of [false,true])test(`A14 Gate ${interruptible?'B':'A'} admission exists explicitly`,()=>{
 const c=new ReplayConsumerBridge(rig(),'Idle',1n,undefined,{crossfade:true,animatedSlots:true,...(interruptible?{interruptible:true}:{})} as any);
 assert.equal(c.currentFrame().mixing!.kind,interruptible?'interruptible-crossfade-slots/v1':'crossfade-slots/v1');assert(c.currentFrame().slotState);
});
const make=()=>new ReplayConsumerBridge(rig(),'Idle',1n,undefined,{crossfade:true,animatedSlots:true});
const numerical=(c:ReplayConsumerBridge)=>{const f=c.currentFrame();return {tick:f.completed,bones:f.bones,records:f.records,mixing:f.mixing,prePhysics:f.prePhysics,slotState:f.slotState};};
const advance=(c:ReplayConsumerBridge,t:bigint)=>{if(c.currentFrame().state==='stopped')c.play(c.context,'Idle',false);c.requestTick(c.context,t);while(c.currentFrame().backlog&&c.currentFrame().health==='healthy')c.pump(c.context,8);};
test('A14 Gate A independent native721 states compose bones, Physics and complete slots',()=>{
 const c=make(),ref=JSON.parse(readFileSync('../experimental/slot-crossfade/fixtures/rust-a.json','utf8'));c.play(c.context,'Idle',false);
 let colorMax=0;for(const expected of ref.frames){if(expected.tick)advance(c,BigInt(expected.tick));const f=c.currentFrame();
  assert.equal(f.slotState!.tick,f.completed);assert.equal(f.slotState!.clip,f.clip);assert.equal(f.slotState!.skin,'default');assert.deepEqual(f.slotState!.drawOrder,expected.drawOrder);
  f.slotState!.slots.forEach((s,i)=>{const e=expected.slots[i];assert.deepEqual([s.name,s.owner,s.attachment,s.visible],[e.name,e.owner,e.attachment,e.visible]);s.color.forEach((v,k)=>{const d=Math.abs(v-e.color[k]);colorMax=Math.max(colorMax,d);assert(d<=1e-5,expected.tick+'/RGBA/'+d);});});
  f.bones.forEach((b,i)=>Object.values(b.world).forEach((v,k)=>assert(Math.abs(v-expected.bones[i].world[k])<=(k<4?.0001:.01))));
  f.records.forEach((v,i)=>[v.rotation,v.x,v.y,v.rotationVelocity,v.velocityX,v.velocityY,v.anchorX,v.anchorY].forEach((v,k)=>assert(Math.abs(v-expected.records[i].values[k])<=(k===0||k===3?.001:.01))));
  for(const cmd of ref.commands.filter((v:any)=>v.requestedTick===expected.tick))c.requestTransition(c.context,{to:cmd.to,durationTicks:BigInt(cmd.durationTicks),incomingTick:BigInt(cmd.incomingTick)});
 }
 assert(colorMax>=0);const end=numerical(c);c.replayFromOrigin(c.context,720n);while(c.currentFrame().backlog)c.pump(c.context,8);assert.deepEqual(numerical(c),end);
});
test('A14 Gate A live source discrete channels advance, target switches atomically only at weight1',()=>{
 const c=make();advance(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:48n});advance(c,71n);assert.equal(c.currentFrame().slotState!.slots.find(s=>s.name==='eye_left')!.attachment,'open');advance(c,72n);assert.equal(c.currentFrame().slotState!.slots.find(s=>s.name==='eye_left')!.attachment,'closed');
 advance(c,108n);assert.equal(c.currentFrame().mixing!.transition!.weight,Math.fround(47/48));assert.equal(c.currentFrame().slotState!.slots.find(s=>s.name==='badge')!.attachment,null);
 advance(c,109n);assert.equal(c.currentFrame().mixing!.transition!.weight,1);assert.equal(c.currentFrame().clip,'Attack');assert.equal(c.currentFrame().slotState!.slots.find(s=>s.name==='eye_left')!.attachment,'open');assert.equal(c.currentFrame().slotState!.slots.find(s=>s.name==='badge')!.attachment,'sun');
});
test('A14 Gate A normalized RGBA endpoints are exact, independent of discrete attachment/order choice',()=>{
 const r=rig(),c=make(),a=c.currentFrame().slotState!;advance(c,100n);const b=c.currentFrame().slotState!;
 for(const weight of [0,1]){const s=mixSlotStates(r,a,b,weight,500n,'Idle'),expected=weight===0?a:b;assert.deepEqual(s.slots,expected.slots);assert.deepEqual(s.drawOrder,expected.drawOrder);}
 const s=mixSlotStates(r,a,b,.5,500n,'Idle');assert.deepEqual(s.drawOrder,a.drawOrder);s.slots.forEach((v,i)=>v.color.forEach((x,k)=>assert.equal(x,a.slots[i]!.color[k]!+(b.slots[i]!.color[k]!-a.slots[i]!.color[k]!)*.5)));
});
for(const fault of ['rgba','orderMissing','orderDuplicate','attachment','pose'])test('A14 Gate A invalid composed '+fault+' rolls back the complete candidate',()=>{
 const c=make();advance(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:48n});const before=numerical(c),fn=ReplayMixPlan.prototype.sample;
 ReplayMixPlan.prototype.sample=function(t){const v=fn.call(this,t);if(t===61n){if(fault==='rgba')(v.slotState!.slots[0]!.color as any)[0]=1.1;if(fault==='orderMissing')(v.slotState!.drawOrder as any).pop();if(fault==='orderDuplicate')(v.slotState!.drawOrder as any)[0]=v.slotState!.drawOrder[1];if(fault==='attachment')(v.slotState!.slots[0]as any).attachment='unknown';if(fault==='pose')(v.locals[0]as any).x=Infinity;}return v;};
 try{c.requestTick(c.context,61n);assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(numerical(c),before);}finally{ReplayMixPlan.prototype.sample=fn;}
});
test('A14 Gate A finite valid color keys can overshoot and reject before any partial accept',()=>{
 const r=rig(),track=r.animations.Attack.slots.find((s:any)=>s.channel==='color');track.keys=[{time:0,color:[0,0,0,0],curve:{type:'bezier',handles:[.25,10,.75,10]}},{time:.5,color:[1,1,1,1],curve:'linear'}];const c=new ReplayConsumerBridge(r,'Idle',1n,undefined,{crossfade:true,animatedSlots:true});advance(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:48n});advance(c,61n);let failed=false;for(let t=62n;t<121n;t++){const before=numerical(c);c.requestTick(c.context,t);if(c.currentFrame().health==='faulted'){assert.deepEqual(numerical(c),before);failed=true;break;}}assert(failed);
});
test('A14 Gate A snapshots detach and redraw cannot sample bones or slots',()=>{
 const c=make();advance(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:48n});advance(c,73n);const before=numerical(c),fn=ReplayMixPlan.prototype.sample;ReplayMixPlan.prototype.sample=()=>{throw Error('redraw sampled');};
 try{for(let i=0;i<10;i++)c.present(f=>{(f.slotState!.slots[0]!.color as any)[0]=99;(f.slotState!.drawOrder as any).reverse();});assert.deepEqual(numerical(c),before);}finally{ReplayMixPlan.prototype.sample=fn;}
});
for(const key of ['deform','events','ik'])test('A14 Gate A excluded '+key+' in another clip is refused at admission',()=>{const r=rig();r.animations.Death[key]=[{}];assert.throws(()=>new ReplayConsumerBridge(r,'Idle',1n,undefined,{crossfade:true,animatedSlots:true}));});

const makeB=(options:any={crossfade:true,interruptible:true,animatedSlots:true},r=rig())=>new ReplayConsumerBridge(r,'Idle',1n,undefined,options);
const advanceB=(c:ReplayConsumerBridge,t:bigint)=>{if(c.currentFrame().state==='stopped')c.play(c.context,'Idle',false);c.requestTick(c.context,t);while(c.currentFrame().backlog&&c.currentFrame().health==='healthy')c.pump(c.context,8);};
const stateB=(c:ReplayConsumerBridge)=>{const f=c.currentFrame();return {tick:f.completed,bones:f.bones,records:f.records,mixing:f.mixing,prePhysics:f.prePhysics,slotState:f.slotState};};
const activeB=()=>{const c=makeB();advanceB(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:96n});advanceB(c,73n);return c;};
const requestB={to:'Hit',durationTicks:24n};
test('A14 Gate B exposes an explicit interrupt request on the native consumer',()=>{
 assert.equal(typeof (ReplayConsumerBridge.prototype as any).requestInterrupt,'function');
});
for(const file of ['rust-b.json','rust-before.json'])test('A14 Gate B native independent Physics trajectory and full accepted replay '+file,()=>{
 const c=makeB(),ref=JSON.parse(readFileSync('../experimental/slot-crossfade/fixtures/'+file,'utf8')),original=new Map<bigint,ReturnType<typeof stateB>>();
 c.play(c.context,'Idle',false);
 for(const f of ref.frames){
  if(f.tick)advanceB(c,BigInt(f.tick));const v=c.currentFrame();assert.deepEqual(v.slotState!.drawOrder,f.drawOrder);v.slotState!.slots.forEach((s,i)=>{const e=f.slots[i];assert.deepEqual([s.name,s.owner,s.attachment,s.visible],[e.name,e.owner,e.attachment,e.visible]);s.color.forEach((x,k)=>assert(Math.abs(x-e.color[k])<=1e-5));});
  assert.deepEqual(JSON.parse(JSON.stringify(v.mixing,(_,v)=>typeof v==='bigint'?String(v):v)),f.mixing);
  v.prePhysics!.forEach((b,i)=>{const expected=f.pureBones[i].local;[b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY].forEach((n,k)=>{const raw=n-expected[k],d=k===2?Math.abs(Math.atan2(Math.sin(raw),Math.cos(raw))):Math.abs(raw);assert(d<=(k===2?.001:.0001));});});
  v.bones.forEach((b,i)=>Object.values(b.world).forEach((n,k)=>assert(Math.abs(n-f.bones[i].world[k])<=(k<4?.0001:.01))));
  v.records.forEach((rec,i)=>[rec.rotation,rec.x,rec.y,rec.rotationVelocity,rec.velocityX,rec.velocityY,rec.anchorX,rec.anchorY].forEach((n,k)=>assert(Math.abs(n-f.records[i].values[k])<=(k===0||k===3?.001:.01))));
  original.set(v.completed,stateB(c));
  for(const q of ref.commands.filter((q:any)=>q.requestedTick===f.tick)){
   const before=stateB(c),req={to:q.to,durationTicks:BigInt(q.durationTicks),incomingTick:BigInt(q.incomingTick)};
   if(q.interrupt)c.requestInterrupt(c.context,req);else c.requestTransition(c.context,req);
   assert.deepEqual(stateB(c),before);
  }
 }
 const old=c.context;c.replayFromOrigin(c.context,720n);assert.throws(()=>c.requestInterrupt(old,requestB),/context/);
 let count=0;while(c.currentFrame().backlog)c.pump(c.context,1,f=>{
  const e=original.get(f.tick)!;assert.deepEqual({tick:f.tick,bones:f.pose.bones,records:f.records,mixing:f.mixing,prePhysics:f.prePhysics,slotState:f.slotState},e);count++;
 });assert.equal(count,720);assert.deepEqual(stateB(c),original.get(720n));
});
test('A14 Gate B start uses exact accepted pre-Physics input, not already-constrained bone locals',()=>{
 const c=activeB(),before=stateB(c);assert(before.prePhysics);
 assert(before.prePhysics.some((v,i)=>v.rotation!==before.bones[i]!.rotation||v.x!==before.bones[i]!.x||v.y!==before.bones[i]!.y));
 c.requestInterrupt(c.context,requestB);assert.deepEqual(stateB(c),before);advanceB(c,74n);
 assert.deepEqual(c.currentFrame().prePhysics,before.prePhysics);
 assert.equal(c.currentFrame().mixing!.transition!.weight,0);
 assert.notDeepEqual(c.currentFrame().records,before.records);
});
test('A14 Gate B pause/resume preserves frozen source, reset clears it and rejects old contexts',()=>{
 const c=activeB();c.requestInterrupt(c.context,requestB);advanceB(c,80n);c.pause(c.context);const before=stateB(c);
 assert.throws(()=>c.requestTick(c.context,81n));assert.deepEqual(stateB(c),before);
 c.resume(c.context);advanceB(c,81n);assert.equal(c.currentFrame().mixing!.transition!.elapsedTicks,7n);
 const old=c.context;c.reset(old,2n);assert.equal(c.transitionStatus(c.context).commands,0);assert.equal(c.currentFrame().mixing!.kind,'interruptible-crossfade-slots/v1');assert.throws(()=>c.requestInterrupt(old,requestB),/context/);
});
test('A14 Gate B rejected pending, unknown, invalid phase, presentation and candidate requests do not mutate state',()=>{
 const c=activeB(),before=stateB(c),commands=c.transitionStatus(c.context).commands;
 for(const req of [{to:'missing',durationTicks:12n},{to:'Hit',durationTicks:0n},{to:'Hit',durationTicks:12n,incomingTick:-1n}])assert.throws(()=>c.requestInterrupt(c.context,req));
 c.present(()=>assert.throws(()=>c.requestInterrupt(c.context,requestB),/presentation/));assert.deepEqual(stateB(c),before);
 assert.equal(c.transitionStatus(c.context).commands,commands);c.requestInterrupt(c.context,requestB);
 assert.throws(()=>c.requestInterrupt(c.context,requestB),/pending/);assert.deepEqual(stateB(c),before);
 c.requestTick(c.context,74n,()=>{assert.throws(()=>c.requestInterrupt(c.context,requestB),/busy/);});
 assert.equal(c.currentFrame().health,'healthy');
});
test('A14 Gate B backlog admission and old capabilities remain closed',()=>{
 const c=activeB();c.requestTick(c.context,120n);assert(c.currentFrame().backlog>0n);const before=stateB(c);
 assert.throws(()=>c.requestInterrupt(c.context,requestB),/backlog/);assert.deepEqual(stateB(c),before);
 const a12=makeB({crossfade:true},JSON.parse(readFileSync('../experimental/interruptions/fixtures/skeleton.json','utf8')));advanceB(a12,60n);a12.requestTransition(a12.context,{to:'Attack',durationTicks:48n});advanceB(a12,73n);
 assert.throws(()=>a12.requestInterrupt(a12.context,requestB),/capability/);assert.equal(a12.currentFrame().prePhysics,undefined);
 for(const opts of [{interruptible:true},{crossfade:true,interruptible:false},{crossfade:true,interruptible:true,weightedFfd:true},{crossfade:true,interruptible:false,animatedSlots:true},{crossfade:true,interruptible:true,animationEvents:true},{crossfade:true,interruptible:true,clipping:true},{crossfade:true,interruptible:true,linkedMeshes:true}])assert.throws(()=>makeB(opts));
});
for(const failure of ['first','middle','observer'])test('A14 Gate B '+failure+' failure preserves locals, frozen metadata, Physics and clock',()=>{
 const c=activeB();c.requestInterrupt(c.context,requestB);if(failure==='middle')advanceB(c,80n);
 const before=stateB(c),t=before.tick+1n,fn=ReplayMixPlan.prototype.sample;
 ReplayMixPlan.prototype.sample=function(tick){const packet=fn.call(this,tick);if(tick===t&&failure!=='observer')(packet.locals[0]as any).x=Infinity;return packet;};
 try{c.requestTick(c.context,t,()=>{if(failure==='observer')throw Error('observer abort');});assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(stateB(c),before);assert.throws(()=>c.requestInterrupt(c.context,requestB),/faulted/);}finally{ReplayMixPlan.prototype.sample=fn;}
});
test('A14 Gate B detached captures and redraw do not resample, mix or advance Physics',()=>{
 const c=activeB();c.requestInterrupt(c.context,requestB);advanceB(c,80n);const before=stateB(c),sample=ReplayMixPlan.prototype.sample,plan=ReplayMixPlan.prototype.stateAt;
 ReplayMixPlan.prototype.sample=()=>{throw Error('unexpected sampler');};ReplayMixPlan.prototype.stateAt=()=>{throw Error('unexpected mix');};
 try{for(let i=0;i<10;i++){c.transitionStatus(c.context);c.present(f=>{(f.prePhysics![0]as any).x=999;(f.mixing!.transition!.source as any).tick=0n;});}assert.deepEqual(stateB(c),before);}finally{ReplayMixPlan.prototype.sample=sample;ReplayMixPlan.prototype.stateAt=plan;}
});
test('A14 Gate B two actors own independent frozen poses, commands and numerical states',()=>{
 const a=activeB(),b=activeB(),before=stateB(b);a.requestInterrupt(a.context,requestB);advanceB(a,78n);a.requestInterrupt(a.context,{to:'Death',durationTicks:12n});advanceB(a,85n);assert.deepEqual(stateB(b),before);
 b.requestInterrupt(b.context,{to:'Death',durationTicks:36n});advanceB(b,85n);assert.notDeepEqual(stateB(a),stateB(b));
});
test('A14 Gate B real finite Bezier keys overflow during the interrupted target and B6 keeps the previous acceptance',()=>{
 const r=rig(),root=r.animations.Hit.bones.find((b:any)=>b.name==='root');
 root.translate_x=[{time:0,value:0,curve:'linear'},{time:Math.fround(7/120),value:0,curve:{type:'bezier',handles:[.25,1e308,.75,1e308]}},{time:Math.fround(9/120),value:10,curve:'linear'}];
 const c=makeB({crossfade:true,interruptible:true,animatedSlots:true},r);advanceB(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:96n});advanceB(c,73n);c.requestInterrupt(c.context,requestB);advanceB(c,81n);const before=stateB(c);
 assert.equal(before.tick,81n);c.requestTick(c.context,82n);assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(stateB(c),before);
});
test('A14 Gate B consumer shares a bounded 64-command budget, rejects overflow and can explicitly reset',()=>{
 const c=makeB();c.play(c.context,'Idle',false);c.requestTransition(c.context,{to:'Attack',durationTicks:120n});
 for(let i=1;i<64;i++){advanceB(c,BigInt(i));c.requestInterrupt(c.context,{to:i%2?'Hit':'Attack',durationTicks:120n});}
 advanceB(c,64n);const before=stateB(c);assert.equal(c.transitionStatus(c.context).commands,64);
 assert.throws(()=>c.requestInterrupt(c.context,{to:'Death',durationTicks:12n}),/capacity/);assert.deepEqual(stateB(c),before);assert.equal(c.transitionStatus(c.context).commands,64);
 c.reset(c.context,2n);assert.equal(c.transitionStatus(c.context).commands,0);
});
test('A14 Gate B command snapshot rejects reentrance and accessor failure before journal publication',()=>{
 const c=activeB(),before=stateB(c),count=c.transitionStatus(c.context).commands;
 const bad={get to(){assert.throws(()=>c.stop(c.context),/busy/);return 'Hit';},get durationTicks():bigint{throw Error('accessor failure');}};
 assert.throws(()=>c.requestInterrupt(c.context,bad),/accessor failure/);assert.deepEqual(stateB(c),before);assert.equal(c.transitionStatus(c.context).commands,count);
 const requestB={get to(){assert.throws(()=>c.requestInterrupt(c.context,{to:'Death',durationTicks:12n}),/busy/);assert.throws(()=>c.reset(c.context,2n),/busy/);return 'Hit';},durationTicks:24n};
 c.requestInterrupt(c.context,requestB);assert.deepEqual(stateB(c),before);assert.equal(c.transitionStatus(c.context).commands,count+1);
});
test('A14 Gate B lower-level animation capture also rejects reentrant reset before journal publication',()=>{
 const a=new ReplayAnimationInstance(rig(),'Idle',1n,undefined,{crossfade:true,interruptible:true,animatedSlots:true});
 for(let t=1n;t<=73n;t++){a.requestTick(a.context,t,()=>{});if(t===60n)a.requestTransition({to:'Attack',durationTicks:96n});}
 const before=a.frame();a.requestInterrupt({get to(){assert.throws(()=>a.reset(rig(),'Idle',2n),/busy/);return 'Hit';},durationTicks:24n});
 assert.deepEqual(a.frame(),before);assert.equal(a.transitionStatus().commands,2);a.requestTick(a.context,74n,()=>{});assert.deepEqual(a.frame().prePhysics,before.prePhysics);
});

const activePlanB=()=>{const p=new ReplayMixPlan(rig(),'Idle',true,true);p.request(60n,{to:'Attack',durationTicks:96n});return p;};
for(const at of [71n,72n,73n])test('A14 Gate B frozen pair at expression boundary '+at,()=>{
 const p=activePlanB(),source=p.sample(at),before=structuredClone(source),cmd=p.requestInterrupt(at,{to:'Hit',durationTicks:24n},source);
 assert.deepEqual(p.sample(at),before);const next=p.sample(at+1n);assert.equal(next.mixing.transition!.weight,0);assert.deepEqual(next.locals,before.locals);assert.deepEqual(next.slotState!.slots,before.slotState!.slots);assert.deepEqual(next.slotState!.drawOrder,before.slotState!.drawOrder);assert.equal(cmd.frozen!.slotState!.tick,at);
 (source.slotState!.slots[0]!.color as any)[0]=99;(cmd.frozen!.slotState!.drawOrder as any).reverse();const detached=p.commands();(detached[1]!.frozen!.slotState!.slots[0]as any).attachment='unknown';
 assert.deepEqual(p.sample(at+1n),next);const restored=new ReplayMixPlan(rig(),'Idle',true,true);restored.restore(p.commands());for(let t=0n;t<130n;t++)assert.deepEqual(restored.sample(t),p.sample(t));
});
for(const edit of ['rgba','visible','attachment','owner','order','tick','clip','skin','missing'])test('A14 Gate B rejects foreign frozen '+edit+' without publishing journal',()=>{
 const p=activePlanB(),good=p.sample(73n),bad=structuredClone(good),before=p.commands(),s=bad.slotState! as any;
 if(edit==='rgba')s.slots[0].color[0]=.125;if(edit==='visible')s.slots[0].visible=!s.slots[0].visible;if(edit==='attachment')s.slots.find((v:any)=>v.name==='eye_left').attachment='open';if(edit==='owner')s.slots[0].owner='other';if(edit==='order')s.drawOrder.reverse();if(edit==='tick')s.tick=72n;if(edit==='clip')s.clip='Attack';if(edit==='skin')s.skin='other';if(edit==='missing')delete (bad as any).slotState;
 assert.throws(()=>p.requestInterrupt(73n,requestB,bad));assert.deepEqual(p.commands(),before);assert.deepEqual(p.sample(73n),good);
});
test('A14 Gate B replay verifies paired slots and rejects corrupted restore atomically',()=>{
 const p=activePlanB(),a=p.sample(73n);p.requestInterrupt(73n,requestB,a);const b=p.sample(80n);p.requestInterrupt(80n,{to:'Death',durationTicks:36n},b);p.verifyOrigin(a);p.verifyOrigin(b);
 const bad=structuredClone(b);(bad.slotState!.slots[0]!.color as any)[0]=.123;assert.throws(()=>p.verifyOrigin(bad),/origin mismatch/);
 const commands=p.commands();(commands[2]!.frozen!.slotState!.drawOrder as any).reverse();const restored=new ReplayMixPlan(rig(),'Idle',true,true);assert.throws(()=>restored.restore(commands));assert.equal(restored.commandCount,0);
 for(const c of p.commands().filter(v=>v.frozen))assert.deepEqual(Object.keys(c.frozen!).sort(),['locals','origin','slotState']);
});
for(const fault of ['rgba','order','attachment','pose','observer'])test('A14 Gate B '+fault+' at exact completion preserves previous complete acceptance',()=>{
 const c=activeB();c.requestInterrupt(c.context,{to:'Death',durationTicks:12n});advanceB(c,85n);const before=numerical(c),fn=ReplayMixPlan.prototype.sample;
 ReplayMixPlan.prototype.sample=function(t){const v=fn.call(this,t);if(t===86n){if(fault==='rgba')(v.slotState!.slots[0]!.color as any)[0]=1.1;if(fault==='order')(v.slotState!.drawOrder as any).pop();if(fault==='attachment')(v.slotState!.slots[0]as any).attachment='unknown';if(fault==='pose')(v.locals[0]as any).x=Infinity;}return v;};
 try{c.requestTick(c.context,86n,()=>{if(fault==='observer')throw Error('abort completion');});assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(numerical(c),before);}finally{ReplayMixPlan.prototype.sample=fn;}
});
test('A14 Gate B64 frozen paired commands do not evict on65th and restore/replay exactly',()=>{
 const p=new ReplayMixPlan(rig(),'Idle',true,true);p.request(0n,{to:'Attack',durationTicks:120n});for(let i=1;i<64;i++)p.requestInterrupt(BigInt(i),{to:i%2?'Hit':'Attack',durationTicks:120n},p.sample(BigInt(i)));
 const before=p.commands();assert.throws(()=>p.requestInterrupt(64n,requestB,p.sample(64n)),/capacity/);assert.deepEqual(p.commands(),before);const restored=new ReplayMixPlan(rig(),'Idle',true,true);restored.restore(before);for(let t=0n;t<=200n;t++)assert.deepEqual(restored.sample(t),p.sample(t));
});
for(const mode of [false,true])test('A14 explicit capabilities preserve old refusals '+mode,()=>{
 const r=rig();for(const o of [undefined,{crossfade:true},{crossfade:true,interruptible:true},{animatedSlots:true},{crossfade:true,animatedSlots:true,interruptible:false},{crossfade:true,animatedSlots:true,animationEvents:true},{crossfade:true,animatedSlots:true,clipping:true},{crossfade:true,animatedSlots:true,weightedFfd:true}])assert.throws(()=>new ReplayConsumerBridge(r,'Idle',1n,undefined,o as any));
 for(const mutation of ['dark','linked','sequence','blend','badAttachment','duplicateOrder','negativeScale']){const x=rig();if(mutation==='dark')x.slots[0].dark_color='000000';if(mutation==='linked')x.skins[0].attachments.find((v:any)=>v.attachment.type==='mesh').attachment.linked={};if(mutation==='sequence')x.skins[0].attachments[0].attachment.sequence={};if(mutation==='blend')x.slots[0].blend='add';if(mutation==='badAttachment')x.animations.Hit.slots.find((v:any)=>v.channel==='attachment').keys[0].name='unknown';if(mutation==='duplicateOrder')x.drawOrder[0]=x.drawOrder[1];if(mutation==='negativeScale')x.bones[0].scaleX=-1;assert.throws(()=>new ReplayConsumerBridge(x,'Idle',1n,undefined,{crossfade:true,animatedSlots:true,...(mode?{interruptible:true}:{})} as any),mutation);}
});

for(const field of ['slotState','local'])test('A14 Gate B refuses nested/extra frozen payload '+field,()=>{
 const p=activePlanB(),source=p.sample(73n),before=p.commands();
 if(field==='slotState')(source.slotState as any).previous={locals:source.locals};else(source.locals[0]as any).previous={slotState:source.slotState};
 assert.throws(()=>p.requestInterrupt(73n,requestB,source));assert.deepEqual(p.commands(),before);
});
