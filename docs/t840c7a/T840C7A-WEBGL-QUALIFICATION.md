# C7A real WebGL2 qualification

## Fixtures and independence

Simple:3 bones,2 slots,1 region+1 unweighted mesh,1 Physics constraint, animated translation/rotation/nonuniform scales; native region conversion includes x3.5,y-2.25,rotation7deg,scale(.94,1.07) and noncentral pivot. Five local vertices, asymmetric UV center(.37,.43), four triangles alternating winding; untrimmed native atlas with exact indices.

Mixed:26 bones,21 slots,16 regions+5 unweighted meshes,8 secondary Physics constraints, multi-depth hierarchy, march/salute and intentional fault_at_20. Meshes on torso/head/scarf/cape/antenna_tip include Physics descendants. Real trimmed two-page native atlas. Both author projects and all source images are retained; native .ankh save/reload compares complete schema/image bytes. No runtime JSON fixture patching. Performance grids are also separately native-authored/exported.

The Rust helper reads the native project, converts regions via existing MeshAttachment::from_region, saves/reloads, exports with the existing preset/staged writer and runs actual ReplayConsumer. Its mesh reference applies the Rust world affine directly to original local vertices, without Pixi/MeshBinding/MeshAtlas. Browser checks reconstruct triangle barycentric positions from native UVs, derive trim coverage area independently via segment intersections+convex hull, and reconstruct parent/root affines with scalar TRS. GPU positions,UV,index data are read using getBufferSubData from actual renderer-owned MeshGeometry buffers. Shader TextureSource/page identities and gl.readPixels are checked.

A second pixel oracle samples original author PNG texels with bilinear PMA, light tint, alpha, draw order and source-over; it includes covered and empty background samples. Control framebuffers temporarily use independently reconstructed Rust-derived positions, then restore original buffers. No CSS/precomputed frame supplies rendered pixels.

## Results

108 controls PASS;102 raw RGBA/PNG GPU-buffer captures. Tick0,1,8,30,60,120,240; partial60/8/52; pump/pause/resume; successive pure previews; replay/reset; numerical fault retaining19; independent actors at30/60 and surviving actor120; transparent/opaque backgrounds; parent/camera and reflected root. Unit tests additionally compare all721 ticks for each of four normal fixture/clip runs.

| Quantity | Maximum absolute error | Fixed tolerance |
|---|---:|---:|
| Bone local components | 3.308270195e-06 | .01 |
| Bone world translation | 5.979269697e-05 | .01 |
| Bone affine linear | 6.02796321e-07 | .0001 |
| Physics records | 4.775802903e-05 | .01 |
| Submitted vertices | 7.02291849e-05 | .01 |
| UV | 2.873371319e-08 | 1e-6 |
| CPU array versus actual GPU buffer | 0 | exact |
| UV coverage area | 8.428939511e-07 | 1e-6 |
| Parent/root affine | 0 | .0001 |
| Wrong winding / invalid draw order | 0 | zero |

623,936 uniform source/background samples, including599,129 background samples:0 outside3/255. Historical full-frame policy unchanged: uniform3/255, large edge24/255, at most2% of nonempty foreground (minimum16). All control image comparisons PASS. No tolerance was raised.

16 actual resource/cache/failure/context-loss/WebGL1 checks and2 real multipage HTTP503/abort cleanup checks PASS; an additional weighted-source load is refused before any atlas request. The external TS project uses package exports and real WebGL2, without internal dist imports. Initial validation refusals are covered separately from callback-time failures and real native context loss/restoration. Graphics failures preserve core state; GPU effects are not transactional.

## Environment and limitations

Chrome156.0.8078.47 / Pixi8.17.0 / Playwright1.58.2; WebGL2, ANGLE RTX3090 D3D11. This is a controlled single-machine campaign, not broad hardware or artistic certification. Constant UV and zero-area meshes have explicit validation semantics, without a claim that every degenerate topology was separately pixel-certified. No weighted/FFD/linked/clipping/dynamic-skin mesh support follows. Historical suites keep accepted captures and statuses;22 complementary C6B/Pixi cases remain NOT_RUN for lack of same-pose old oracle.

Raw evidence in the delivery: webgl-qualified/, safety-qualified/, load-qualified/, external-mesh/, quality-final/, native source/trace folders and SOURCE-SHA256.json. Scripts and instructions are under scripts/t840c7a. No Editor GUI or new user-character edit was needed.
