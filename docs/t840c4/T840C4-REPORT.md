# T-840C4 — ReplayV1 Phaser experimental integration

**Local implementation qualified for the declared subset; ready for human review.** This does not certify every historical Phaser harness or authorize distribution. Inherited specialized Phaser failures are explicitly retained below and in [regression](T840C4-REGRESSION.md).

## Bases and prior audit

Runtime starts exactly at b7e6f984deb22b77a675c7e68bc63ec169974869 on new local dev/t840c4-replay-phaser-integration. Editor stays275082e8f26d42389ed05fb92c45e2822006525d. Phaser source audit/proposal preceded implementation (WORKING-API-PROPOSAL.md in delivery). Phaser 3.90.0 has Game-owned textures, Scene lifetimes, Mesh/Face/Vertex projection and a WebGL1 default; Pixi containers/resources cannot be transplanted. Native UV trim/alpha conventions and Legacy renderer capabilities are reused.

## Changes

- Additive public @ankhimate/phaser-runtime/experimental-replay export, strict original-source/all-clips gate, staged native atlas loader and explicit Game/Scene/instance ownership.
- One actual ReplayConsumer per character; shared unchanged C3 HostTime bridge. No new clock, solver, sampler, constraint schedule or default activation.
- Minimal internal presentation-only path in existing PhaserRig, bypassing Legacy playback construction only behind an internal token. Same region geometry, atlas/UV/alpha/draw pipeline. Public Face projection synchronizes prerender with the committed pose.
- Immutable context/owner-bound snapshots, separate pure preview, explicit updates, bounded backlog/pump, numerical/presentation failure separation and cached redraw safety.
- Independent public Phaser Scene demo, strict external TypeScript consumer, native animated-scale fixture and reproducible browser/performance/memory scripts.

## RED/GREEN and results

Entry missing RED -> public ESM export GREEN. First-render RED camera error1.17604 -> final maximum3.1455099e-05 with unchanged0.02 limit. Cached presentation after atlas removal RED -> refusal GREEN without faulting Physics.

370 tests, build/typecheck,11 characterizations,14 pilot/public tests,5,968 time vectors and B3–B6/Legacy trace preservation pass. C4:50 scenario rows/46 capture pairs across two native fixtures,10 load/resource cases,1 external compiled TS application and1 actual Scene.update live-clock check.125 modern Phaser/Pixi parity scenarios/20 lifecycle checks and752 historical Pixi scenarios pass.38 accepted C1/C2/C3 raw captures remain byte-identical.

Older specialized Phaser harnesses still fail21/21,8/32,153/153 and14/74 cases respectively; all semantic outcomes independently reproduce on untouched C3. They were neither repaired nor hidden. This is inherited debt, **not a completely green historical Phaser campaign**. Initial failed attempts and setup incidents are retained in delivery.

## Boundaries and ownership

Only native v2, all-clips-compatible bone transformations, Physics-only constraints, one fixed default skin, static regions/setup slots, Normal blend and actual WebGL2. No meshes/FFD/clipping, mixed constraints, visual skin changes, dark tint, advanced blending, animated slots/order, events, crossfade/layers or WebGL1. Game owns loaded pages through its asset; Scene shutdown disposes instances but permits asset reuse. Each owner has independent numerical and mutable graphical state. External GPU effects are not transactional; device-loss recovery is unqualified.

Measured1/10/25 characters remain stable; see [performance](T840C4-PERFORMANCE.md). Timing categories disclose snapshot/mapping and buffer-instrumentation boundaries rather than asserting unavailable pure-stage measurements. Small rigs do not predict production character costs.

5,560 protected files, Editor, original projects,207 references and RC2 unchanged. No new full Rust suite, manual Editor trial or broader hardware qualification is claimed. Commit, complete binary diff, per-file hashes, initial/final Git receipts and all logs/captures are in the separate delivery folder. One local targeted commit is prepared after validation; its exact SHA is recorded in LOCAL-COMMITS.json and runtime-commit.patch, avoiding self-referential commit hashes in source documentation.

See [API](T840C4-API-CONTRACT.md), [capabilities](T840C4-CAPABILITY-MATRIX.md), [WebGL](T840C4-WEBGL-QUALIFICATION.md), [regression](T840C4-REGRESSION.md), [next](T840C4-NEXT.md). STOP after C4 for review; no follow-up feature implemented or publication performed.
