# Capabilities and level of evidence

| Capability | Core ReplayV1 | Pixi fixed C2 | Pixi dynamic C6A | Pixi static C7A | Phaser experimental C6B | Legacy readers/renderers |
|---|---|---|---|---|---|---|
| Native v2 / Physics-only bone clips | qualified numerical | qualified regions | qualified regions | qualified regions+rigid meshes | qualified regions | separate Legacy policy; no new Physics parity claim |
| Unweighted local static meshes | passive data; no vertex output | refused | refused | qualified, fixed default skin | refused | existing mesh contracts, historical tests retained |
| Weighted meshes/inverse binds | not a Replay vertex capability | refused | refused | refused | refused | existing qualified subset; unchanged |
| FFD / vertex animation | clip channels refused | refused | refused | refused | refused | existing subset; unchanged |
| Visual skin calendar | qualified B5B1 | refused | qualified region-only | refused | qualified region-only | Legacy skin APIs, independent of Replay |
| Linked meshes | not qualified | refused | refused | refused | refused | Pixi refused; Phaser limited Legacy path, not newly certified |
| Clipping | not a Replay output | refused | refused | refused | refused | historical Legacy clipping subset only |
| Dark tint / Add/Multiply/Screen | not the Replay visual contract | refused | refused | refused | refused | pre-existing tests/capabilities; not broadened |
| Pure preview / origin replay / host bridge | qualified B/C3 | preserved | preserved | qualified vertices with completed tick | preserved | separate Legacy transport |
| Slots/draw-order/events/layers/crossfade | not enabled by this Replay clip contract | refused | refused | refused | refused | separate supported Legacy APIs; no new qualification |

“Passive data” is not a promise of presentation or a new solver feature. Source reader acceptance is distinct from adapter capability validation. C7A requires opt-in, one default skin, native static UV/index/local arrays and an actual WebGL2 renderer. There is no automatic downgrade of weighted/linked/FFD data.

New evidence: two independently saved/reloaded/exported native author projects,2,884 full Rust/TS committed poses,108 WebGL controls with102 submitted-buffer/pixel captures, strict refusal tests, external public consumer and24 measured workloads. Historical evidence:752 Pixi scenarios,125 modern comparisons plus20 lifecycle, C1–C6B and accepted protected oracles. The196 Phaser and31 Legacy failures remain explicit historical debts. No claim is made for unsupported channels, general hardware, mobiles, WebGL1, WebGPU, dynamic meshes+skins or newly validated Legacy features.
