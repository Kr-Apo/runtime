# Experimental ReplayV1 through A17

This source branch contains A17 `3cfe7dd991d98726f2e1c8b3e8c8f70590c6981f`.
Source availability, branch integration and package publication are separate.
Runtime package identities/versions remain unchanged and independent of Classic.
Repositories: [Kr-Apo/editor](https://github.com/Kr-Apo/editor) and
[Kr-Apo/runtime](https://github.com/Kr-Apo/runtime), unofficial community forks
with original licenses, copyrights and credits preserved.

## Legacy versus explicit ReplayV1

Legacy RigPlayer/RigPlayback and adapter update/seek/crossFade paths retain their
own subset and limits. They do not inherit ReplayV1/B6 guarantees. See
[shared playback boundaries](shared-playback-boundaries.md).

ReplayV1 is opt-in: one 120 Hz logical clock samples animation, accumulates
Physics and schedules constraints. Host-time bridging advances bounded work;
presentation/redraw must not advance the clock. Numerical-domain admission stays
guarded. A bounded certificate is not a universal guarantee for arbitrary rigs,
browsers or time horizons.

| Feature | Core | PixiJS 8.17.0 | Phaser 3.90.0 | Standalone | A17 composition |
|---|---|---|---|---|---|
| Animation + continuous Physics | bounded qualification | WebGL2 pilot | WebGL2 pilot | explicit mode | admitted domain only |
| Weighted geometry + FFD | native references/B6 | buffers/pixels | buffers/pixels | A3/A16/A17 | one stable owner |
| RGBA, attachments, visibility, draw order | transactional channels | bounded cases | bounded cases | A4/A6/A14 | FFD attachment/visibility fixed |
| Events | one accepted queue | same occurrences | same occurrences | A5/A15 | incoming-owner policy below |
| Crossfade/interruption | A12/A13/A16 references | bounded captures | bounded captures | A17 gates A/B | explicit capabilities |
| Linked ownership/inherited FFD | A10/A11 bridge | separate A11 cases | separate A11 cases | linked pilot | refused |
| Polygon clipping | separate A7/A8 | separate pilot | separate pilot | separate option | refused |
| Dynamic weighted skins | separate C7 domain | separate pilot | separate pilot | separate admission | refused |
| Dark tint / other blend modes | Legacy data where documented | separate evidence | separate evidence | no A17 admission | refused; Normal only |
| Mobile/WebGPU/WebGL1/general performance | not certified | not certified for ReplayV1 | not certified for ReplayV1 | desktop measurements | not certified |

Qualified means identified fixtures/trajectories/environments passed, not every
artistic project or an entire feature family.

## Integrated admission and limits

Native v2; exactly Idle, Attack, Hit, Death; immutable default skin; Normal;
Physics-only constraints; qualified positive nonsingular scales. One weighted FFD
owner always selected and visible, immutable topology/binds. No linked meshes,
clipping composition, dynamic skins, sequences, dark tint, arbitrary layers or
additive composition. Whole absent FFD track means zero rest. Empty tracks/keys
and empty/full vectors remain HOLD. A complete zero key differs from an empty key.

Pilot ceilings: 128 bones, 32 slots, 128 attachments, four clips, 512 FFD scalar
components, 131072 stored FFD scalars. Structural identity 32768 UTF-16 units,
slot snapshot 12288, command/capture 98304. At most 64 transition commands/session
(conservative serialized UTF-16 payload <=12 MiB). There is no journal compaction
or eviction: surface refusal and end/reset explicitly; do not hide resets to
claim long-combat endurance.

Events: 1024 pending, 8192 UTF-16 units/native payload, 32768/accepted occurrence,
conservative serialized queue <=64 MiB. Returned clones, temporary candidates and
application-held copies add heap. Serialized limits are not universal JS heap or
FPS guarantees.

## Composition and event policy

Gate A options: `{crossfade:true, weightedFfd:true, animatedSlots:true,
animationEvents:true}`. Gate B adds `interruptible:true`. A12/A13 locals, A16
author-space per-influence FFD and A14 normalized RGBA compose before one Physics
tick. Discretes remain outgoing until weight 1. Interruptions capture accepted
pre-Physics locals, canonical FFD and normalized slots, not GPU positions or
Physics-modified source locals.

Incoming event ownership starts on the first accepted transition tick, with an
empty first window, then `(from,to]`. Time-zero events are excluded. Incoming
events can coexist with outgoing eyes and blended body FFD.

One B6 candidate contains numeric state, Physics, FFD, slots and events: all accept
or none do. GPU failure preserves the graphical front but does not undo accepted
numeric events. Retry presents the same accepted frame without resampling.
Context restoration/disposal use explicit owned lifecycles.

Drain provides **at-most-once removal**, not durable exactly-once external effects.
Reset/Stop/Replay replace the epoch and discard pending events: drain first when
needed. Replay creates new numerical occurrences; external-effect policy belongs
to the game.

## Running and integrating the actual source APIs

See [A17 contract](../experimental/integrated-combat/README.md),
[Gate B wrappers](../experimental/integrated-interruptions/README.md),
[A12 transitions](../experimental/crossfade/README.md),
[A13 interruptions](../experimental/interruptions/README.md) and
[continuous actor](../experimental/continuous-playback/README.md).

```sh
npm ci --ignore-scripts
npm run build
node experimental/integrated-combat/prepare-demo.mjs NEW_OUTPUT_FOLDER . core/dist b
node NEW_OUTPUT_FOLDER/server.mjs NEW_OUTPUT_FOLDER
```

Open the server's pixi.html/phaser.html in desktop WebGL2. Use a fresh output
folder. Do not rebuild historical sealed ZIPs. Combat Frog is native-API technical
authoring, not Classic artistic GUI proof; Jade's Legacy sample is not A17-admitted.

Minimal existing API fragment, after the matching asset/engine setup:

```js
// From experimental/integrated-interruptions/pixi.mjs, not a new npm API.
const actor = createPixiActor({asset, renderer, stage, clip:'Idle',
  skinEvents:[{tick:0n, skin:asset.rig.defaultSkin}]});
actor.startRealtime(performance.now());
// Host frame: actor.update(performance.now()); actor.present();
actor.requestTransition({to:'Attack', durationTicks:48n, incomingTick:0n});
// Later, after acceptance:
actor.requestInterrupt({to:'Hit', durationTicks:24n, incomingTick:0n});
const accepted = actor.observe();
const occurrences = actor.drainEvents();
actor.destroy(); // actors before shared asset/engine disposal
```

This is not a complete async loader. The generated demo contains the real abort/
generation checks, resource failure handling, pause/context restoration and
shutdown sequence. Never mix explicit ticks with an active host-time bridge,
including while paused. Handle sampling, queue/journal and stale-context errors;
never clamp/reset silently.

## Qualification and tests

[Qualification lineage](replay-v1-evidence.md) preserves A11–A17 methods and scope.
Historical A17 environment: hardware Chrome 156, ANGLE/NVIDIA RTX 3090, WebGL2,
Rust 1.95, PixiJS 8.17.0, Phaser 3.90.0. Gate B independent Rust trajectories:
1441 states / 1440 Physics inputs each; maximum weighted contribution residual
0.000110123, world 0.000060552, FFD 0.000013505 (<0.01), RGB <=0.000000400.
Nonzero residuals remain evidence. No general browser/mobile certification or
endurance beyond 64 commands follows.

Run `npm test`, `npm run typecheck`, `npm run build`; core includes the A17 numeric
regressions. Experiment authority/geometry and WebGL2 suites are additional.
Rust tools under tools/ require the matching editor layout and reference inputs.
Historical oracles/certificates/goldens remain immutable. Release receipts must
distinguish freshly executed tests from accepted historical evidence.
