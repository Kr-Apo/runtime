# Ankhimate — Kr-Apo Community Fork (Unofficial)

This is a community-developed derivative maintained independently by Kr-Apo.
The original projects are [Ankhimate/editor](https://github.com/Ankhimate/editor)
and [Ankhimate/runtime](https://github.com/Ankhimate/runtime).
This derivative is not officially endorsed or maintained by the upstream
Ankhimate organization. Original MIT OR Apache-2.0 licensing, copyrights and
third-party attribution requirements are preserved. Naming identifies upstream
origin; no upstream trademark license or endorsement is claimed.

TypeScript animation evaluation and game adapters for native Ankhimate exports.
The experimental public alpha pairs the **Windows editor with PixiJS 8 / WebGL2**.

**[Editor and alpha download](https://github.com/Kr-Apo/ankhimate/releases/tag/alpha-2026.10.18-rc2)** ·
**[Integration guide](docs/alpha/PIXIJS_INTEGRATION.md)** ·
**[Compatibility matrix](docs/alpha/RUNTIME_COMPATIBILITY.md)**

## Packages and scope

| Workspace | Version | Purpose |
|---|---|---|
| `core` / `@ankhimate/runtime` | 0.1.1 | Shared parsing, pose evaluation and playback primitives; v1/v2 reader |
| `pixi` / `@ankhimate/pixi-runtime` | 0.0.0, private workspace | Qualified alpha adapter for explicit native v2, PixiJS 8.17.0, desktop WebGL2 |
| `phaser` | See its package manifest | Retained source adapter and historical regressions; outside the distributed alpha qualification |

No PixiJS npm package has been published by this release. Do not assume an npm
registry package with a similar version is the exact qualified checkpoint.
The distribution identifier `alpha-2026.10.18-rc2` is independent of these component versions.

## Start with the shipped example

Download the complete Windows alpha from the editor release, extract it and run
`Start-Demo.exe`. Jade Sentinel is its only official sample. The local demo has
two independent characters, looping/one-shot playback, fades, events and cleanup;
it needs no developer toolchain or external downloads. Source `examples/` and
fixture rigs are development harnesses, not additional official alpha examples.

## Integrate using public APIs

The archive provides an import map and [complete runnable example](docs/alpha/minimal.mjs).
Resolve `pixi.js`, `@ankhimate/runtime`, `@ankhimate/pixi-runtime` and `fflate`
using those shipped modules, or configure your own build from this source tree.
Serve assets over HTTP; `file://` is not supported by the demo loader.

```js
import { loadPixiRig } from '@ankhimate/pixi-runtime';

const asset = await loadPixiRig('/characters/sentinel/skeleton.json');
const instance = asset.createInstance({ skin: 'default' });
app.stage.addChild(instance.root); // app is an initialized PixiJS WebGL2 Application
instance.playback.play('idle', { loop: true });
const off = instance.playback.onEvent(event => console.log(event.name));
const tick = ticker => instance.playback.update(ticker.deltaMS / 1000);
app.ticker.add(tick);

// During scene cleanup:
app.ticker.remove(tick);
off();
app.stage.removeChild(instance.root);
instance.destroy();
asset.destroy(); // after every instance has been destroyed
```

See [ownership, error handling and complete cleanup](docs/alpha/PIXIJS_INTEGRATION.md).
Use `setSkin(name)` for a compatible authored skin; Jade itself authors only
default. Events at t=0 are ignored at startup and on each loop. Interrupted
crossfades can visibly jump because they do not snapshot the displayed mixture.

The qualified subset includes bones, regions, weighted meshes, FFD, Normal
light/static dark tint, compatible skins and sequential clipping. Unsupported
constraints, linked meshes and non-Normal blending are rejected. Mobile, WebGPU
and WebGL1 are not certified. Consult the matrix before making capability claims.

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
