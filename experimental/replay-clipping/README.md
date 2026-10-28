# ReplayV1 polygon clipping — A7 experimental

Opt in with `{animatedSlots:true, clipping:true}` in ReplayConsumerBridge. Use loadPixiAsset/createPixiActor or loadPhaserAsset/createPhaserActor from this folder for the application pilot. No automatic Legacy or A3–A6 activation.

Native v2, one clip and fixed default skin, Normal regions/static or weighted nonlinked meshes, existing Physics. Simple convex/concave rigid polygons, at most64 vertices. Events, FFD, dynamic skins, links, holes, general mask intersection, sequences, mixing and other constraints remain excluded. Unknown/self end slots and malformed/degenerate/self-intersecting polygons fail admission. A null end masks the remainder; an end before introduction is not encountered again.

A clipping attachment activates before its slot visibility is considered. It is not a texture draw. Traversal uses accepted slotState.drawOrder, attachments and bones only. A new clipping attachment replaces the previous mask. Ordinary end slots are included and clear the mask even when hidden or null.

Geometry preparation reuses core/render/clipping.ts, including ear clipping and UV interpolation; no stencil/scissor state. Each frame has temporary mask and cut arrays. At most32768 subject-triangle × mask-triangle pairs per draw and196608 emitted clipped vertices per frame; over-budget frames refuse publication. Both banks cache by native attachment identity, never by tick. Pixi replaces/destroys inactive-bank MeshGeometry when topology size changes; Phaser uses public Mesh.clear/addVertices on its inactive mesh.

Numerical commit and GPU publication are separate. A failed last slot/triangle or GL submission retains the previous front; retry the same accepted frame without advancing time. Context loss destroys driver contents; restoration requires presenting accepted frames again, not a durability guarantee for lost pixels.

Author fixture: `tools/replay-clipping-reference`, using the read-only A2 sibling editor. Run Cargo with its manifest and a NEW output directory. It creates Masked-Frog.ankh + assets, Save/reopen equality, real native export and721 Rust accepted Physics/clipping frames. Native positive JSON is not patched. The author tool is headless API evidence, not GUI authoring qualification.

Build runtime first, then `node experimental/replay-clipping/prepare-demo.mjs NEW_OUTPUT DEPENDENCY_RUNTIME CORE_DIST`. Run generated server.mjs, open pixi.html/phaser.html. Assets/dependencies/notices are local.

Tests: core/test/replay-clipping.test.ts; `node --test experimental/replay-clipping/geometry.test.mjs`. GPU evidence and six detailed reports are delivered separately under T840C9-A7-Replay-Clipping. Pixel policy and historical goldens unchanged. No general qualification or performance claim beyond the tested machine.
