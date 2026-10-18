import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Texture,TextureSource } from 'pixi.js';
import { PixiRigAsset } from '../dist/index.js';
import { evaluate, RigPlayer } from '@ankhimate/runtime';

const native = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}/skeleton.json`,import.meta.url),'utf8'));
// Synthetic API-only variations are separate from the byte-identical native fixtures.
const apiRig = () => {
  const r=native('tagged'), clip=Object.values(r.animations)[0];
  r.animations={a:structuredClone(clip),b:structuredClone(clip),zero:structuredClone(clip)};
  r.animations.a.events=[{time:0,name:'start'},{time:.25,name:'quarter'},{time:1,name:'end'}];
  r.animations.b.events=[{time:.25,name:'incoming'}];
  r.animations.zero.duration=0;r.animations.zero.events=[{time:0,name:'never'}];
  r.animations.b.bones=[{name:r.bones[0].name,translate_x:[{time:0,value:20,curve:'linear'},{time:1,value:60,curve:'linear'}]}];
  return r;
};
const withRig=(run,raw=apiRig())=>{
  const pages=new Map(raw.atlas.pages.map(p=>[p.index,new Texture({source:new TextureSource({width:p.width,height:p.height,alphaMode:'premultiplied-alpha'})})]));
  const asset=PixiRigAsset.from(raw,pages),instances=[];
  try {run({asset,pages,raw,make:()=>{const i=asset.createInstance();instances.push(i);return i;}});}
  finally {for(const i of instances)i.destroy();asset.destroy();for(const p of pages.values())p.destroy(true);}
};
const display=i=>i.root.children.map(m=>({name:m.label,visible:m.visible,positions:[...m.geometry.positions],uvs:[...m.geometry.uvs],alpha:m.alpha,tint:m.tint}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} vs ${b}`);

test('b.2 instance exposes its playback controller while keeping b.1 direct-pose methods',()=>{
  const raw=JSON.parse(readFileSync(new URL('./fixtures/tagged/skeleton.json',import.meta.url),'utf8'));
  const pages=new Map(raw.atlas.pages.map(p=>[p.index,new Texture({source:new TextureSource({width:p.width,height:p.height,alphaMode:'premultiplied-alpha'})})]));
  const asset=PixiRigAsset.from(raw,pages),instance=asset.createInstance();
  try {
    assert.equal(typeof instance.setPose,'function');
    assert.equal(typeof instance.setTime,'function');
    assert.ok(instance.playback,'missing per-instance playback API');
    for(const method of ['play','pause','resume','stop','crossFade','update','destroy'])assert.equal(typeof instance.playback[method],'function',method);
  }finally{instance.destroy();asset.destroy();for(const p of pages.values())p.destroy(true);}
});

test('play, pause, resume, speed and stop reuse the core pose and render setup on stop',()=>withRig(({raw,make})=>{
  const i=make(),p=i.playback,setup=display(i);assert.equal(p.playing,false);
  p.play('a');assert.equal(p.animation,'a');assert.equal(p.time,0);
  const actual=p.update(.25);assert.deepEqual(actual,evaluate(raw,[{animation:'a',time:.25,alpha:1}],{skin:raw.defaultSkin}));
  const paused=display(i);p.pause();p.update(100);near(p.time,.25);assert.deepEqual(display(i),paused);assert.deepEqual(p.events,[]);
  p.resume();p.speed=2;p.update(.125);near(p.time,.5);
  p.stop();assert.equal(p.animation,undefined);assert.equal(p.time,0);assert.equal(p.playing,false);assert.deepEqual(display(i),setup);
  p.resume();assert.equal(p.playing,false);
}));

test('per-instance loop override clamps or wraps and never changes the default or source',()=>withRig(({raw,make})=>{
  const before=JSON.stringify(raw),a=make().playback,b=make().playback;
  a.play('a',{loop:false});b.play('a');a.update(1.25);b.update(1.25);
  assert.equal(a.time,1);assert.equal(b.time,.25);a.update(2);assert.equal(a.time,1);
  a.play('a');a.update(1.25);assert.equal(a.time,.25);assert.equal(JSON.stringify(raw),before);
}));

test('invalid inputs preserve time, meshes, events and active transition atomically',()=>withRig(({make})=>{
  const i=make(),p=i.playback;p.play('a').update(.25);p.crossFade('b',1);p.update(.125);
  const state=()=>JSON.stringify({time:p.time,name:p.animation,playing:p.playing,speed:p.speed,events:p.events,meshes:display(i)});
  const before=state();
  for(const action of [()=>p.play('absent'),()=>p.play('__proto__'),()=>p.play('a',{loop:1}),()=>p.play('a',null),()=>p.crossFade('a',NaN),()=>p.crossFade('a',-1),()=>p.crossFade('a',Infinity),()=>p.update(-1),()=>p.update(Infinity),()=>p.update(NaN),()=>{p.speed=0;},()=>{p.speed=-1;},()=>{p.speed=NaN;},()=>p.onEvent(null),()=>i.setTime('absent',0),()=>i.setTime('a',NaN),()=>i.setPose({})]) {
    assert.throws(action);assert.equal(state(),before);
  }
  p.speed=Number.MAX_VALUE;const snapshot=state();assert.throws(()=>p.update(2),/finite/);assert.equal(state(),snapshot);
}));

test('duration zero holds time zero, emits nothing, and zero delta never replays events',()=>withRig(({make})=>{
  const p=make().playback;let calls=0;p.onEvent(()=>calls++);
  p.play('zero');p.update(200);assert.equal(p.time,0);assert.deepEqual(p.events,[]);
  p.play('a');p.update(.25);assert.equal(calls,1);p.update(0);assert.equal(calls,1);assert.deepEqual(p.events,[]);
}));

test('events follow approved Rust intervals at zero, exact end, loops and large delta',()=>withRig(({make})=>{
  const trace=steps=>{const p=make().playback,names=[];p.onEvent(e=>names.push(e.name));p.play('a');for(const d of steps)p.update(d);return names;};
  assert.deepEqual(trace([1.25]),['quarter','end','quarter']);
  assert.deepEqual(trace([1,0,.25]),trace([1.25]));
  assert.deepEqual(trace([3.25]),['quarter','end','quarter','end','quarter','end','quarter']);
  assert.deepEqual(trace([0]),[]);
}));

test('crossfade poses and incoming-only events match core, including interruption and zero duration',()=>withRig(({raw,make})=>{
  const i=make(),p=i.playback,core=new RigPlayer(raw).setSkin(raw.defaultSkin);
  p.play('a');core.play('a');p.update(.25);core.update(.25);
  p.crossFade('b',1);core.crossFade('b',1);
  for(const dt of [0,.25,.25,.5]){assert.deepEqual(p.update(dt),core.update(dt));assert.deepEqual(p.events,core.events);}
  p.crossFade('a',1);core.crossFade('a',1);assert.deepEqual(p.update(.1),core.update(.1));
  p.crossFade('b',.5);core.crossFade('b',.5);assert.deepEqual(p.update(.25),core.update(.25));
  p.crossFade('a',0);core.crossFade('a',0);assert.deepEqual(p.update(.25),core.update(.25));
  assert.deepEqual(p.events.map(e=>e.name),['quarter']);
}));

test('same-name crossfade keeps the core no-restart policy and nonloop fades finish past clip end',()=>withRig(({raw,make})=>{
  const p=make().playback,c=new RigPlayer(raw).setSkin(raw.defaultSkin);
  p.play('a');c.play('a');p.update(.25);c.update(.25);p.crossFade('a',0);c.crossFade('a',0);near(p.time,.25);
  p.crossFade('b',2,{loop:false});const isolated=structuredClone(raw);isolated.animations.b.looping=false;
  const expected=new RigPlayer(isolated).setSkin(raw.defaultSkin).play('a');expected.update(.25);expected.crossFade('b',2);
  for(const dt of [1,1])assert.deepEqual(p.update(dt),expected.update(dt));assert.equal(p.time,1);
}));

test('two transports share only textures, retain buffers, and are deterministic for 600 updates',()=>withRig(({raw,pages,make})=>{
  const a=make(),b=make(),c=make(),before=JSON.stringify(raw),meshes=[...a.root.children],buffers=meshes.flatMap(m=>m.geometry.buffers);
  a.playback.play('a');b.playback.play('b');c.playback.play('a');b.playback.speed=2;
  for(let n=0;n<600;n++){assert.deepEqual(a.playback.update(1/60),c.playback.update(1/60));b.playback.update(1/60);}
  assert.equal(a.root.children.length,meshes.length);meshes.forEach((m,n)=>assert.equal(a.root.children[n],m));assert.ok(buffers.every(b=>!b.destroyed));
  assert.notEqual(a.root.children[0].geometry,b.root.children[0].geometry);assert.equal(a.root.children[0].texture,b.root.children[0].texture);
  const state=display(b);a.playback.stop();a.destroy();assert.deepEqual(display(b),state);b.playback.update(.1);
  assert.ok([...pages.values()].every(t=>!t.destroyed));assert.equal(JSON.stringify(raw),before);
  delete raw.animations.a; // External source edits cannot delete the asset's snapshotted clip.
  b.playback.speed=1;b.playback.play('a');b.playback.update(.25);assert.equal(b.playback.time,.25);
}));

test('successful direct seek/pose detaches playback; invalid ones leave transport intact',()=>withRig(({raw,make})=>{
  const i=make(),p=i.playback;p.play('a');p.update(.25);
  const pose=i.setTime('b',.75),before=display(i);assert.equal(p.playing,false);assert.equal(p.animation,undefined);
  p.resume();assert.deepEqual(p.update(.1),pose);assert.deepEqual(display(i),before);
  p.play('a');i.setPose(evaluate(raw));assert.equal(p.animation,undefined);
  const other=make();const manual=other.setTime('b',.5);assert.deepEqual(other.playback.update(.1),manual);
}));

test('unsubscribe, immutable payloads, reentrant advance and destroy from callback',()=>withRig(({raw,make})=>{
  const i=make(),p=i.playback,events=[],before=JSON.stringify(raw);
  const off=p.onEvent(e=>events.push(e.name));off();p.play('a');p.update(.25);assert.deepEqual(events,[]);
  p.play('a');p.onEvent(e=>{assert.ok(Object.isFrozen(e));assert.throws(()=>p.update(.1),/Recursive/);events.push(e.name);i.destroy();});
  p.onEvent(()=>assert.fail('callback after destroy'));p.update(3.25);assert.deepEqual(events,['quarter']);assert.equal(p.playing,false);
  assert.throws(()=>p.update(0),/destroyed/);p.destroy();i.destroy();assert.equal(JSON.stringify(raw),before);
}));

test('controller destruction alone preserves displayed pose and blocks future callbacks',()=>withRig(({make})=>{
  const i=make(),p=i.playback;let calls=0;p.onEvent(()=>calls++);p.play('a');p.update(.25);const state=display(i);
  p.destroy();assert.equal(calls,1);assert.deepEqual(display(i),state);assert.throws(()=>p.play('a'),/destroyed/);i.setTime('b',.5);
}));

test('event flood is refused before advancing; reasonable multiloop updates remain available',()=>withRig(({make})=>{
  const p=make().playback;p.play('a');assert.throws(()=>p.update(1e20),/too many events/);assert.equal(p.time,0);p.update(10.25);assert.equal(p.events.length,21);
}));

test('event gate validates names, times and payloads; malformed duration is rejected',()=>{
  for(const alter of [a=>a.duration=-1,a=>a.duration=NaN,a=>a.duration=Infinity,a=>a.looping='yes',a=>a.events=[{time:0}],a=>a.events=[{time:2,name:'late'}],a=>a.events=[{time:-1,name:'early'}],a=>a.events=[{time:0,name:'bad',float:Infinity}],a=>a.events=[{time:0,name:'bad',int:.5}],a=>a.events=[{time:0,name:'bad',audio:7}]]){
    const raw=apiRig();alter(raw.animations.a);assert.throws(()=>PixiRigAsset.from(raw,new Map()));
  }
});

test('new untouched native export agrees with independent Rust poses, fades and event windows',()=>{
  const raw=native('playback'),ref=JSON.parse(readFileSync(new URL('./fixtures/playback/reference.json',import.meta.url),'utf8'));
  let max=0,components=0;
  withRig(({make})=>{
    const p=make().playback;
    const check=(pose,reference)=>{for(const b of reference.bones){const actual=pose.bones.find(a=>a.name===b.name).world;for(const [k,v] of Object.entries(b.world)){max=Math.max(max,Math.abs(actual[k]-v));components++;assert.ok(Math.abs(actual[k]-v)<.01,`${k}: ${actual[k]} vs Rust ${v}`);}}};
    for(const s of ref.samples){p.play(s.animation,{loop:false});check(p.update(s.time),s.pose);}
    p.play('rise');p.update(.25);p.crossFade('recover',1);let previous=0;
    for(const s of ref.fades){check(p.update(s.elapsed-previous),s.pose);previous=s.elapsed;}
    for(const window of ref.event_windows){p.play('rise');p.update(window.to);assert.deepEqual(p.events.map(e=>e.name),window.names);}
    p.play('rise');p.update(.5);assert.equal(p.events[0].int,7);assert.equal(p.events[0].float,.25);assert.equal(p.events[0].string,raw.animations.rise.events.find(e=>e.name==='impact').string);
  },raw);
  console.log(`Pixi transport/Rust: ${components} affine components, max absolute error ${max}`);
});

test('incremental b.1 tagged playback preserves its independent Rust bones and region corners',()=>{
  const raw=native('tagged'),ref=JSON.parse(readFileSync(new URL('./fixtures/tagged/cpu-reference.json',import.meta.url),'utf8'));
  withRig(({make})=>{const i=make(),p=i.playback;p.play(ref.animation);let previous=0;
    for(const s of ref.samples){const pose=p.update(s.time-previous);previous=s.time;
      for(const b of s.bones)for(const [k,v] of Object.entries(b.world))assert.ok(Math.abs(pose.bones.find(a=>a.name===b.name).world[k]-v)<.01);
      for(const slot of s.slots){const m=i.root.children.find(m=>m.label===slot.name);m.geometry.positions.forEach((v,n)=>assert.ok(Math.abs(v-(n%2?-slot.positions[n]:slot.positions[n]))<.01));}
    }
  },raw);
});
