# Experimental deterministic ReplayV1 crossfade (A12)

This is an explicit `{crossfade:true}` mode of `ReplayConsumerBridge`, separate
from Legacy `RigPlayer.crossFade` and all single-clip Replay modes. Native v2 and
the project format are unchanged. No published runtime version is changed.

```ts
const actor = new ReplayConsumerBridge(rig, "Idle", 1n, undefined, {crossfade:true});
actor.play(actor.context, "Idle", false);
actor.requestTransition(actor.context, {to:"Attack", durationTicks:24n});
actor.requestTick(actor.context, 1n); // first accepted transition tick, weight0
const frame = actor.currentFrame(); // accepted bones, Physics and frame.mixing
const status = actor.transitionStatus(actor.context); // accepted vs pending
```

Requests require ordinary play/pause, drained backlog, an existing different clip,
positive bigint duration1..7200 and no pending/active transition. Incoming tick
(default0n) is explicit. Request at acceptedN starts atN+1 with weight0, completes
atN+1+D with weight1. Outgoing phase continues; incoming phase starts at the given
tick. Both local clip times use native f32 durations and120Hz canonical sampling.
After completion the incoming clip continues, or holds its endpoint if nonlooping.
Physics continues once per accepted tick; there is no automatic clip/loop reset.

Full local poses are sampled, including setup fallback. Translation, scale and
unwrapped shear interpolate linearly; rotation uses signed shortest arc. Within
2^-20 radians (four f32 ulps at pi) of the antipodal tie, preserve the signed
half-turn. Endpoints are exact sampled poses; raw angular representatives can
change by2pi without a geometric jump. This is not Legacy's sequential weighted
layer accumulation, notably for scale. No world-matrix mixing is used.

Zero/negative scales (or <=1e-6), singular shear and nonfinite sampled/interpolated
poses are refused before B6 acceptance. No compensation/clamping is invented.
All clips are checked: no FFD, linked meshes, animated slots/order, events/audio,
clipping, constraint mixing, sequences, dynamic skins, layering or additive mixing.
Default skin, Normal, static regions/meshes and existing Physics only. Static dark
tint is outside this pilot. V1 reading and old modes remain available separately.

The journal has64 preallocated cells; overflow is refused, never silently dropped.
Stop/reset/restart explicitly clear it and reset Physics. Replay from origin retains
it and reexecutes native ticks. Interruption is unsupported. Pure seek is refused.
Global and local phases must remain within MAX_SAMPLE_TICK; reset explicitly before
limits. No sampler, mixer progression or Physics runs on redraw/frame reads.

Run `npm run build`, then the core tests and
`node --test experimental/crossfade/geometry.test.mjs experimental/crossfade/authority.test.mjs`.
Build standalone applications with
`node experimental/crossfade/prepare-demo.mjs NEW_OUTPUT DEPENDENCY_RUNTIME core/dist`.
The output must not exist. Run `node server.mjs .` inside it. Ordinary pages provide
realtime Play/Pause/Resume and four transition buttons; `?manual=1` uses explicit ticks
and disables realtime Play. Reset returns to stopped Idle; press Play to restart.

`tools/crossfade-reference` requires sibling read-only Editor A10 at the relative
paths in its Cargo manifest. Arguments are NEW_OUTPUT and optional `loop` for the
second trajectory. It creates Combat Frog through genuine native author APIs,
Save/reopen/rebind/export, independently samples full Rust locals, interpolates
locally, and feeds one existing native ReplayPhysicsInstance. No positive native
JSON is patched. Fixtures and references are reproducible; headless authoring is
not GUI/artist qualification. The local A12 delivery contains receipts, two native
trajectories, GPU/CPU comparisons, APNGs, history preservation and measured limits.
