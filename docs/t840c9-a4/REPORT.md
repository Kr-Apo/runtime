# T-840C9-A4 — Animated Slot State ReplayV1

Verdict: GO for the explicit experimental A4 domain, for human review. All four families are implemented and qualified: SlotColor, SlotVisible, SlotAttachment, DrawOrder. This does not qualify the entire native/Legacy feature set.

Runtime parent: `657fec7c03a17b7eb40c22b227bb0d7126b5bc4d` (A3). Local branch: `dev/t840c9-a4-animated-slot-state`. Read-only author/export authority: Editor A2 `1f76349731e2242376b61880ac427267fd0712b9`. One local runtime commit, no Editor commit, push, merge, tag or publication. The final commit identity is recorded in delivery `COMMIT.json` rather than embedded in its own source.

## Qualified capability

| Family | Author/export | Accepted frame | PixiJS / Phaser WebGL2 |
|---|---|---|---|
| Light RGB and alpha | Linear, Stepped, Bézier | Once per accepted candidate | Actual uniforms and PMA pixels |
| Visibility | Discrete keys | Boolean, attachment retained | Invisible slots omitted |
| Attachment | Named image/mesh or explicit null | Exact name and owner | Region → region → weighted mesh → region; multipage |
| Draw order | Setup-relative signed offsets | Complete slot permutation | Complete prepared draw list, real GPU submission order |

The domain is native v2, one positive-duration looping or nonlooping clip, exactly one fixed default skin, Normal blending, normalized light RGBA, static nonlinked regions/meshes, and existing ReplayV1 Physics. Admission currently requires at least one Physics constraint. No broader zero-Physics presentation claim is made.

`ReplayOptions` adds `{animatedSlots:true}`. It is mutually exclusive with A3 `{weightedFfd:true}`. Default bone-only and A3 admission remain closed to these new channels. Native v1/v2 formats, the Legacy evaluator, FFD A3 sampling, Physics equations and clock scheduling are not changed.

## Implementation map

- `core/src/replay-slots.ts`: opt-in admission, immutable source ownership, detached state validation.
- `core/src/evaluate.ts`: appended channel-only sampler using existing interpolation/draw-order primitives; no new pose evaluator.
- `core/src/replay-animation.ts`, `replay-physics.ts`, `replay-consumer.ts`, `replay-transport.ts`, `index.ts`: capability propagation and complete accepted-frame integration.
- Existing bounded/dynamic-weighted geometry, I2 assets/actor/demo and both double-bank views: consume accepted state, retain existing geometry, texture and resource abstractions.
- `experimental/animated-slots/`: thin PixiJS/Phaser factories, deterministic authentic fixtures, geometry tests and standalone packaging recipe.
- `tools/animated-slots-reference/`: headless native author Save/Reopen/export and independent Rust oracle.
- `core/test/animated-slots.test.ts`: 77 targeted tests.

## Authentic author path

Costume Frog is an isolated, deliberately small author project, not an edit of Crapaud or Jade Sentinel. It has six bones, three slots, five attachment identities, weighted and unweighted meshes, four images on three native atlas pages, animated bones and a Physics spring. The accessory appears/disappears, changes image and topology, fades, and crosses the cape/body in depth.

The Rust author API constructs the native document; the native project codec saves and reopens it with schema equality, rebinds the normally nonserialized inverse-bind cache, and invokes the real unchanged A2 preset/export publication. Native positive JSON is never patched. A second export reproduces every project, asset, native file and reference byte (`AUTHOR-DETERMINISM.json`). This is a headless author/API proof; no new editor GUI authoring qualification is claimed.

## Delivery map

Six reports are in this directory and copied to the delivery root. Delivery `README.md` identifies final evidence, commands, the author project/export, standalone demos, source archive, patch and checksums. `demonstrations-final` is the current-code standalone bundle. `previews` contains real captured animations and a contact sheet, not synthetic render evidence.

## Residual limits

FFD + slots, dynamic skins, linked meshes, clipping, mixing, events, animated dark tint, sequences, non-Normal blending and new constraints remain refused. Direct pure-pose sample/seek preview is refused in A4; explicit replay from origin and reset/stop retain coherent accepted state. Mathematical extrapolation outside normalized RGBA faults before numerical commit. Structural admission is not a general numerical or security certificate. See the other five reports for bounds, transactions and evidence.
