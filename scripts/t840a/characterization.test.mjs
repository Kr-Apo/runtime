import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createEvaluationState,evaluate,parseRig,RigPlayer} from '../../core/dist/index.js';
import {RigPlayback} from '../../core/dist/render/playback.js';
import {ClockModel,dueFromNanoseconds} from './clock-model.mjs';
const fixture=()=>parseRig(readFileSync(new URL('../../core/test/fixtures/t839/single.native.json',import.meta.url),'utf8'));
const driven=p=>p.bones.find(b=>b.name==='tassel');

test('T840A current TS zero dt consumes hitch backlog (known contract divergence)',()=>{
  const rig=fixture(),state=createEvaluationState();evaluate(rig,[],{state,deltaSeconds:.5});
  const before=structuredClone(state);evaluate(rig,[],{state,deltaSeconds:0});
  assert.notDeepEqual(state,before);assert.ok([...before.physics.values()][0].remainder>0);
});
test('T840A current mix zero freezes state and resumes stale anchors',()=>{
  const rig=fixture(),state=createEvaluationState();evaluate(rig,[],{state,deltaSeconds:1/60});
  const before=structuredClone(state);rig.constraints[0].mix=0;
  evaluate(rig,[{animation:'move',time:1,alpha:1}],{state,deltaSeconds:.5});assert.deepEqual(state,before);
  rig.constraints[0].mix=1;evaluate(rig,[{animation:'move',time:1,alpha:1}],{state,deltaSeconds:1/60});assert.notDeepEqual(state,before);
});
test('T840A actual player seek retains state, play clears, crossfade preserves',()=>{
  const rig=fixture();rig.animations.other=structuredClone(rig.animations.move);
  const p=new RigPlayer(rig).play('move');p.update(.2);const r=driven(p.pose()).rotation;
  assert.notEqual(r,0);p.seek(0);assert.equal(driven(p.pose()).rotation,r);
  p.crossFade('other',.5);assert.equal(driven(p.pose()).rotation,r);
  p.play('move');assert.equal(driven(p.pose()).rotation,0);
});
test('T840A actual playback pause/resume/stop/destroy needs no renderer or GUI',()=>{
  const p=new RigPlayback(fixture(),'default',()=>{});p.play('move');const before=p.update(.1);
  p.pause();assert.deepEqual(p.update(.5),before);p.resume();assert.notDeepEqual(p.update(.1),before);
  p.stop();assert.equal(p.playing,false);assert.equal(driven(p.update(.2)).rotation,0);
  p.destroy();assert.throws(()=>p.update(.1),/destroyed/);
});
test('T840A instances sharing one immutable rig remain independent and reset repeatably',()=>{
  const rig=fixture(),original=structuredClone(rig),a=new RigPlayer(rig).play('move'),b=new RigPlayer(rig).play('move'),alone=new RigPlayer(rig).play('move');
  for(let i=0;i<144;i++){a.update(.5);assert.deepEqual(b.update(1/144),alone.update(1/144));}
  const runs=[];for(let j=0;j<3;j++){b.play('move');runs.push(Array.from({length:60},()=>b.update(1/60)));}
  assert.deepEqual(runs[0],runs[1]);assert.deepEqual(runs[1],runs[2]);assert.deepEqual(rig,original);
});
test('T840A nonfinite input and missing bone evidence stays explicit, other instance intact',()=>{
  const rig=fixture(),good=new RigPlayer(rig).play('move');good.update(.1);const before=good.pose();
  assert.throws(()=>good.update(NaN),RangeError);assert.deepEqual(good.pose(),before);
  const missing=fixture();missing.bones=missing.bones.slice(0,1);assert.throws(()=>parseRig(missing),/physics.*bone/);
  // Deliberate in-memory fault injection, never a patched export/oracle.
  const bad=fixture();bad.constraints[0].forces.wind_x=Infinity;
  const pose=evaluate(bad,[],{state:createEvaluationState(),deltaSeconds:1/60});
  assert.ok(!Number.isFinite(driven(pose).x),'current direct TS core lacks the Rust recovery guard');
  assert.deepEqual(good.pose(),before);
});
test('T840A current independent per-bone TS clocks do not couple force-only simulations',()=>{
  const rig=fixture(),a=structuredClone(rig.constraints[0]),b=structuredClone(a);
  b.name='second';b.target='tip';rig.constraints=[a,b];rig.constraintOrder=['sway','second'];
  // Compare local simulation records, excluding the legitimate parent FK effect.
  const state=createEvaluationState();for(let i=0;i<144;i++)evaluate(rig,[],{state,deltaSeconds:1/144});
  const alone=fixture(),single=createEvaluationState();for(let i=0;i<144;i++)evaluate(alone,[],{state:single,deltaSeconds:1/144});
  assert.deepEqual(state.physics.get('sway\0tassel'),single.physics.get('sway\0tassel'));
});
test('T840A proposed clock model schedules 120 ticks at 30/60/120/144Hz',()=>{
  for(const hz of[30,60,120,144]){const c=new ClockModel(),ticks=[];for(let i=1;i<=hz;i++)c.request(i,hz,n=>ticks.push(n));assert.equal(c.tick,120);assert.deepEqual(ticks,Array.from({length:120},(_,i)=>i+1));}
});
test('T840A proposed hitch cap retains backlog; zero dt freezes; explicit offline drain catches up',()=>{
  const c=new ClockModel(),ticks=[];assert.equal(c.request(1,2,n=>ticks.push(n)),8);assert.equal(c.target-c.tick,52);
  assert.equal(c.request(1,2,n=>ticks.push(n)),0);assert.equal(c.tick,8);
  while(c.tick<c.target)c.pump(n=>ticks.push(n));assert.equal(c.tick,60);assert.equal(ticks.length,60);
});
test('T840A proposed clock rejects invalid/backward targets before changing its counters',()=>{
  const c=new ClockModel();c.request(1,2,()=>{});const before=structuredClone(c);
  for(const [a,b]of[[NaN,1],[-1,1],[1,0],[1,3]])assert.throws(()=>c.request(a,b,()=>{}),RangeError);
  assert.deepEqual({...c},before);
});
test('T840A proposed canonical nanosecond boundary matches rational rate schedules',()=>{
  for(const hz of[30,60,120,144])for(let i=0;i<=hz;i++){
    const ns=BigInt(Math.round(i*1e9/hz));
    assert.equal(dueFromNanoseconds(ns),BigInt(Math.floor(i*120/hz)));
  }
  assert.equal(dueFromNanoseconds(8_333_332n),0n);
  assert.equal(dueFromNanoseconds(8_333_333n),1n);
  assert.throws(()=>dueFromNanoseconds(-1n),RangeError);
});
