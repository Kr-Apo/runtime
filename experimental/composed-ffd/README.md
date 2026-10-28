# ReplayV1 composed weighted FFD — A8 experimental

Two independently qualified, explicit capabilities:

```ts
new ReplayConsumerBridge(native, clip, epoch, undefined, {weightedFfd:true, animatedSlots:true});
new ReplayConsumerBridge(native, clip, epoch, undefined, {weightedFfd:true, animatedSlots:true, clipping:true});
```

Gate A requires native v2, one clip and fixed default skin, Normal, existing Physics, one nonempty weighted/nonlinked FFD target with fixed topology/binds/influences. Its setup slot must display that exact attachment. Any target attachment key selecting a different name or null is refused, even while invisible. Other slots may animate color/alpha, visibility, attachment/null and order. Target visibility/alpha do not change numerical deformation.

Gate B additionally requires actual rigid simple A7 clipping masks. FFD on a mask, events, dynamic skins, linked meshes, mixing, sequences, dark/nonNormal and other constraints remain excluded. A3/A4/A7 standalone gates stay closed to unapproved combinations.

Admission-only private projections reuse the existing A3 and A4/A7 validators. The slot projection excludes only deform tracks. The FFD projection excludes slot/order tracks and, for B, mask entries already strictly validated by A7. No native source geometry, UV, weight, bind or author file is changed. Original source is detached; no fake region replacement.

One B6 candidate owns bones/Physics/FFD/slots/order at one tick. Channel sampling and validation happen before numerical acceptance. An invalid slot state or sampled FFD rejects the whole candidate. Graphical failure after commit retains accepted numerics and old front, allowing retry without advancing Physics.

Presentation order: accepted per-influence author offsets → inverse-influence/host-setup **linear vector** mapping → accepted Physics bone skinning/weight normalization → world geometry → slot selection/color/order → atlas projection → A7 polygon cut with UV interpolation → inactive-bank GPU submission → front publication. Existing setup FK is used once at construction to derive immutable bind-linear mappings; no timeline or Physics reevaluation occurs during present.

DeformGeometry caches only the exact owned attachment in composed mode. Same vertex count never confers ownership; other weighted meshes use ordinary weightedPoints. Source offsets are absolute relative to native binds, not accumulated into a previous deformed pose. Hidden targets still carry/validate current deformation.

Use loadPixiAsset/createPixiActor or loadPhaserAsset/createPhaserActor from this folder, with optional `clipping:true` for B. The factories reuse existing ApplicationActor, views, double banks and borrowed atlas pages. They are application pilots, not Q1 certification or automatic Legacy activation.

Author/reference tool: tools/composed-ffd-reference, using unchanged sibling editor A2 at1f76349731e2242376b61880ac427267fd0712b9. Run its Cargo manifest with NEW_OUTPUT and optional a/b. Save/reopen schema equality, real native export and721 independent Rust FFD/slot/Physics/clipping states. Native positive JSON is never patched. Headless API evidence, not GUI authoring qualification.

Build runtime, then `node experimental/composed-ffd/prepare-demo.mjs NEW_OUTPUT DEPENDENCY_RUNTIME CORE_DIST a` (or b). Run the generated static HTTP server; both pages include local dependencies/notices. Play/Pause/Resume/Reload and accepted target/offset/mask status.

Tests: core/test/replay-ffd-composition.test.ts, core/test/replay-ffd-clipping.test.ts, and `node --test experimental/composed-ffd/geometry.test.mjs`. The separate T840C9-A8-Composed-Weighted-FFD delivery contains gate-specific numeric/CPU/GPU/transaction/lifecycle/profiling receipts and recordings. No historical golden, certificate, solver, editor or format change.
