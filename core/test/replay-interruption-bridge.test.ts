import test from 'node:test';
import assert from 'node:assert/strict';
import {ReplayConsumerBridge,ReplayAnimationInstance} from '../src/index.js';
import {ReplayMixPlan} from '../src/replay-mixing.js';
import {readFileSync} from 'node:fs';
const rig=()=>JSON.parse(readFileSync('../experimental/interruptions/fixtures/skeleton.json','utf8'));
const make=(options:any={crossfade:true,interruptible:true},r=rig())=>new ReplayConsumerBridge(r,'Idle',1n,undefined,options);
const advance=(c:ReplayConsumerBridge,t:bigint)=>{if(c.currentFrame().state==='stopped')c.play(c.context,'Idle',false);c.requestTick(c.context,t);while(c.currentFrame().backlog&&c.currentFrame().health==='healthy')c.pump(c.context,8);};
const state=(c:ReplayConsumerBridge)=>{const f=c.currentFrame();return {tick:f.completed,bones:f.bones,records:f.records,mixing:f.mixing,prePhysics:f.prePhysics};};
const active=()=>{const c=make();advance(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:96n});advance(c,73n);return c;};
const request={to:'Hit',durationTicks:24n};
test('A13 Gate B exposes an explicit interrupt request on the native consumer',()=>{
 assert.equal(typeof (ReplayConsumerBridge.prototype as any).requestInterrupt,'function');
});
for(const file of ['rust.json','rust-repeat.json'])test('A13 native independent Physics trajectory and full accepted replay '+file,()=>{
 const c=make(),ref=JSON.parse(readFileSync('../experimental/interruptions/fixtures/'+file,'utf8')),original=new Map<bigint,ReturnType<typeof state>>();
 c.play(c.context,'Idle',false);
 for(const f of ref.frames){
  if(f.tick)advance(c,BigInt(f.tick));const v=c.currentFrame();
  assert.deepEqual(JSON.parse(JSON.stringify(v.mixing,(_,v)=>typeof v==='bigint'?String(v):v)),f.mixing);
  v.prePhysics!.forEach((b,i)=>{const expected=f.pureBones[i].local;[b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY].forEach((n,k)=>{const raw=n-expected[k],d=k===2?Math.abs(Math.atan2(Math.sin(raw),Math.cos(raw))):Math.abs(raw);assert(d<=(k===2?.001:.0001));});});
  v.bones.forEach((b,i)=>Object.values(b.world).forEach((n,k)=>assert(Math.abs(n-f.bones[i].world[k])<=(k<4?.0001:.01))));
  v.records.forEach((rec,i)=>[rec.rotation,rec.x,rec.y,rec.rotationVelocity,rec.velocityX,rec.velocityY,rec.anchorX,rec.anchorY].forEach((n,k)=>assert(Math.abs(n-f.records[i].values[k])<=(k===0||k===3?.001:.01))));
  original.set(v.completed,state(c));
  for(const q of ref.commands.filter((q:any)=>q.requestedTick===f.tick)){
   const before=state(c),req={to:q.to,durationTicks:BigInt(q.durationTicks),incomingTick:BigInt(q.incomingTick)};
   if(q.interrupt)c.requestInterrupt(c.context,req);else c.requestTransition(c.context,req);
   assert.deepEqual(state(c),before);
  }
 }
 const old=c.context;c.replayFromOrigin(c.context,720n);assert.throws(()=>c.requestInterrupt(old,request),/context/);
 let count=0;while(c.currentFrame().backlog)c.pump(c.context,1,f=>{
  const e=original.get(f.tick)!;assert.deepEqual({tick:f.tick,bones:f.pose.bones,records:f.records,mixing:f.mixing,prePhysics:f.prePhysics},e);count++;
 });assert.equal(count,720);assert.deepEqual(state(c),original.get(720n));
});
test('A13 start uses exact accepted pre-Physics input, not already-constrained bone locals',()=>{
 const c=active(),before=state(c);assert(before.prePhysics);
 assert(before.prePhysics.some((v,i)=>v.rotation!==before.bones[i]!.rotation||v.x!==before.bones[i]!.x||v.y!==before.bones[i]!.y));
 c.requestInterrupt(c.context,request);assert.deepEqual(state(c),before);advance(c,74n);
 assert.deepEqual(c.currentFrame().prePhysics,before.prePhysics);
 assert.equal(c.currentFrame().mixing!.transition!.weight,0);
 assert.notDeepEqual(c.currentFrame().records,before.records);
});
test('A13 pause/resume preserves frozen source, reset clears it and rejects old contexts',()=>{
 const c=active();c.requestInterrupt(c.context,request);advance(c,80n);c.pause(c.context);const before=state(c);
 assert.throws(()=>c.requestTick(c.context,81n));assert.deepEqual(state(c),before);
 c.resume(c.context);advance(c,81n);assert.equal(c.currentFrame().mixing!.transition!.elapsedTicks,7n);
 const old=c.context;c.reset(old,2n);assert.equal(c.transitionStatus(c.context).commands,0);assert.equal(c.currentFrame().mixing!.kind,'interruptible-crossfade/v1');assert.throws(()=>c.requestInterrupt(old,request),/context/);
});
test('A13 rejected pending, unknown, invalid phase, presentation and candidate requests do not mutate state',()=>{
 const c=active(),before=state(c),commands=c.transitionStatus(c.context).commands;
 for(const req of [{to:'missing',durationTicks:12n},{to:'Hit',durationTicks:0n},{to:'Hit',durationTicks:12n,incomingTick:-1n}])assert.throws(()=>c.requestInterrupt(c.context,req));
 c.present(()=>assert.throws(()=>c.requestInterrupt(c.context,request),/presentation/));assert.deepEqual(state(c),before);
 assert.equal(c.transitionStatus(c.context).commands,commands);c.requestInterrupt(c.context,request);
 assert.throws(()=>c.requestInterrupt(c.context,request),/pending/);assert.deepEqual(state(c),before);
 c.requestTick(c.context,74n,()=>{assert.throws(()=>c.requestInterrupt(c.context,request),/busy/);});
 assert.equal(c.currentFrame().health,'healthy');
});
test('A13 backlog admission and old capabilities remain closed',()=>{
 const c=active();c.requestTick(c.context,120n);assert(c.currentFrame().backlog>0n);const before=state(c);
 assert.throws(()=>c.requestInterrupt(c.context,request),/backlog/);assert.deepEqual(state(c),before);
 const a12=make({crossfade:true});advance(a12,60n);a12.requestTransition(a12.context,{to:'Attack',durationTicks:48n});advance(a12,73n);
 assert.throws(()=>a12.requestInterrupt(a12.context,request),/capability/);assert.equal(a12.currentFrame().prePhysics,undefined);
 for(const opts of [{interruptible:true},{crossfade:true,interruptible:false},{crossfade:true,interruptible:true,weightedFfd:true},{crossfade:true,interruptible:true,animatedSlots:true},{crossfade:true,interruptible:true,animationEvents:true},{crossfade:true,interruptible:true,clipping:true},{crossfade:true,interruptible:true,linkedMeshes:true}])assert.throws(()=>make(opts));
});
for(const failure of ['first','middle','observer'])test('A13 '+failure+' failure preserves locals, frozen metadata, Physics and clock',()=>{
 const c=active();c.requestInterrupt(c.context,request);if(failure==='middle')advance(c,80n);
 const before=state(c),t=before.tick+1n,fn=ReplayMixPlan.prototype.sample;
 ReplayMixPlan.prototype.sample=function(tick){const packet=fn.call(this,tick);if(tick===t&&failure!=='observer')(packet.locals[0]as any).x=Infinity;return packet;};
 try{c.requestTick(c.context,t,()=>{if(failure==='observer')throw Error('observer abort');});assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(state(c),before);assert.throws(()=>c.requestInterrupt(c.context,request),/faulted/);}finally{ReplayMixPlan.prototype.sample=fn;}
});
test('A13 detached captures and redraw do not resample, mix or advance Physics',()=>{
 const c=active();c.requestInterrupt(c.context,request);advance(c,80n);const before=state(c),sample=ReplayMixPlan.prototype.sample,plan=ReplayMixPlan.prototype.stateAt;
 ReplayMixPlan.prototype.sample=()=>{throw Error('unexpected sampler');};ReplayMixPlan.prototype.stateAt=()=>{throw Error('unexpected mix');};
 try{for(let i=0;i<10;i++){c.transitionStatus(c.context);c.present(f=>{(f.prePhysics![0]as any).x=999;(f.mixing!.transition!.source as any).tick=0n;});}assert.deepEqual(state(c),before);}finally{ReplayMixPlan.prototype.sample=sample;ReplayMixPlan.prototype.stateAt=plan;}
});
test('A13 two actors own independent frozen poses, commands and numerical states',()=>{
 const a=active(),b=active(),before=state(b);a.requestInterrupt(a.context,request);advance(a,78n);a.requestInterrupt(a.context,{to:'Death',durationTicks:12n});advance(a,85n);assert.deepEqual(state(b),before);
 b.requestInterrupt(b.context,{to:'Death',durationTicks:36n});advance(b,85n);assert.notDeepEqual(state(a),state(b));
});
test('A13 real finite Bezier keys overflow during the interrupted target and B6 keeps the previous acceptance',()=>{
 const r=rig(),root=r.animations.Hit.bones.find((b:any)=>b.name==='root');
 root.translate_x=[{time:0,value:0,curve:'linear'},{time:Math.fround(7/120),value:0,curve:{type:'bezier',handles:[.25,1e308,.75,1e308]}},{time:Math.fround(9/120),value:10,curve:'linear'}];
 const c=make({crossfade:true,interruptible:true},r);advance(c,60n);c.requestTransition(c.context,{to:'Attack',durationTicks:96n});advance(c,73n);c.requestInterrupt(c.context,request);advance(c,81n);const before=state(c);
 assert.equal(before.tick,81n);c.requestTick(c.context,82n);assert.equal(c.currentFrame().health,'faulted');assert.deepEqual(state(c),before);
});
test('A13 consumer shares a bounded 64-command budget, rejects overflow and can explicitly reset',()=>{
 const c=make();c.play(c.context,'Idle',false);c.requestTransition(c.context,{to:'Attack',durationTicks:120n});
 for(let i=1;i<64;i++){advance(c,BigInt(i));c.requestInterrupt(c.context,{to:i%2?'Hit':'Attack',durationTicks:120n});}
 advance(c,64n);const before=state(c);assert.equal(c.transitionStatus(c.context).commands,64);
 assert.throws(()=>c.requestInterrupt(c.context,{to:'Death',durationTicks:12n}),/capacity/);assert.deepEqual(state(c),before);assert.equal(c.transitionStatus(c.context).commands,64);
 c.reset(c.context,2n);assert.equal(c.transitionStatus(c.context).commands,0);
});
test('A13 command snapshot rejects reentrance and accessor failure before journal publication',()=>{
 const c=active(),before=state(c),count=c.transitionStatus(c.context).commands;
 const bad={get to(){assert.throws(()=>c.stop(c.context),/busy/);return 'Hit';},get durationTicks():bigint{throw Error('accessor failure');}};
 assert.throws(()=>c.requestInterrupt(c.context,bad),/accessor failure/);assert.deepEqual(state(c),before);assert.equal(c.transitionStatus(c.context).commands,count);
 const request={get to(){assert.throws(()=>c.requestInterrupt(c.context,{to:'Death',durationTicks:12n}),/busy/);assert.throws(()=>c.reset(c.context,2n),/busy/);return 'Hit';},durationTicks:24n};
 c.requestInterrupt(c.context,request);assert.deepEqual(state(c),before);assert.equal(c.transitionStatus(c.context).commands,count+1);
});
test('A13 lower-level animation capture also rejects reentrant reset before journal publication',()=>{
 const a=new ReplayAnimationInstance(rig(),'Idle',1n,undefined,{crossfade:true,interruptible:true});
 for(let t=1n;t<=73n;t++){a.requestTick(a.context,t,()=>{});if(t===60n)a.requestTransition({to:'Attack',durationTicks:96n});}
 const before=a.frame();a.requestInterrupt({get to(){assert.throws(()=>a.reset(rig(),'Idle',2n),/busy/);return 'Hit';},durationTicks:24n});
 assert.deepEqual(a.frame(),before);assert.equal(a.transitionStatus().commands,2);a.requestTick(a.context,74n,()=>{});assert.deepEqual(a.frame().prePhysics,before.prePhysics);
});
