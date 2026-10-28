import type { ReplayConsumerBridge } from './replay-consumer.js';
import type { TransportContext, TransportSnapshot } from './replay-transport.js';
import type { ClockProgress, RationalTime } from './replay-clock.js';
import type { ReplayObserver } from './replay-physics.js';
import { MAX_SAMPLE_TICK } from './replay-animation.js';

export const MAX_HOST_MILLISECONDS = Number.MAX_SAFE_INTEGER;
export type HostTimeErrorCode = 'invalid_time' | 'backward_time' | 'horizon' | 'context' | 'external_request' | 'transport_state' | 'physics_fault' | 'disposed' | 'busy';
export class HostTimeError extends Error {
  constructor(readonly code: HostTimeErrorCode) { super(`Replay host time: ${code}`); this.name = 'HostTimeError'; }
}
export interface HostTimeSnapshot {
  readonly state: 'running' | 'paused';
  readonly lastHostMilliseconds: number;
  readonly originTick: bigint;
  readonly targetTick: bigint;
  readonly submittedTick: bigint;
  readonly elapsedMilliseconds: RationalTime;
  readonly transport: TransportSnapshot;
}
export interface HostTimeProgress { readonly time: HostTimeSnapshot; readonly progress: ClockProgress | null }

// Every nonnegative binary64 is an integer multiple of 2^-1074. This is a
// host-time accumulator, not a physical clock. No endpoint subtraction or
// per-segment rounding is performed in Number arithmetic.
const UNITS_PER_MS = 1n << 1074n;
const UNITS_PER_SECOND = 1000n * UNITS_PER_MS;
function units(milliseconds: number): bigint {
  if (typeof milliseconds !== 'number' || !Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > MAX_HOST_MILLISECONDS) throw new HostTimeError('invalid_time');
  const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, milliseconds);
  const bits = bytes.getBigUint64(0), exponent = Number((bits >> 52n) & 2047n), mantissa = bits & ((1n << 52n) - 1n);
  return exponent === 0 ? mantissa : ((1n << 52n) | mantissa) << BigInt(exponent - 1);
}
function elapsedTime(value: bigint): RationalTime {
  let a = value, b = UNITS_PER_MS;
  while (b) [a, b] = [b, a % b];
  return Object.freeze({ numerator: value / a, denominator: UNITS_PER_MS / a });
}

/** Opt-in absolute monotone milliseconds -> exact tick requests on a real consumer.
 * No delta, speed, solver, pose or implicit backlog-pump API. Does not own consumer.
 */
export class ReplayHostTimeBridge {
  readonly #consumer: ReplayConsumerBridge;
  #context!: TransportContext;
  #state: 'running' | 'paused' = 'running';
  #last = 0;
  #lastUnits = 0n;
  #elapsed = 0n;
  #origin = 0n;
  #submitted = 0n;
  #disposed = false;
  #busy = false;

  constructor(consumer: ReplayConsumerBridge, nowMilliseconds: number) {
    this.#consumer = consumer; this.reset(nowMilliseconds);
  }
  #idle(): void {
    if (this.#disposed) throw new HostTimeError('disposed');
    if (this.#busy) throw new HostTimeError('busy');
  }
  #binding(allowFault = false): TransportSnapshot {
    if (this.#disposed) throw new HostTimeError('disposed');
    if (this.#consumer.context !== this.#context) throw new HostTimeError('context');
    const status = this.#consumer.transportStatus(), clock = status.clock;
    if (status.state === 'disposed') throw new HostTimeError('disposed');
    if (!clock || clock.requested !== this.#submitted || !clock.time || clock.time.numerator * 120n !== this.#submitted * clock.time.denominator) throw new HostTimeError('external_request');
    if (status.state === 'faulted') { if (!allowFault) throw new HostTimeError('physics_fault'); }
    else if (status.state !== (this.#state === 'running' ? 'playing' : 'paused')) throw new HostTimeError('transport_state');
    return status;
  }
  #candidate(now: number): { host: bigint; elapsed: bigint; tick: bigint } {
    const host = units(now);
    if (now < this.#last) throw new HostTimeError('backward_time');
    const elapsed = this.#elapsed + (this.#state === 'running' ? host - this.#lastUnits : 0n);
    const tick = this.#origin + elapsed * 120n / UNITS_PER_SECOND;
    if (tick > MAX_SAMPLE_TICK) throw new HostTimeError('horizon');
    return { host, elapsed, tick };
  }
  #snapshot(now: number, elapsed: bigint, status: TransportSnapshot): HostTimeSnapshot {
    return Object.freeze({ state: this.#state, lastHostMilliseconds: now, originTick: this.#origin,
      targetTick: this.#origin + elapsed * 120n / UNITS_PER_SECOND, submittedTick: this.#submitted,
      elapsedMilliseconds: elapsedTime(elapsed), transport: status });
  }
  /** Observe accepted host time/actual transport, including faults; never advance. */
  observe(): HostTimeSnapshot { return this.#snapshot(this.#last, this.#elapsed, this.#binding(true)); }
  /** Pure conversion preview. No host anchor or numerical state changes. */
  preview(nowMilliseconds: number): HostTimeSnapshot {
    const status = this.#binding(), c = this.#candidate(nowMilliseconds);
    return this.#snapshot(nowMilliseconds, c.elapsed, status);
  }
  advance(nowMilliseconds: number, audit?: ReplayObserver): HostTimeProgress {
    this.#idle(); this.#binding();
    if (this.#state !== 'running') throw new HostTimeError('transport_state');
    const c = this.#candidate(nowMilliseconds);
    // In particular, an unchanged timestamp cannot drain a previous hitch.
    if (nowMilliseconds === this.#last) return Object.freeze({ time: this.observe(), progress: null });
    this.#busy = true;
    try {
      const progress = this.#consumer.requestTick(this.#context, c.tick, audit);
      this.#elapsed = c.elapsed; this.#last = nowMilliseconds; this.#lastUnits = c.host; this.#submitted = c.tick;
      return Object.freeze({ time: this.observe(), progress });
    } finally { this.#busy = false; }
  }
  /** Preserve the completed tick AND existing backlog. Active tail is deferred. */
  pause(nowMilliseconds: number): void {
    this.#idle(); this.#binding();
    if (this.#state !== 'running') throw new HostTimeError('transport_state');
    const c = this.#candidate(nowMilliseconds);
    this.#consumer.pause(this.#context);
    this.#elapsed = c.elapsed; this.#last = nowMilliseconds; this.#lastUnits = c.host; this.#state = 'paused';
  }
  resume(nowMilliseconds: number): void {
    this.#idle(); this.#binding();
    if (this.#state !== 'paused') throw new HostTimeError('transport_state');
    const c = this.#candidate(nowMilliseconds);
    this.#consumer.resume(this.#context);
    this.#last = nowMilliseconds; this.#lastUnits = c.host; this.#state = 'running';
  }
  /** Explicitly rebind/reanchor after the caller's transport reset/seek/replay.
   * Requires a playing consumer at an exact requested tick. Discards prior host
   * fraction; never resets, plays or modifies the physical transport itself.
   */
  reset(nowMilliseconds: number): void {
    this.#idle(); const host = units(nowMilliseconds), s = this.#consumer.transportStatus(), clock = s.clock;
    if (s.state !== 'playing' || !clock || !clock.time) throw new HostTimeError('transport_state');
    if (clock.time.numerator * 120n !== clock.requested * clock.time.denominator) throw new HostTimeError('external_request');
    this.#context = this.#consumer.context; this.#origin = clock.requested; this.#submitted = clock.requested;
    this.#elapsed = 0n; this.#last = nowMilliseconds; this.#lastUnits = host; this.#state = 'running';
  }
  /** Invalidate only this adapter. Caller still owns the consumer and graphics. */
  dispose(): void { if (!this.#disposed) { this.#idle(); this.#disposed = true; } }
}
