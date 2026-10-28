# T-840C3 — Host-time contract

## Scope and public API

Opt-in ESM/types entry: `@ankhimate/runtime/experimental-host-time`. Exports `ReplayHostTimeBridge`, `HostTimeError`, `MAX_HOST_MILLISECONDS`, `HostTimeSnapshot`, `HostTimeProgress`, `HostTimeErrorCode`. No default instance activation, dependency or version change. The bridge borrows an actual ReplayConsumer; it never owns its graphics, textures or solver.

```ts
import { ReplayHostTimeBridge } from '@ankhimate/runtime/experimental-host-time';
const c = actor.consumer;
c.play(c.context, 'sway', false);
const host = new ReplayHostTimeBridge(c, performance.now());
// Call from the game's chosen absolute monotone clock, in milliseconds:
const update = host.advance(performance.now());
actor.present(); // completed frame only
app.render();
// Catch-up is a distinct caller decision, never a redraw/observation effect:
if (c.currentFrame().backlog > 0n) c.pump(c.context, 8);
host.pause(performance.now());
host.resume(performance.now());
host.dispose(); // adapter only; dispose actor/asset separately
```

`new ReplayHostTimeBridge(consumer, nowMilliseconds)` binds a playing consumer with an exact requested-tick time. Existing backlog is allowed. Its origin tick is the consumer's requested tick, not completed tick; it does not reinterpret or discard debt. A noncanonical fractional rational request must be explicitly resolved by the caller before binding.

- `advance(nowMilliseconds, audit?)`: validate/convert, request an integer target through the existing consumer, return `{time, progress}`. An identical timestamp yields `progress:null`; a changed timestamp in the same tick yields the inherited unchanged request result and no pumping.
- `observe()`: immutable accepted host-time metadata plus actual transport status, including numerical fault. No host sampling/request/pump.
- `preview(nowMilliseconds)`: pure conversion/binding check; no accepted anchor update or numerical work. This is a time preview, not a graphical seek.
- `pause(nowMilliseconds)`, `resume(nowMilliseconds)`: lifecycle below.
- `reset(nowMilliseconds)`: explicitly rebind/reanchor to the consumer's current valid playing exact target. It discards the previous host fraction, allows a new host origin, and performs no consumer reset/play/seek of its own.
- `dispose()`: idempotently invalidate the adapter, without destroying the borrowed consumer. Subsequent use refuses.

## Inputs, conversion and precision

Only absolute nonnegative finite Number milliseconds up to `Number.MAX_SAFE_INTEGER` are accepted. A negative zero is equivalent to zero. Use one monotone clock domain. No deltaSeconds API, implicit wall-clock origin, negative playback, speed property or floating-seconds player replacement is provided. Speed is 1x; 0x means explicitly pause. Half/double speed are deferred.

Decode each IEEE754 input exactly as integer units of 2^-1074 milliseconds. Subtract endpoint integers, accumulate active intervals as BigInts, and calculate:

```text
targetTick = originTick + floor(activeUnits * 120 / (1000 * 2^1074))
```

The denominator is an implementation detail of host conversion, never a new Physics integrator or serialized field. Private accumulator storage remains bounded by the permitted input domain and ReplayV1 horizon. Fractions are retained across all pauses; there is no independently floored microsecond per segment. `elapsedMilliseconds` is a reduced exact rational in milliseconds; `targetTick` is the canonical desired target, `submittedTick` the last target actually sent, and `transport.clock` describes actual numerical progress. The canonical request time is submittedTick/120 seconds.

There is zero arithmetic error relative to the represented input endpoints and the declared segment policy. Final floor-to-ticks discards a fraction in [0,1) tick. This does NOT make the original Number reading exact relative to ideal wall time. If each ideal timestamp was rounded to nearest binary64, one endpoint contributes at most half its ULP; N active segments have input-representation uncertainty bounded by the sum of their endpoint half-ULPs. Clock jitter/privacy coarsening/source error are additional, unqualified quantities.

Precision-qualified test domain: absolute readings in [0,2^32] ms and up to 1,000 active segments, with active elapsed time within ReplayV1's horizon. In this domain each ULP is at most 2^-20 ms, hence segment endpoint representation error sums to at most 1000*2^-20 ms (0.953675 microseconds), before the final tick quantization. This is a rounding-model bound, not a guarantee of physical browser-clock accuracy. Larger origins up to MAX_SAFE_INTEGER remain well-defined and tested, but cannot promise microsecond precision: at 1e12 ms an intended 0.001 ms increment is represented as 1/1024 ms; near MAX_SAFE_INTEGER a 0.1 ms increment can disappear entirely. Never add epsilon to hide these boundaries.

## Pause, resume and backlog

Pause validates first, retains the active tail in the host accumulator, and delegates consumer.pause only. It does not request/pump, change completed tick or alter existing requested/backlog. Desired target can therefore exceed submittedTick while paused. Resume excludes all intervening wall time, delegates consumer.resume and reanchors without a request. The first update at the identical resume timestamp is observational even if an active tail is deferred; the next changed timestamp submits the derived target. No time is silently thrown away to force this result.

A 500 ms advance from zero submits tick60; the inherited interactive budget completes at most8 and retains52 debt. New canonical targets can arrive while debt remains. Pump stays explicit on the consumer and is forbidden while paused by B5A. Observations, redraws, repeated host timestamps and same-tick updates never drain debt. No completed tick is fabricated before the real solver commits it.

## Transport ownership and invalidation

Context identity and the last canonical request are checked before conversion requests. Direct stop/reset/seek/replay changes context and expires the adapter until explicit rebind. Seek is pure preview; replay must finish, become paused, and be explicitly resumed before rebinding. A new host reset origin may be lower than the old one because it deliberately starts a new binding; ordinary advance/pause/resume may never regress.

Use the bridge for pause/resume while bound. An external pause/resume cycle already completed between bridge calls cannot be inferred from a snapshot, so do not mix these lifecycle owners. Visible state/request changes refuse; a caller that deliberately operates the transport must rebind. Direct pump is allowed because it changes only completed progress/debt. No History/Physics/Legacy contract is rewritten to enforce ownership.

## Errors and faults

`HostTimeError.code`: invalid_time (type/nonfinite/negative/out-of-domain), backward_time, horizon, context, external_request, transport_state, physics_fault, disposed, busy. Conversion validation and horizon checks occur before physical mutation; failures preserve accepted host and numerical state. A valid request that later fails in the real B6 solver is different: the requested target/host reading stay accepted, only the committed prefix remains, and numerical recovery requires explicit consumer reset followed by play/rebind. A failed audit has the inherited B6 semantics. Mutating bridge calls during an audit refuse as busy.

The maximum sampled tick is8,388,607, about69,905.0583 seconds (~19.42h) from numerical origin. Changing host origin does not bypass this physical epoch horizon. Resetting/replaying must follow B5A/B6 rules. No reverse simulation, layers, crossfade, events, graphical skins or new render capabilities are added.
