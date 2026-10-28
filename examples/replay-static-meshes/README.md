# ReplayV1 static unweighted meshes — experimental

Run `node examples/replay-static-meshes/server.mjs` after `npm run build`; open the printed URL. Select Simple or Mixed and march/salute. Buttons exercise exact ticks, pump, pause, resume, pure preview, replay from origin and reset. `fault_at_20` is an intentional numerical-fault fixture. This is a controlled demonstration, not an autonomous game loop.

```ts
import { ExperimentalReplayPixiAsset } from '@ankhimate/pixi-runtime/experimental-replay';
const asset = await ExperimentalReplayPixiAsset.load(url, { staticMeshes: true });
const actor = asset.createInstance({ clip: 'march' });
stage.addChild(actor.root);
actor.consumer.play(actor.consumer.context, 'march', false);
actor.consumer.requestTick(actor.consumer.context, 60n); // default budget: completed8, backlog52
actor.present(); // mesh and Physics both use completed8
actor.dispose(); asset.destroy();
```

Only one fixed default skin, native v2, unweighted static meshes/regions, Physics-only, Normal blend, PixiJS8 WebGL2. `visualSkins:true` is a separate region-only contract and cannot be combined. FFD, linked/weighted meshes, clipping, sequences, dark tint, events, slot/draw-order animations, layers and crossfades remain refused. C2 default and Legacy capabilities are unchanged. No renderer-side Physics or second bone hierarchy exists.

Original deterministic source art, native author inputs, saved projects/assets, native JSON/atlas and Rust references are retained here. The Simple fixture uses exact original triangle order; Mixed also covers real trimmed atlas geometry and two pages. Region pivots/offset/rotation/scale were baked by the native conversion into mesh-local vertices. Meshes have no second pivot transform.

Ordinary presentation errors do not roll back completed simulation. Last accepted presentation token is retained until successful retry, while external GPU writes are not transactional. Source pages are pinned and caller-owned textures stay caller-owned. Context loss refuses presentations after the first bound renderer is known; Pixi owns restoration/reupload. No crash durability, VRAM residency or multi-GPU guarantee is claimed.
