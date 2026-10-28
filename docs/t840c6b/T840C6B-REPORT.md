# T-840C6B — local implementation and validation

Verdict: ready for maintainer review of the bounded experimental Phaser dynamic-skin path. No public release or wider alpha compatibility is implied. STOP after the local checkpoint.

## Base and architecture

Started clean at runtime d892e1bfd8acba725bbbacfaf42b1e82b747e9e9 on dev/t840c6a-replay-visual-skins-pixi; new branch dev/t840c6b-replay-visual-skins-phaser. Editor remains 275082e8f26d42389ed05fb92c45e2822006525d on dev/t840b6-physics-transactions. Initial HEAD/refs/remotes/config and protected artifacts were checked before edits. No GitHub main/fetch/merge/push/tag/version/publication.

Read the six C6A reports, C4 API and C5B safety contracts, actual adapters, native resolution and B5B1/consumer code. The preimplementation proposal was to reuse the existing calendar constructor and same-snapshot skin/bones, while extending only Phaser's internal presentation facade. There is no need for a core bridge change. Different graphics/ownership lifecycles justify separate small adapters; a shared refactor would unnecessarily touch qualified Pixi code.

Two production files change: phaser/src/experimental-replay.ts and phaser/src/phaser.ts. The first adds the C6A opt-in flag/calendar shape, all-skin validation, native absence layout, same-token skin, TextureSource identity guard and retry protection. The second minimally extends the existing internal facade to apply a selected appearance without Legacy playback, deferring dynamic initial setup to the first valid token and retaining the public Face projection. Fixed/Legacy defaults, projection/UV/shader algorithms and package entry are preserved. Supporting files are19 new tests, the example, drivers/reproduction and these six reports. No native fixture, format, evaluator, core or Pixi change.

C4 intentionally refused multiple skins. Its view also applied setup before token presentation and used its fixed appearance; admitting a multi-skin JSON alone would not implement temporal authority or legitimate absence. The three initial RED tests fail on that gate before modification. The new facade presents the canonical committed appearance with its bones. It never chooses by requested time or calls Legacy setSkin.

[Contract](T840C6B-SKIN-CONTRACT.md) · [WebGL](T840C6B-WEBGL-QUALIFICATION.md) · [Resources](T840C6B-RESOURCE-LIFECYCLE.md) · [Performance](T840C6B-PERFORMANCE.md) · [Next, not started](T840C6B-NEXT.md).

## Validation

- 425 Runtime tests PASS: core105,Phaser142,Pixi172, pixel-policy6, including 19 new Phaser regressions and all406C6A tests. Build/typecheck,11 characterizations,14 public/pilot tests, syntax and historic fixture checks PASS. Tests cover exact skin boundaries, all2,884 Phaser/Rust poses, B6 faults, invalid calendars/references, absence/fallback, stale/foreign/forged tokens, previews, callbacks, partial presentation/retry, shared resource and destruction behavior.
- 210 main real-WebGL rows PASS (206 framebuffer/numeric comparisons and 4 lifecycle rows), plus 16two-actor rows (14 framebuffer/numeric,2 lifecycle). Maximum geometry error0.00006485 unit, screen projection0.00008147 pixel; both below original gates.63,920 uniform source-PNG texel samples in the main campaign have zero errors above 3 RGBA8 units. Actual Vertex.load submission and atlas bindings are verified.
- 184 comparable PixiJS C6A captures PASS with unchanged tolerances.22 extra Phaser captures have no equivalent old Pixi capture: complementary checks are explicitly NOT_RUN, while their independent Rust/source-PNG checks pass.
- 21 dynamic WebGL safety cases PASS, including actual context loss/restoration and Scene restart at Night40;12 loading/ownership/retry scenarios PASS; strict external TypeScript public consumer builds/runs real WebGL2.
- Ranger and Courier each execute1,800 repeated transitions across 36,000 ticks (300 seconds SIMULATED, accelerated), with paused/replaying/dephased actors, peer disposal and recreation. No growing meshes/Face/Vertex arrays; independently replayed final pose/records match byte-for-byte. No GL buffers created during those transition campaigns; final owned resources and listeners released.
- C5B/C6B fixed and same-data constant-opt-in performance at 1/5/10/25 actors, actual multi-skin schedules, reverse ordering controls, phase counters and allocation/GC profiles are retained. Zero steady-state VERSION queries. Large run variation is reported rather than interpreted as a guarantee or masked with an optimization.

## Preserved historical evidence

Fresh runs preserve752 Pixi scenarios;125modern comparisons plus 20 lifecycle rows;230C5A character rows;20C5B WebGL safety cases; C1/C3/C4 controls;5,968C3 vectors; all B3/B4/B5A/B5B1/B5B2/B6 traces.148 character RGBA captures +38C1/C3 controls are byte-identical to accepted evidence. C6A's188WebGL rows and 184 PNGs pass unchanged, with byte-identical captures; its1,800transition endurance and package tests also pass.

The196 Legacy Phaser failures retain exact signatures/classification (181 stale expectations,1 incomplete descriptor,14 missing-attachment policy divergences).31 Legacy numerical divergences remain failures. No oracle/threshold/golden replacement.19,235 protected files, including 207 historical graphical references, author projects, native exports, previous sealed deliveries and RC2, are hash-identical. Both original D: repos and the Editor workspace remain unchanged/clean; existing branches/remotes/config preserved.

RC2 SHA-256:a1c9835fbe83468f6e87bdd5676965a45210c4913305fc18b72c9d426b9553c0. New product warnings:none. Existing engine context-loss warnings and expected refusals are retained injection evidence. Rust workspace/WASM are NOT_RUN: no Rust/core/Editor changes; accepted C6A native projects, Save/Reload provenance and independent Rust references are reused exactly, not presented as new manual authoring qualification.

## Incidents and limits

Retained initial failures: an endurance inventory queried a disposed transport; the driver now records disposed state without reading it. A complementary Pixi comparison was launched before preparation had created its script, producing two MODULE_NOT_FOUND logs; final preparation/comparison completed and passed. Initial phase profiling lacked the default public Phaser entry in the new example import map; the map was completed and the final profile passed. No product numeric/renderer changes or tolerance relaxation were used to repair these driver issues. All initial logs/results remain.

Only native v2 static regions/setup slots/order, nonempty Physics-only, Normal blend, validated immutable skin calendars, exact/C3 time and real WebGL2 are newly qualified. Mesh/FFD/clipping/sequences/animated slots/order/dark tint/advanced blend/mixed constraints/crossfade/layers/events remain refused. Shader/UV algorithms, core/Pixi/Editor and RC2 are untouched. Successful CPU presentation is not GPU atomicity. One browser/GPU, one controlled loss cycle, accelerated simulated endurance, variable CPU latency and observable allocation churn do not certify general device recovery, FPS, VRAM or absence of all leaks.

Commit/hash/full diff/patch and final clean Git receipts are supplied in delivery after local commit, without embedding a self-referential hash in the source report.
