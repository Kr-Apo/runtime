import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {Texture,TextureSource} from 'pixi.js';
import {RigPlayer} from '@ankhimate/runtime';
import {PixiRigAsset,PixiRigInstance} from '../dist/index.js';
const data=(n,file='skeleton.json')=>JSON.parse(readFileSync(new URL(`./fixtures/appearance/${n}/${file}`,import.meta.url),'utf8'));
function using(name,fn){const raw=typeof name==='string'?data(name):name,before=JSON.stringify(raw),pages=new Map(raw.atlas.pages.map(p=>[p.index,new Texture({source:new TextureSource({width:p.width,height:p.height,alphaMode:'premultiplied-alpha'})})]));let asset;const instances=[];
 try{asset=PixiRigAsset.from(raw,pages);fn({raw,pages,asset,make:skin=>{const i=asset.createInstance(skin?{skin}:{});instances.push(i);return i;}});assert.equal(JSON.stringify(raw),before);}
 finally{instances.forEach(i=>i.destroy());asset?.destroy();pages.forEach(p=>p.destroy(true));}}
const capture=i=>i.root.children.map(m=>({label:m.label,visible:m.visible,p:[...m.geometry.positions],uv:[...m.geometry.uvs],ix:[...m.geometry.indices],texture:m.texture.uid,alpha:m.alpha,tint:m.tint}));
test('b.4.1 explicit dynamic skin API exists',()=>assert.equal(typeof PixiRigInstance.prototype.setSkin,'function'));
for(const n of ['skins','ffd_alt','tint_grid','tint_mesh','blend_normal'])test(`native ${n}: all compatible skins and Rust poses`,()=>using(n,({make})=>{
 const i=make(),ref=data(n,'reference.json');let components=0,worst=0;
 for(const s of ref.samples){i.setSkin(s.skin);const p=i.setTime(s.animation,s.time);
  for(const b of s.pose.bones)for(const [k,v]of Object.entries(b.world))assert.ok(Math.abs(p.bones.find(a=>a.name===b.name).world[k]-v)<=.01);
  for(const slot of s.pose.slots){const m=i.root.children.find(m=>m.label===slot.name);assert.ok(m?.visible); // trim vertices are checked independently by the browser
   if(n!=='tint_mesh'){assert.equal(m.geometry.positions.length,slot.positions.length);m.geometry.positions.forEach((v,j)=>{const d=Math.abs(v-(j%2?-slot.positions[j]:slot.positions[j]));worst=Math.max(worst,d);components++;assert.ok(d<=.01);});}
  }
 }console.log(`${n}: ${components} position components, maximum Rust error ${worst}`);
}));
test('default fallback, hidden attachment and region/mesh/topology transitions reuse Mesh and release old buffers',()=>using('skins',({make})=>{
 const i=make(),m=i.root.children.find(m=>m.label==='front'),back=i.root.children.find(m=>m.label==='back'),texture=back.texture;
 for(const skin of ['alternate','triangle','quad','default','alternate']){const old=m.geometry,buffers=[...old.buffers];i.setSkin(skin);assert.equal(i.root.children.find(m=>m.label==='front'),m);assert.equal(back.texture,texture);if(m.geometry!==old)assert.ok(buffers.every(b=>b.destroyed));}
 i.setTime('clip',.5);assert.equal(m.texture,back.texture);i.setTime('clip',.75);assert.equal(m.visible,false);i.setSkin('default');assert.equal(m.visible,false);i.setTime('clip',0);assert.equal(m.visible,true);
}));
test('skin change preserves time, speed, pause, active crossfade and pending events exactly',()=>using('ffd_alt',({raw,make})=>{
 const i=make(),p=i.playback,ref=new RigPlayer(raw),events=[];p.onEvent(e=>events.push(e.name));p.speed=1.25;p.play('clip');ref.play('clip');p.update(.2);ref.update(.25);p.crossFade('relax',1);ref.crossFade('relax',1);p.update(.2);ref.update(.25);
 const pending=p.events,time=p.time;p.setSkin('alternate');ref.setSkin('alternate');assert.equal(p.events,pending);assert.equal(p.time,time);assert.equal(p.speed,1.25);assert.equal(p.playing,true);
 for(const skin of ['default','alternate','default']){i.setSkin(skin);ref.setSkin(skin);assert.deepEqual(p.update(.1),ref.update(.125));assert.deepEqual(p.events,ref.events);}
 p.pause();i.setSkin('alternate');assert.equal(p.playing,false);assert.equal(p.time,ref.time);assert.equal(p.animation,'relax');
 assert.deepEqual(events,['quarter','relaxed']);
}));
test('invalid skin and incompatible FFD refuse before any visible or transport mutation',()=>using('ffd_alt',({make})=>{
 const i=make(),p=i.playback;p.play('clip');p.update(.25);p.crossFade('relax',1);p.update(.25);const before=capture(i),time=p.time,events=p.events;
 for(const skin of ['absent','incompatible']){assert.throws(()=>i.setSkin(skin),/skin|deform/);assert.deepEqual(capture(i),before);assert.equal(p.time,time);assert.equal(p.events,events);assert.equal(p.playing,true);}
 i.setSkin('alternate');assert.equal(i.skinName,'alternate');
}));
test('two instances share pages, not appearance, geometry, playback, uniforms or callbacks',()=>using('tint_mesh',({make})=>{
 const a=make(),b=make('alternate');a.playback.play('clip');b.playback.play('relax');a.playback.update(.25);b.playback.update(.5);const before=capture(b),view=b.root.children.find(m=>m.label==='front');
 for(let n=0;n<50;n++){a.setSkin(n%2?'default':'alternate');a.playback.update(.01);}assert.deepEqual(capture(b),before);assert.notEqual(a.root.children.find(m=>m.label==='front'),view);a.destroy();assert.equal(view.destroyed,false);b.playback.update(.1);
}));
for(const mode of ['additive','multiply','screen'])test(`native ${mode} stays explicitly refused until CPU/Phaser parity exists`,()=>assert.throws(()=>using(`blend_${mode}`,()=>assert.fail('unqualified blend accepted')),/blend.*unsupported|Normal only/));
test('invalid dark components are rejected, without mutating native data',()=>{for(const dark of [[NaN,0,0,1],[1,0,0,Infinity],[1.1,0,0,1],[0,0,0,-1],[0,0,0]]){const r=data('tint_grid');r.slots[0].dark_color=dark;assert.throws(()=>using(r,()=>assert.fail('invalid dark accepted')),/dark|finite/);}});


test('destroyed target-only atlas page refuses skin change before pose or fade mutation',()=>using('skins',({raw,pages,make})=>{
 const i=make(),p=i.playback;p.play('relax');p.update(.25);p.crossFade('clip',1);p.update(.1);const before=capture(i),events=p.events,time=p.time;
 pages.get(raw.atlas.regions.find(r=>r.name==='edge').page).destroy(true);
 assert.throws(()=>i.setSkin('triangle'),/atlas texture.*destroyed/);assert.deepEqual(capture(i),before);assert.equal(p.events,events);assert.equal(p.time,time);assert.equal(i.skinName,'default');assert.equal(p.playing,true);
}));

test('skin change from an event callback does not replay, drop or duplicate its event batch',()=>using('ffd_alt',({make})=>{
 const i=make(),p=i.playback,seen=[];p.onEvent(e=>{seen.push(e.name);i.setSkin(i.skinName==='default'?'alternate':'default');});p.play('clip');p.update(.8);assert.deepEqual(seen,['quarter','three-quarter']);assert.deepEqual(p.events.map(e=>e.name),seen);assert.ok(Math.abs(p.time-.8)<1e-12);p.update(.4);assert.deepEqual(seen,['quarter','three-quarter']);p.update(.1);assert.deepEqual(seen,['quarter','three-quarter','quarter']);
}));

test('invalid initial FFD appearance leaves no registered instance behind',()=>using('ffd_alt',({asset})=>{
 assert.throws(()=>asset.createInstance({skin:'incompatible'}),/deform/);asset.destroy();
}));
