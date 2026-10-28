import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ReplayConsumerBridge,ReplayPhysicsInstance,parseRig,validateWeightedFfdRig} from '../src/index.js';
import {evaluateBoneLocals} from '../src/evaluate.js';
const source=()=>parseRig(readFileSync('../experimental/weighted-ffd/fixtures/skeleton.json','utf8'));
const fixture=JSON.parse(readFileSync('../experimental/weighted-ffd/fixtures/rust.json','utf8'));
const create=(r=source())=>new ReplayConsumerBridge(r,'impact',1n,undefined,{weightedFfd:true});
const mesh=(r:ReturnType<typeof source>)=>r.skins[0]!.attachments[0]!.attachment as any;
const keys=(r:ReturnType<typeof source>)=>r.animations.impact!.deform[0]!.keys as any[];
function advance(c:ReplayConsumerBridge,t:bigint){if(c.currentFrame().state==='stopped')c.play(c.context,'impact',false);c.requestTick(c.context,t);while(c.currentFrame().backlog)c.pump(c.context,8);return c.currentFrame();}
test('A3 explicit capability; historical default unchanged',()=>{
 assert.throws(()=>new ReplayConsumerBridge(source(),'impact',1n),/unsupported clip channel deform/);
 const r=source();r.animations.impact!.deform=[];const old=new ReplayConsumerBridge(r,'impact',1n);assert(!Object.hasOwn(old.currentFrame(),'deformation'));
 assert.deepEqual(create(r).currentFrame().deformation!.entries[0]!.offsets,Array(20).fill(0));
 assert.throws(()=>new ReplayConsumerBridge(source(),'impact',1n,undefined,{weightedFfd:false} as any));
});
test('A3 independent Rust offsets, bones and records across curves, step and loops',()=>{
 const c=create();let worst=0;for(const r of fixture.frames){const f=advance(c,BigInt(r.tick));assert.equal(f.deformation!.tick,f.completed);assert.equal(f.clipTime,r.clipTime);
 f.deformation!.entries[0]!.offsets.forEach((v,i)=>{worst=Math.max(worst,Math.abs(v-r.offsets[i]));assert(Math.abs(v-r.offsets[i])<.01);});
 for(const b of f.bones){const e=r.bones.find((x:any)=>x.name===b.name);Object.values(b.world).forEach((v,i)=>assert(Math.abs(v-e.world[i])<(i<4?.0001:.01)));}
 for(const rec of f.records){const e=r.records.find((x:any)=>x.constraint===rec.constraint);[rec.rotation,rec.x,rec.y,rec.rotationVelocity,rec.velocityX,rec.velocityY,rec.anchorX,rec.anchorY].forEach((v,i)=>assert(Math.abs(v-e.values[i])<(i===0||i===3?.001:.01)));}}
 assert(worst>0);
});
test('A3 2/3/5 influences, zero coefficient and rigid row remain intact',()=>{
 const r=source(),m=mesh(r),before=structuredClone(m);assert.deepEqual(m.weights.map((w:any)=>w.bones.length),[2,3,5,0]);assert.equal(advance(create(r),60n).deformation!.entries[0]!.offsets.length,20);assert.deepEqual(m,before);
});
test('A3 rest, impact, returned rest, step and loop belong to accepted time',()=>{
 const c=create();for(const t of [0n,60n,95n,96n,97n,132n,179n,180n,181n]){const f=advance(c,t),o=f.deformation!.entries[0]!.offsets;assert.equal(f.deformation!.tick,t);if([0n,132n,179n,180n].includes(t))assert(o.every(x=>x===0));if(t===60n)assert.equal(Math.max(...o),15);}
});
test('A3 backlog never samples the requested future time',()=>{
 const c=create();c.play(c.context,'impact',false);c.requestTick(c.context,60n);const f=c.currentFrame();assert.deepEqual([f.completed,f.requested,f.backlog,f.deformation!.tick],[8n,60n,52n,8n]);assert(Math.max(...f.deformation!.entries[0]!.offsets)<1);
});
test('A3 pause, repeated rendering and detached mutations do not advance',()=>{
 const c=create();advance(c,60n);c.pause(c.context);const before=c.currentFrame();for(let i=0;i<20;i++)c.present(f=>{(f.deformation!.entries[0]!.offsets as number[])[0]=999;assert.throws(()=>c.resume(c.context));});assert.deepEqual(c.currentFrame(),before);
 assert.throws(()=>c.present(()=>{throw Error('GPU failure');}));assert.deepEqual(c.currentFrame(),before);c.resume(c.context);assert.equal(advance(c,61n).deformation!.tick,61n);
});
test('A3 detached source and absent/empty track convention',()=>{
 const r=source(),c=create(r);keys(r)[2].offsets.fill(999);assert.equal(Math.max(...advance(c,60n).deformation!.entries[0]!.offsets),15);
 for(const empty of [true,false]){const r=source();if(empty)keys(r).length=0;else r.animations.impact!.deform=[];assert(advance(create(r),60n).deformation!.entries[0]!.offsets.every(x=>x===0));}
});
test('A3 observer failure keeps whole accepted prefix and FFD',()=>{
 const c=create();advance(c,60n);const result=c.requestTick(c.context,65n,f=>{assert.equal(f.deformation!.tick,f.tick);if(f.tick===62n)throw Error('audit');(f.deformation!.entries[0]!.offsets as number[]).fill(999);});assert.equal(result.stop.kind,'failed');const f=c.currentFrame();assert.equal(f.completed,61n);assert.equal(f.deformation!.tick,61n);assert.equal(f.health,'faulted');assert(!f.deformation!.entries[0]!.offsets.includes(999));assert.throws(()=>c.pump(c.context,1));c.reset(c.context,2n);assert.equal(c.currentFrame().deformation!.tick,0n);
});
test('A3 nonfinite numerical input cannot publish half a frame',()=>{
 const r=source(),initial=evaluateBoneLocals(r,{animation:"impact",time:0,alpha:1}),p=new ReplayPhysicsInstance(r,1n,initial,undefined,{weightedFfd:true,clip:'impact'}),before=p.frame();const result=p.requestTick(p.context,1n,()=>initial.map((b,i)=>({...b,x:i===0?NaN:b.x})),()=>{});assert.equal(result.stop.kind,'failed');assert.deepEqual(p.frame(),before);assert.equal(p.clock().completed,0n);assert(p.faulted);
});
test('A3 stop/reset/origin replay preserve capability; pure seek refuses without mutation',()=>{
 const c=create();advance(c,60n);const f=c.currentFrame();assert.throws(()=>c.seekTick(c.context,60n),/FFD/);assert.deepEqual(c.currentFrame(),f);c.stop(c.context);assert.equal(c.currentFrame().deformation!.tick,0n);c.play(c.context,'impact',false);c.replayFromOrigin(c.context,60n);while(c.currentFrame().backlog)c.pump(c.context,8);assert.equal(c.currentFrame().deformation!.tick,60n);const old=c.context;c.reset(c.context,c.context.epoch+1n);assert.throws(()=>c.play(old,'impact',false));assert.equal(c.currentFrame().deformation!.tick,0n);
});
const negatives:Record<string,(r:ReturnType<typeof source>)=>void>={
 'linked':r=>mesh(r).linked={skin:'default',slot:'body',attachment:'body',inherit_deform:true},
 'dynamic skins':r=>r.skins.push({...r.skins[0]!,name:'other'}),
 'unknown owner':r=>(r.animations.impact!.deform[0] as any).slot='unknown',
 'not displayed':r=>r.slots[0]!.attachment=null,
 'short offsets':r=>keys(r)[1].offsets.pop(),
 'nonfinite offsets':r=>keys(r)[1].offsets[0]=Infinity,
 'nonfinite weights':r=>mesh(r).weights[0].bones[0].weight=NaN,
 'negative weights':r=>mesh(r).weights[0].bones[0].weight=-1,
 'zero-total row':r=>mesh(r).weights[0].bones.forEach((b:any)=>b.weight=0),
 'unknown bone':r=>mesh(r).weights[0].bones[0].bone='absent',
 'nonfinite vertex':r=>mesh(r).vertices[0]=NaN,
 'topology':r=>mesh(r).triangles[0]=100,
 'UV':r=>mesh(r).uvs[0]=-1,
 'another clip':r=>r.animations.other=structuredClone(r.animations.impact!),
 'slots':r=>(r.animations.impact!.slots as any[]).push({name:'body'}),
 'events':r=>(r.animations.impact!.events as any[]).push({time:0,name:'x'}),
 'IK':r=>(r.animations.impact!.ik as any[]).push({name:'x'}),
 'duplicate owner':r=>r.animations.impact!.deform.push(structuredClone(r.animations.impact!.deform[0]!)),
 'unweighted target':r=>{mesh(r).weighted=false;mesh(r).weights=[];},
 'Bezier':r=>keys(r)[0].curve={type:'bezier',handles:[-1,0,1,1]},
 'same-time keys':r=>keys(r)[1].time=0,
};
for(const [name,change]of Object.entries(negatives))test('A3 refuses '+name,()=>{const r=source();change(r);assert.throws(()=>create(r));});
test('A3 dynamic calendar refused before consumer construction',()=>assert.throws(()=>new ReplayConsumerBridge(source(),'impact',1n,[{tick:0n,skin:'default'},{tick:120n,skin:'default'}],{weightedFfd:true}),/dynamic skins/));
test('A3 native source and version untouched',()=>{const r=source(),before=structuredClone(r);validateWeightedFfdRig(r,'impact');advance(create(r),60n);assert.deepEqual(r,before);assert.equal(r.format_version,2);});

test('A3 finite source interpolation overflow rejects sampled FFD before commit',()=>{
 const r=source();keys(r)[1].offsets.fill(Number.MAX_VALUE);keys(r)[2].offsets.fill(-Number.MAX_VALUE);
 const c=create(r);advance(c,47n);const before=c.currentFrame();const result=c.requestTick(c.context,50n);assert.equal(result.stop.kind,'failed');const f=c.currentFrame();assert.equal(f.completed,47n);assert.equal(f.deformation!.tick,47n);assert.deepEqual(f.deformation,before.deformation);assert.deepEqual(f.bones,before.bones);assert.deepEqual(f.records,before.records);
});
