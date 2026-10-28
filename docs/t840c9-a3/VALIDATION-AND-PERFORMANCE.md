# Validation and performance

## Automated checks

Full `npm test`: **502 pass, 0 fail** (core139, Phaser142, Pixi215, pixel policy6); the accepted baseline was468. New A3 core cases total34. Independent geometry suite adds10 cases. `npm run build`, `npm run typecheck`, source syntax checks, reference-crate locked/offline execution, rustfmt check and Clippy `-D warnings` pass. No new product warning is introduced. Editor A2 is read-only; its accepted Rust/WASM workspace results are preserved, not represented as rerun by A3.

The 721-tick numerical run and22 selected core/geometry references cover nonlinear transitions, Stepped boundary, impact, rest, loop,2/3/5 influences, zero coefficient, nonunit sum and rigid fallback. Negative data cover owners, linked/dynamic skins, missing attachment, unsupported channels, dimensions, nonfinite/negative/zero-total weights, bones, vertices, UVs, topology, duplicate owners, curves, key ordering, invalid option, stale context and another clip.

B3/B4/B5B2/B6 production numerical comparisons pass, with traces byte-identical to accepted N6 results. B6's existing54 private fault injections and C3 exact host-time vectors pass. N3/N4/N5/N6 admission/identity/sealing/fault/proxy checks and Q1 offline/browser-proof checks are rerun against their historical evidence. Their old compiled identities stay bound to their old certificates: this does not issue new Q1 authority for A3. New-core historical behavior is tested separately by the current workspace tests, numerical trace comparisons and72 real I2 GPU comparisons.

Windows global Git autocrlf converted freshly checked-out B3 fixtures; the exact-byte driver initially refused those checkout bytes. Only this new worktree's temporary fixture copies were restored from the unchanged Git blobs for that test, then returned to checkout line endings; no reference change is staged. Fresh dependency junctions also caused the static-module server to refuse URLs outside its root; local ignored dependency copies and an initial workspace build corrected test setup. B6's test-only import rewriting requires the ordinary double-quoted import convention, which is retained. Two Q1 invocations initially used the wrong configuration file; corrected accepted/approved-final inputs are recorded separately. All failed logs remain available, rather than being labeled product regression successes.

## Short performance and lifecycle

One and two actors each run600 actual ticks (5 seconds of simulated time), then40 measured repeated submissions, including GPU timer queries. Real RAF playback is separately tested beyond tick500, with UI pause/resume and no external tick commands. No new10-minute endurance campaign is run.

| Engine / actors | Median numeric CPU ms | Median present+draw CPU ms | Median GPU ms |
|---|---:|---:|---:|
| Pixi /1 | 0.10 | 0.30 | 0.006144 |
| Pixi /2 | 0.10 | 0.60 | 0.009216 |
| Phaser /1 | 0.10 | 0.50 | 0.016896 |
| Phaser /2 | 0.10 | 1.00 | 0.032768 |

Each actor reaches two cached meshes (one fixed identity per bank), with no growth across the remaining samples. Every created mesh and consumer is disposed. Post-GC heap deltas after shutdown range0.83–1.05MB; browser/framework/JIT/metrics allocations remain, so this is **not a zero-allocation or universal leak-free claim**. All individual timing/resource samples are retained; results apply to this small fixture and machine only.

Context loss/restoration, immutable numerical state while paused, repeated redraw, prepared-front failure, post-submit error and retry, shared atlas, peer isolation, five reloads, canceled/missing/concurrent loads, shutdown during load, Scene stop and Game destroy pass. Deliberate context-loss/404 messages are distinguished from unexpected warnings/errors. No cloud inference, new model, publication or original-project editing occurs.

## Evidence map

The local `T840C9-A3-Weighted-FFD-Replay` delivery contains `author-final/`, `NUMERIC.json`, `graphics-final/`, `pixel-comparisons-final/`, `historical-i2-graphics/`, `transactions-final/`, `lifecycle-final/`, `visual-sequence/`, `performance/`, `regressions/`, `admission-regressions/`, the six reports, drivers, source/patch and SHA256 manifests. Initial failed/setup experiments are separate and retained. Final Git/commit and preservation receipts identify exactly what was tested and committed.
