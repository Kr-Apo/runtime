# Ankhimate — Kr-Apo Community Fork (Unofficial)

This is a community-developed derivative maintained independently by Kr-Apo.
The original projects are [Ankhimate/editor](https://github.com/Ankhimate/editor)
and [Ankhimate/runtime](https://github.com/Ankhimate/runtime).
This derivative is not officially endorsed or maintained by the upstream
Ankhimate organization. Original MIT OR Apache-2.0 licensing, copyrights and
third-party attribution requirements are preserved. Naming identifies upstream
origin; no upstream trademark license or endorsement is claimed.

TypeScript native animation evaluation and game adapters. **T-811 is an unpublished
local candidate**, proposed as 0.2.0-alpha.1 for all three npm packages. Install
matching candidate archives together; never substitute the public RC2 core.

| Package | Proposed version | Tested engine |
|---|---|---|
| `@ankhimate/runtime` | 0.2.0-alpha.1 | Framework independent; v1/v2 reader, shared render helpers |
| `@ankhimate/pixi-runtime` | 0.2.0-alpha.1 (private local package) | PixiJS 8.17.0, WebGL2 |
| `@ankhimate/phaser-runtime` | 0.2.0-alpha.1 | Phaser 3.90.0, actual WebGL1 context in headless T-811 |

The documented common v2 profile covers regions, weighted meshes/FFD, trim and
multi-page atlases, compatible skins, sequential clipping, light/static dark tint,
Normal composition, events and distinct-clip crossfades. Constraints, physics,
linked meshes, rotated atlases and other blend modes remain outside it.

## Evidence and limits

T-810: 219 Node tests and 457 unchanged Pixi data snapshots. T-811 adds six pixel
comparator unit tests and **125 actual headless framebuffer comparisons, 104 exact**,
plus 20 logical lifecycle cleanups. DPR 1, 640×520, no framebuffer AA, linear texture
filtering, local unchanged native exports. Browser/GL versions and all per-case
metrics are recorded in the delivered parity report. One transformed clipping
contour pixel differs by alpha 64, within the predeclared edge bound. These results
are specific to one ANGLE/NVIDIA configuration, not broad GPU qualification.

No new runtime feature or product renderer correction was required in T-811.
No inference or interactive editor/desktop automation was run. An interactive GPU
review remains required via `npm run example:parity`. Historical RC2 and its narrower
public scope are unchanged. Read [features](docs/FEATURES.md),
[limitations](docs/KNOWN_LIMITATIONS.md), [integration](docs/RUNTIME_INTEGRATION.md),
[readiness](docs/RELEASE_READINESS.md) and [changelog](CHANGELOG.md).

## Public API example

```js
import { loadPixiRig } from '@ankhimate/pixi-runtime';
const asset = await loadPixiRig('/characters/sentinel/skeleton.json');
const instance = asset.createInstance({ skin: 'default' });
app.stage.addChild(instance.root);
instance.playback.play('idle', { loop: true });
const off = instance.playback.onEvent(event => console.log(event.name));
const tick = ticker => instance.playback.update(ticker.deltaMS / 1000);
app.ticker.add(tick);
// Cleanup before destroying the asset:
app.ticker.remove(tick); off(); instance.destroy(); asset.destroy();
```

Phaser uses `new PhaserRig(scene, raw, { pageTextureKeys })`, then
`rig.playback.play(name)` / `rig.playback.update(seconds)`. Legacy `rig.update(ms)`
is retained. Use `setTime(clip, time)` for direct sampling and `setSkin(name)` for a
compatible authored skin. Time-zero events are ignored each loop; interrupted
crossfades can jump. Asset ownership and complete loading are documented in the
[integration guide](docs/RUNTIME_INTEGRATION.md).

## Build and test from source

Use Node.js 22 or later and the committed npm lockfile.

```sh
git clone https://github.com/Kr-Apo/ankhimate-runtime.git
cd ankhimate-runtime
npm ci
npm run build
npm run typecheck
npm test
```

The browser test scripts use Playwright and need its matching browser installed;
that requirement applies to developers, not users of the shipped demo. Rust
parity scripts also require the accepted editor source and Rust toolchain.
See [CONTRIBUTING](CONTRIBUTING.md) for scope and validation.

- [Getting Started](docs/alpha/GETTING_STARTED.md)
- [Native runtime v2](docs/alpha/FORMAT_V2.md)
- [Troubleshooting](docs/alpha/TROUBLESHOOTING.md)
- [AI context](docs/alpha/AI_INTEGRATION_CONTEXT.md) and [llms.txt](llms.txt)
- [Maintainer assembly notes](release/alpha/BUILD.md)

Code is [MIT](LICENSE-MIT) OR [Apache-2.0](LICENSE-APACHE). Keep third-party and
asset notices. Report reproducible public-safe bugs using the issue template;
read [SECURITY](SECURITY.md) before disclosing a vulnerability.
