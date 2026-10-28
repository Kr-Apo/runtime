# T-840B5A — Experimental ReplayV1 transport contract

Status: opt-in headless core API. No existing editor, player, renderer or export
consumer activates it. Rust module replay_transport; TS core export ReplayTransport.

## Ownership

The transport owns an immutable source snapshot, one selected clip and exactly one
ReplayAnimationInstance (B4), which owns B3 Physics and its single B2 ReplayClock.
The transport has no ticking clock, wall time, delta accumulator or second simulation
counter. Snapshot positions/replay targets are derived views or command metadata.
Rust shares the immutable source across candidate epochs with Arc; TS privately
clones the source for each new candidate. Neither rebuilds immutable rigs per tick.

The caller supplies a nonzero u64 epoch initially. Restart, clip change, stop, seek
and replay create a fresh increasing epoch; reset takes an explicit greater epoch.
Every successful replacement invalidates the old opaque TransportContext. Tokens
from another transport fail even with the same numeric epoch. Context tokens hold
no rig, pose, spring or GPU resource. Disposed transports cannot be reset or reused.

## State transitions

| Operation | Valid source | Result and physical rule |
|---|---|---|
| construct | compatible source/clip | Stopped, pure selected clip@0, no numerical step |
| play(same,false) | Stopped/Playing | Playing, same epoch; no tick or reset |
| play(same,false) | Paused | same as explicit resume, using the recorded continuation |
| play(name,true) | any ready state | Playing, fresh origin-zero epoch |
| play(different name,false) | any ready state | explicit abrupt clip change, fresh origin-zero epoch |
| play(same,false) | SeekPreview/Replaying | refused; choose replay/restart or pump explicitly |
| pause | Playing/Replaying | Paused, freeze exact requested/completed time and all numerical state |
| pause | Paused | idempotent, no work |
| resume | Paused | restore Playing or Replaying; no work or implicit drain |
| stop | any ready state | Stopped, retain clip, new zero-state epoch, clear backlog, pure clip@0 |
| seekTick/seekTime | any ready state | SeekPreview, new epoch, pure canonical pose, no historical simulation |
| replayTo/replayToTime | any ready state | new origin-zero epoch; queue target, then Replaying, or Paused if target zero |
| pump | Playing/Replaying | execute existing debt up to explicit budget |
| requestTick/requestTime | Playing | absolute exact request; B2 interactive budget of eight ticks |
| target reached by replay | Replaying | Paused, replayComplete true; explicit resume continues from that completed state |
| reset | any live state, including Faulted | Stopped at zero, explicit increasing epoch; clears fault |
| dispose | any live state, including Faulted | Disposed; release private source, sampler, physics and preview |

"Ready" excludes Faulted and Disposed. Faulted accepts only reset/dispose; stop is
not a disguised recovery retry. All unlisted transitions are errors. Play requires
an explicit boolean restart argument in both APIs; malformed JS arguments are refused.

## Pause, requests and backlog

Pause preserves offsets, velocities, anchors, clip, context and the full pending
target. A half-second request commits eight ticks and leaves 52 pending. Pause and
repeated frame/snapshot queries leave all of them unchanged. Resume does not add
paused wall time or execute any tick; the next pump starts at tick nine. Equal exact
requests never drain backlog, including after resume. Requests while paused fail.

Callers provide **logical absolute epoch targets**, excluding paused wall time.
There is no general deltaSeconds bridge, speed control or wall-clock API. A caller
that supplies a later absolute target is deliberately requesting that history;
the transport cannot infer a missing wall-time/pause policy from floating deltas.

Normal nonlooping playback retains B4 clamping: author pose holds at duration while
Physics may continue settling for further requested ticks. It does not auto-stop at
the last key. Looping uses B4 f32-duration recovery, modulo-before-rounding and
integer tick-derived sampling; loops preserve springs and velocities.

## Pure seek and historical replay

seekTick selects N directly. seekTime accepts exact u64 rational seconds and snaps
the preview to canonical N=floor(n*120/d); previewTime retains the reduced requested
rational. position is the canonical displayed tick, clipTime is B4's corresponding
wrapped/clamped f32 clip time. **Sub-tick preview interpolation is not implemented.**
This quantization is explicit; the API does not claim to show an arbitrary fractional
pose beyond its 120Hz domain.

Seek replaces the old physics epoch, publishes a pure preview with no spring records,
and exposes a fresh simulation clock still at zero. That preview's tick can be ahead
of completed only because poseKind is explicitly pure. Resume, play(same,false),
request and pump cannot continue the stale physics. Choose replayTo, or explicitly
play(restart=true) to return to zero. Nonzero rest-start-from-preview is refused by
startFromPreview; B4 only primes an origin-zero author history. No implicit choice
between a historical reconstruction and a new rest-start is made.

replayTo always uses the captured rig/clip and known origin zero. It queues work
without executing a single tick, so it can pause before tick one. The queue delegates
to B2's existing Cancelled offer before any sampler/Physics work; this is scheduling
deferral, not a numerical fault. pump then consumes the very same pending tick.
Use budget one for interruption at any tick, or bounded chunks for efficiency.
Synchronous batches are not preempted inside a tick or halfway through an already
running pump; the caller pauses between calls. An incomplete target remains Replaying
(or Paused with resumeState=Replaying). It is never reported complete until debt is zero.

Replay completion retains replayTarget and marks replayComplete until explicit
resume/play, stop, reset, seek or another replay. Resume after completion retains the
rebuilt numerical state and continues at the next tick. No replay checkpoints,
external root/control logs or intermediate-origin restoration exist.

## Observation and failure

snapshot exposes state, clip, completed position, clip time, poseKind, exact clock
requested/completed/backlog/next/time, previewTime, resumeState and replay completion.
The sole authoritative advancing counters are the B2 clock. frame returns the last
completed simulated frame, or a clearly labeled pure preview. Simulated frame zero
is a primed zero-state frame and does not imply a positive Physics integration.
Reading, redraw-equivalent queries and pure sample queries do no scheduling.

Rust frame is an immutable borrow; TS frame is detached. Snapshot is value-owned in
Rust and frozen in TS. sample_tick/sampleTick is an explicitly pure diagnostic query,
not a published historical frame. It can also diagnose a fault without resuming it.

Validation errors preserve document/source, transport state, token and current frame.
Candidate construction/validation/sampling happens before replacing the old epoch.
Bad clip, epoch, target, budget, context or unsupported feature cannot partially switch
the transport. A failed executing tick retains the completed prefix and last good
public frame, sets Faulted and requires reset. B3 private spring updates may already
have occurred: **B6 numerical rollback is not implemented**. No silent retries.

Observers retain B3 semantics: a fully evaluated candidate is offered before its clock
commit. TS passes a detached candidate; current frame/snapshot still describe the
previous completed tick during that callback. TS denies reentrant mutations while
processing. Rust's exclusive borrow enforces mutation separation, and a pessimistic
fault flag survives observer panic. External observer side effects are not rolled back.

## Domain and future integration boundary

All B4 limits remain: one v2 bone-transform clip, seven scalar channels, native
linear/stepped/Bezier rules, Physics-only, fixed default-skin membership, no authored
bone time offsets, events, attachment sequences, FFD/slot/draw-order/constraint tracks.
The 8,388,607-tick sampling horizon remains; out-of-range commands fail before work.
Existing v1/v2 readers and native fields remain unchanged.

crossFade and setSkin always refuse, including a nominal default-skin request.
There is no external-input API; missing/incompatible author clips are errors. Arbitrary
unrecorded game inputs cannot be reconstructed, substituted or silently assumed.
There is no rig replacement/retarget API: construct a new owner for a changed source.

Future adapters can explicitly own this experimental transport and submit exact logical
requests/pumps, then render frame plus snapshot lag. No callback is wired into AppState,
RigPlayer.update, RigPlayback, PixiJS, Phaser, CPU exports, GIF or video. Their existing
semantics and protective refusals stay intact. B5B requires a separate review.
