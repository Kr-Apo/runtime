import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {evaluate,attachmentWorldVertices} from '@ankhimate/runtime';
import {decodeOraclePng} from './oracle-png.mjs';
import {geometryErrors} from './clipping-measure.mjs';
import {Texture,TextureSource} from 'pixi.js';
import {PixiRigAsset} from '../dist/index.js';
const native=name=>JSON.parse(readFileSync(new URL(`./fixtures/clipping/${name}/skeleton.json`,import.meta.url),'utf8'));
function using(raw,fn){const pages=new Map(raw.atlas.pages.map(p=>[p.index,new Texture({source:new TextureSource({width:p.width,height:p.height,alphaMode:'premultiplied-alpha'})})]));let asset,instance;try{asset=PixiRigAsset.from(raw,pages);instance=asset.createInstance();fn(instance);}finally{instance?.destroy();asset?.destroy();pages.forEach(p=>p.destroy(true));}}
test('b.4.2 native clipping rectangle is accepted and cuts rendered triangles',()=>using(native('successive'),i=>{const art=i.root.children.find(m=>m.label==='art');assert.ok(art?.visible);assert.ok([...art.geometry.positions].filter((_,i)=>i%2===0).every(x=>x<=.01));assert.ok(!i.root.children.some(m=>m.label==='mask'&&m.visible));}));

const ref=n=>JSON.parse(readFileSync(new URL(`./fixtures/clipping/${n}/reference.json`,import.meta.url),'utf8'));
const capture=i=>i.root.children.map(m=>({label:m.label,visible:m.visible,p:[...m.geometry.positions],uv:[...m.geometry.uvs],ix:[...m.geometry.indices],texture:m.texture.uid}));
for(const name of ['ffd_alt','tint_mesh','replacement'])test(`native ${name}: Rust clipped geometry, transformed mask and UV interpolation for every skin, clip and fade`,()=>using(native(name),i=>{
 const r=native(name),refs=ref(name);let worst=0,area=0,vertices=0;
 for(const s of refs.samples){i.setSkin(s.skin);const pose=i.setTime(s.animation,s.time),error=geometryErrors(i,r,s.pose,s.skin);worst=Math.max(worst,error.position);area=Math.max(area,error.area);vertices+=error.vertices;
  assert.ok(error.position<=.01&&error.containment<=.01&&error.uv<=1e-6,JSON.stringify(error));assert.ok(error.area<=.01,JSON.stringify(error));
  for(const mask of s.pose.masks){const a=pose.slots.find(s=>s.name===mask.name).attachment,points=attachmentWorldVertices(r,pose,s.skin,mask.name,a);assert.equal(points.length,mask.vertices.length);points.forEach((v,j)=>assert.ok(Math.abs(v-mask.vertices[j])<=.01));}
 }
 for(const s of refs.fades){i.setSkin(s.skin);const p=i.playback;p.play('clip');p.update(.25);p.crossFade('relax',1);const pose=p.update(s.elapsed);const error=geometryErrors(i,r,s.pose,s.skin);assert.ok(error.position<=.01&&error.area<=.01&&error.containment<=.01&&error.uv<=1e-6,JSON.stringify(error));}
 console.log(`${name}: ${vertices} vertices, max source position ${worst}, max Rust clipped area delta ${area}`);
}));
for(const n of ['audit-rect','audit-concave','audit-transformed','end-visible','end-empty','end-invisible','end-animated','successive','toggle','concave','mesh-multi-dark','draw-order'])test(`historical native ${n}: every relevant pose accepts clipping`,()=>using(native(n),i=>{for(const t of (n==='end-animated'?[0,.25]:[0,.25,.5,.75]))i.setTime('clip',t);if(n==='end-animated'){const before=capture(i);assert.throws(()=>i.setTime('clip',.5),/unknown attachment/);assert.deepEqual(capture(i),before);}}));
test('invalid mask geometry and unrepresented semantics refuse deterministically',()=>{
 const bad=[[],[0,0,1,1,2,2],[0,0,1,0,1,0,0,1],[0,0,1,0,2,0,2,1,0,1],[0,0,3,3,0,3,3,0],[NaN,0,1,0,0,1],[Infinity,0,1,0,0,1]];
 for(const vertices of bad){const r=native('successive'),a=r.skins[0].attachments.find(e=>e.slot==='mask').attachment;a.vertices=vertices;a.vertex_count=vertices.length/2;assert.throws(()=>using(r,()=>assert.fail()),/clipping|finite/);}
 for(const property of ['holes','weights','deform','nested']){const r=native('successive');r.skins[0].attachments.find(e=>e.slot==='mask').attachment[property]=[];assert.throws(()=>using(r,()=>assert.fail()),/clipping fields/);}
 const r=native('successive');r.skins[0].attachments.find(e=>e.slot==='mask').attachment.end_slot='missing';assert.throws(()=>using(r,()=>assert.fail()),/unresolved clipping end/);
});
test('collapsed animated mask refuses before visible mutation or transport change; inverse winding remains usable',()=>using(native('ffd_alt'),i=>{
 i.playback.play('clip');i.playback.update(.25);const before=capture(i),time=i.playback.time,pose=evaluate(native('ffd_alt'),[{animation:'clip',time:.5,alpha:1}]);const bone=pose.bones.find(b=>b.name==='maskbone');bone.world.a=bone.world.b=bone.world.c=bone.world.d=0;
 assert.throws(()=>i.setPose(pose),/clipping polygon/);assert.deepEqual(capture(i),before);assert.equal(i.playback.time,time);assert.equal(i.playback.playing,true);
 const reflected=evaluate(native('ffd_alt'));const b=reflected.bones.find(b=>b.name==='maskbone');b.world.a*=-1;b.world.b*=-1;i.setPose(reflected);assert.ok(i.root.children.some(m=>m.visible));
}));
test('independent instances, replacement masks and hidden introduction match Rust without mask objects',()=>using(native('ffd_alt'),i=>{
 const r=native('ffd_alt');i.setTime('clip',.25);geometryErrors(i,r,ref('ffd_alt').samples.find(s=>s.skin==='default'&&s.animation==='clip'&&s.time===.25).pose,'default');assert.ok(i.root.children.every(m=>m.label!=='mask'&&m.label!=='mask2'));const ids=[...i.root.children];for(let n=0;n<60;n++){i.setSkin(n%2?'default':'alternate');i.setTime('clip',n%4/4);}assert.ok(ids.every(m=>i.root.children.includes(m)));
}));
test('288 CPU PNGs decode identically to independent Pillow RGBA bytes',()=>{const hashes=JSON.parse(readFileSync(new URL('./clipping-png-rgba.json',import.meta.url)));assert.equal(Object.keys(hashes).length,288);for(const [file,sha]of Object.entries(hashes)){const p=decodeOraclePng(readFileSync(new URL(file,import.meta.url)));assert.equal(createHash('sha256').update(p.rgba).digest('hex'),sha,file);}});
