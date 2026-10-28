# T-840C2 — WebGL qualification

## Environment and source

Windows 11 Pro 10.0.26300, i7-13700K (16 cores / 24 logical processors), RTX 3090, ANGLE Direct3D11, installed Chrome 156.0.8078.47, PixiJS 8.17.0, actual WebGL2. C1 captures use 900×520 opaque output, DPR 1, antialias false; no browser/GPU download. All requests are local. This is a hardware-specific validation, not a broad hardware certificate.

The original native C1 fixture and 721 Rust reference frames remain unchanged. The two-page fixture was independently exported by the unchanged Editor B6 native preset with max page 128 after Save/Reload. No native JSON was patched. Delivery `native-multipage-green/` and its generation helper establish provenance; committed fixture page/JSON bytes match those outputs.

## C1 migration and measurements

`webgl-release/results.json`: 24 captures plus a separate presentation-error check pass. Coverage includes tick 0, 1, 8, 30, 60 and 120; partial/caught-up backlog; pause and unchanged redraw; explicit seek preview and replay; failed audit and native solver failure; reset; two independent characters; exact cadence 30/60/120/144 and irregular hitch. Live host-time pause/resume and destruction are also checked. No JavaScript errors, warnings, unexpected missing resources, external requests or context loss.

World matrices and quad corners are compared against independent Rust state. The test-only pixel oracle writes independently calculated Rust corners into the existing Pixi geometry buffers, renders/readPixels, then restores actual buffers. It neither forges application presentation tokens nor mutates source exports. This compares Rust simulation/geometry through the same Pixi rasterizer, not a new CPU/GPU texel certification. Pure seek preview is explicitly not a historical Physics oracle.

| Quantity | Maximum observed absolute difference | Unchanged acceptance limit |
| --- | ---: | ---: |
| Affine coefficients | 3.40306669622e-07 | 0.0001 |
| Bone world values | 6.88827640971e-06 | 0.01 |
| Submitted vertices | 1.23494788085e-05 | 0.01 |
| Camera-space vertices | 2.22290618126e-05 | 0.02 |

All compared capture pixel pairs are equal in this campaign. Independently, `C1-PIXEL-NONREGRESSION.json` verifies that all 24 actual `.rgba` outputs are byte-identical to accepted C1. The native solver-fault request at tick 9 retains completed tick 8, backlog 52 and identical last-good pixels. No threshold or historical golden was changed.

## Independent consumer and loading

`consumer-release/`: a TypeScript project physically outside the runtime repository compiles using the built public package exports only. Real WebGL2/readPixels verifies native load, owned consumer, exact 8/60/52 progression, presentation/cache, pause/resume, seek/replay, independent instances, refusal, Legacy refusal and disposal. `consumer.png` is its real browser output. Temporary local package junctions used for TypeScript resolution were detached after the run, without deleting their targets.

Six additional actual browser loading cases: success with two atlas pages; pre-abort; malformed JSON; missing JSON; second-page HTTP failure after page 1 decoded; cancellation after page 1 decoded. Completed TextureSources destroyed: 2 on successful asset destruction, 1 in each late failure/abort, 0 in early failures. Ordinary cleanup is tested; crash-time GPU reclamation is not claimed.

## Historical graphics

All feasible existing Pixi campaigns were run: 33 regions, 20 playback, 115 meshes, 232 appearance, 352 clipping; total 752 PASS. Artifacts are in `historical-pixi-*`, with final logs and browser gate receipts. Expected advanced-blend refusals are successful negative tests, not new blend support. No Phaser browser campaign or new Phaser implementation is claimed. Historical 207 goldens and other protected evidence were checked unchanged.

## Reproduction

From the Runtime checkout after building local workspaces, use fresh, nonexistent output directories:

```text
npm run build
npm run typecheck
npm test
node --test scripts/t840c1/pilot.test.mjs scripts/t840c2/time.test.mjs
node scripts/t840c1/webgl.mjs ABSOLUTE_NEW_C1_OUTPUT
node scripts/t840c2/consumer.mjs ABSOLUTE_NEW_CONSUMER_OUTPUT
node scripts/t840c2/performance.mjs ABSOLUTE_NEW_PERFORMANCE_OUTPUT
node scripts/t840c2/memory.mjs ABSOLUTE_NEW_MEMORY_OUTPUT
```

Installed Chrome is the default Windows browser path; set `ANKHIMATE_BROWSER_PATH` if necessary. Playwright and package dependencies must already be installed. The scripts do not download a browser. Historical campaigns use `scripts/test-pixi-{webgl,playback,meshes,appearance,clipping}.mjs` with separate fresh output directories. Preserve existing evidence; never reuse sealed output directories. The matched benchmark requires the accepted C1 parent commit in local Git.
