import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ReplayConsumerBridge, parseRig, MAX_SAMPLE_TICK } from '../src/index.js';
import { ReplayHostTimeBridge, HostTimeError, MAX_HOST_MILLISECONDS } from '../src/replay-host-time.js';
const source = () => parseRig(readFileSync('../examples/replay-pixi-pilot/assets/skeleton.json', 'utf8'));
function create(now = 0, clip = 'sway') {
  const c = new ReplayConsumerBridge(source(), clip, 1n); c.play(c.context, clip, false);
  return { c, h: new ReplayHostTimeBridge(c, now) };
}
const code = (wanted: string) => (e: unknown) => e instanceof HostTimeError && e.code === wanted;

test('fixed independent Python Fraction vectors: cadences, neighbors and long sessions', () => {
  const {c,h} = create();
  const vectors = JSON.parse(readFileSync('test/fixtures/t840c3/time-vectors.json', 'utf8')) as {name:string;ms:number;tick:string;idealTick?:string}[];
  const before = c.transportStatus(); let differingFromIdeal = 0;
  for (const v of vectors) {
    assert.equal(h.preview(v.ms).targetTick, BigInt(v.tick), v.name);
    if (v.idealTick !== undefined) { const diff = BigInt(v.tick)-BigInt(v.idealTick); assert.ok(diff >= -1n && diff <= 0n, v.name); if(diff) differingFromIdeal++; }
  }
  assert.ok(vectors.length > 5900 && differingFromIdeal > 0);
  assert.deepEqual(c.transportStatus(), before); assert.equal(h.observe().lastHostMilliseconds,0);
  h.dispose();c.dispose(c.context);
});

test('500ms hitch, new targets with debt, same timestamp and sub-tick updates never pump',()=>{
  const {c,h}=create(); const p=h.advance(500);assert.equal(p.progress!.processed,8);
  assert.deepEqual([p.time.targetTick,p.time.transport.clock!.completed,p.time.transport.clock!.backlog],[60n,8n,52n]);
  const old=c.currentFrame();for(let i=0;i<20;i++){assert.equal(h.advance(500).progress,null);h.observe();h.preview(500);}
  assert.deepEqual(c.currentFrame(),old);
  assert.equal(h.advance(500.001).progress!.processed,0);assert.deepEqual(c.currentFrame().bones,old.bones);
  assert.equal(h.advance(1000).progress!.processed,8);assert.equal(c.currentFrame().backlog,104n);
  c.pump(c.context,3);assert.equal(h.observe().transport.clock!.completed,19n);
  c.pump(c.context,128);assert.equal(h.observe().transport.clock!.completed,120n);
});

test('pause preserves completed and backlog; resume and first same observation add no ticks',()=>{
  const {c,h}=create();h.advance(500);const old=c.currentFrame();h.pause(750);
  assert.deepEqual([c.currentFrame().completed,c.currentFrame().backlog],[old.completed,old.backlog]);
  assert.equal(h.observe().targetTick,90n);assert.equal(h.observe().submittedTick,60n);
  assert.throws(()=>h.advance(1000),code('transport_state'));h.resume(100000);
  assert.equal(h.advance(100000).progress,null);assert.equal(c.currentFrame().completed,8n);
  assert.equal(h.advance(100001).progress!.processed,8);assert.equal(h.observe().targetTick,90n);
  assert.equal(h.observe().transport.clock!.requested,90n);
});

test('1000 segments of 0.9 microseconds retain their represented fractions',()=>{
  const {c,h}=create();for(let i=0;i<1000;i++){h.pause(i+.0009);h.resume(i+1);}
  const elapsed=h.observe().elapsedMilliseconds;
  const reference=JSON.parse(readFileSync('test/fixtures/t840c3/segments.json','utf8'));assert.deepEqual(elapsed,{numerator:BigInt(reference.numerator),denominator:BigInt(reference.denominator)});
  assert.ok(Math.abs(Number(elapsed.numerator)/Number(elapsed.denominator)-.9)<1e-8);
  assert.ok(elapsed.numerator>0n);assert.equal(c.currentFrame().completed,0n);
  assert.equal(h.observe().targetTick,0n);assert.equal(h.advance(1000).progress,null);
});

test('1000 pauses, exact fractional boundary and alternating long/small segments',()=>{
  const {c,h}=create();for(let i=0;i<1000;i++){h.pause(2*i+1);h.resume(2*i+2);}
  assert.equal(h.observe().targetTick,120n);assert.equal(h.observe().elapsedMilliseconds.numerator,1000n);
  assert.equal(h.advance(2000).progress,null);assert.equal(h.advance(2000.125).progress!.processed,8);
  const other=create();other.h.pause(.125);other.h.resume(100000);other.h.pause(100024.875);
  assert.equal(other.h.observe().targetTick,3n);assert.deepEqual(other.h.observe().elapsedMilliseconds,{numerator:25n,denominator:1n});
  assert.equal(c.currentFrame().completed,8n);assert.equal(other.c.currentFrame().completed,0n);
});

test('high host origins, lost input precision, minimum subnormal and maximum domain',()=>{
  const {h}=create(1e12);const s=h.preview(1e12+.001);assert.deepEqual(s.elapsedMilliseconds,{numerator:1n,denominator:1024n});
  const tiny=create();assert.ok(tiny.h.preview(Number.MIN_VALUE).elapsedMilliseconds.numerator>0n);
  const max=create(MAX_HOST_MILLISECONDS);assert.equal(max.h.advance(MAX_HOST_MILLISECONDS+.1).progress,null);
  assert.throws(()=>max.h.advance(MAX_HOST_MILLISECONDS+1),code('invalid_time'));
});

test('conversion errors are transactional before any host or physical change',()=>{
  const {c,h}=create();h.advance(1);const before=h.observe(),physical=c.currentFrame();
  for(const value of [NaN,Infinity,-Infinity,-1,Number.MAX_VALUE]){assert.throws(()=>h.advance(value),code('invalid_time'));assert.deepEqual(h.observe(),before);assert.deepEqual(c.currentFrame(),physical);}
  assert.throws(()=>h.advance(.5),code('backward_time'));assert.throws(()=>h.advance(70000000),code('horizon'));
  assert.throws(()=>h.pause(.5),code('backward_time'));assert.deepEqual(h.observe(),before);assert.deepEqual(c.currentFrame(),physical);
  h.pause(2);const paused=h.observe();assert.throws(()=>h.resume(1),code('backward_time'));assert.deepEqual(h.observe(),paused);
});

test('tick horizon accepted, next tick rejected, without simulating the whole session',()=>{
  const {c,h}=create();assert.equal(h.preview(69905058.33333333).targetTick,MAX_SAMPLE_TICK-1n);
  assert.equal(h.preview(69905058.33333334).targetTick,MAX_SAMPLE_TICK);
  assert.throws(()=>h.advance(Number(MAX_SAMPLE_TICK+1n)*1000/120),code('horizon'));
  assert.equal(c.currentFrame().completed,0n);h.advance(3600000);assert.equal(c.currentFrame().requested,432000n);assert.equal(c.currentFrame().completed,8n);
});

test('stop, reset, seek, replay and stale context require explicit host rebind',()=>{
  const {c,h}=create();h.advance(500);const old=c.context;c.stop(c.context);assert.throws(()=>h.advance(501),code('context'));assert.throws(()=>c.play(old,'sway',false));
  assert.throws(()=>h.reset(0),code('transport_state'));c.play(c.context,'sway',false);h.reset(0);assert.equal(h.observe().targetTick,0n);
  c.seekTick(c.context,90n);assert.throws(()=>h.advance(1000),code('context'));assert.throws(()=>h.reset(1000),code('transport_state'));
  c.replayFromOrigin(c.context,90n);assert.throws(()=>h.reset(1000),code('transport_state'));c.pump(c.context,128);c.resume(c.context);h.reset(1000);
  assert.equal(h.observe().originTick,90n);assert.equal(h.advance(1500).time.targetTick,150n);
  c.reset(c.context,c.context.epoch+1n);assert.throws(()=>h.observe(),code('context'));c.play(c.context,'sway',false);h.reset(0);assert.equal(h.observe().originTick,0n);
});

test('external target writes reject, explicit pumping and canonical attachment are allowed',()=>{
  const {c,h}=create();c.requestTime(c.context,1n,1000n);assert.throws(()=>h.advance(10),code('external_request'));assert.throws(()=>h.reset(10),code('external_request'));
  c.requestTick(c.context,60n);h.reset(10);assert.equal(h.observe().originTick,60n);c.pump(c.context,2);assert.equal(h.observe().transport.clock!.completed,10n);
  c.requestTick(c.context,61n);assert.throws(()=>h.advance(11),code('external_request'));
});

test('Physics fault and audit failure retain requested host time and last committed pose',()=>{
  const {c,h}=create(0,'fault_at_9');h.advance(500);const before=c.currentFrame();assert.equal(c.pump(c.context,1).stop.kind,'failed');
  assert.equal(h.observe().transport.state,'faulted');assert.throws(()=>h.advance(501),code('physics_fault'));assert.deepEqual(c.currentFrame().bones,before.bones);
  const audit=create();const p=audit.h.advance(500,()=>{throw Error('audit');});assert.equal(p.progress!.stop.kind,'failed');assert.equal(p.time.submittedTick,60n);assert.equal(p.time.transport.clock!.completed,0n);assert.throws(()=>audit.h.pause(501),code('physics_fault'));
});

test('two consumers from shared source have independent time, pause and state',()=>{
  const a=create(),b=create();a.h.advance(500);a.h.pause(500);b.h.advance(1000);b.c.pump(b.c.context,128);
  assert.equal(a.c.currentFrame().completed,8n);assert.equal(b.c.currentFrame().completed,120n);a.h.resume(10000);a.h.advance(10500);
  assert.equal(a.h.observe().targetTick,120n);assert.equal(b.h.observe().targetTick,120n);a.c.pump(a.c.context,128);assert.deepEqual(a.c.currentFrame().bones,b.c.currentFrame().bones);
});

test('invalid initial binding and disposed adapters cannot mutate consumers',()=>{
  const c=new ReplayConsumerBridge(source(),'sway',1n);const before=c.transportStatus();assert.throws(()=>new ReplayHostTimeBridge(c,0),code('transport_state'));assert.deepEqual(c.transportStatus(),before);
  c.play(c.context,'sway',false);const h=new ReplayHostTimeBridge(c,0);h.dispose();const after=c.currentFrame();
  for(const fn of [()=>h.advance(1),()=>h.pause(1),()=>h.resume(1),()=>h.reset(0),()=>h.preview(1),()=>h.observe()])assert.throws(fn,code('disposed'));
  assert.deepEqual(c.currentFrame(),after);c.dispose(c.context);
});

test('reentrant host writes refuse during the inherited precommit audit',()=>{
  const {c,h}=create();h.advance(25,()=>{assert.throws(()=>h.advance(50),code('busy'));assert.throws(()=>h.pause(50),code('busy'));assert.throws(()=>h.reset(0),code('busy'));assert.throws(()=>h.dispose(),code('busy'));});
  assert.equal(c.currentFrame().completed,3n);assert.equal(h.observe().submittedTick,3n);
});


test('variable cadence and hours without rendering preserve exact integer-ms requests',()=>{
 const {c,h}=create();for(const ms of [1,9,25,500,501,1000,10000,60000,600000,3600000]){const before=c.currentFrame().completed,p=h.advance(ms);assert.equal(p.time.targetTick,BigInt(ms)*120n/1000n);assert.ok(p.progress!.processed<=8);assert.equal(c.currentFrame().completed,before+BigInt(p.progress!.processed));}const before=c.currentFrame();for(let i=0;i<100;i++)h.observe();assert.deepEqual(c.currentFrame(),before);
});
