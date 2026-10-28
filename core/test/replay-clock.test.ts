import assert from "node:assert/strict";
import test from "node:test";
import { ReplayClock, ClockError, MAX_CLOCK_INTEGER, SimulationProfile } from "../src/index.js";
import type { TickConsumer } from "../src/index.js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

test("T840B2 hitch is bounded and unchanged rational time is observational", () => {
  const clock = new ReplayClock();
  clock.reset(1n);
  const ticks: bigint[] = [];
  const progress = clock.requestTime(1n, 1n, 2n, tick => {
    ticks.push(tick.index);
    return { kind: "complete" };
  });
  assert.deepEqual(ticks, [1n,2n,3n,4n,5n,6n,7n,8n]);
  assert.equal(progress.state.backlog, 52n);
  const before = clock.snapshot();
  const observed = clock.requestTime(1n, 2n, 4n, () => { throw Error("observation called consumer"); });
  assert.equal(observed.processed, 0);
  assert.deepEqual(clock.snapshot(), before);
});

test("T840B2 shared exact vectors", () => {
  interface Op { op: string; epoch: string; tick?: string; numerator?: string; denominator?: string; budget?: number; cancelAt?: string; failAt?: string; expected: unknown }
  const input = JSON.parse(readFileSync(resolve("test/fixtures/t840b2/clock-vectors.json"), "utf8")) as {cases: {name:string; operations:Op[]}[]};
  const results = input.cases.map(c => {
    const clock = new ReplayClock();
    const entireOrder: string[] = [];
    const rows = c.operations.map(op => {
      const attempts: string[] = [], order: string[] = [];
      const epoch = BigInt(op.epoch);
      const consume: TickConsumer = tick => {
        assert.equal(tick.epoch, epoch);
        const index = String(tick.index); attempts.push(index);
        if (index === op.cancelAt) return {kind:"cancelled"};
        if (index === op.failAt) return {kind:"failed",error:"consumer"};
        order.push(index); return {kind:"complete"};
      };
      const before = clock.snapshot();
      let processed=0, attempted=0, stop="reset", error: string|null=null;
      try {
        if (op.op === "reset") clock.reset(epoch);
        else {
          const p = op.op === "tick" ? clock.requestTick(epoch, BigInt(op.tick!), consume)
            : op.op === "time" ? clock.requestTime(epoch, BigInt(op.numerator!), BigInt(op.denominator!), consume)
            : clock.pump(epoch, op.budget!, consume);
          processed=p.processed; attempted=p.attempted; stop=p.stop.kind;
          if (p.stop.kind === "failed") assert.equal(p.stop.error,"consumer");
        }
      } catch (e) {
        assert.ok(e instanceof ClockError); error=e.code; stop="error";
        assert.deepEqual(clock.snapshot(),before,"invalid input mutated state");
      }
      // Explicit test-only BigInt transport, never part of the runtime formats.
      const row = JSON.parse(JSON.stringify({state:clock.snapshot(),processed,attempted,stop,error,order,attempts},(_,v:unknown)=>typeof v==="bigint" ? String(v):v)) as unknown;
      assert.deepEqual(row,op.expected,`${c.name} ${op.op}`);
      entireOrder.push(...order); return row;
    });
    if (c.name.startsWith("cadence-")) assert.deepEqual(entireOrder,Array.from({length:120},(_,i)=>String(i+1)));
    return {name:c.name,results:rows};
  });
  if (process.env.T840B2_CLOCK_RESULTS) writeFileSync(process.env.T840B2_CLOCK_RESULTS,JSON.stringify(results,null,2),{flag:"wx"});
});

const complete: TickConsumer = () => ({kind:"complete"});
test("T840B2 explicit initialization and profile boundary", () => {
  const c = new ReplayClock(); assert.equal(c.profile,SimulationProfile.ReplayV1);
  assert.equal(SimulationProfile.LegacyT839,"LegacyT839");
  const before=c.snapshot();
  assert.throws(()=>c.requestTick(1n,0n,complete),{code:"uninitialized"});
  assert.deepEqual(c.snapshot(),before);
  c.reset(1n); const zero=c.snapshot();
  for(let i=0;i<5;i++) c.requestTime(1n,0n,7n,()=>{throw Error("unexpected tick")});
  assert.deepEqual(c.snapshot(),zero);
});
test("T840B2 nonrepresentable JS inputs are refused before mutation", () => {
  const c = new ReplayClock(); c.reset(1n); c.requestTick(1n,60n,complete); const before=c.snapshot();
  for(const n of [-1n,NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER+1,"120",MAX_CLOCK_INTEGER+1n]) {
    assert.throws(()=>c.requestTick(1n,n as bigint,complete),ClockError);
    assert.deepEqual(c.snapshot(),before);
  }
  for(const n of [-1,NaN,Infinity,0.5,65537,0]) {
    assert.throws(()=>c.pump(1n,n,complete),{code:"invalid_budget"});assert.deepEqual(c.snapshot(),before);
  }
});
test("T840B2 interleaved independent clocks on shared schedule", () => {
  const a=new ReplayClock(),b=new ReplayClock();a.reset(1n);b.reset(1n);
  for(const n of [1n,2n,3n]) {a.requestTime(1n,n,2n,complete);b.requestTime(1n,n,2n,complete);assert.deepEqual(a.snapshot(),b.snapshot());}
  const before=b.snapshot();a.reset(2n);assert.deepEqual(b.snapshot(),before);
  b.pump(1n,65536,complete);assert.equal(b.snapshot().completed,180n);assert.equal(a.snapshot().completed,0n);
});
test("T840B2 callbacks observe an uncommitted tick and cannot reenter mutation", () => {
  const c=new ReplayClock();c.reset(1n);
  c.requestTick(1n,3n,tick=>{
    const before=c.snapshot();assert.equal(before.completed,tick.index-1n);
    assert.throws(()=>c.reset(2n),{code:"busy"});
    assert.throws(()=>c.requestTick(1n,10n,complete),{code:"busy"});
    assert.throws(()=>c.pump(1n,1,complete),{code:"busy"});
    assert.deepEqual(c.snapshot(),before);return {kind:"complete"};
  });assert.equal(c.snapshot().completed,3n);
});
test("T840B2 thrown consumer and async/malformed response do not commit", () => {
  const c=new ReplayClock();c.reset(1n);
  const p=c.requestTick(1n,10n,t=>{if(t.index===2n)throw Error("consumer");return {kind:"complete"}});
  assert.equal(p.stop.kind,"failed");assert.equal(p.state.completed,1n);assert.equal(p.attempted,2);
  const bad=c.pump(1n,1,(()=>Promise.resolve({kind:"complete"})) as unknown as TickConsumer);
  assert.equal(bad.stop.kind,"failed");assert.equal(c.snapshot().completed,1n);
  assert.equal(c.pump(1n,9,complete).state.completed,10n);
});
