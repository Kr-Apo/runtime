/** Exact scheduling foundation only; no player, solver or JSON integration. */
export const TICKS_PER_SECOND = 120n;
export const INTERACTIVE_BUDGET = 8;
export const MAX_BUDGET = 65_536;
export const MAX_CLOCK_INTEGER = (1n << 64n) - 1n;
export const SimulationProfile = Object.freeze({ LegacyT839: "LegacyT839", ReplayV1: "ReplayV1" } as const);
export type SimulationProfile = typeof SimulationProfile[keyof typeof SimulationProfile];
export type ClockErrorCode = "uninitialized" | "invalid_epoch" | "invalid_time" | "overflow" | "backward_time" | "invalid_budget" | "busy";
export class ClockError extends Error {
  constructor(readonly code: ClockErrorCode) { super(code); this.name = "ClockError"; }
}
export interface RationalTime { readonly numerator: bigint; readonly denominator: bigint }
export interface ClockSnapshot {
  readonly initialized: boolean;
  readonly epoch: bigint;
  readonly requested: bigint;
  readonly completed: bigint;
  readonly backlog: bigint;
  readonly next: bigint | null;
  readonly time: RationalTime | null;
}
export interface ScheduledTick { readonly epoch: bigint; readonly index: bigint }
export type TickResult = { readonly kind: "complete" } | { readonly kind: "cancelled" } | { readonly kind: "failed"; readonly error: unknown };
export type ClockStop = { readonly kind: "target_reached" | "budget_exhausted" | "unchanged" | "cancelled" } | { readonly kind: "failed"; readonly error: unknown };
export interface ClockProgress { readonly state: ClockSnapshot; readonly processed: number; readonly attempted: number; readonly stop: ClockStop }
export type TickConsumer = (tick: ScheduledTick) => TickResult;

function integer(value: bigint, invalid: ClockErrorCode): void {
  if (typeof value !== "bigint" || value < 0n) throw new ClockError(invalid);
  if (value > MAX_CLOCK_INTEGER) throw new ClockError("overflow");
}
export function rational(numerator: bigint, denominator: bigint): [RationalTime, bigint] {
  integer(numerator, "invalid_time"); integer(denominator, "invalid_time");
  if (denominator === 0n) throw new ClockError("invalid_time");
  const target = numerator * TICKS_PER_SECOND / denominator;
  if (target > MAX_CLOCK_INTEGER) throw new ClockError("overflow");
  let a = numerator, b = denominator;
  while (b !== 0n) [a, b] = [b, a % b];
  return [Object.freeze({ numerator: numerator / a, denominator: denominator / a }), target];
}

/** Synchronous, per-instance, uninitialized until an explicit reset(epoch).
 * BigInts never enter legacy serialization. No floating-seconds bridge exists.
 */
export class ReplayClock {
  readonly profile = SimulationProfile.ReplayV1;
  #epoch = 0n;
  #requested = 0n;
  #completed = 0n;
  #time: RationalTime | null = null;
  #busy = false;
  snapshot(): ClockSnapshot {
    return Object.freeze({ initialized: this.#time !== null, epoch: this.#epoch,
      requested: this.#requested, completed: this.#completed,
      backlog: this.#requested - this.#completed,
      next: this.#completed < this.#requested ? this.#completed + 1n : null, time: this.#time });
  }
  reset(epoch: bigint): void {
    this.#checkIdle(); integer(epoch, "invalid_epoch");
    if (epoch === 0n || epoch <= this.#epoch) throw new ClockError("invalid_epoch");
    this.#epoch = epoch; this.#requested = 0n; this.#completed = 0n;
    this.#time = Object.freeze({ numerator: 0n, denominator: 1n });
  }
  #checkIdle(): void { if (this.#busy) throw new ClockError("busy"); }
  #checkEpoch(epoch: bigint): void {
    this.#checkIdle();
    if (this.#time === null) throw new ClockError("uninitialized");
    integer(epoch, "invalid_epoch");
    if (epoch !== this.#epoch) throw new ClockError("invalid_epoch");
  }
  requestTick(epoch: bigint, tick: bigint, consume: TickConsumer): ClockProgress {
    return this.requestTime(epoch, tick, TICKS_PER_SECOND, consume);
  }
  requestTime(epoch: bigint, numerator: bigint, denominator: bigint, consume: TickConsumer): ClockProgress {
    this.#checkEpoch(epoch);
    const [time, target] = rational(numerator, denominator);
    const previous = this.#time!;
    const left = time.numerator * previous.denominator, right = previous.numerator * time.denominator;
    if (left < right) throw new ClockError("backward_time");
    if (left === right) return this.#progress(0, 0, { kind: "unchanged" });
    this.#time = time; this.#requested = target;
    return this.#process(INTERACTIVE_BUDGET, consume);
  }
  pump(epoch: bigint, budget: number, consume: TickConsumer): ClockProgress {
    this.#checkEpoch(epoch);
    if (!Number.isSafeInteger(budget) || budget <= 0 || budget > MAX_BUDGET) throw new ClockError("invalid_budget");
    return this.#process(budget, consume);
  }
  #progress(processed: number, attempted: number, stop: ClockStop): ClockProgress {
    return { state: this.snapshot(), processed, attempted, stop };
  }
  #process(budget: number, consume: TickConsumer): ClockProgress {
    let processed = 0;
    this.#busy = true;
    try {
      while (processed < budget && this.#completed < this.#requested) {
        const index = this.#completed + 1n;
        let result: TickResult;
        try { result = consume(Object.freeze({ epoch: this.#epoch, index })); }
        catch (error) { return this.#progress(processed, processed + 1, { kind: "failed", error }); }
        if (result?.kind === "complete") { this.#completed = index; processed++; }
        else if (result?.kind === "cancelled") return this.#progress(processed, processed + 1, { kind: "cancelled" });
        else return this.#progress(processed, processed + 1, { kind: "failed", error: result?.kind === "failed" ? result.error : new TypeError("Expected synchronous TickResult") });
      }
      return this.#progress(processed, processed, { kind: this.#completed === this.#requested ? "target_reached" : "budget_exhausted" });
    } finally { this.#busy = false; }
  }
}
