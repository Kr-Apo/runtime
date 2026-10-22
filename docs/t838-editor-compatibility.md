# Editor v0.1.5 and the prepared runtime source

Local preparation only; no new fork, tag, npm package or release exists. Original upstreams: [Ankhimate/editor](https://github.com/Ankhimate/editor) and [Ankhimate/runtime](https://github.com/Ankhimate/runtime). Future community fork URLs are unset in PUBLICATION-TARGETS.json until creation is authorized and verified.

| Component | Actual identity | Compatibility |
|---|---|---|
| Editor candidate | product0.1.5 / T838 | Ankh author schema1 / envelope1; not a format-version bump |
| Native export | format_version2, context_version1 | Independent axes, curves, compatible mesh/FFD and static dark tint data retained |
| Runtime core | @ankhimate/runtime0.2.0-alpha.1 at c4c38df269cfcb30f941221454b7202f40d3fa5b | Existing v1/v2 reader and evaluator; not a newly published package |
| PixiJS adapter | @ankhimate/pixi-runtime0.2.0-alpha.1, PixiJS8.17.0 | Documented native-v2 WebGL2 subset; protected historical qualification only |
| Phaser adapter | @ankhimate/phaser-runtime0.2.0-alpha.1, tested Phaser3.90.0 | Documented native-v2 subset; adapter-specific clipping/blending/appearance boundaries |
| PathPosition | Editor/CPU supported, older author readers reject the variant | Runtime/native/script exports that cannot represent it are refused; no runtime implementation added |
| Rendered exports | PNG/JPEG/WebP sequence, PNG sheets, external FFmpeg MP4/GIF | Default skin/Normal/no physics; sheet metadata is Ankhimate, not native Phaser atlas JSON |

Weighted meshes/FFD, skins and static dark tint do not imply universal support for linked meshes, constraints, physics, blending or arbitrary masks. Crossfade interruption may be discontinuous. CPU success is not proof of WebGL parity. No new GPU, real inference or physical Windows qualification is claimed.

## Editor → runtime

Choose the native **Data / atlas** preset, read preflight, and keep skeleton.json with its atlas pages. Obtain the exact compatible runtime source from the approved local checkpoint until the future runtime fork is created. Never install from a deleted old fork URL. Product0.1.5 does not impose npm0.1.5.

## Runtime → editor

The local editor v0.1.5 produces native v2 without a wire-format migration. A minimal data inspection after building the existing runtime source is:

```js
import { parseRig, evaluate } from './core/dist/index.js';
const rig = parseRig(await (await fetch('./skeleton.json')).text());
const pose = evaluate(rig, [{ animation: 'idle', time: 0.25, alpha: 1 }]);
console.log(pose.bones);
```

Serve files over HTTP; a renderer must also load the atlas and use its adapter's public API. This snippet inspects a pose, not a complete GPU renderer. Preserve the locked workspace dependencies; see existing examples for full adapter setup. The37 replayed core tests are precompiled protected tests, not a new adapter build.
