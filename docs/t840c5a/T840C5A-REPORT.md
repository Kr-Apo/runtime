# T-840C5A — real-character acceptance and Phaser triage

Local qualification/diagnostic checkpoint, ready for maintainer review. No product runtime, Editor, format or Legacy implementation change. Two readable native articulated puppets work in both experimental renderers; scope remains fixed-skin/static-region/Physics-only/Normal/WebGL2. No runtime optimization is shipped.

## Bases and architecture

Exact Runtime parent68fd668c065b45815889a4e424b0d3b5351e5c0f, branch dev/t840c5a-real-character-acceptance. Editor reference remains275082e8f26d42389ed05fb92c45e2822006525d. Existing C2/C3/C4/B6 contracts and protected evidence were read and preserved before the new branch. Native author sources -> unchanged Editor Save/Reload/export -> real Rust ReplayConsumer references -> public experimental Pixi/Phaser APIs -> actual WebGL2. One solver/clock per owner; no manually simulated movement or export JSON patch.

## Findings

- Moss Ranger14 bones/12 regions/2 Physics; Clockwork Courier26/21/8,8 hierarchy levels and2 atlas pages. Both have looping march/salute clips of different durations. Native generation and deterministic reproduction pass. These are newly designed rigid paper-puppets, not a preexisting production weighted rig.
-230 final qualification rows pass:148 captures,8 lifecycle/audit cases and74 cross-engine pixel controls. Independent local/world/corner/camera references stay well within fixed limits; pure previews have separate Rust references. Native fault variants retain8/60/52 and last numerical state, and reset safely. Both external strict TypeScript consumers run graphically on Courier. Actual live host-time hitch tests pass.
-224 performance conditions and16 memory configurations complete at1/5/10/25 actors. Complexity increases numerical work as expected. Repeated native WebGL VERSION reads are a major Phaser-specific cost; face projection is duplicated but not the main measured cost. Query caching remains an isolated diagnostic counterfactual, never product code or a promised speedup.
-196 older Phaser failures reproduce exactly on fresh C3 and C5A.181 expectations are obsolete by independent sampling/UV laws,1 synthetic descriptor is incomplete,14 missing-attachment clipping cases remain a reader-policy divergence requiring review. All196 remain original harness failures. No tolerances/oracles/goldens or Legacy implementation were changed.
-Current bodies remain visibly rigid at joints, with some art seams/hat gap and piecewise-linear motion. Ranger Physics is subtle. Mathematical conformance does not certify artistic polish or weighted skinning.

## Changes and validation

Only new author/export/reference fixtures, common optional example, test/profiling/reproduction scripts,8 deterministic fixture tests,6 reports and narrow byte-preservation attributes. Core/Phaser/Pixi product sources and package versions/default exports/dependencies remain unchanged.

Fresh build/typecheck and378 tests pass (core105/Phaser114/Pixi153/pixel6),11 characterizations,14 historical pilot/public tests,5,968 C3 vectors and B3–B6/Legacy trace checks. Fresh real-WebGL regressions pass:752 historical Pixi cases,125 modern cross-engine comparisons plus20 lifecycle controls,50 C4 Phaser scenario rows and10 resource cases. C1 exact/C3 host campaigns retain38 byte-identical raw captures. Final preservation verifies8,467 protected files and unchanged RC2. Browser environment:Chrome156.0.8078.47,RTX3090 through ANGLE/D3D11,WebGL2;Phaser3.90.0/Pixi8.17. Runtime graphics regressions and sealed-reference identity are recorded in the final validation receipts; do not infer an unexecuted suite from accepted C4 history. The unchanged Editor is used for native generation/references only, not a newly run full Rust/WASM suite.

Every setup error, diagnostic difference and retry is retained: initial native output parent missing, baseline type-dependency setup, initial unmatched filtering and intermediate wrong enum, final explicit LINEAR control, plus any final gate incidents. The first exploratory driver recorded cross-engine DIFFERENCE but did not yet gate its exit on them; the final driver requires every row PASS. No unfavorable result is replaced with a convenient counter.

Six reports, captures, native projects/assets, profiles, raw224-condition samples, memory/GC traces, exact-message triage, complete diff and final local Git receipt are in T840C5A-Real-Character-Acceptance. Commit SHA is recorded after creation in LOCAL-COMMITS.json/commit patch rather than self-referential source text. Original repos/branches/remotes, old proofs,207 references, projects and RC2 remain protected. No push, merge, tag, version change, npm publication or release. STOP for review.

[Characters](T840C5A-CHARACTER-QUALIFICATION.md) · [Legacy triage](T840C5A-LEGACY-PHASER-TRIAGE.md) · [Performance](T840C5A-PERFORMANCE.md) · [Capability gaps](T840C5A-CAPABILITY-GAPS.md) · [Next](T840C5A-NEXT.md).
