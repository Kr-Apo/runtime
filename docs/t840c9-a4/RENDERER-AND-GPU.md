# Renderer and GPU evidence — A4

Existing G1/G2 geometry, atlas mapping, PMA shader, double bank and resource abstractions are reused. Native weighted vertices, inverse binds, coefficients, UVs and triangles are not rewritten. The frame supplies the selected attachment and full order; a renderer never evaluates a timeline.

Both views iterate accepted drawOrder, omit invisible and null selections, resolve the exact selected owner/identity, and prepare region or mesh geometry with accepted bones. Light RGB and alpha flow into existing uLight/uOpacity submission. Normal source alpha is premultiplied on texture upload and composed with the existing Normal PMA pipeline. No camera flip, UV workaround or new shader is introduced.

The badge switches between sun region, moon region on another atlas page, null, and a five-vertex weighted fan mesh before returning to sun. Topology, index count and resource identities are correctly selected per bank. A zero-alpha visible fan still has a prepared/submitted draw with uOpacity exactly zero. Invisible/null produce no draw. Depth changes are verified by both actual submission order and overlapping pixels.

## Actual WebGL2 checks

Hardware Chrome 156, ANGLE NVIDIA RTX 3090 / D3D11, PixiJS 8.17.0, Phaser 3.90.0. No SwiftShader. Alpha/PMA canvas, no antialiasing. 43 ticks × two engines provide 86 transparent framebuffers; three poses × two engines add six opaque frames. Ticks surround discrete/color/order boundaries and include 0, 0.25, 0.5, 0.75 seconds plus later laps.

Pixi GPU buffer readback checks positions, UVs and indices. Phaser checks actual submitted Vertex/Face batch bytes and texture coordinates, not only logical mesh properties. Test-only GL interception reads the actual bound texture, framebuffer, uLight and uOpacity for each draw. Values are compared to independent Rust state within 1e-6; selected texture page and order are exact.

Independent unchanged I2 CPU rasterizer uses native Rust world geometry and atlas information; it does not render from TypeScript-derived vertices. 92 CPU comparisons and 92 same-tick cross-engine comparisons pass the inherited raw RGBA8 policy. Raw deltas and amplified difference images remain in pixel-comparisons-delivery. Passing does not mean CPU/GPU byte identity: interpolation/rasterization differences remain measured. Final code reproduces all 86 transparent and six opaque compared buffers byte-for-byte.

## Lifecycle and resources

Two actors, cancellation, absent assets, concurrent async loads, five reload cycles, Scene/Game removal and real context loss/restoration pass. Context-loss/HTTP-404 diagnostics are expected only in their injected scenarios. At tick 318, with the weighted fan visible and transport paused, restored positions/UVs/indices, accepted frame and raw readPixels SHA256 are identical. Normal demo operation has no page errors or warnings and only local HTTP/blob requests.

Per actor, cached identities reach ten meshes (two banks × five identities), three borrowed atlas pages and two render targets. After exercising every identity, repeated ticks do not continually create new meshes. Destruction balances all ten mesh resources; actor consumers are disposed once. Global engine batch buffers and borrowed textures retain their correct owner. No zero-allocation or general hardware certification claim is made.

## Viewing

Extract the standalone ZIP, run `node server.mjs .`, open `http://127.0.0.1:4188/pixi.html` or `/phaser.html` (the server prints its actual loopback URL). Use Play/Pause/Resume/Reload. Status displays accepted/requested tick, clip, skin, attachments and playback state. Dependencies and data are local; no supervisor or certificate service is required. The supplied APNGs are actual recorded 1.5-second excerpts, not claims that continuous Physics resets identically each loop.
