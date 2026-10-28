import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{ReplayConsumerBridge,parseRig,linkedGeometry,linkedMeshSources}from'../src/index.js';
const native=()=>parseRig(readFileSync('../experimental/linked-meshes/fixtures/skeleton.json','utf8'));
const make=(r=native(),options:any={linkedMeshes:true,animatedSlots:true})=>new ReplayConsumerBridge(r,'linked_frog',1n,undefined,options);
test('A9 static linked attachment is admitted only through explicit capability',()=>{const c=make();assert.equal(c.currentFrame().slotState!.slots[0]!.attachment,'linked_royal');});

const entries=(r:any):any=>r.skins[0].attachments;const mesh=(r:any,name='body')=>entries(r).find((e:any)=>e.slot==='body'&&e.name===name).attachment;
const advance=(c:ReplayConsumerBridge,t:bigint)=>{if(c.currentFrame().state==='stopped')c.play(c.context,'linked_frog',false);c.requestTick(c.context,t);while(c.currentFrame().backlog&&c.currentFrame().health==='healthy')c.pump(c.context,8);};
const accepted=(c:ReplayConsumerBridge)=>{const f=c.currentFrame();return{completed:f.completed,bones:f.bones,records:f.records,slotState:f.slotState};};
for(const[name,change]of Object.entries({
 'missing owner':(r:any):any=>mesh(r,'linked_royal').linked.attachment='missing',
 'ambiguous tuple':(r:any):any=>entries(r).push(structuredClone(entries(r)[0])),
 'self cycle':(r:any):any=>mesh(r,'linked_royal').linked.attachment='linked_royal',
 'chain':(r:any):any=>mesh(r,'linked_royal').linked.attachment='linked_plain',
 'wrong skin':(r:any):any=>mesh(r,'linked_royal').linked.skin='alternate',
 'skin ambiguity':(r:any):any=>r.skins.push({...r.skins[0],name:'alternate'}),
 'nonmesh source':(r:any):any=>{mesh(r,'linked_royal').linked.slot='badge';mesh(r,'linked_royal').linked.attachment='sun';},
 'missing slot':(r:any):any=>mesh(r,'linked_royal').linked.slot='missing',
 'inherit flag type':(r:any):any=>mesh(r,'linked_royal').linked.inherit_deform=1,
 'missing texture':(r:any):any=>mesh(r,'linked_royal').texture='absent',
 'nonfinite source':(r:any):any=>mesh(r).vertices[0]=NaN,
 'invalid UV':(r:any):any=>mesh(r).uvs[0]=2,
 'invalid triangle':(r:any):any=>mesh(r).triangles[0]=100,
 'degenerate triangle':(r:any):any=>mesh(r).triangles[0]=mesh(r).triangles[1],
 'invalid bind':(r:any):any=>mesh(r).weights[0].bones[0].x=Infinity,
 'missing bone':(r:any):any=>mesh(r).weights[0].bones[0].bone='absent',
 'singular bone':(r:any):any=>r.bones.find((b:any)=>b.name==='b0').scaleX=0,
 'negative weight':(r:any):any=>mesh(r).weights[0].bones[0].weight=-1,
 'zero weight total':(r:any):any=>mesh(r).weights[0].bones.forEach((w:any)=>w.weight=0),
 'duplicate influence':(r:any):any=>{mesh(r).weights[0].bones[1].bone=mesh(r).weights[0].bones[0].bone;},
 'source FFD':(r:any):any=>r.animations.linked_frog.deform.push({slot:'body',attachment:'body',keys:[]}),
 'same-size wrong FFD owner':(r:any):any=>r.animations.linked_frog.deform.push({slot:'body',attachment:'linked_royal',keys:[{time:0,offsets:Array(20).fill(1),curve:'linear'}]}),
 'events':(r:any):any=>r.animations.linked_frog.events.push({time:.5,name:'excluded'}),
 'clipping':(r:any):any=>entries(r).push({slot:'body',name:'mask',attachment:{type:'clipping',vertices:[0,0,0,1,1,0],vertex_count:3,end_slot:null}}),
 'nonNormal':(r:any):any=>r.slots[0].blend='add',
 'sequence':(r:any):any=>mesh(r,'linked_royal').sequence={frames:['body_art']}
}))test('A9 refuses '+name+' without changing source',()=>{const r=native();change(r);const before=structuredClone(r);assert.throws(()=>make(r));assert.deepEqual(r,before);});
for(const options of [undefined,{animatedSlots:true},{weightedFfd:true},{linkedMeshes:true},{linkedMeshes:true,animatedSlots:false},{linkedMeshes:true,animatedSlots:true,weightedFfd:true},{linkedMeshes:true,animatedSlots:true,clipping:true},{linkedMeshes:true,animatedSlots:true,animationEvents:true}])test('A9 keeps unqualified capability closed '+JSON.stringify(options),()=>assert.throws(()=>new ReplayConsumerBridge(native(),'linked_frog',1n,undefined,options as any)));
test('A9 owner/texture projection is exact, independent of vertex count and immutable',()=>{const r=native(),before=structuredClone(r),e=entries(r).find((e:any)=>e.name==='linked_royal'),resolved=linkedGeometry(r,'default',e);assert.deepEqual(resolved.owner,{skin:'default',slot:'body',attachment:'body'});const a=resolved.attachment as any;assert.equal(a.texture,'moon');assert.deepEqual(a.vertices,mesh(r).vertices);assert.deepEqual(a.weights,mesh(r).weights);assert.deepEqual(a.uvs,mesh(r).uvs);const projected=linkedMeshSources(r,'linked_frog');mesh(projected).vertices[0]+=10;assert.deepEqual(r,before);});
test('A9 accepts unweighted link and implicit default within one fixed skin',()=>{const r=native();assert.equal(entries(r).find((e:any)=>e.name==='linked_cape').attachment.linked.skin,null);assert(make(r));});
test('A9 genuine Rust static linked trajectory including attachment transitions and four loops',()=>{const refs=JSON.parse(readFileSync('../experimental/linked-meshes/fixtures/rust.json','utf8')).frames,c=make();for(const r of refs){if(r.tick)advance(c,BigInt(r.tick));const f=c.currentFrame();assert.equal(f.completed,BigInt(r.tick));assert.equal(f.deformation,undefined);assert.equal(f.slotState!.tick,f.completed);assert.deepEqual(f.slotState!.drawOrder,r.drawOrder);for(const s of f.slotState!.slots){const e=r.slots.find((v:any)=>v.name===s.name);assert.deepEqual([s.attachment,s.owner,s.visible],[e.attachment,e.owner,e.visible]);s.color.forEach((v,i)=>assert(Math.abs(v-e.color[i])<1e-5));}for(const b of f.bones){const e=r.bones.find((v:any)=>v.name===b.name);Object.values(b.world).forEach((v,i)=>assert(Math.abs(v-e.world[i])<=(i<4?.0001:.01)));}}});
test('A9 observer abort preserves accepted prefix and requires native reset',()=>{const c=make();advance(c,59n);const old=accepted(c);c.requestTick(c.context,60n,()=>{throw Error('abort');});assert.deepEqual(accepted(c),old);assert.equal(c.currentFrame().health,'faulted');assert.throws(()=>advance(c,60n),/reset/);});
test('A9 source mutation after admission cannot redirect geometry or timelines',()=>{const r=native(),c=make(r);mesh(r,'linked_royal').linked.attachment='missing';r.animations.linked_frog!.slots=[];advance(c,60n);assert.equal(c.currentFrame().slotState!.slots[0]!.attachment,'linked_plain');});

test('A9 reset/stop/restart preserve explicit linked capability and reject old context',()=>{const c=make();advance(c,60n);const old=c.context;c.reset(old,2n);assert.notEqual(c.context,old);assert.equal(c.currentFrame().completed,0n);assert.equal(c.currentFrame().slotState!.slots[0]!.attachment,'linked_royal');assert.throws(()=>c.requestTick(old,1n),/context/);advance(c,90n);assert.equal(c.currentFrame().slotState!.slots[0]!.attachment,'linked_royal');c.stop(c.context);assert.equal(c.currentFrame().completed,0n);advance(c,60n);assert.equal(c.currentFrame().slotState!.slots[0]!.attachment,'linked_plain');});
