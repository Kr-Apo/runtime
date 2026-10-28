# T-840C7A — Static unweighted meshes / PixiJS ReplayV1

## Result and scope

GO for review of this narrow local experimental capability. Source checkpoint 3bfff8bf58e76995f976d7bf4bc61baa2c155a53; local branch dev/t840c7a-replay-static-meshes-pixi. Editor remains 275082e8f26d42389ed05fb92c45e2822006525d on dev/t840b6-physics-transactions. No push, merge, tag, version or publication operation.

The only production source changed is pixi/src/experimental-replay.ts. It adds staticMeshes:true to the existing asset API, retains the one-fixed-default-skin gate, refuses weights/linked/vertex animation, reuses the existing internal Pixi view and C6A page/source pinning and retry protections, and rejects cached presentations during a known WebGL context loss. No numerical core, MeshBinding/MeshAtlas algorithm, Phaser, Editor, export format or RC2 modification. pixi/README.md documents the additive mode. Other additions are the C7A test, six reports, scripts/t840c7a and examples/replay-static-meshes with new author/native fixtures.

## Audit and architecture gate

The proposal was recorded before product changes in the delivery ARCHITECTURE-BEFORE-IMPLEMENTATION.md. Native MeshAttachment::from_region bakes attachment offsets, pivot, rotation and scale into bone-local setup vertices; schema/export carry vertices/UV/indices directly for empty weights. The ReplayConsumer bone output already suffices. No new solver, bone hierarchy or vertex output was added. Existing appearance-local immutable geometry/atlas crop plans and per-instance buffers are reused. Working vertex coordinates and world arrays still incur the existing renderer's per-pose work; this mission does not promise allocation-free presentation.

## Tests

468 runtime tests PASS (105 core,142 Phaser,215 Pixi,6 pixel policy); 43 are new C7A tests. The new native-mesh opt-in regression is RED before implementation and GREEN after. A second RED/GREEN regression covers cached presentation during context loss. Four native clip runs compare all721 committed ticks each: 2,884 Rust/TypeScript poses, local/world bones, Physics records and draw order. Complete author schemas and original image bytes survive Save/Reload; repeat native exports and Rust traces are byte-identical. Native helper fmt/build/Clippy -D warnings pass; Editor workspace/core/WASM are unchanged and were not redundantly requalified as new product changes.

108 C7A real WebGL controls /102 pixel+GPU-buffer captures PASS, plus16 resource/lifecycle checks,2 owned-load failure/abort checks and a weighted-mesh refusal before texture requests and an independently typechecked external TypeScript public-entry consumer. 24 measured workloads cover region, equivalent four-vertex/two-triangle mesh, increasing grids and a mixed character at1/5/10/25 actors. No steady buffer creation, no per-instance geometry sharing, no geometry buffer writes on cached presentation, and all observed owned buffers are destroyed.

Historical: all752 Pixi scenarios and125 modern comparisons plus20 lifecycle cases PASS. C1/C3/C5A numerical/pixel controls, B3/B4/B5A/B5B1/B5B2/B6 traces,5,968 host-time vectors, C6A188 controls/endurance, C6B210 controls/16 multi-actor controls/21 safety/12 resource cases and1,800 transitions per fixture remain conformant. Complementary C6B/Pixi checks retain184 PASS and22 NOT_RUN with no same-pose oracle. The196 historical Phaser failures and31 Legacy numerical divergences retain their accepted signatures; they are not converted into success claims. Protected original goldens and RC2 are hashed separately.

## Incidents retained

The initial fixture helper had two compile-time API mistakes (private Vec2 path and Skin.entries spelling); fixed only in the new helper. A test initially cleared RGB to a nonzero color with alpha0; it now uses transparent black, matching the accepted PMA initialization. One historical asymmetric mesh scenario timed out after45 seconds; its entire unchanged campaign passed on a fresh retry, with no threshold/oracle changes. An orchestration invocation omitted the C6B safety server-root argument and failed before testing; the corrected invocation passed21 cases. All initial logs remain in the delivery. The final geometry oracle adds independent trim coverage area and scalar parent/root transforms; thresholds were set before that final campaign.

## Limits and delivery

One GPU/browser configuration only: Chrome156.0.8078.47, ANGLE/D3D11, RTX3090, Pixi8.17.0. No general hardware/FPS certification or GPU transaction/durability guarantee. Static local meshes only; default C2 and dynamic C6A remain region-only. Weighted meshes, FFD, linked meshes, clipping, dynamic visual skins+meshes, dark tint, other constraints/channels remain outside this mode.

Full diff/patch, exact file/hash lists, final Git receipts, raw results/captures, native projects/assets and SHA manifests are delivered outside the repository. Exact commit is recorded in LOCAL-COMMITS.json after validation; a report cannot contain its own commit hash. STOP after C7A for review.
