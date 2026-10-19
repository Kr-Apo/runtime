import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {readFileSync,writeFileSync} from 'node:fs';
import {evaluate} from '@ankhimate/runtime';
import {clipDraw,points,polygonPieces} from '@ankhimate/runtime/render';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), earcut=require('phaser/src/geom/polygon/Earcut.js');
import {PhaserRig} from '../dist/index.js';
import {Texture,TextureSource} from 'pixi.js';
import {PixiRigAsset} from '../../pixi/dist/index.js';
import {mockScene} from './mock-scene.mjs';
const native=n=>JSON.parse(readFileSync(new URL(`../../pixi/test/fixtures/${n}/skeleton.json`,import.meta.url),'utf8'));
function withPair(name,run){const raw=typeof name==='string'?native(name):name,before=JSON.stringify(raw),scene=mockScene(raw),pages=new Map(raw.atlas.pages.map(p=>[p.index,new Texture({source:new TextureSource({width:p.width,height:p.height,alphaMode:'premultiplied-alpha'})})]));let asset,instance,phaser;
 try{asset=PixiRigAsset.from(raw,pages);instance=asset.createInstance();phaser=new PhaserRig(scene,raw,{pageTextureKeys:scene.pageTextureKeys});run({raw,scene,pixi:instance,phaser});assert.equal(JSON.stringify(raw),before);}
 finally{phaser?.destroy();instance?.destroy();asset?.destroy();pages.forEach(p=>p.destroy(true));}}
const metrics={poseComparisons:0,renderedPositionComponents:0,renderedUvComponents:0,maxAdapterPositionError:0,maxAdapterUvError:0,rustPositionComponents:0,maxRustPositionError:0,rustAffineComponents:0,maxRustAffineError:0};
const near=(a,b,eps=.00001)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<=eps,`${i}: ${v} versus ${b[i]}`));};
function phaserDraw(view){
 const p=Float32Array.from(view.object.vertices.flatMap(v=>[v.x,-v.y])),uv=Float32Array.from(view.object.vertices.flatMap(v=>[v.tu,v.tv]));
 let g={positions:p,uvs:uv,indices:Uint32Array.from(view.indices,(_,i)=>i)};
 const mask=view.object.mask?.geometryMask;if(mask){const polygon=points(mask.points);g=clipDraw(g,polygon,polygonPieces(polygon));}
 return g;
}
function expanded(g,field){return [...g.indices].flatMap(i=>[g[field][i*2],g[field][i*2+1]]);}
function compare(phaser,pixi){metrics.poseComparisons++;phaser.scene.events.emit('prerender');
 const actual=[];for(const object of phaser.root.list){const entry=[...phaser.views].find(([,v])=>v.object===object);if(entry&&object.visible){const g=phaserDraw(entry[1]);if(g.indices.length)actual.push(entry[0]);}}
 const expected=pixi.root.children.filter(m=>m.visible&&m.geometry.indices.length).map(m=>m.label);assert.deepEqual(actual,expected,'effective draw order');
 for(const [slot,view]of phaser.views){const expected=pixi.root.children.find(m=>m.label===slot);if(!view.object.visible){assert.ok(!expected?.visible);continue;}
 const actual=phaserDraw(view);if(!actual.indices.length){assert.ok(!expected?.visible);continue;}
 assert.ok(expected?.visible);const geometry=expected.geometry;
 for(const [field,kind]of [['positions','Position'],['uvs','Uv']]){const a=expanded(actual,field),b=expanded(geometry,field);metrics[`rendered${kind}Components`]= (metrics[`rendered${kind}Components`]??0)+a.length;for(let j=0;j<a.length;j++)metrics[`maxAdapter${kind}Error`]=Math.max(metrics[`maxAdapter${kind}Error`],Math.abs(a[j]-b[j]));}
 near(expanded(actual,'positions'),expanded(geometry,'positions'),.0001);near(expanded(actual,'uvs'),expanded(geometry,'uvs'),1e-7);
 // These are the real Phaser Vertex fields consumed by Face.load, not guessed UVs.
 near(view.object.vertices.flatMap(v=>[v.u,v.v]),view.object.vertices.flatMap(v=>[v.tu,v.tv]),0);
 const effect=pixi.tints.get(slot),mesh=view.object;mesh.pipeline.onBind(mesh);const uniforms=mesh.pipeline.uniforms;
 near(uniforms.uLight,[...effect.light].slice(0,3),1e-7);near(uniforms.uDark,[...effect.dark],1e-7);assert.ok(Math.abs(uniforms.uOpacity-effect.light[3])<1e-7);
 assert.equal(uniforms.uTrimEnabled,effect.trimEnabled);if(effect.trimEnabled){near(uniforms.uTrim,[...effect.trim],1e-7);near(uniforms.uPageSize,[...effect.pageSize]);}
 assert.ok(mesh.vertices.every(v=>v.color===0xffffff&&v.alpha===1),'slot floats must not be quantized into vertex tint a second time');
 }
}
test('source texel centres and trimmed bounds match Pixi rather than stretching the retained frame',()=>withPair('trim',({phaser,pixi})=>compare(phaser,pixi)));
test('partially weighted FFD does not apply packed influence offsets to rigid vertices',()=>withPair('meshes/partial_ffd',({raw,phaser,pixi})=>{const pose=pixi.setTime('clip',.5);phaser.player.play('clip').seek(.5);phaser.update(0);const pv=pixi.root.children[0].geometry.positions,view=[...phaser.views.values()][0];const v=view.object.vertices[view.indices.indexOf(1)];const source=pv.slice(2,4);near([v.x,-v.y],source,.01);}));
test('Phaser exposes the same per-instance safe transport controls as Pixi',()=>withPair('playback',({phaser})=>{assert.equal(typeof phaser.playback?.pause,'function');assert.equal(typeof phaser.setTime,'function');assert.equal(typeof phaser.setPose,'function');}));

const meshCases=['weighted','weighted_partial','weighted_ffd','weighted_ffd_linear','ffd_linear','ffd_stepped','ffd_bezier','asymmetric','weighted_complex','partial_ffd','trim_multi','topology'];
for(const name of ['tagged','trim','multipage','playback',...meshCases.map(n=>`meshes/${n}`),...['skins','ffd_alt','tint_grid','tint_mesh','blend_normal'].map(n=>`appearance/${n}`)])test(`same unpatched native export: ${name}, clips/skins, vertices/UVs/slot floats`,()=>withPair(name,({raw,phaser,pixi})=>{
 for(const skin of raw.skins.filter(s=>s.name!=='incompatible')){phaser.setSkin(skin.name);pixi.setSkin(skin.name);
 for(const [clip,a]of Object.entries(raw.animations))for(const time of [...new Set([0,.25,.5,.75,a.duration])].filter(t=>t<=a.duration)){
  assert.deepEqual(phaser.setTime(clip,time),pixi.setTime(clip,time));compare(phaser,pixi);
 }}
}));
for(const name of ['audit-rect','audit-concave','audit-transformed','end-visible','end-empty','end-invisible','end-animated','successive','toggle','concave','mesh-multi-dark','draw-order','ffd_alt','tint_mesh','replacement'])test(`polygon mask parity: ${name}, hidden/replaced/inclusive ends and FFD`,()=>withPair(`clipping/${name}`,({raw,phaser,pixi})=>{
 for(const skin of raw.skins.filter(s=>s.name!=='incompatible')){phaser.setSkin(skin.name);pixi.setSkin(skin.name);
 for(const [clip,a]of Object.entries(raw.animations))for(const t of [0,.25,.5,.75].filter(t=>t<=a.duration)){
  if(name==='end-animated'&&t===.5){assert.throws(()=>phaser.setTime(clip,t),/unknown attachment/);assert.throws(()=>pixi.setTime(clip,t),/unknown attachment/);continue;}
  assert.deepEqual(phaser.setTime(clip,t),pixi.setTime(clip,t));compare(phaser,pixi);
 }
 }
}));
const state=p=>JSON.stringify({meshes:[...p.views].map(([name,v])=>({name,visible:v.object.visible,mask:!!v.object.mask,p:v.object.vertices.flatMap(v=>[v.x,v.y,v.tu,v.tv])})),skin:p.skinName,time:p.playback.time,clip:p.playback.animation,playing:p.playback.playing});
test('shared playback parity: milliseconds legacy, pause/speed/loops/fades/skins/events and direct detachment',()=>withPair('appearance/ffd_alt',({phaser,pixi})=>{
 const a=phaser.playback,b=pixi.playback,eventsA=[],eventsB=[];a.onEvent(e=>eventsA.push(e));b.onEvent(e=>eventsB.push(e));a.speed=b.speed=1.25;
 a.play('clip');b.play('clip');assert.deepEqual(phaser.update(200),b.update(.2));compare(phaser,pixi);
 a.crossFade('relax',1);b.crossFade('relax',1);for(const skin of ['alternate','default','alternate']){const time=a.time;const pending=a.events;phaser.setSkin(skin);pixi.setSkin(skin);assert.equal(a.time,time);assert.equal(a.events,pending);assert.deepEqual(a.update(.1),b.update(.1));compare(phaser,pixi);}
 a.pause();b.pause();assert.deepEqual(phaser.update(500),b.update(.5));a.resume();b.resume();assert.deepEqual(phaser.update(250),b.update(.25));compare(phaser,pixi);assert.deepEqual(eventsA,eventsB);
 phaser.setTime('clip',.75);pixi.setTime('clip',.75);assert.equal(a.animation,undefined);a.resume();b.resume();assert.deepEqual(phaser.update(100),b.update(.1));compare(phaser,pixi);
 a.play('clip',{loop:false});b.play('clip',{loop:false});assert.deepEqual(phaser.update(2000),b.update(2));assert.equal(a.time,1);compare(phaser,pixi);
 a.stop();b.stop();compare(phaser,pixi);assert.equal(a.playing,false);
}));
test('legacy player/play/seek, same clip no-restart and millisecond update preserve existing API',()=>withPair('playback',({raw,phaser})=>{
 const clip=Object.keys(raw.animations)[0];phaser.player.play(clip).seek(.25);assert.deepEqual(phaser.update(250),evaluate(raw,[{animation:clip,time:.5,alpha:1}],{skin:raw.defaultSkin}));
 const player=phaser.player,time=player.time;phaser.play(clip,false);assert.equal(phaser.player,player);assert.equal(player.time,time);phaser.play(clip);assert.equal(player.time,0);
}));
test('malformed direct poses and refused skins leave display, masks, playback and pending events unchanged',()=>withPair('clipping/ffd_alt',({phaser})=>{
 const p=phaser.playback;p.play('clip');const pose=p.update(.25);p.crossFade('relax',1);const original=state(phaser),pending=p.events;
 for(const corrupt of [v=>v.bones[0].world.a=NaN,v=>v.slots[0].color[0]=Infinity,v=>v.drawOrder.pop(),v=>v.deforms.bad=[0,0],v=>Object.values(v.deforms)[0].pop(),v=>{const b=v.bones.find(b=>b.name==='maskbone');b.world.a=b.world.b=b.world.c=b.world.d=0;}]){
  const bad=structuredClone(pose);corrupt(bad);assert.throws(()=>phaser.setPose(bad));assert.equal(state(phaser),original);assert.equal(p.events,pending);
 }
 assert.throws(()=>phaser.setSkin('absent'));assert.equal(state(phaser),original);
 for(const delta of [-1,NaN,Infinity])assert.throws(()=>phaser.update(delta));assert.equal(state(phaser),original);
 assert.throws(()=>p.crossFade('clip',NaN));assert.equal(state(phaser),original);
}));
test('same-name skin topology/page swaps retain Mesh, update every expanded index, and reuse stable vertices',()=>withPair('appearance/skins',({phaser,pixi,scene})=>{
 const mesh=phaser.views.get('front').object;for(const skin of ['alternate','triangle','quad','default','alternate']){phaser.setSkin(skin);pixi.setSkin(skin);assert.equal(phaser.views.get('front').object,mesh);compare(phaser,pixi);}
 const vertices=[...mesh.vertices],pipelines=scene.pipelineCount();phaser.play('clip');for(let i=0;i<600;i++)phaser.update(1000/60);
 assert.equal(scene.liveMeshes,2);assert.equal(scene.pipelineCount(),pipelines);assert.equal(phaser.views.get('front').object,mesh);
 // Stable setup on a selected skin avoids animated attachment topology changes.
 phaser.setTime('clip',0);const stable=[...mesh.vertices];for(let i=0;i<30;i++)phaser.setTime('clip',0);assert.deepEqual(mesh.vertices,stable);
 assert.ok(vertices.length>0);
}));
test('root/ancestor transforms and scroll are applied to polygon masks using real Phaser matrices',()=>withPair('clipping/ffd_alt',({scene,phaser})=>{
 phaser.setTime('clip',.25);const parent=scene.add.container();parent.setPosition(11,-17).setScale(-1.5,.75);parent.rotation=.37;parent.scrollFactorX=.5;parent.scrollFactorY=.6;parent.add(phaser.root);
 phaser.root.setPosition(33,19).setScale(.8,1.25);phaser.root.rotation=-.2;phaser.root.scrollFactorX=.7;phaser.root.scrollFactorY=.9;
 scene.events.emit('prerender');const m=phaser.root.getWorldTransformMatrix();for(const c of phaser.clips.values()){const expected=c.vertices.flatMap((v,i)=>i%2?[]:[m.getX(v,-c.vertices[i+1]),m.getY(v,-c.vertices[i+1])]);near(c.graphics.points,expected);assert.equal(c.graphics.scrollFactorX,.35);assert.equal(c.graphics.scrollFactorY,.54);const triangles=earcut(c.graphics.points);assert.ok(triangles.length>=3);}
 parent.destroy(true);
}));
test('Phaser real Vertex projection is one Y conversion, never another camera flip',()=>withPair('meshes/asymmetric',({phaser})=>{
 phaser.setTime('clip',.5);for(const v of phaser.views.values())near(v.object.projected(),v.object.vertices.flatMap(v=>[v.x,-v.y]),.0001);
}));
test('destruction through rig or public root removes callbacks, listeners, geometry and masks; pages remain borrowed',()=>{
 const raw=native('clipping/ffd_alt'),scene=mockScene(raw),pages=[...scene.textures.data.values()];
 for(let n=0;n<12;n++){const rig=new PhaserRig(scene,raw,{pageTextureKeys:scene.pageTextureKeys}),p=rig.playback;let calls=0;p.onEvent(()=>calls++);p.play('clip');p.update(.25);const count=calls;
  if(n%2)rig.root.destroy(true);else rig.destroy();rig.destroy();assert.equal(scene.liveMeshes,0);assert.equal(scene.liveGraphics,0);assert.equal(scene.liveMasks,0);assert.equal(scene.liveRoots,0);assert.equal(scene.events.listenerCount('prerender'),0);assert.throws(()=>p.update(.1),/destroyed/);assert.equal(calls,count);
 }
 assert.deepEqual([...scene.textures.data.values()],pages);assert.equal(scene.pipelineCount(),2);
});
test('immutable source snapshot and independent instances share only textures/pipeline',()=>withPair('meshes/weighted_complex',({raw,scene,phaser})=>{
 const other=new PhaserRig(scene,raw,{pageTextureKeys:scene.pageTextureKeys});try{other.play('relax');other.update(250);const before=state(other);phaser.play('clip');phaser.update(500);assert.equal(state(other),before);assert.notEqual([...other.views.values()][0].object,[...phaser.views.values()][0].object);
 const saved=raw.animations,names=Object.keys(saved);raw.animations={...saved};delete raw.animations[names[0]];phaser.play(names[0]);phaser.update(250); // private snapshot survives external edits
 raw.animations=saved;
 }finally{other.destroy();}
}));
test('missing textures, bad dimensions/PMA and atlas-frame collisions fail before allocating roots/meshes',()=>{
 const raw=native('trim');for(const corrupt of [s=>s.textures.data.clear(),s=>s.textures.get('page-0').source[0].width++,s=>s.textures.get('page-0').source[0].glTexture.pma=false,s=>{const r=raw.atlas.regions[0];s.textures.get(`page-${r.page}`).add(r.name,0,r.x+1,r.y,r.width,r.height);}]){const scene=mockScene(raw);corrupt(scene);assert.throws(()=>new PhaserRig(scene,raw,{pageTextureKeys:scene.pageTextureKeys}),/atlas|Atlas|frame/);assert.equal(scene.liveRoots,0);assert.equal(scene.liveMeshes,0);}
});
test('bad mesh topology/influences/FFD and incompatible alternative skins refuse atomically',()=>{
 for(const corrupt of [r=>r.skins[0].attachments[0].attachment.triangles=[0,1,999],r=>r.skins[0].attachments[0].attachment.uvs.pop(),r=>r.skins[0].attachments[0].attachment.weights[0].bones[0].weight=-1,r=>r.skins[0].attachments[0].attachment.weights[0].bones[0].bone='absent',r=>r.animations.clip.deform[0].keys[0].offsets.pop(),r=>r.bones[0].scaleX=0,r=>r.slots[0].blend='unknown',r=>r.bones[0].inheritReflect='yes']){const raw=native('meshes/weighted_ffd');corrupt(raw);const scene=mockScene(raw);assert.throws(()=>new PhaserRig(scene,raw,{pageTextureKeys:scene.pageTextureKeys}));assert.equal(scene.liveMeshes,0);assert.equal(scene.liveRoots,0);}
 withPair('appearance/ffd_alt',({phaser})=>{phaser.play('clip');phaser.update(250);const before=state(phaser);assert.throws(()=>phaser.setSkin('incompatible'),/deform/);assert.equal(state(phaser),before);});
});
test('event reentrancy/unsubscribe/flood guards use the same shared controller',()=>withPair('playback',({raw,phaser})=>{
 const name=Object.keys(raw.animations).find(n=>raw.animations[n].events.length);const p=phaser.playback;let n=0;const off=p.onEvent(()=>n++);off();p.play(name,{loop:true});p.onEvent(()=>{assert.throws(()=>p.update(.1),/Recursive/);n++;phaser.destroy();});p.onEvent(()=>assert.fail('callback after destruction'));
 assert.throws(()=>p.update(1e20),/too many events/);assert.equal(p.time,0);p.update(3);assert.equal(n,1);
}));

for(const name of meshCases)test(`independent Rust geometry oracle: ${name}, samples and fades`,()=>withPair(`meshes/${name}`,({raw,phaser})=>{
 const reference=JSON.parse(readFileSync(new URL(`../../pixi/test/fixtures/meshes/${name}/reference.json`,import.meta.url),'utf8'));
 const verify=(pose,ref)=>{for(const b of ref.bones){const actual=pose.bones.find(v=>v.name===b.name).world;for(const [k,v]of Object.entries(b.world)){metrics.rustAffineComponents++;const error=Math.abs(actual[k]-v);metrics.maxRustAffineError=Math.max(metrics.maxRustAffineError,error);assert.ok(error<=.01);}}
  const appearance=phaser.appearances.get(phaser.skinName);for(const slot of ref.slots){if(!slot.positions.length)continue;const binding=appearance.bindings.get(`${slot.name}\0${slot.attachment}`);if(!binding)continue;const p=binding.positions(pose);assert.equal(p.length,slot.positions.length);for(let i=0;i<p.length;i++){metrics.rustPositionComponents++;const error=Math.abs(p[i]-(i%2?-slot.positions[i]:slot.positions[i]));metrics.maxRustPositionError=Math.max(metrics.maxRustPositionError,error);assert.ok(error<=.01,`${name} Rust position error ${error}`);}}
 };
 for(const sample of reference.samples){phaser.setSkin(sample.skin??raw.defaultSkin);verify(phaser.setTime(sample.animation??'clip',sample.time),sample.pose);}
 if(reference.fades?.length){phaser.play('clip');phaser.update(250);phaser.crossFade('relax',1);let previous=0;for(const s of reference.fades){verify(phaser.update((s.elapsed-previous)*1000),s.pose);previous=s.elapsed;}}
}));
test('legacy v1 reader remains usable and genuine walker IK clips still evaluate through the shared core',()=>{
 for(const name of ['walker','tagged_rig']){const r=JSON.parse(readFileSync(new URL(`./fixtures/${name}/skeleton.json`,import.meta.url),'utf8')),scene=mockScene(r),i=new PhaserRig(scene,r,{pageTextureKeys:scene.pageTextureKeys});try{for(const [name,a]of Object.entries(r.animations))for(const t of [0,.25,.5,.75].filter(t=>t<=a.duration))assert.deepEqual(i.setTime(name,t),evaluate(r,[{animation:name,time:t,alpha:1}],{skin:r.defaultSkin}));}finally{i.destroy();}}
 // Accepted text-string export fixture has no bone scalar tracks; real atlas/regions stay byte-for-byte.
 const r=native('tagged');delete r.format_version;r.animations={};const scene=mockScene(r),i=new PhaserRig(scene,r,{pageTextureKeys:scene.pageTextureKeys});i.update(0);i.destroy();
});
test('native control characters in identities remain data, not slot/attachment separators',()=>{
 const r=native('meshes/weighted_ffd'),slot='art\0"é',name='shape\0\\royal';r.slots[0].name=slot;r.slots[0].attachment=name;r.drawOrder=[slot];for(const s of r.skins)for(const e of s.attachments){e.slot=slot;e.name=name;}for(const a of Object.values(r.animations))for(const d of a.deform){d.slot=slot;d.attachment=name;}
 withPair(r,({phaser,pixi})=>{phaser.setTime('clip',.5);pixi.setTime('clip',.5);compare(phaser,pixi);});
});

test('zero duration, exact loop endpoint, negative seek and invalid direct time follow shared semantics',()=>{
 const raw=native('playback'),original=Object.keys(raw.animations)[0];raw.animations.zero={duration:0,looping:true,bones:[],slots:[],deform:[],drawOrder:[],ik:[],transform:[],events:[]};
 withPair(raw,({raw,phaser,pixi})=>{const a=phaser.playback,b=pixi.playback;a.play('zero');b.play('zero');assert.deepEqual(a.update(20),b.update(20));assert.equal(a.time,0);assert.deepEqual(a.events,[]);
  a.play(original,{loop:true});b.play(original,{loop:true});const duration=raw.animations[original].duration;assert.deepEqual(phaser.update(duration*1000),b.update(duration));assert.equal(a.time,0);
  phaser.player.seek(-duration/4);assert.equal(phaser.player.time,duration*.75);const before=state(phaser);for(const t of [-.1,NaN,Infinity,duration+1])assert.throws(()=>phaser.setTime(original,t));assert.equal(state(phaser),before);
 });
});
test('real Phaser Face.load consumes updated UVs and white packed tint; slot precision stays in uniforms',()=>withPair('appearance/tint_grid',({phaser})=>{
 phaser.setTime('clip',.25);for(const v of phaser.views.values())if(v.object.visible){const m=v.object;for(const vertex of m.vertices){vertex.ta=1;vertex.tx=vertex.x;vertex.ty=-vertex.y;}
  const f32=new Float32Array(m.faces.length*21),u32=new Uint32Array(f32.buffer);let offset=-1;for(const f of m.faces)offset=f.load(f32,u32,offset,0,0);
  assert.equal(offset,f32.length-1);for(let i=0;i<m.vertices.length;i++){assert.equal(f32[i*7+2],Math.fround(m.vertices[i].tu));assert.equal(f32[i*7+3],Math.fround(m.vertices[i].tv));assert.equal(u32[i*7+6],0xffffffff);}
 }
}));

test('legacy events polling does not repeat the last event during a high-level pause',()=>withPair('playback',({raw,phaser})=>{
 const [name,a]=Object.entries(raw.animations).find(([,a])=>a.events.some(e=>e.time>0)),event=a.events.find(e=>e.time>0);phaser.play(name);phaser.update(event.time*1000);assert.ok(phaser.player.events.length>0);
 phaser.playback.pause();phaser.update(0);assert.deepEqual(phaser.playback.events,[]);assert.deepEqual(phaser.player.events,[],'legacy polling must not replay the old batch while paused');
}));
test('legacy play(name,false) refreshes a seeked pose and resumes without restarting',()=>withPair('playback',({raw,phaser,pixi})=>{
 const name=Object.keys(raw.animations)[0],time=raw.animations[name].duration*.75;phaser.play(name);phaser.playback.pause();phaser.player.seek(time);phaser.play(name,false);
 assert.equal(phaser.playback.playing,true);assert.equal(phaser.player.time,time);pixi.setTime(name,time);compare(phaser,pixi);
}));
after(()=>{if(process.env.ANKHIMATE_PARITY_METRICS)writeFileSync(process.env.ANKHIMATE_PARITY_METRICS,JSON.stringify(metrics,null,2)+'\n');console.log('T-810 numeric data (no rendering): '+JSON.stringify(metrics));});
