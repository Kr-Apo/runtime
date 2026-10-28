# T-840C1 — ReplayV1 visual pilot

## Verdict

PASS within the narrow experimental scope: nativev2, static region attachments,
fixed default skin, bone animation and Physics-only. This is a local opt-in test
application, not a distributed runtime activation or a publication. STOP for review.

Editor stays clean on `dev/t840b6-physics-transactions` at
`275082e8f26d42389ed05fb92c45e2822006525d` (no branch/commit/change).
Runtime parent `c83ff72adb9670f4c9df5510c547d3edc2208d7d`, new branch
`dev/t840c1-replay-pixi-pilot`. Local commit receipt accompanies delivery; source
report cannot contain its own final commit hash. Original D: repositories, refs,
configs, protected artifacts and RC2 are checked separately in preservation receipts.

## Audit and architecture

`pixi/src/rig.ts` owns validated assets, page textures, registered views and their
cleanup. `validate.ts::regionRig` refuses all constraints deliberately; `playback.ts`
uses the Legacy player and is NOT used by this pilot. `applyPose` resolves setup
slots, attachment appearance, geometry/UVs, Normal tint, and mesh update order;
`regionQuad` converts core Y-up worlds to Y-down mesh vertices. Bones are baked
into vertex positions; there is no per-bone Pixi Container graph. Root camera is
an ordinary translation/scale. Destroy listeners release geometries/buffers/tints,
and textures are released only after all views are destroyed.

ReplayConsumer is bone-only, not a RigPose. The pilot supplies only setup slots,
attachments and draw order and uses accepted bone locals/worlds, never requested
or pure future samples, to assemble a presentation pose. The original PixiRigInstance
constructor/setPose/disposal and pageTexture are reused. No new renderer/solver.
A strict experimental factory first validates Physics/B4 capabilities and then
reuses the old graphics gate on an in-memory STATIC validation descriptor with
constraints/membership omitted. That descriptor is never exported, displayed or
simulated; original native constraints are retained for both owner and view. The
original PixiRigAsset gate remains unchanged and rejects the same Physics fixture.
The public constructor seam and relative validator/loader imports are deliberately
local experimental integration, not a stable package API. No production file changes.

Pure evaluate at construction computes setup FK with NO EvaluationState, so no Legacy
Physics integration occurs. No playback controller or RigPlayer is accessed. One
ReplayConsumer owns its transport, B4 sampler, B6 numerical instance and B2clock.
Presentation has no access to step/velocities/anchors and cannot advance them.
Snapshots retained for redraw remain detached; render only submits existing meshes.

## Native fixture and references

Replay Scout is newly authored synthetic art and native project data, not a modified
Jade/Crapaud/original fixture. Four bones, three static regions, one secondary spring,
2-second looping `sway` clip (parent translation/rotation, transformed nonuniform
setup parent). Source PNGs have transparent borders. `fault_at_9` is a second genuine
native clip whose scale key makes the Physics parent singular; it tests solver fault.
The Rust helper runs native Save/Reload, actual unchanged native preset/atlas exporter
and ReplayConsumer for721tick-matched frames (0..720). No runtime JSON hand patch.
Rust full region corners come from the native local_corners + accepted world affine.

## Actually executed checks

| Check | Result |
|---|---|
| Runtime build / typecheck / source syntax |PASS|
| Complete existing runtime package/pixel-policy suites |278PASS:90core,69Phaser,113Pixi,6pixel-policy|
| Separate historical characterizations |11PASS|
| Final targeted pilot tests |9PASS (including721Rust reference frames)|
| B3/B4/B5A/B5B1/B5B2/B6 crossed parity re-executed |90/45/50/60/18/33 scenarios PASS|
| Legacy characterization traces |29within-threshold;31accepted divergences retained|
| Existing Pixi region WebGL campaign |33PASS, including trim, load failure/abort and independent sample|
| New pilot WebGL campaign |24captures +1presentation-error check PASS|
| Native generation |Save/Reload/export and721Rust frames PASS|
| Editor full Rust workspace/fmt/Clippy/WASM |NOT_RERUN in C1; editor unchanged; accepted B6 evidence retained|

A RED capacity test fails on missing pilot module, explicitly not a claim of a newly
found Legacy bug. The central GREEN proves requested60/completed8/backlog52 drives
geometry8, not60. Additional tests cover exact30/60/120/144cadences, irregular/hitch,
bounded pumps, observational redraw, pause/resume, stop, seek preview, replay,
reset, two owners, immutable snapshots, actual secondary motion, observer fault,
native solver fault and presentation exception. Twenty real WebGL lifecycle cycles
check old root and geometry-buffer destruction, bounded instance/texture counts.
Final asset destruction leaves zero instances/textures. No browser JS/WebGL warning,
missing/external request or context loss. No new product warning.

The first Rust helper build had wrong fixture APIs and one unused import, followed
by clean corrected generation. A wrong toolchain spelling and unsupported author
field were corrected; first logs retained. No compatibility validator was weakened
to hide an error. A local Python encoding/path mistake did not change protected files.
The diagnostic was refined to label preview displayedTick separately from committed
poseTick and distinguish host/solver/presentation errors; final WebGL verifies it.
All preliminary captures/measurements remain separate from authoritative webgl-release.

## Scope of evidence and limits

GPU readPixels is compared against the SAME existing Pixi presentation fed independent
Rust simulated bone worlds, plus independent Rust region corners transformed to
mesh/camera space. This proves temporal/data mapping, not an independent CPU Physics
pixel renderer. Existing CPU Physics export refusals are not bypassed. No207historic
golden replaced; only the33existing region WebGL scenarios were freshly rerun, not
all historical graphics suites. Real GPU tested on one Windows/NVIDIA/Chrome setup.
No broad hardware, mixed solvers, crossfade, FFD, visual skin switching or event claim.

B6 state rollback is preserved; reset remains required after fault. Presentation
exceptions do not undo committed ticks or external GPU effects. Host real-time
microsecond quantization is isolated and approximate, not canonical parity. Per-tick
B6 maps and B5B2 detached snapshot copies remain; memory data is limited and not a
leak/driver allocation certification. See the five companion reports and full diffs.
