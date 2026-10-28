# T-840C9-A5 — Transactional Animation Events

Verdict: GO for human review of the explicit experimental A5 subset. Runtime parent `61787e1c9b8f30d4bb236fbd9d20a12fdcca069c` (A4), branch `dev/t840c9-a5-transactional-events`. Editor A2 `1f76349731e2242376b61880ac427267fd0712b9` remains read-only. The final local commit is recorded in delivery COMMIT.json. No push, merge, tag, version change or publication.

## Result

Native author events now flow through the existing B6 numerical candidate/commit into a bounded, explicitly drained application queue. PixiJS and Phaser applications receive the same committed events, display counters/accepted ticks, and flash a DOM impact indicator in response to the received native event. Neither view samples event timelines; there is no audio player, RigPlayer instance, additional pose evaluator or second Physics simulation.

Activation is `{animationEvents:true}`, separate from A3 weighted FFD and A4 animated slots. Initial domain: native v2, one positive-duration clip, one fixed default skin, animated bones, existing Physics (at least one constraint), static nonlinked regions/unweighted/weighted meshes, Normal blending, existing atlas pages. Combinations with FFD, animated slots, dynamic skins, clipping, linked meshes, mixing, sequences, dark tint (static or animated), non-Normal blending and new constraints remain refused. Pure seek/sample preview is refused in A5; explicit origin replay remains supported.

## Source changes

- `core/src/replay-events.ts`: native event validation, stable chronological collection, canonical lap windows, detached event envelope and queue capacity.
- `core/src/replay-physics.ts`: privately prepare event queue; swap it in the existing accept step; guarded drain/status. Physics equations and B2 scheduling are unchanged.
- `replay-animation.ts`, `replay-transport.ts`, `replay-consumer.ts`, `replay-slots.ts`, `index.ts`: explicit capability propagation, context/lifecycle guards and public drain/status API. Existing modes remain default-closed.
- Existing bounded/dynamic-weighted admission, assets and both adapters: admit the separately validated event-only source, retain existing geometry/shaders/banks, require current accepted frame authority.
- I2 `ApplicationActor`: forward committed drains with actor identity. Shared demo: opt-in application event display/impact reaction. Ordinary I2/A3/A4 rendering remains unchanged.
- `experimental/replay-events/`: narrow factories, real author/native fixture, Rust vectors, standalone builder.
- `tools/transactional-events-reference/`: isolated native author/export and independent Rust reference generator.
- `core/test/replay-events.test.ts`: 51 deterministic A5 tests. Six reports in this directory.

## Authentic author proof

Signal Frog is an isolated author project derived from the small A4 technical character; no historical project/assets are edited. Six bones, three slots, weighted and static meshes, regions, three atlas pages, animated bones and the existing spring constraint. Clip `signals` lasts 1.5 seconds. Events include preparation, impact, a simultaneous detail, a near-loop cue, exact end, first tick, first positive time, and an ignored origin key. Text includes quotes, backslash, Unicode and newline; native int/float/audio-name/gain/balance fields are preserved.

The tool creates real native schema/document data, uses native Save/Reopen with schema equality, restores the ordinarily nonserialized bind cache, then invokes unchanged A2 preset planning and staged publication. Positive native JSON is never patched. A repeat produces identical author files, assets, native JSON/PNGs, Rust frames and vectors. This proves headless native author APIs, not a new GUI authoring test. The native editor event UI was inspected, not changed.

## Validation

630 workspace tests pass (267 core, 142 Phaser, 215 Pixi, six pixel-policy tests), with 51 A5 cases included. Build/typecheck/syntax, selected C3/N3/B6 checks, A3/A4 geometry and independent B3/B4/B5B2/B6 traces pass. 721 consecutive ticks match Rust with 28 delivered occurrences. Four independent window vectors also pass, including very short and nonlooping clips. 32 real WebGL frames pass independent CPU and cross-engine comparisons. 202 historical I2/A3/A4 framebuffers are byte-identical to accepted evidence. Both autonomous demos pass real RAF, pause/resume, context loss, two-actor and reload/lifecycle tests.

The protected historical map and four extra sealed A2/I2/A3/A4 trees are unchanged; RC2 retains its accepted SHA256. The complete old Q1/G1/G2/N3–N6 campaigns are preserved, not reissued or rerun in full. No ten-minute endurance campaign or Editor workspace/WASM rebuild is claimed. The new Rust reference crate passes fmt and all-target Clippy with warnings denied.

## Remaining limitations

Drain acknowledges the entire returned batch before application processing: at-most-once dequeue, not crash-durable exactly-once effects. Source snapshots are isolated; later mutations of caller-owned input cannot change the admitted timelines. Session IDs are process-local, not persistent security identities. Queue overflow faults before that tick's commit; accepted prefix remains drainable, then reset/replay is required. See EVENT-DELIVERY-CONTRACT.md for deliberate old-queue discard on reset/stop/replay and the other reports for bounds/performance.
