# Renderers and GPU proof

A3 extends G1/I2 PixiJS and G2/I2 Phaser views; it does not use Legacy RigPlayer or create another renderer. DeformGeometry computes immutable setup bind-linear conversions once, then adjusts each influence base from the **already sampled accepted payload**. Existing weightedPoints, MeshAtlas projection, PMA/tint path, indices, page selection and double banks are reused.

PixiJS proof reads actual position, UV and index buffer storage using WebGL2 getBufferSubData, checks it against prepared draw arrays, then against independent Rust geometry. Each actor owns its mutable geometry; two banks retain at most one mesh per fixed attachment identity per bank.

Phaser proof inspects actual drawArrays attribute storage in its shared batching buffers, verifies uploaded bytes, Face triangle order, screen positions and submitted `tu/tv`, and maps submitted positions independently back to Rust triangles. Vertex.setUVs and projection behavior remain unchanged. DynamicTexture/offscreen target ownership is retained. **Phaser does not have an independent GL buffer per logical mesh.** Scene/Game destroy and context restoration are exercised, including the post-restore GPU positions/UVs/indices.

## Measured results

Chrome156, Windows, ANGLE NVIDIA RTX3090 D3D11, real WebGL2 (SwiftShader refused), PixiJS8.17.0 and Phaser3.90.0. Framebuffer640×480, DPR1, antialias off, Normal PMA blending, fixed native atlas. Exact identity/context attributes and executed-source hashes accompany captures.

44 transparent checkpoints (22 per engine) plus6 opaque checkpoints (rest/impact/return on RGB40/50/61) pass independent Rust and CPU rasterizer comparisons. Selected maxima:

| Quantity | Maximum | Unchanged limit |
|---|---:|---:|
| Per-influence world term | 0.000020078 | 0.01 |
| Final world vertex | 0.000017106 | 0.01 |
| Actual Pixi buffer world vs Rust | 0.000017010 | 0.01 |
| Phaser submitted GPU world vs Rust | 0.000027569 | 0.01 |
| Atlas UV | 2.168e-8 | 1e-6 |

The accepted CPU rasterizer uses the author PNG, independent Rust vertices and existing UV×(W−1)/PMA/bilinear conventions. Historical policy remains uniform3, neighborhood4, edge24 with maximum2% of foreground; no alignment or new tolerance. All50 CPU and50 cross-engine comparisons pass. Raw differing pixels and difference PNGs are kept; equality is not falsely claimed for Rust/CPU/GPU output.

72 representative old I2 captures (regions and weighted meshes, fixed and dynamic skins, both engines) are **byte-identical** to accepted I2 GPU captures, including transition boundaries239/240/241 and255/256/257. No historical bank or certificate is regenerated.

`pixi-weighted-ffd.png` and `phaser-weighted-ffd.png` are short APNG excerpts composed from real GPU captures (no invented intermediate poses). These recorded excerpts repeat visually; the live demos retain Physics across clip loops rather than resetting it. The contact sheet shows rest/impact/return. Larger sequence captures and opaque setup use declared test-only placement/background changes, never patched native animation data.
