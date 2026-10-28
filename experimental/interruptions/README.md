# Experimental ReplayV1 interruptible crossfade (A13)

Explicit opt-in: `{crossfade:true, interruptible:true}`. Native v2, one fixed default
skin, Normal blending, bone clips and static regions/meshes, including weighted
meshes without FFD. The existing Physics solver runs once per accepted tick.
This is a bounded application pilot, not a new Q1 numerical certificate or an
extension of the published alpha. A12 `{crossfade:true}` still refuses interruptions.

```ts
const c = new ReplayConsumerBridge(rig, "Idle", 1n, undefined, {
  crossfade: true, interruptible: true
});
c.play(c.context, "Idle", false);
for (let tick = 1n; tick <= 72n; tick++) {
  c.requestTick(c.context, tick);
  if (tick === 60n) c.requestTransition(c.context, {
    to: "Attack", durationTicks: 96n
  });
}
c.requestInterrupt(c.context, {to: "Hit", durationTicks: 24n, incomingTick: 0n});
// Accepted tick72 is unchanged. At tick73 weight0 uses exactly its pre-Physics input.
c.requestTick(c.context, 73n);
const accepted = c.currentFrame();
console.log(accepted.mixing, accepted.prePhysics, c.transitionStatus(c.context));
```

The source is a detached, complete local pose captured from the accepted B6 frame,
never the already-constrained bone locals or final matrices. Each new interruption
owns one flat pose; it does not create a recursive transition tree. At most two
poses are mixed. A frozen transition samples only its incoming clip.

A request after accepted N starts at N+1 with weight0, completes at N+1+D with
weight1, and follows A12's local interpolation and angular tie policy. Duration
is a positive bigint, at most7200 ticks. Incoming phase defaults to0. Requests
require active ordinary play/pause, a drained backlog, no concurrent pending
command and the exact live context. Interrupting requires an active transition.
Unknown clips, invalid phases/poses, reentrance and capacity overflow refuse
before publication. Never mutate snapshots to supply poses.

`mixing.kind` is `interruptible-crossfade/v1`. `transition.source` identifies a
frozen origin by accepted tick and owning command number. Its clip/time labels
describe provenance, not a pure clip that can reconstruct the composite pose.
Render from the accepted bones. Source locals stay fixed while Physics evolves
normally; this guarantees pose continuity, not inertial or velocity blending.

`replayFromOrigin(context, target)` creates a new epoch, retains the bounded plan,
executes every tick again and verifies each reconstructed pre-Physics origin
before its first use. The numerical frames and mixing metadata are reproducible;
epoch, replay state and backlog describe the new request. Resume after completion.
Explicit stop/reset/restart clears the journal and resets Physics. No implicit
reset occurs at interruption, clip completion or looping.

The shared journal holds64 commands including interruptions. Captures remain for
replay until explicit clearing/disposal. Storage is O(64 × bones), with at most256
bones and16 clips; no per-tick cache. This is not unlimited game playback. The
global/local sampling horizon remains2^23−1 ticks; a positive incoming offset can
reduce the remaining local horizon. Zero/negative/singular scales are excluded.

FFD, linked meshes, animated slots/order, clipping, events/audio, dynamic skins,
constraint mixing, layering, additive blending and sequences remain excluded.
The native project/export schemas, evaluator, Physics solver and shaders are unchanged.

`prepare-demo.mjs NEW_OUTPUT DEPENDENCY_RUNTIME CORE_DIST` reuses I2/A12's standalone
delivery builder and the authentic four-clip fixture. The resulting two WebGL2
applications include Play/Pause/Resume, interruption buttons, Reset and Replay.
Run `node server.mjs .`; all browser dependencies and notices are local.
Manual diagnostic pages use explicit ticks; ordinary pages use the existing host
time bridge. Replay proceeds in bounded chunks and finishes paused.

The separate `tools/interruption-reference` tool requires the read-only sibling
Editor A10 checkout (`cca30f97c2dd28b49da1d42a6c2cb31a779666ac`). It creates, saves,
reopens and natively exports Combat Frog, independently samples/blends/captures
locals, and supplies one native ReplayPhysicsInstance. It extends the A12 reference
without changing its tool or historical outputs. This is headless authoring, not
GUI or artistic qualification. See the local A13 delivery reports for residuals,
GPU readbacks, pixels, performance, failure cases and exact source hashes.
