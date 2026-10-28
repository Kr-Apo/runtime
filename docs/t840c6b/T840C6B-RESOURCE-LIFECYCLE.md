# C6B — resources and lifecycle

## Ownership

Game owns TextureManager, pipelines and GL buffers. load owns only its generated unique page keys; decoding is staged before installation. from borrows distinct caller-supplied keys. Caller keeps borrowed pages alive until every borrower is disposed. This is not a cross-asset global reference-counting scheme. An asset refuses destruction while its own views live. View disposal never removes shared pages. Final owned destruction removes only the exact registered Texture objects, never someone else's same-key replacement.

Instance owns its consumer, root and mutable Mesh/Face/Vertex objects. No mutable vertices are shared across actors. Appearance/layout caches are bounded by validated skins; meshes by ever-visible setup slots. Hidden meshes remain for reuse. Named atlas Frame metadata installed in borrowed pages is retained until the page owner destroys them, as in C4. Matching existing metadata is reused; collisions refuse. No per-transition atlas metadata growth.

Scene shutdown/destroy and root destroy dispose the consumer, detach instance listeners and release asset membership. The same asset can create fresh independent instances after Scene restart. Game destruction aborts outstanding loads and disposes active instances, tolerating earlier TextureManager destruction. Normal game.destroy plus next public game.step handles pending destruction in deterministic tests. No private engine runDestroy is called.

## Dynamic validation and failure paths

The C5B qualification WeakMap is unchanged. No VERSION-per-frame regression: zero steady-state VERSION calls in all four phase profiles. Every present, including cached tokens, checks live context and all pages; the guarded callback repeats checks. Dynamic mode pins TextureSource identity as well as original TextureManager object identity. Source dimensions and GL PMA wrapper are rechecked. A replacement under an existing key refuses both owners. Restoration may legitimately rebuild a GL wrapper under the same source; the actual Night40 loss/restoration test passes after C5B requalification.

21 dynamic real-WebGL safety cases pass.12 load/resource cases additionally cover owned success, borrowed peers, controlled partial UV failure/retry, presentation refusal, preabort, malformed JSON, incompatible source before any pages, page failure after decoding, abort after decoding, failures before/after second TextureManager insertion and Game destruction during loading. Installed owned keys and listener counts return to baseline; object URLs are revoked. Refusal/presentation failure preserves numerical state and the last successful CPU token. This is ordinary failure cleanup, not crash atomicity or a GPU transaction.

## Repeated transitions and bounded resources

Ranger(two skins) and Courier(three skins) each execute1,800 transitions over36,000 completed ticks:300 seconds SIMULATED time, accelerated. Three actors include a7 tick phase offset, a paused actor while another replays, independently budgeted replay, peer destruction and full instance recreation. Final origin-replayed bones/spring records are byte-identical to incremental requests. Both campaigns preserve the existing mesh, face-array, vertex-array and Vertex-object identities after all skins are first seen.

At three actors: Ranger≤36 meshes,72 faces,216 vertices,2 shared pages; Courier≤63 meshes,126 faces,378 vertices,4 pages. The badge mesh appears once. No new GL buffer was created during either long campaign;11 engine-owned buffers were deleted during final Game teardown. No final counter is mistaken for a VRAM measurement. All controlled Mesh objects lose their scene and clear faces/vertices; final asset counters0instances/0 pages. Raw resource histories retain before/during/peer-disposal/recreate/final observations.

Driver buffers belong to Phaser's batching pipeline, not one GL buffer per region. The timing driver's fields called geometries/buffers are Face-array/Vertex-array identities; explicit GL create/delete/bufferData/bufferSubData counters in phase-profile-final are separate. Ordinary rendering still uploads batches even with no new skin. Cache redraw60 produces no new pose application or Vertex.setUVs call, although Phaser may still project/render unchanged meshes.

Allocation profiles and forced-GC observations are retained, not a proof of absence of all leaks. One environment/session, no general driver/device-loss/abrupt-process guarantees. Assets/diagnostic references intentionally remain reachable in the demo until page close.
