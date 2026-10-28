# T-840C7A reproduction

Use the locked runtime dependencies and the sibling Editor checkpoint 275082e8 (Rust 1.95). No editor/product file is edited by these helpers.

1. `python scripts/t840c7a/create-authors.py NEW_AUTHOR_ROOT` generates original primitive artwork and native author inputs.
2. Set CARGO_TARGET_DIR outside the repositories if desired. Run `cargo +1.95 run --offline --locked --manifest-path scripts/t840c7a/native/Cargo.toml -- NEW_AUTHOR_ROOT/simple NEW_EXPORT_SIMPLE`, then repeat for mixed. Output directories must not exist. The helper uses native MeshAttachment::from_region, saves/reloads Character.ankh plus assets, asserts complete author schema/image equality, exports the default native preset (simple untrimmed; mixed trimmed, page limit 256), then runs Rust ReplayConsumer for every clip through tick720 and pure previews. No exported JSON is modified.
3. `npm run build`, `npm run typecheck`, `npm test`.
4. `node scripts/t840c7a/qualify.mjs NEW_OUTPUT` / `safety.mjs NEW_OUTPUT` / `load-safety.mjs NEW_OUTPUT` / `consumer.mjs NEW_OUTPUT` / `measure.mjs NEW_OUTPUT`.

Chrome executable defaults to its standard Windows location; ANKHIMATE_BROWSER_PATH can override it. Run WebGL campaigns sequentially, especially measurements. Node24, TypeScript5.9.3, Pixi8.17, Playwright1.58.2 were used. Each script retains raw results and fails on violations. Never reuse a historical output directory.

For performance author workloads, copy the simple native author input, use mesh-slots.json [] for region or ["head"] for a mesh, add mesh-grid.json =1/4/8/16 and an empty untrimmed marker, then use the same native helper. Grids have 4/25/81/289 vertices and 2/32/128/512 triangles; they do not change UV coverage, bone animation, source textures or Physics. Retained author inputs and exported assets are in examples/replay-static-meshes.

The independent oracle reconstructs native triangle barycentrics, intersection area by segment intersections plus convex hull, scalar parent/root matrices, original PNG bilinear PMA texels and Rust bone matrices. GPU data is read with WebGL2 getBufferSubData from the buffers used by actual Pixi MeshGeometry. Neither a production mesh result nor screenshots alone are the oracle.
