# T-840C6A — local implementation and qualification

Verdict: ready for maintainer review of the bounded experimental PixiJS visual skin capability. No public-release or broader feature/hardware qualification. STOP after this checkpoint.

## Baseline and scope

Runtime started clean at accepted C5B c3454f329d865373dd3515596348c8961e947c26, branch dev/t840c5b-phaser-webgl-validation; new branch dev/t840c6a-replay-visual-skins-pixi. Editor remains 275082e8f26d42389ed05fb92c45e2822006525d on dev/t840b6-physics-transactions, unchanged. The final local commit receipt/diff is delivered separately to avoid a self-referential commit hash. Prior refs/remotes/config are verified. No push/merge/tag/npm/version/release/Actions change.

Only two production files change: pixi/src/experimental-replay.ts (explicit visualSkins option, canonical calendar forwarding, same-token appearance/pose, native absence resolution, resource identity checks and failed-presentation retry), pixi/src/rig.ts (small internal facade into existing region presentation, bypassing Legacy playback). No core/Phaser/Editor source change; no renderer/shader/UV algorithm replacement. Supporting changes are 19 tests, six reports, new native fixtures/example, reproduction/browser/performance drivers and narrow -text Git attributes preserving native fixture bytes. See full binary diff and changed-file hash inventory in delivery.

## Audit and design

B5B1 calendar and B5B2 consumer already expose everything needed: an immutable calendar constructor argument and skin attached to committed snapshots. No shared-core correction or second calendar is needed. C2's original single-default-skin refusal was intentional; passing the new native multi-skin fixtures to it is the preimplementation RED. Simply calling Legacy setSkin would bypass Replay temporal authority and can invoke a Legacy controller; the internal facade instead submits the validated snapshot skin with the same snapshot bones to the existing slot/mesh cache.

Native selected/default fallback, legitimate absence and constraint memberships differ. They are audited independently. The new gate validates all skins/clips and rejects unresolved global references while permitting an attachment genuinely absent in the selected/default pair. This policy is opt-in only;14 historical Legacy policy divergences are preserved. All advanced Replay refusals remain; no unsupported channel is removed from native source to make validation pass.

[Skin contract](T840C6A-SKIN-CONTRACT.md), [capabilities](T840C6A-CAPABILITY-MATRIX.md), [WebGL evidence](T840C6A-WEBGL-QUALIFICATION.md), [resources/performance](T840C6A-RESOURCE-PERFORMANCE.md), [next work, not started](T840C6A-NEXT.md).

## Tests and independent evidence

- RED:3 opt-in tests fail before modification against the fixed-skin gate. GREEN:19 new deterministic tests plus all previous package tests;406 Runtime tests (core 105,Phaser 123,Pixi 172,pixel-policy 6), all pass. Build/typecheck/syntax pass.11 characterization and 14 public/pilot tests pass.
- 2,884 full committed poses (2 characters×2 calendars×721 ticks) compare native Rust bone locals/world matrices, active spring records, visible native-resolved slots and same-tick graphical skin. Additional tests cover invalid/mutated calendars, backlog, pause/resume, preview/replay/reset, real B6 faults, unknown attachments, unsupported skins/channels, stale/forged/wrong-kind tokens, destroyed/replaced/dimension/PMA pages, callback races, controlled presentation errors, bounded resources and independent disposal.
- 188 new real-WebGL rows, including 184 framebuffer/numeric comparisons and 4 independent-lifecycle rows, pass.57,428 source-PNG uniform foreground texel samples have 0 RGBA8 errors above 3. Maximum geometric vertex error 0.00006485 unit, world translation0.00005789 unit, spring field0.00004229 unit; below 0.01. UV error 0.00000002932. Pure previews are explicitly separate from simulated Physics. Reference/threshold details and retained development incidents are documented.
- 12 new real-WebGL presentation/resource cases +2 actual PNG decode failure/cancellation cases pass. External standalone strict TypeScript consumer imports public exports only, builds and runs WebGL2. Ownership tests verify ordinary cleanup; GPU external side effects are not transactional.
- 1,800 repeated transitions across 36,000 ticks (300 seconds SIMULATED time, accelerated) retain 21 meshes/21 geometries/63 buffers/4 pages; independently replayed final bones/records match byte-for-byte. This is not a5 minute live soak.
- Equivalent fixed-mode C5B/current measurements at 1/5/10/25 actors, repeat 25 order control; new simultaneous/delayed skin workloads separately measured; raw latency, allocation/GC traces and disposal evidence retained. No new full-renderer reconstruction. No generalized FPS/VRAM bound claimed.

## Historic non-regression

Fresh campaigns preserve 752 Pixi historical cases;125 modern Phaser/Pixi comparisons plus 20 lifecycle cases;230 C5A character rows;20 C5B real WebGL safety cases; C1/C3 and C4 default/scaled/resources;5,968 C3 vectors. B3/B4/B5A/B5B1/B5B2/B6 traces are byte-identical to accepted outputs.148 character RGBA captures plus 38 C1/C3 controls are byte-identical. All196 Legacy Phaser failures retain their signatures/classification (181 stale expectations,1 incomplete descriptor,14 missing-attachment policy divergences).31 Legacy numerical divergences remain unchanged; they are not relabeled PASS. No oracle or tolerance changed.

15,595 protected files are hash-identical, including 207 original graphic references, previous native exports and sealed deliveries. RC2 SHA-256 remains a1c9835fbe83468f6e87bdd5676965a45210c4913305fc18b72c9d426b9553c0. Both D: original repos and the Editor working repo stay clean at original heads/remotes. The separately archived C5B baseline source is byte-identical to its commit. No new product warnings; context-loss warnings in the unchanged C5B injection campaign are retained expected evidence. Full Editor Rust workspace/WASM are not rerun or newly claimed: Editor/core are unchanged; the new standalone native helper is formatted, compiled offline/locked and reproduces its outputs byte-for-byte.

## Limits and review boundary

Static regions/setup slots/order, bone-only clips, Physics-only, Normal blend, native v2, default fallback and a predeclared immutable skin calendar only. No meshes/FFD/clipping/animated slots/order/sequences/dark tint/advanced blends/mixed constraints/crossfades/layers/gameplay events. C2 fixed mode remains the default; Phaser gains no capability. Single Chrome 156/Pixi 8.17/RTX3090 WebGL2 evidence, not multi-browser/context-loss certification. Graphics failures preserve numerical state and successful-token authority; a driver/GPU can still expose partial visual effects. Allocation churn from safe detached snapshots remains measured technical debt. The example fixtures are deterministic headless-native authoring evidence, not a manual artist test. All later tasks in NEXT require separate authorization.
