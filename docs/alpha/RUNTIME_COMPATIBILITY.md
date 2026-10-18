# Runtime compatibility

Scope: the compiled local PixiJS adapter in this archive, PixiJS 8.17.0, desktop
WebGL2, native runtime v2. Editor model support is not equivalent to runtime
rendering support. Historical Phaser proof does not establish new Pixi coverage.

| Feature | Candidate status | Evidence and boundary |
|---|---|---|
| Native v2 | Supported and qualified | Real GUI export; core v1/v2 reader retained, adapter explicitly requires v2 |
| Regions, rigid/weighted meshes | Supported and qualified subset | CPU/GPU positions and pixels; valid authored topology and nonsingular influence setup |
| FFD | Supported and qualified subset | Matching per-vertex or per-influence offsets, independent time curves; Jade two meshes/two clips |
| Compatible dynamic skins | Supported and qualified subset | Existing same/multipage switching tests; default fallback and compatible FFD dimensions, not arbitrary retargeting |
| Light and static dark tint | Supported and qualified | Normal PMA equation; dark alpha is shadow strength, not opacity; no dark-color animation API |
| Normal blend | Supported and qualified | Transparent and opaque references |
| Polygon clipping | Supported and qualified subset | Sequential simple convex/concave polygons and inclusive end slot; a new mask replaces the old mask |
| Playback, looping, speed, events | Supported and qualified | Jade 29 controlled transport/event steps and two instances |
| Crossfade | Supported and qualified subset | Distinct clips and FFD; see interruption limit below |
| Trimmed, multipage atlases | Supported and qualified subset | Nonrotated native pages; historical page switching, source-texel/fringe comparisons |
| Add / Multiply / Screen | Explicitly rejected | Normal only; do not waive export fidelity warnings to force them |
| IK / transform / path / physics constraints | Explicitly rejected | Constraint arrays/order must be empty; physics state and deterministic stepping not qualified here |
| Linked meshes | Explicitly rejected | Resolve authoring before target qualification; adapter does not implement links |
| Mesh image sequences | Explicitly rejected | Region sequence support does not imply mesh-sequence support |
| Multi-skin composition | Not supported | One explicit skin with default fallback |
| Nested mask intersection | Not supported | Sequential replacement is not intersecting nesting |
| Rotated atlas regions/pages | Explicitly rejected | Native preset disallows rotation |
| WebGPU / Canvas | Outside contract / rejected at render | Select WebGL explicitly |
| WebGL1 | Not qualified and excluded | Demo requires WebGL2; adapter's generic WebGL gate is not a WebGL1 certification |
| Mobile, large production rigs | Not tested as a general guarantee | Small desktop technical rig measurements are not a mobile/performance budget |

## Crossfade interruption

The outgoing track is the **previous incoming clip**, not a snapshot of the
currently blended pose. The Jade Sentinel controlled test observed a vertex
component jump up to **11.8049 world units** on interruption. Finish the fade
before starting another if continuity is required. This is a verified limitation,
not a claim of a newly corrected blend model.

## Events and clock

Events at **t=0 are ignored, including loop boundaries**. Positive-time events
use (from,to], stable order for ties, incoming only during fades. Replay continuous
steps from reset when testing transport; direct seek does not produce events.
Finite nonnegative delta and positive speed are required. There is no automatic
sound playback, completion callback or hidden fixed timestep in the adapter.

## Evidence scope

Accepted qualification includes 752 historical Pixi scenarios, 256 targeted trim
fringe scenarios, 32 Jade Rust CPU images and 29 controlled transport steps.
Jade's 6-instance desktop run lasted 180 seconds with stable buffer/texture counts;
it does not establish a universal frame rate or support for excluded features.
The release validation report distinguishes re-executed tests from preserved
accepted evidence. A clean-machine trial of this exact ZIP is a separate gate.


---
Source-tree note: file locations and runnable browser examples above refer to
the extracted RC2 archive. Download the [complete alpha archive](https://github.com/Ankhimate/ankhimate/releases/download/alpha-2026.10.18-rc2/Ankhimate-Editor-PixiJS-Alpha-RC2.zip).
Source files here document that same API; GitHub does not execute the demo.
