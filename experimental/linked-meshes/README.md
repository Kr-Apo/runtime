# Static linked meshes — A9 Gate A

Experimental opt-in: `new ReplayConsumerBridge(native, clip, 1n, undefined, {linkedMeshes:true, animatedSlots:true})`.

`validateLinkedMeshRig` admits a native v2 rig with one fixed default skin, one clip, existing Physics constraints, Normal slots and at least one one-level linked mesh. All attachments and slot selections are validated before use. It refuses FFD (including source-owner tracks), events, clipping, dynamic skins, sequences, chains/cycles, missing or ambiguous owners, invalid topology/UVs/influences and singular Setup binds. Existing modes keep their previous refusals.

`linkedGeometry` is a projection helper for **already admitted immutable** data, not an admission API. It retains the displayed attachment's texture and source image dimensions and the exact source vertices, UVs, indices and local influence coordinates. It never rebinds or modifies the native rig. `linkedMeshSources` supplies a detached admission/sampling view to existing slot transactions; bone sampling and B6 Physics are unchanged.

The graphics views reuse per-actor inactive banks and displayed `(skin,slot,attachment)` cache keys. Accepted metadata includes `geometryOwner` and `deformationOwner:null`; texture identity is independent of the geometry source. Pixi owns separate GL geometry buffers. Phaser owns separate Mesh/Vertex/Face arrays and uses its existing shared streaming driver buffers. No sampling in `present()`.

Run `node experimental/linked-meshes/prepare-demo.mjs NEW_DIRECTORY THIS_RUNTIME core/dist a`. Start `node server.mjs .` in the resulting directory, open pixi.html or phaser.html. Vendors and notices are local. Play/Pause/Resume/Reload are available; no Legacy RigPlayer or supervisor. The page shows displayed attachment, source owner, texture, clip and accepted tick.

## Native evidence and limit

`tools/linked-mesh-reference` creates Linked Frog through the unchanged A2 author schema API, saves/reopens and performs a real native export. This is headless authoring evidence, not a GUI qualification. The positive fixture contains a weighted source with ten influences (including non-normalized sums, a zero-weight term and an empty-row rigid fallback), two distinct linked body identities/textures, a rigid linked cape and compatible animated slot transitions. Four continuous loops preserve Physics state.

**Gate B inherited FFD is HOLD.** The unchanged Rust CPU resolves linked geometry but looks up FFD by the displayed slot/name, ignoring `inherit_deform`. The native diagnostic measures a 14.059692-unit discrepancy at0.75s; actual CPU PNGs with the flag true/false are identical. Source-owner positions in the diagnostic are an interpretation of the documented contract, never a corrected positive oracle. No inherited FFD runtime capability is enabled.

No native format, solver, evaluator, renderer engine, runtime version or Editor source change. Cross-slot links use the same native displayed-host fallback rule; dedicated cross-slot artistic/GPU qualification beyond this fixture is not claimed. Dynamic skins, linked FFD/clipping/events composition, linked chains and mixing remain outside A9 qualification.
