# Experimental ReplayV1 visual skins — Phaser WebGL2

From the Runtime root, install exact lockfile dependencies, run `npm run build`, then `node examples/replay-phaser-visual-skins/server.mjs`. Open the printed loopback URL. Tested: Phaser3.90.0, Chrome156, WebGL2. The default Phaser context may be WebGL1; this example explicitly supplies canvas.getContext('webgl2'). No cloud/model/API service is used.

Ranger and Courier use the unchanged C6A native exports, source PNGs, calendars and Rust references. Select primary/delayed. Play starts the transport without queuing time; request60 completes at most8ticks, then Pump catches up explicitly. Diagnostics separate requested/completed/backlog, numerical skin, visualSkin, active records, visible slots and simulated/pure-preview presentation. Live uses the existing C3 host-time bridge at1×; pause/resume use its absolute clock. Seek is a pure FK preview, never a Physics checkpoint. Replay reconstructs history. Reset must follow a numeric fault. Calendars are absolute ticks and do not repeat at clip boundaries.

```js
import { ExperimentalReplayPhaserAsset } from '@ankhimate/phaser-runtime/experimental-replay';
// game/scene belong to the same live WebGL2 Game; see app.mjs for construction.
const asset = await ExperimentalReplayPhaserAsset.load(game, url, { visualSkins: true });
const actor = asset.createInstance(scene, { clip: 'march', skinEvents: [
  { tick: 0n, skin: 'default' }, { tick: 20n, skin: 'festival' }
] });
const c = actor.consumer;
c.play(c.context, 'march', false);
c.requestTick(c.context, 60n);
actor.present(); // default8, backlog52
c.pump(c.context, 12);
actor.present(); // festival20, backlog40
const present = () => { if (actor.displayed) actor.present(); };
scene.events.on('prerender', present);
// Dispose the callback/host bridge when appropriate; instances auto-dispose on Scene stop.
// Final shutdown: scene.events.off('prerender', present); actor.dispose(); asset.destroy();
```

Borrow existing full-page PMA atlas textures with `Asset.from(game, source, {pageTextureKeys, visualSkins:true})`. Keep caller-owned pages alive for every borrower. Resource validation is part of present/prerender; direct mutations of adapter-owned meshes/textures are unsupported. The existing C5B context guards remain; the controlled recovery test is not universal device-loss recovery UX.

This example initializes an alpha-enabled context, Normal blend and LINEAR texture filtering through the public Game configuration. Opaque camera clear is40/50/61/255; transparent qualification uses zero-RGBA camera clear. Root/parent/camera transforms follow C4 without changing the projection or source coordinates.

Omit visualSkins to retain the old fixed default-skin mode. Refused in Replay: meshes, FFD, clipping, sequences, animated slots/colors/order, dark tint, advanced blends, mixed constraints, crossfade/layers/gameplay events, WebGL1/Canvas. Legacy feature support does not qualify this experimental path. No direct visual setSkin exists.

[Contract](../../docs/t840c6b/T840C6B-SKIN-CONTRACT.md) · [Qualification](../../docs/t840c6b/T840C6B-WEBGL-QUALIFICATION.md) · [Reproduction](../../scripts/t840c6b/README.md)
