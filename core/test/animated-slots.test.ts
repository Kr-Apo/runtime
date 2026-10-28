import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{ReplayConsumerBridge,ReplayPhysicsInstance,ReplayAnimationInstance,ReplayTransport,evaluate,parseRig,validateReplaySlotState,validateAnimatedSlotsRig}from'../src/index.js';
const source=()=>parseRig(readFileSync('../experimental/animated-slots/fixtures/skeleton.json','utf8'));
test('A4 real author export admits four slot channels only under explicit capability',()=>{
 const c=new ReplayConsumerBridge(source(),'costume',1n,undefined,{animatedSlots:true} );const f=c.currentFrame();
 assert.equal(f.slotState!.kind,'animated-slots/v1');assert.equal(f.slotState!.tick,0n);assert.equal(f.slotState!.slots.length,3);assert.deepEqual(f.slotState!.drawOrder,['body','cape','badge']);
});
test('A4 historical bone-only and A3 gates still refuse slot timelines',()=>{
 assert.throws(()=>new ReplayConsumerBridge(source(),'costume',1n),/unsupported clip channel/);assert.throws(()=>new ReplayConsumerBridge(source(),'costume',1n,undefined,{weightedFfd:true}));
});

const refs=JSON.parse(readFileSync('../experimental/animated-slots/fixtures/rust.json','utf8')).frames;
const create=(r=source())=>new ReplayConsumerBridge(r,'costume',1n,undefined,{animatedSlots:true});
const advance=(c:ReplayConsumerBridge,t:bigint)=>{if(c.currentFrame().state==='stopped')c.play(c.context,'costume',false);c.requestTick(c.context,t);while(c.currentFrame().backlog)c.pump(c.context,8);return c.currentFrame();};
const badge=(c:ReplayConsumerBridge)=>c.currentFrame().slotState!.slots.find(v=>v.name==='badge')!;
const channel=(r:ReturnType<typeof source>,name:string,kind:string)=>r.animations.costume!.slots.find(t=>t.name===name&&t.channel===kind)!;
test('A4 selected exact Rust visibility/attachment/owner/order and numerical color, bones, Physics',()=>{
 const c=create();let max=0;for(const r of refs){const f=advance(c,BigInt(r.tick)),s=f.slotState!;assert.equal(s.tick,f.completed);assert.equal(s.clip,'costume');assert.equal(s.skin,'default');assert.deepEqual(s.drawOrder,r.drawOrder);
 for(const v of s.slots){const e=r.slots.find((x:any)=>x.name===v.name);assert.deepEqual([v.attachment,v.visible,v.owner],[e.attachment,e.visible,e.owner]);v.color.forEach((x,i)=>{const d=Math.abs(x-e.color[i]);max=Math.max(max,d);assert(d<=1e-5);});}
 for(const b of f.bones){const e=r.bones.find((x:any)=>x.name===b.name);Object.values(b.world).forEach((v,i)=>assert(Math.abs(v-e.world[i])<=(i<4?.0001:.01)));}
 for(const rec of f.records){const e=r.records.find((x:any)=>x.constraint===rec.constraint);[rec.rotation,rec.x,rec.y,rec.rotationVelocity,rec.velocityX,rec.velocityY,rec.anchorX,rec.anchorY].forEach((v,i)=>assert(Math.abs(v-e.values[i])<=(i===0||i===3?.001:.01)));}}
 assert(max>0);
});
test('A4 first color holds before first key as Rust; discrete channels keep setup; Legacy unchanged',()=>{
 const r=source(),f=create(r).currentFrame(),b=f.slotState!.slots.find(s=>s.name==='body')!,icon=f.slotState!.slots.find(s=>s.name==='badge')!;
 assert.equal(b.color[1],Math.fround(.9));assert.deepEqual([icon.visible,icon.attachment],[true,'sun']);assert.deepEqual(f.slotState!.drawOrder,r.drawOrder);
 const legacy=evaluate(r,[{animation:'costume',time:0,alpha:1}]);assert.deepEqual(legacy.slots.find(s=>s.name==='body')!.color,[1,1,1,1]);
});
test('A4 null is explicit absence; invisible retains named attachment; missing/empty track is setup',()=>{
 const c=create();advance(c,78n);assert.deepEqual([badge(c).attachment,badge(c).owner,badge(c).visible],[null,null,true]);advance(c,96n);assert.deepEqual([badge(c).attachment,badge(c).owner,badge(c).visible],['sun','default',false]);advance(c,120n);assert.deepEqual([badge(c).attachment,badge(c).visible],['sun',true]);
 for(const empty of [true,false]){const r=source();if(empty)channel(r,'badge','attachment').keys=[];else r.animations.costume!.slots=r.animations.costume!.slots.filter(t=>t.channel!=='attachment');assert.equal(badge(advanceConsumer(create(r),132n)).attachment,'sun');}
});
function advanceConsumer(c:ReplayConsumerBridge,t:bigint){advance(c,t);return c;}
test('A4 complete native offset order, empty restore and stable tie semantics',()=>{
 const c=create();assert.deepEqual(advance(c,54n).slotState!.drawOrder,['body','badge','cape']);assert.deepEqual(advance(c,96n).slotState!.drawOrder,['badge','body','cape']);assert.deepEqual(advance(c,138n).slotState!.drawOrder,['cape','body','badge']);assert.deepEqual(advance(c,168n).slotState!.drawOrder,['body','cape','badge']);
 const r=source();r.animations.costume!.drawOrder=[{time:0,offsets:[{slot:'body',offset:2},{slot:'cape',offset:1}]}];assert.deepEqual(create(r).currentFrame().slotState!.drawOrder,['badge','body','cape']);
});
test('A4 zero alpha is not invisibility or null; no implicit color multiplication by setup',()=>{
 const r=source();channel(r,'body','color').keys=[{time:0,color:[.2,.4,.6,0],curve:'linear'}];const b=create(r).currentFrame().slotState!.slots[0]!;assert.deepEqual([b.visible,b.attachment,b.color],[true,'body',[.2,.4,.6,0]]);
});
test('A4 backlog/paused/repeated presentation cannot show a future slot state',()=>{
 const c=create();c.play(c.context,'costume',false);c.requestTick(c.context,132n);const f=c.currentFrame();assert.deepEqual([f.completed,f.requested,f.slotState!.tick],[8n,132n,8n]);assert.equal(badge(c).attachment,'sun');c.pause(c.context);const paused=c.currentFrame();for(let n=0;n<25;n++)c.present(s=>assert.equal(s.slotState!.tick,8n));assert.deepEqual(c.currentFrame(),paused);c.resume(c.context);while(c.currentFrame().backlog)c.pump(c.context,8);assert.equal(badge(c).attachment,'fan');
});
test('A4 source, observer and external snapshots are detached',()=>{
 const r=source(),c=create(r);channel(r,'badge','attachment').keys[0]!.name='absent';c.play(c.context,'costume',false);c.requestTick(c.context,30n,f=>{const s=f.slotState! as any;s.slots[0].color.fill(999);s.drawOrder.reverse();f.pose.slots[0]!.visible=false;});while(c.currentFrame().backlog)c.pump(c.context,8);assert.equal(badge(c).attachment,'moon');const before=c.currentFrame(),copy=c.currentFrame();(copy.slotState!.slots[0]!.color as unknown as number[]).fill(0);(copy.slotState!.drawOrder as string[]).reverse();assert.deepEqual(c.currentFrame(),before);
});
test('A4 observer refusal preserves complete prefix, including slots; reset requires new context',()=>{
 const c=create();advance(c,95n);const result=c.requestTick(c.context,98n,f=>{if(f.tick===97n)throw Error('precommit audit');assert.equal(f.slotState!.tick,f.tick);assert.deepEqual(f.pose.drawOrder,f.slotState!.drawOrder);});assert.equal(result.stop.kind,'failed');const f=c.currentFrame();assert.equal(f.completed,96n);assert.equal(f.slotState!.tick,96n);assert.equal(badge(c).visible,false);assert.equal(f.health,'faulted');assert.throws(()=>c.pump(c.context,1));c.reset(c.context,2n);assert.equal(c.currentFrame().slotState!.tick,0n);
});
test('A4 nonrepresentable interpolated normalized color faults before accepting a half pose',()=>{
 const r=source();channel(r,'body','color').keys=[{time:0,color:[.5,.5,.5,.5],curve:{type:'bezier',handles:[.2,100,.8,100]}},{time:1,color:[1,1,1,1],curve:'linear'}];const c=create(r);c.play(c.context,'costume',false);const before=c.currentFrame(),result=c.requestTick(c.context,1n);assert.equal(result.stop.kind,'failed');const f=c.currentFrame();assert.equal(f.completed,0n);assert.deepEqual(f.slotState,before.slotState);assert.deepEqual(f.bones,before.bones);assert.deepEqual(f.records,before.records);
});
test('A4 numerical invalid input retains pose slots, payload and all records together',()=>{
 const r=source(),p=new ReplayPhysicsInstance(r,1n,[],undefined,{animatedSlots:true,clip:'costume'}),before=p.frame();const result=p.requestTick(p.context,1n,()=>[{name:'root',x:NaN,y:0,rotation:0,scaleX:1,scaleY:1,shearX:0,shearY:0}],()=>{});assert.equal(result.stop.kind,'failed');assert.deepEqual(p.frame(),before);
});
test('A4 render failure cannot undo acceptance; mutation during present is refused; retry is pure',()=>{
 const c=create();advance(c,96n);const f=c.currentFrame();assert.throws(()=>c.present(()=>{throw Error('GPU');}));assert.deepEqual(c.currentFrame(),f);c.present(s=>{assert.deepEqual(s,f);assert.throws(()=>c.stop(c.context));});assert.deepEqual(c.currentFrame(),f);
});
test('A4 stop/reset/explicit origin replay retain mode and reject pure seek intact',()=>{
 const c=create();advance(c,132n);const before=c.currentFrame();assert.throws(()=>c.seekTick(c.context,120n),/Animated slots/);assert.deepEqual(c.currentFrame(),before);c.stop(c.context);assert.equal(c.currentFrame().slotState!.tick,0n);c.play(c.context,'costume',false);c.replayFromOrigin(c.context,132n);while(c.currentFrame().backlog)c.pump(c.context,8);assert.equal(badge(c).attachment,'fan');const old=c.context;c.reset(c.context,c.context.epoch+1n);assert.throws(()=>c.resume(old));assert.equal(badge(c).attachment,'sun');
});
test('A4 multiple owners are independent and non-slot bones preserve old frame shape',()=>{
 const r=source(),a=create(r),b=create(r),before=b.currentFrame();advance(a,132n);assert.deepEqual(b.currentFrame(),before);const plain=source();plain.animations.costume!.slots=[];plain.animations.costume!.drawOrder=[];assert(!Object.hasOwn(new ReplayConsumerBridge(plain,'costume',1n).currentFrame(),'slotState'));
});
const mutate:Record<string,(r:any)=>void>={
 'unknown slot':r=>r.animations.costume.slots[0].name='unknown',
 'unknown channel':r=>r.animations.costume.slots[0].channel='dark_color',
 'duplicate channel':r=>r.animations.costume.slots.push(structuredClone(r.animations.costume.slots[0])),
 'unknown attachment':r=>r.animations.costume.slots.find((t:any)=>t.channel==='attachment').keys[0].name='absent',
 'undefined attachment':r=>delete r.animations.costume.slots.find((t:any)=>t.channel==='attachment').keys[0].name,
 'ambiguous attachment':r=>r.skins[0].attachments.push(structuredClone(r.skins[0].attachments.find((e:any)=>e.slot==='body'&&e.name==='body'))),
 'sparse RGBA':r=>delete r.animations.costume.slots[0].keys[0].color[0],
 'NaN color':r=>r.animations.costume.slots[0].keys[0].color[0]=NaN,
 'Infinity color':r=>r.animations.costume.slots[0].keys[0].color[3]=Infinity,
 'missing color component':r=>r.animations.costume.slots[0].keys[0].color.pop(),
 'out-of-range alpha':r=>r.animations.costume.slots[0].keys[0].color[3]=-1,
 'malformed curve':r=>r.animations.costume.slots[0].keys[0].curve={type:'bezier',handles:[-1,0,1,1]},
 'nonfinite curve':r=>r.animations.costume.slots[0].keys[0].curve={type:'bezier',handles:[0,Infinity,1,1]},
 'extra color key field':r=>r.animations.costume.slots[0].keys[0].foo=2,
 'bad visibility':r=>r.animations.costume.slots.find((t:any)=>t.channel==='visible').keys[0].value=1,
 'nonstepped visibility':r=>r.animations.costume.slots.find((t:any)=>t.channel==='visible').keys[0].curve='linear',
 'unsorted times':r=>r.animations.costume.slots[0].keys[1].time=0,
 'nonfinite time':r=>r.animations.costume.slots[0].keys[0].time=NaN,
 'missing setup order':r=>r.drawOrder.pop(),
 'duplicate setup order':r=>r.drawOrder[0]=r.drawOrder[1],
 'unknown order slot':r=>r.animations.costume.drawOrder[0].offsets[0].slot='absent',
 'duplicate draw offset':r=>r.animations.costume.drawOrder[0].offsets.push(structuredClone(r.animations.costume.drawOrder[0].offsets[0])),
 'fractional draw offset':r=>r.animations.costume.drawOrder[0].offsets[0].offset=.5,
 'out-of-range draw offset':r=>r.animations.costume.drawOrder[0].offsets[0].offset=-100,
 'missing draw offsets':r=>delete r.animations.costume.drawOrder[0].offsets,
 'unknown order field':r=>r.animations.costume.drawOrder[0].order=['body'],
 'FFD combination':r=>r.animations.costume.deform=[{slot:'body',attachment:'body',keys:[]}],
 'events':r=>r.animations.costume.events=[{time:0,name:'x'}],
 'animated IK':r=>r.animations.costume.ik=[{constraint:'x',keys:[]}],
 'mixing metadata':r=>r.animations.costume.mixing=true,
 'two clips':r=>r.animations.other=structuredClone(r.animations.costume),
 'two skins':r=>r.skins.push({...structuredClone(r.skins[0]),name:'other'}),
 'linked mesh':r=>r.skins[0].attachments.find((e:any)=>e.slot==='body'&&e.name==='body').attachment.linked={skin:'default',slot:'body',attachment:'body'},
 'clipping':r=>r.skins[0].attachments.find((e:any)=>e.slot==='body'&&e.name==='body').attachment.type='clipping',
 'sequence':r=>r.skins[0].attachments.find((e:any)=>e.slot==='body'&&e.name==='body').attachment.sequence={frames:['x']},
 'embedded FFD':r=>r.skins[0].attachments.find((e:any)=>e.slot==='body'&&e.name==='body').attachment.deform=[],
 'invalid triangle':r=>r.skins[0].attachments.find((e:any)=>e.slot==='body'&&e.name==='body').attachment.triangles[0]=999,
 'unknown influence':r=>r.skins[0].attachments.find((e:any)=>e.slot==='body'&&e.name==='body').attachment.weights[0].bones[0].bone='absent',
 'nonfinite weight':r=>r.skins[0].attachments.find((e:any)=>e.slot==='body'&&e.name==='body').attachment.weights[0].bones[0].weight=Infinity,
 'blend':r=>r.slots[0].blend='add',
 'static dark tint outside initial domain':r=>r.slots[0].dark_color=[0,0,0,1],
 'non-Physics constraint':r=>r.constraints[0].type='path',
};
for(const[name,change]of Object.entries(mutate))test('A4 admission refuses '+name+' without mutating caller data',()=>{const r=source();change(r);const before=structuredClone(r);assert.throws(()=>create(r));assert.deepEqual(r,before);});
test('A4 mixed flags, false flag and dynamic calendar are explicit refusals',()=>{
 for(const options of [{animatedSlots:true,weightedFfd:true},{animatedSlots:false},{animatedSlots:true,extra:1}])assert.throws(()=>new ReplayConsumerBridge(source(),'costume',1n,undefined,options as any));assert.throws(()=>new ReplayConsumerBridge(source(),'costume',1n,[{tick:0n,skin:'default'},{tick:120n,skin:'default'}],{animatedSlots:true}));
});
for(const[name,change]of [['incomplete order',(s:any)=>s.drawOrder.pop()],['duplicate order',(s:any)=>s.drawOrder[0]=s.drawOrder[1]],['wrong tick',(s:any)=>s.tick++],['wrong owner',(s:any)=>s.slots[0].owner='other'],['invisible attachment lost',(s:any)=>s.slots[0].attachment=null],['wrong clip',(s:any)=>s.clip='other'],['nonfinite color',(s:any)=>s.slots[0].color[0]=NaN],['missing slot',(s:any)=>s.slots.pop()]] as const)test('A4 frame validator refuses '+name,()=>{const r=source(),c=create(r),s=structuredClone(c.currentFrame().slotState!) as any;change(s);assert.throws(()=>validateReplaySlotState(r,s,0n,'costume','default'));});

test('A4 pure legacy sampling is refused; low-level transport frame is the accepted slot frame',()=>{
 const r=source(),a=new ReplayAnimationInstance(r,'costume',1n,undefined,{animatedSlots:true});assert.throws(()=>a.sampleTick(0n),/accepted frame/);assert.equal(a.frame().slotState!.tick,0n);
 const t=new ReplayTransport(r,'costume',1n,undefined,{animatedSlots:true});assert.deepEqual(t.frame(),t.committedFrame());assert.equal(t.snapshot().poseKind,'simulated');
});
for(const[name,change]of [['nonfinite region',(m:any)=>m.x=Infinity],['bad region UV',(m:any)=>m.uv=[0,1]],['invalid source size',(m:any)=>m.source_width=0]] as const)test('A4 refuses '+name,()=>{const r=source(),m=r.skins[0]!.attachments.find(e=>e.attachment.type==='region')!.attachment;change(m);assert.throws(()=>create(r));});

test('A4 region -> weighted five-vertex mesh -> region is an exact named switch with immutable assets/topology',()=>{
 const r=source(),before=structuredClone(r),c=create(r);assert.equal(advance(c,30n).slotState!.slots.find(s=>s.name==='badge')!.attachment,'moon');assert.equal(advance(c,132n).slotState!.slots.find(s=>s.name==='badge')!.attachment,'fan');const mesh=r.skins[0]!.attachments.find(e=>e.slot==='badge'&&e.name==='fan')!.attachment;assert.equal(mesh.type,'mesh');if(mesh.type==='mesh'){assert.equal(mesh.vertex_count,5);assert.equal(mesh.weighted,true);assert.equal(mesh.triangles.length,12);}assert.equal(advance(c,168n).slotState!.slots.find(s=>s.name==='badge')!.attachment,'sun');assert.deepEqual(r,before);
});

test('A4 real authored zero alpha keeps a visible named weighted attachment',()=>{const c=create();advance(c,132n);const v=badge(c);assert.equal(v.attachment,'fan');assert.equal(v.visible,true);assert.equal(v.color[3],0);assert.equal(v.owner,'default');});

test('A4 sparse snapshot RGBA is rejected, never replaced silently by zero',()=>{const r=source(),s=structuredClone(create(r).currentFrame().slotState!) as any;delete s.slots[0].color[0];assert.throws(()=>validateReplaySlotState(r,s,0n,'costume','default'));});

for(const [name,change]of [
 ['sparse Bezier handles',(r:any)=>{r.animations.costume.slots[0].keys[0].curve={type:'bezier',handles:[.2,0,.8,1]};delete r.animations.costume.slots[0].keys[0].curve.handles[1];}],
 ['sparse mesh triangles',(r:any)=>{delete r.skins[0].attachments.find((e:any)=>e.slot==='body').attachment.triangles[0];}],
 ['sparse setup order',(r:any)=>{delete r.drawOrder[0];}]
] as const)test('A4 strict source admission rejects '+name,()=>{const r=source();change(r);assert.throws(()=>validateAnimatedSlotsRig(r,'costume'));});
test('A4 sparse published order is incomplete, never a valid permutation',()=>{const r=source(),s=structuredClone(create(r).currentFrame().slotState!) as any;delete s.drawOrder[0];assert.throws(()=>validateReplaySlotState(r,s,0n,'costume','default'));});
