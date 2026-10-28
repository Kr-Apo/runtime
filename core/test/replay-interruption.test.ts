import test from 'node:test';
import assert from 'node:assert/strict';
import {ReplayMixPlan} from '../src/replay-mixing.js';
import {readFileSync} from 'node:fs';
const native = () => JSON.parse(readFileSync('../experimental/crossfade/fixtures/skeleton.json', 'utf8'));
const make = (interruptible = true) => new ReplayMixPlan(native(), 'Idle', interruptible);
const request = {to:'Hit', durationTicks:12n, incomingTick:0n};
const active = () => {const p=make();p.request(60n,{to:'Attack',durationTicks:48n});return p;};
test('A13 explicit accepted-local interruption API exists', () => {
  assert.equal(typeof (ReplayMixPlan.prototype as any).requestInterrupt, 'function');
});
test('A13 standalone plan requires a real boolean capability, not a truthy value',()=>{
 for(const value of [1,0,'true',null])assert.throws(()=>new ReplayMixPlan(native(),'Idle',value as any),/boolean/);
});
test('A13 capture preserves exact accepted locals at first weight zero, then stays frozen', () => {
  const p=active(), source=p.sample(73n), before=structuredClone(source);
  const c=p.requestInterrupt(73n,request,source);
  assert.deepEqual(p.sample(73n),before);
  assert.deepEqual(p.sample(74n).locals,before.locals);
  assert.equal(p.sample(74n).mixing.transition!.weight,0);
  assert.equal(p.sample(75n).mixing.transition!.weight,Math.fround(1/12));
  assert.deepEqual(p.commands()[1]!.frozen!.locals,before.locals);
  assert.equal(p.sample(86n).mixing.activeClip,'Hit');
  assert.equal(p.sample(86n).mixing.transition!.weight,1);
  assert.equal(c.frozen!.origin.tick,73n);
  (source.locals[0] as any).x=999;(c.frozen!.locals[0] as any).x=999;
  assert.deepEqual(p.sample(74n).locals,before.locals);
});
test('A13 repeated interruption uses a flat frozen pose, not a recursive blend tree',()=>{
  const p=active();p.requestInterrupt(73n,request,p.sample(73n));
  const last=p.sample(78n);p.requestInterrupt(78n,{to:'Attack',durationTicks:24n},last);
  assert.deepEqual(p.sample(79n).locals,last.locals);
  assert.equal(p.sample(79n).mixing.transition!.source!.command,3);
  assert.equal(p.sample(103n).mixing.activeClip,'Attack');
  const restored=make();restored.restore(p.commands());
  for(let t=0n;t<=150n;t++)assert.deepEqual(restored.sample(t),p.sample(t));
  assert.equal(p.commands().filter(c=>c.frozen).length,2);
});
test('A13 replay origin verifies actual accepted input, rejects a corrupted capture',()=>{
  const p=active(),at=p.sample(73n);p.requestInterrupt(73n,request,at);
  p.verifyOrigin(at);const bad=structuredClone(at);(bad.locals[0] as any).x+=1;
  assert.throws(()=>p.verifyOrigin(bad),/origin mismatch/);
  const commands=p.commands();(commands[1]!.frozen!.locals[0] as any).x+=1;
  const restored=make();assert.throws(()=>restored.restore(commands),/source differs/);
  assert.equal(restored.commandCount,0);
});
test('A13 mode absent continues to refuse interruptions',()=>{
  const p=make(false);p.request(0n,{to:'Attack',durationTicks:24n});
  assert.throws(()=>p.requestInterrupt(10n,request,p.sample(10n)),/capability/);
  assert.throws(()=>p.request(10n,request),/active/);
});
for(const [name,edit] of Object.entries({
  nonfinite:(s:any):any=>s.locals[0].x=NaN,
  finiteForeign:(s:any):any=>s.locals[0].x+=1,
  missing:(s:any):any=>s.locals.pop(),
  singular:(s:any):any=>s.locals[0].scaleX=0,
  metadata:(s:any):any=>s.mixing.tick=72n,
}))test('A13 invalid frozen '+name+' preserves all journal and pose state',()=>{
  const p=active(),before=p.commands(),pose=p.sample(73n),bad=structuredClone(pose);edit(bad);
  assert.throws(()=>p.requestInterrupt(73n,request,bad));assert.deepEqual(p.commands(),before);assert.deepEqual(p.sample(73n),pose);
});
for(const req of [{to:'absent',durationTicks:12n},{to:'Hit',durationTicks:0n},{to:'Hit',durationTicks:12},{to:'Hit',durationTicks:7201n},{to:'Hit',durationTicks:12n,incomingTick:-1n},{to:'Hit',durationTicks:12n,incomingTick:8388607n}])test('A13 invalid interruption request '+String(req.durationTicks)+'/'+req.to,()=>{
 const p=active(),before=p.commands();assert.throws(()=>p.requestInterrupt(73n,req as any,p.sample(73n)));assert.deepEqual(p.commands(),before);
});
test('A13 pending and chronology refusals are atomic',()=>{
 const p=active();p.requestInterrupt(73n,request,p.sample(73n));const before=p.commands();
 assert.throws(()=>p.requestInterrupt(73n,request,p.sample(73n)),/pending/);
 assert.throws(()=>p.requestInterrupt(72n,request,p.sample(72n)));
 assert.deepEqual(p.commands(),before);
});
test('A13 frozen captures share the 64 command budget without eviction',()=>{
 const p=make();p.request(0n,{to:'Attack',durationTicks:120n});
 for(let i=1;i<64;i++){const t=BigInt(i);p.requestInterrupt(t,{to:i%2?'Hit':'Attack',durationTicks:120n},p.sample(t));}
 const before=p.commands();assert.equal(before.length,64);
 assert.throws(()=>p.requestInterrupt(64n,request,p.sample(64n)),/capacity/);assert.deepEqual(p.commands(),before);
 const restored=make();restored.restore(before);assert.deepEqual(restored.sample(80n),p.sample(80n));
});
