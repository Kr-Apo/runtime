import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { RendererType, Texture, TextureSource } from 'pixi.js';
import { PixiRigAsset } from '../dist/index.js';
import { evaluate } from '@ankhimate/runtime';
import { MeshBinding } from '../dist/mesh.js';

const fixture=name=>JSON.parse(readFileSync(new URL(`./fixtures/meshes/${name}/skeleton.json`,import.meta.url),'utf8'));
const withRig=(name,run)=>{
  const raw=typeof name==='string'?fixture(name):name;
  const pages=new Map(raw.atlas.pages.map(p=>[p.index,new Texture({source:new TextureSource({width:p.width,height:p.height,alphaMode:'premultiplied-alpha'})})]));
  let asset;const instances=[];
  try{asset=PixiRigAsset.from(raw,pages);run({raw,asset,pages,make:()=>{const i=asset.createInstance();instances.push(i);return i;}});}
  finally{for(const i of instances)i.destroy();asset?.destroy();for(const p of pages.values())p.destroy(true);}
};

for(const name of ['weighted','weighted_partial','weighted_ffd','weighted_ffd_linear','ffd_linear','ffd_stepped','ffd_bezier'])test(`native ${name}: mesh/FFD must load and agree with Rust vertices`,()=>{
  const reference=JSON.parse(readFileSync(new URL(`./fixtures/meshes/${name}/reference.json`,import.meta.url),'utf8'));
  withRig(name,({raw,make})=>{const i=make(),before=JSON.stringify(raw);let max=0;
    for(const s of reference.samples.filter(s=>s.skin==='default')){
      const pose=i.setTime('clip',s.time);
      for(const b of s.pose.bones)for(const [k,v] of Object.entries(b.world))assert.ok(Math.abs(pose.bones.find(p=>p.name===b.name).world[k]-v)<=.01);
      for(const slot of s.pose.slots){if(!slot.positions.length)continue;const mesh=i.root.children.find(m=>m.label===slot.name);
        mesh.geometry.positions.forEach((v,n)=>max=Math.max(max,Math.abs(v-(n%2?-slot.positions[n]:slot.positions[n]))));
        assert.deepEqual([...mesh.geometry.indices],slot.indices);
      }
      for(const d of s.pose.deforms){const actual=pose.deforms[`${d.slot}\0${d.attachment}`];assert.equal(actual.length,d.offsets.length);actual.forEach((v,n)=>assert.ok(Math.abs(v-d.offsets[n])<=.01));}
    }
    assert.ok(max<=.01,`max Rust vertex error ${max}`);assert.equal(JSON.stringify(raw),before);console.log(`${name}: max Rust vertex error ${max}`);
  });
});

const capture=i=>i.root.children.map(m=>({name:m.label,visible:m.visible,positions:[...m.geometry.positions],uvs:[...m.geometry.uvs],indices:[...m.geometry.indices],alpha:m.alpha}));
const ref=name=>JSON.parse(readFileSync(new URL(`./fixtures/meshes/${name}/reference.json`,import.meta.url),'utf8'));
let worst=0,components=0;
function verify(pose,reference,bindings){
 for(const b of reference.bones)for(const [key,value] of Object.entries(b.world)){const error=Math.abs(pose.bones.find(v=>v.name===b.name).world[key]-value);assert.ok(error<=.01);}
 for(const slot of reference.slots){const actual=bindings.get(`${slot.name}\0${slot.attachment}`).positions(pose);assert.equal(actual.length,slot.positions.length);
  actual.forEach((v,n)=>{const error=Math.abs(v-(n%2?-slot.positions[n]:slot.positions[n]));worst=Math.max(worst,error);components++;assert.ok(error<=.01,`Rust vertex error ${error}`);});
 }
 for(const d of reference.deforms){const actual=pose.deforms[`${d.slot}\0${d.attachment}`];assert.equal(actual.length,d.offsets.length);actual.forEach((v,n)=>assert.ok(Math.abs(v-d.offsets[n])<=.01));}
}
for(const name of ['asymmetric','weighted_complex','partial_ffd','trim_multi','topology'])test(`new native ${name}: Rust poses, FFD and crossfade, default and reflected transforms`,()=>withRig(name,({raw,make})=>{
 const reference=ref(name),i=make(),setup=evaluate(raw),bindings=new Map(raw.skins[0].attachments.map(e=>[`${e.slot}\0${e.name}`,new MeshBinding(raw,e.slot,e.name,e.attachment,setup)]));
 const before=JSON.stringify(raw);
 for(const s of reference.samples)verify(i.setTime(s.animation,s.time),s.pose,bindings);
 i.playback.play('clip');i.playback.update(.25);i.playback.crossFade('relax',1);let t=0;
 for(const s of reference.fades){verify(i.playback.update(s.elapsed-t),s.pose,bindings);t=s.elapsed;}
 assert.equal(JSON.stringify(raw),before);console.log(`Cumulative new native parity: ${components} vertex components, max ${worst}`);
}));

test('weighted geometry normalizes positive total weights using the common core',()=>{
 const raw=fixture('weighted');for(const w of raw.skins[0].attachments[0].attachment.weights)for(const b of w.bones)b.weight*=3;
 withRig('weighted',({make})=>{const base=make();base.setTime('clip',.5);const expected=capture(base);
  withRig(raw,({make})=>{const scaled=make();scaled.setTime('clip',.5);const actual=capture(scaled);actual[0].positions.forEach((v,n)=>assert.ok(Math.abs(v-expected[0].positions[n])<.01));});
 });
});

test('malformed topology, UVs, weights, associations and FFD are refused before creating any view',()=>{
 for(const corrupt of [
  r=>r.skins[0].attachments[0].attachment.vertex_count++,r=>r.skins[0].attachments[0].attachment.vertices[0]=Infinity,
  r=>r.skins[0].attachments[0].attachment.triangles=[0,1,99],r=>r.skins[0].attachments[0].attachment.triangles=[0,0,1],r=>r.skins[0].attachments[0].attachment.triangles.pop(),
  r=>r.skins[0].attachments[0].attachment.uvs.pop(),r=>r.skins[0].attachments[0].attachment.uvs[0]=-1,
  r=>r.skins[0].attachments[0].attachment.weights[0].count++,r=>r.skins[0].attachments[0].attachment.weights.pop(),
  r=>r.skins[0].attachments[0].attachment.weights[0].bones[0].bone='absent',r=>r.skins[0].attachments[0].attachment.weights[0].bones[0].weight=-1,
  r=>r.skins[0].attachments[0].attachment.weights[0].bones.forEach(b=>b.weight=0),r=>r.skins[0].attachments[0].attachment.weights[0].bones[0].x=NaN,
  r=>r.bones[0].scaleX=0,r=>r.skins[0].attachments[0].attachment.linked={skin:'default',slot:'art',attachment:'shape'},
  r=>r.animations.clip.deform[0].attachment='absent',r=>r.animations.clip.deform[0].keys[0].offsets.pop(),
  r=>r.animations.clip.deform[0].keys[0].offsets[0]=NaN,r=>r.animations.clip.deform[0].keys[0].time=NaN,
  r=>r.animations.clip.deform[0].keys[1].time=-2,r=>r.animations.clip.deform[0].keys[0].curve={type:'bezier',handles:[-1,0,1,1]},
  r=>{const a=r.skins[0].attachments[0].attachment;a.sequence={frames:[a.texture],fps:1,mode:'loop',setup_index:0};}
 ]){const raw=fixture('weighted_ffd');corrupt(raw);assert.throws(()=>PixiRigAsset.from(raw,new Map()),/weight|influence|triangle|UV|deform|topology|vertices|linked|singular|sequence/);}
});

test('invalid direct FFD and influence affines preserve the entire displayed pose and playback state',()=>withRig('weighted_complex',({make})=>{
 const i=make(),p=i.playback;p.play('clip');const valid=p.update(.5),before=capture(i),time=p.time;
 for(const corrupt of [v=>v.deforms.bad=[0,0],v=>Object.values(v.deforms)[0].pop(),v=>Object.values(v.deforms)[0][0]=NaN,v=>v.bones.find(b=>b.name==='tip').world.a=Infinity]){
  const pose=structuredClone(valid);corrupt(pose);assert.throws(()=>i.setPose(pose));assert.deepEqual(capture(i),before);assert.equal(p.time,time);assert.equal(p.playing,true);
 }
}));

test('ordinary FFD updates reuse every mesh and buffer; instances share textures only',()=>withRig('weighted_complex',({raw,pages,make})=>{
 const a=make(),b=make(),meshes=[...a.root.children],geometries=meshes.map(m=>m.geometry),buffers=geometries.flatMap(g=>g.buffers),before=JSON.stringify(raw);
 a.playback.play('clip');b.playback.play('relax');a.playback.update(.25);b.playback.update(.75);const second=capture(b);
 for(let i=0;i<600;i++)a.playback.update(1/60);
 assert.deepEqual(capture(b),second);meshes.forEach((m,n)=>{assert.equal(a.root.children[n],m);assert.equal(m.geometry,geometries[n]);});assert.ok(buffers.every(b=>!b.destroyed));
 assert.equal(a.root.children[0].texture,b.root.children[0].texture);assert.notEqual(a.root.children[0].geometry,b.root.children[0].geometry);
 a.destroy();assert.ok(buffers.every(b=>b.destroyed));assert.ok([...pages.values()].every(t=>!t.destroyed));b.playback.update(.1);assert.equal(JSON.stringify(raw),before);
}));

test('real topology and page changes retain the Mesh object and release replaced geometry buffers',()=>withRig('topology',({make})=>{
 const i=make(),m=i.root.children[0],geometry=m.geometry,buffers=[...geometry.buffers],texture=m.texture;
 i.setTime('clip',.5);assert.equal(i.root.children[0],m);assert.notEqual(m.geometry,geometry);assert.equal(m.geometry.positions.length,6);assert.ok(buffers.every(b=>b.destroyed));assert.notEqual(m.texture,texture);
 const triangle=m.geometry,old=[...triangle.buffers];i.setTime('clip',1);assert.equal(m.geometry.positions.length,10);assert.ok(old.every(b=>b.destroyed));
 for(let n=0;n<20;n++)i.setTime('clip',n%2?.5:0);assert.equal(i.root.children.length,1);
}));

test('mesh binding keeps authored Unicode/control characters in slot and attachment names',()=>{
 const raw=fixture('weighted_ffd'),slot='art\0"é',name='shape\0\\royal';
 raw.slots[0].name=slot;raw.slots[0].attachment=name;raw.drawOrder=[slot];
 for(const s of raw.skins)for(const e of s.attachments){e.slot=slot;e.name=name;}
 for(const a of Object.values(raw.animations))for(const d of a.deform){d.slot=slot;d.attachment=name;}
 withRig(raw,({make})=>{const i=make();const pose=i.setTime('clip',.5);assert.equal(pose.slots[0].name,slot);assert.ok(capture(i)[0].positions.every(Number.isFinite));});
});

test('render-time capability guard refuses WebGPU and Canvas instead of claiming qualification',()=>withRig('weighted',({make})=>{
 const i=make(),before=capture(i);
 for(const type of [RendererType.WEBGPU,RendererType.CANVAS])assert.throws(()=>i.root.onRender?.({type}),/WebGL/);
 assert.deepEqual(capture(i),before);assert.doesNotThrow(()=>i.root.onRender({type:RendererType.WEBGL}));
}));
