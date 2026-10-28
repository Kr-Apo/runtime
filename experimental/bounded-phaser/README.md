# Bounded Phaser weighted meshes (C7C1)

Experimental qualification bench only, based on R2 `3c8e80e` and unchanged N6 admission. Not a package export or a replacement for existing Phaser/PixiJS playback. Editor E1 and native v2 remain unchanged.

`createBoundedBench(trustedConfig)` owns a private N6 supervisor and a separate Phaser graphics process. Only the six exact Simple/Mixed qualifications and their step/bulk/replay/reset histories are accepted. No caller-supplied consumer or simulation provider. `create(id,history,instanceId,placement)` creates its own admission and returns the closed N6 session plus a graphics bridge. The graphics context cannot access or advance that consumer.

The bridge presents the current accepted snapshot. Optional `capture()` / `capturePreview()` tokens are privately registered, immutable owner/kind/cursor/epoch-bound handles; copied, foreign or stale handles refuse. Presentation is nonreentrant. Pure preview remains explicitly labeled and separate from completed Physics. No arbitrary seeks, implicit pumps, resets or horizon extension. The lower-level graphics RPCs are qualification tooling under the trusted launcher, not alternate admission APIs or a security boundary against their own owner.

Reuse R2's dependency-free `geometry.mjs` exactly: ordered native influence locals/weights, positive-total normalization, empty/all-zero host fallback, no pruning/four-influence cap or early bind downcast. Reuse unchanged MeshAtlas, regionQuad and Phaser applyDarkTint at D=0. No MeshBinding/evaluate/setup-FK path and no old `consumer` getter. Imported numerical class definitions exist transitively; precise V8 coverage verifies that no consumer, Physics, transport or evaluator executes graphically.

Each view owns two Mesh/Face/Vertex banks and two RenderTextures. Prepare/project with public Face.transformCoordinatesLocal, use Vertex.setUVs, draw the back target, then publish its texture after success. The initial Y-up to Y-down conversion and Phaser's orthographic projection are accounted for once, without camera/data compensation. Parent and final camera transforms are checked separately. Failure during back-target preparation retains the front. Screen composition/driver failure is not universally atomic; context loss destroys pixels and requires explicit restoration/redraw of the same accepted state.

Pages are borrowed and pinned by TextureManager object and TextureSource identity. Recheck dimensions/PMA, availability and C5B Game/context qualification on every present, including reuse. No repeated steady-state VERSION query. Mutable Vertex objects are per view; actual GL buffers belong to Phaser batching pipelines and are shared at the Game level. The names in `positionBufferUID` / `uvBufferUID` / `indexBufferUID` identify logical Mesh/Vertex/Face storage, not dedicated driver buffers. Real expanded GPU batches, layout, readback and upload equality are separate `submitted` records.

The qualification harness flushes each Mesh batch at its boundary to associate actual GPU uploads with the owning slot. It intercepts bufferData/bufferSubData and reads actual GL storage during drawArrays. This diagnostic GPU readback and byte copy are disabled inside timed profiles; all dynamic source/frame/context/texture validations and batch boundaries remain active. Performance is for this instrumented staged path, not a claim about default Phaser throughput.

Destroy views before their atlas owner, then Game and browser context. Scene shutdown/destroy invalidates its views, without disposing another Scene's textures or numerical session. The ledger's strong diagnostic handle sets can retain engine-created shader/temp texture handles until context close; explicit delete counts are not physical VRAM or a leak oracle. Report fixed engine caches separately from unbounded per-view growth. The launcher closes the graphics context/process and then N6.

Scope: fixed default skin, static regions, native weighted meshes, Normal blend, exact Physics-only admitted data, finite H720/H19, Chrome 156.0.8078.47 / V8 15.6.75.19 headless, Phaser 3.90.0 / real WebGL2. Refuse near-singular, FFD, linked meshes, clipping, dynamic skins, dark tint, extra constraints, slot/order/event timelines, mixing, host-time and arbitrary transcripts. The pure kernel has unweighted tests, but no general Phaser unweighted-mesh WebGL support is newly certified without a native corresponding fixture.

Run against the exact pinned N6 identity and existing locked dependencies, never rewrite certificates to obtain PASS. Use fresh output directories; `cfg.out` holds copied exact E1/oracle references and all output subfolders must be new. See the delivery's six reports, raw evidence and reproduction guide.

```text
node experimental/bounded-phaser/adapter.test.mjs
node experimental/bounded-phaser/measure.test.mjs <trusted-config.json>
node experimental/bounded-phaser/qualify.mjs <trusted-config.json>
node experimental/bounded-phaser/safety.mjs <trusted-config.json>
node experimental/bounded-phaser/special.mjs <trusted-config.json>
node experimental/bounded-phaser/profile.mjs <trusted-config.json>
```

No new dependency, format, version, default API, push or publication. Subsequent skins/FFD/linked/headful/public-integration/WASM work requires separate authorization.
