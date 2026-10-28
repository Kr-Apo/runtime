# ReplayV1 capability boundaries

Qualified means the named subset was exercised; it does not mean all assets or hardware are supported. C4 does not turn Legacy features into Replay features.

| Capability | Core ReplayV1 | Pixi experimental C2/C3 | Phaser experimental C4 | Legacy readers |
|---|---|---|---|---|
| Native v2 bone transformations | Canonical sampler | Qualified subset | Qualified subset, including animated parent nonuniform scale | v1/v2 retained |
| Physics-only | Transactional120Hz | Qualified | Qualified real WebGL2 | Phaser accepts with existing unqualified Physics warning; Pixi rejects Physics |
| Exact/rational time | Yes | Yes | Same consumer | Existing Legacy sampling policy |
| Absolute host time | Shared C3 bridge | Shared C3 | Shared C3 | Legacy update semantics unchanged |
| Fixed default skin/static regions | Numerical membership plus graphical adapter | Qualified | Qualified | Broader existing skin/attachment support |
| Normal blend/setup RGBA/setup draw order | Graphics independent | Qualified | Qualified | Existing renderer capabilities retained |
| Multi-page PNG atlas | Graphics independent | Qualified | Qualified2 pages and failure cleanup | Existing |
| WebGL2 | No renderer | Required | Required, explicit Game context | Broader Legacy context declarations unchanged |
| Canvas/WebGL1/WebGPU | No renderer | Refused/not qualified | Refused | Not newly certified |
| Extra visual skins | Numeric skin calendars exist | Refused | Refused | Existing switching; not a Replay qualification |
| Rigid/weighted meshes, linked meshes, FFD | Outside Replay graphical subset | Refused | Refused | Existing qualified Legacy subset; not extended |
| Clipping | Outside subset | Refused | Refused | Existing Legacy stencil/mask subset retained |
| Slot/attachment animation, animated draw order | Unsupported in selected Replay policy | Refused | Refused, including unused clip channels | Existing Legacy support |
| Dark tint, advanced blending | No renderer | Refused | Refused | Existing qualified Legacy subset |
| IK/Transform/Path mixed constraints | Outside contract | Refused | Refused | Existing partial/unqualified cases, no new guarantees |
| Crossfade/layers/gameplay events | Outside selected Replay contract | Refused | Refused | Existing Legacy capabilities retained |

Strict refusal is tested before graphical instance creation and before unnecessary page requests. All clips must satisfy the gate. Native v1, missing/empty clips, invalid references or nonfinite Physics parameters fail. No input is stripped to manufacture compatibility. Legacy entry points keep their historic capabilities, errors and warnings.

C4's125 modern Legacy Phaser/Pixi parity cases pass. Several older specialized Phaser harnesses fail equally on C3 and C4: stale UV assertions, filtered transparent borders and animated clipping references. They remain visible technical debt, not newly certified features. See [regression](T840C4-REGRESSION.md).
