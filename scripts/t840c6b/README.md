# Reproduce C6B

Use NEW output directories. Exact parent runtime d892e1bfd8acba725bbbacfaf42b1e82b747e9e9; native Editor275082e8f26d42389ed05fb92c45e2822006525d remains unchanged. Node24.18, TypeScript5.9.3, Phaser3.90.0, Pixi8.17, Playwright1.58.2, Chrome156. Exact npm lockfile dependencies; ANKHIMATE_BROWSER_PATH can choose another Chrome binary (a different environment, not prior certified evidence).

From the Runtime root:

```powershell
npm run build
npm run typecheck
npm test
node scripts/t840c6b/qualify.mjs NEW_OUTPUT
node scripts/t840c6b/multiple.mjs NEW_OUTPUT
node scripts/t840c6b/safety.mjs NEW_OUTPUT RUNTIME_ROOT
node scripts/t840c6b/resources.mjs NEW_OUTPUT
node scripts/t840c6b/endurance.mjs NEW_OUTPUT
node scripts/t840c6b/consumer.mjs NEW_OUTPUT
node scripts/t840c6b/measure.mjs NEW_OUTPUT RUNTIME_ROOT visual
node scripts/t840c6b/memory.mjs NEW_OUTPUT RUNTIME_ROOT visual
node scripts/t840c6b/profile.mjs NEW_OUTPUT
```

The strict external TypeScript consumer uses public exports only, then real WebGL2; its temporary dependency junction entries are detached. The one upstream GameConfig.context cast is the existing Phaser typing workaround, not weakening experimental types.

The new example reads existing examples/replay-visual-skins/assets and authors. No native JSON is patched or simplified. Delivered copies preserve the accepted C6A native projects/assets, input art, Save/Reload and Rust reference provenance. For native reproduction use unchanged scripts/t840c6a/native-export.py with its accepted Editor checkpoint. C6B does not claim a new Rust workspace/WASM or GUI authoring run.

For fixed comparisons, independently archive/build exact C5B c3454f329d865373dd3515596348c8961e947c26 with browser dependencies physically confined to that server root. Run measure with fixed on both sources. Run current measure with constant to select a default-only canonical calendar using the SAME old native one-skin bytes; only the local harness load/create options are changed. Run C5B/current then current/C5B with C6_COUNTS=25 for ordering control. Actual multi-skin schedules use visual separately; their different membership/packing prevents a fake same-data baseline. memory accepts fixed/visual; allocation/GC is a separate intrusive pass. profile uses test-only method/driver instrumentation and must not be interpreted as unprofiled latency.

Timing geometries/buffers fields refer to per-mesh Face/Vertex ARRAYS, not GL buffer counts. Phaser batching pipeline owns driver buffers; profile and endurance count actual GL creation/deletion separately. Cached redraw must not call the pose updater or Vertex.setUVs, even though the engine renders/projects unchanged geometry.

compare-pixi.mjs takes a Phaser qualification folder and a folder of top-down PMA .rgba files decoded from sealed C6A PNGs. Opaque alpha255 data are exact; transparent display PNGs require re-premultiplication and may quantize by1. Keep policy thresholds unchanged. Equivalent captures compare; extra poses without old reference are NOT_RUN supplemental comparisons, while independent Rust/source-texel tests still apply.

Historical scripts remain unchanged under t840c1/c3/c4/c5a/c5b/c6a. Preserve all logs, including expected196Legacy failures and31numerical divergences. Do not overwrite old goldens, sealed outputs, RC2 or prior refs. [Contract](../../docs/t840c6b/T840C6B-SKIN-CONTRACT.md).
