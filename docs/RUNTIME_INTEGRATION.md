> **P01-RC1 local candidate — 28 October 2026.** Read the [current contracts and qualification boundary](replay-v1.md) before the historical notes below. Proposed Classic v0.1.6 is not tagged/released here. Runtime package versions are unchanged; ReplayV1 A17 is explicit and separate from Legacy playback.

# Integrating the T-811 runtime candidate

This is unpublished local software, proposed 0.2.0-alpha.1. Install all matching
core/adapter tarballs from this delivery together. A registry RC2 core cannot
satisfy the candidate adapter contract. No npm publication is implied.

```sh
npm install ./ankhimate-runtime-0.2.0-alpha.1.tgz ./ankhimate-pixi-runtime-0.2.0-alpha.1.tgz ./ankhimate-phaser-runtime-0.2.0-alpha.1.tgz
```

The local install smoke test uses cached PixiJS 8.17.0 / Phaser 3.90.0 and checks
ESM resolution and TypeScript declarations. Both packages retain their public API.
The Phaser peer range is broader than the single actually tested engine version;
that range is not a qualification claim for every release.

## PixiJS

Initialize a PixiJS Application with `preference: 'webgl'`, an actual WebGL2 context
and the desired dimensions, then load a real native v2 `skeleton.json` over HTTP:

```js
import { loadPixiRig } from '@ankhimate/pixi-runtime';
const asset = await loadPixiRig('/assets/sentinel/skeleton.json');
const rig = asset.createInstance({ skin: 'default' });
app.stage.addChild(rig.root);
rig.playback.play('idle', { loop: true });
const off = rig.playback.onEvent(event => console.log(event.name));
const tick = ticker => rig.playback.update(ticker.deltaMS / 1000);
app.ticker.add(tick);
// Cleanup:
app.ticker.remove(tick); off(); rig.destroy(); asset.destroy();
```

The asset owns loaded pages; destroy instances first. Textures supplied with
`PixiRigAsset.from(data, pages)` are borrowed and remain the caller's responsibility.
All atlas pages must be fully decoded, full-page textures, resolution 1 and PMA.

## Phaser

In scene preload, load every `data.atlas.pages` PNG into its own texture key. In
create, use the same untouched native JSON. Do not flip the camera or rewrite UVs.

```js
import { parseRig, PhaserRig } from '@ankhimate/phaser-runtime';
const data = parseRig(nativeJson); // already loaded by your application's loader
const pageTextureKeys = data.atlas.pages.map(page => `sentinel-page-${page.index}`);
// scene.load.image(key, correspondingPageUrl) must have completed for every page.
const rig = new PhaserRig(scene, data, { pageTextureKeys, skin: 'default' });
rig.root.setPosition(320, 280).setScale(2);
rig.playback.play('idle', { loop: true });
const off = rig.playback.onEvent(event => console.log(event.name));
// scene update: rig.update(deltaMilliseconds); or rig.playback.update(seconds)
// Never call both for the same frame.
// cleanup: off(); rig.destroy(); the caller still owns Phaser atlas textures.
```

Both adapters expose `setSkin(name)`, `setTime(clip, seconds)` for direct sampling,
and `playback.play/pause/resume/stop/crossFade`, `.speed`, `.time`, `.onEvent`.
Direct sampling detaches playback. Core event time-zero and interrupted-crossfade
limits remain. Do not retain a Phaser raw `player` reference across stop/direct pose.

## Browser modules and local bench

Bundlers resolve the core subpath automatically. For direct browser modules your
import map must also map **`@ankhimate/runtime/render`** to the candidate core's
`render/index.js`, alongside `@ankhimate/runtime`, both adapters, `pixi.js` and
`fflate`. The portable Jade demo and candidate bench include that mapping.
Serve files over loopback HTTP; `file://` is not supported.

```sh
npm ci
npm run build
npm run example:parity
```

Open the printed 127.0.0.1:4180 address yourself for the maintainer GPU review.
The bench never opens a browser automatically. Select native fixture, clip, skin
and direct time, or compare playback. `npm run test:parity` is the bounded headless
runner: it requires an already-installed browser and never downloads one.
Use `ANKHIMATE_BROWSER_PATH` to choose its executable and `ANKHIMATE_PARITY_OUTPUT`
to keep the metrics/captures outside your source checkout.

See [common capability limits](KNOWN_LIMITATIONS.md), [feature matrix](FEATURES.md)
and [Phaser/Pixi history](PHASER-PIXI-PARITY.md). No implicit support is claimed for
constraints, linked/rotated meshes, advanced blending or arbitrary hardware.
