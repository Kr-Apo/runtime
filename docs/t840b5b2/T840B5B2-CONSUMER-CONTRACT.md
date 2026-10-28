# T-840B5B2 — Exact consumer bridge contract

Experimental opt-in headless bone-only API. No RigPlayer/RigPlayback, renderer,
editor, export or format default changes. No GPU qualification. One owned B5A/B5B1
transport -> one B4 sampler -> one B3 Physics owner -> one B2 clock. The bridge
stores only immutable bone identities/names and the default skin name in Rust;
TS stores the default name and transport. It has no advancing temporal counter.

## APIs and ownership

Rust ReplayConsumerBridge::new(rig,clips,name,epoch,Option<&[SkinEvent]>).
TS new ReplayConsumerBridge(rig,name,epoch,events?). Supply a calendar explicitly
for B5B1 skin switching; omission retains historical fixed-default membership.
The native context, validation, horizon and immutable snapshots are reused. Failed
construction returns no owner; there is no uninitialized frame or Setup substitute.
Source changes require a new owner; same bone names do not authorize continuity.

context, transport_status/transportStatus, current_frame/currentFrame,
preview_frame/previewFrame, present, play(context,name,explicitRestart), pause,
resume, stop, reset(context,newEpoch), seek_tick/seekTick, seek_time/seekTime,
replay_from_origin/replayFromOrigin, request_tick/requestTick,
request_time/requestTime, pump(context,budget) and dispose reuse the transport.
No general deltaSeconds API, event player or renderer is added.

Request has the existing eight-whole-tick budget. Equal exact rational requests
are unchanged, including while debt remains. Pump is explicit, budget 1..65536,
with no silent debt truncation. Cancel catch-up BETWEEN bounded pumps; budget=1
provides single-tick granularity. Pause preserves all remaining debt. No asynchronous
mid-tick cancellation or numeric rollback is promised. Render/observation never
calls request/pump, samples the future or consumes gameplay events.

## Coherent committed view

currentFrame returns an owned ConsumerFrame:
context token, epoch, clip, requested, completed, backlog, poseTick, exact poseTime,
wrapped/clamped clipTime, skin, transport state, health, targetReached, bone locals/
world affines and Physics records (identity, offsets, velocities, anchors).
poseTick ALWAYS equals completed. Requested/backlog are explicitly INTENT metadata,
not the time of any pose field. poseTime is reduced completed/120; clipTime delegates
to B4 canonical_time at that same tick. Skin resolves from B5B1 at completed, with
the captured native default name in fixed mode. Records are the last committed
records, not private in-progress records. Bone order is native update order.

A request60/completed8 returns pose8 + skin8 + records8, backlog52, targetReached=false.
The bridge adds read-only committed_frame/committedFrame and clip_time_at/clipTimeAt
to the transport to avoid mistaking its display preview for simulated history.
These helpers perform no work and do not change existing frame/snapshot behavior.

At construction/stop/reset, frame0 is a primed rest state, not an executed positive
tick. The opaque context token + epoch + completed identifies a numerical frame
within one owner. Epoch/tick alone is NOT globally unique. A snapshot can retain the
same frame identity while request/backlog/paused mode metadata changes. Tokens from
another owner or a previous epoch never authorize commands. No integer global
identity generator or second clock is introduced.

## Pure preview is a distinct type

seek creates a new origin-zero simulation and a PURE preview, as in B5A. currentFrame
still reports committed0/skin0/records0. previewFrame returns a separate optional
ConsumerPreview {context,epoch,tick,poseTime,clipTime,skin,bones}, with NO simulated
records, completed counter or targetReached flag. Its tick may be 180 with skin off
while the committed origin frame remains on. Never pass this object as historical
Physics output. transportStatus describes the transport and preview position; it
is not the committed pose envelope. Resume/request/pump after pure seek still refuse;
explicit replay or zero restart is required. Replay reexecutes the frozen calendar.

## Safety, copies and callbacks

Rust frames/previews own Vecs and can be retained across commands; their context
handles are opaque. TS returns a detached transport frame once, then wraps its
bones/records plus frozen top-level metadata. Nested bone/affine data is caller-owned
and mutable, never shared with simulation. Mutating it cannot modify a later read.
Use one snapshot per update and retain it for redraws rather than copying per mesh.
A caller must preserve the original opaque token identity; structured-cloning a
context object does NOT create a valid command token. No snapshot deserialization
or state restoration API exists.

present invokes a synchronous consumer AFTER obtaining a committed snapshot. A
presentation error propagates (Rust explicit Result mapped to presentation error;
TS exception) without changing simulation, debt, skin or health. Rust borrowing and
TS presenting guard prevent reentrant mutation during present. Async rendering,
threads and asynchronous callbacks are not provided by this interface.

Request/pump optionally reuse B3's PRECOMMIT audit observer (Rust takes a closure,
TS defaults to no-op). This diagnostic candidate is NOT a ConsumerFrame or a render
hook: do not present it. A failing audit faults the numerical owner per B3. TS
currentFrame during an audit still returns the previous committed frame; Rust
borrowing forbids reentrant owner access. No user callback runs inside snapshot
assembly, so metadata and data cannot race in this synchronous API.

Fault health is explicit; targetReached is false while faulted, even with no debt.
The last good public frame remains readable; progression/stop/pause cannot silently
retry the failing tick. Only reset/reconstruction or dispose recovers. B6 rollback
of private offsets, velocities, anchors and membership is NOT implemented.
Disposed transportStatus reports disposed without a clock; currentFrame/previewFrame
and mutating commands reject. No artificial empty valid frame is returned.

Only qualified bone transforms and Physics records are published. ConsumerFrame is
NOT RigPose: slots, drawOrder, FFD, attachment poses and clipping are absent. B4
unsupported tracks, mixed solvers, sequences and offsets remain rejected. Old v1/v2
readers stay intact; the opt-in clip wrapper remains native v2 only. B5B1 calendars
are immutable; no realtime past/future edits are introduced.

## Host-time boundary decision

Exact integer ticks or u64/BigInt rational seconds remain the only shipped inputs.
The host must define logical time excluding pauses. See HOST-TIME-ANALYSIS.json in
the delivery: exact decoding of binary64(1/FPS)*FPS is below one second at all tested
30/60/120/144 Hz, yielding floor119 rather than normative120. Naive double addition
and f32 accumulation also disagree at long boundaries. Absolute host doubles have
the same ambiguity at a rounded tick boundary. A nanosecond bias cannot recover the
lost original intent, and arbitrary epsilon changes exact B2 semantics.

A finite double can be decoded deterministically, but whether it means that exact
binary fraction, a rounded measurement or an intended rational cadence requires a
host policy. No such policy is silently chosen. Defer a float/delta adapter to a
separate contract (units, quantization, drift, pauses, long-session bounds). An
engine able to provide exact integer time units can already call requestTime(n,d)
with no conversion bridge or new clock. No f32 accumulation, epsilon or nanosecond
bias is shipped, and RigPlayer's existing delta policy is untouched.
