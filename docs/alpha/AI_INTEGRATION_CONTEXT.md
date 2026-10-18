# Ankhimate integration context

## Product and scope

Windows editor authors .ankh projects; native export emits skeleton.json and PNG
pages. Browser playback uses independent TypeScript core + PixiJS adapter.
This candidate targets native v2, PixiJS 8.17.0, desktop WebGL2 and Normal blending.
The adapter is a private local 0.0.0 snapshot, not a published registry release.
Core is 0.1.1. Generated versions/hashes/entry points are in the
`distribution-manifest.json` (inside the downloaded archive); [documentation index](README.md).

## Entry points and lifecycle

Import maps resolve `pixi.js`, `@ankhimate/runtime`, `@ankhimate/pixi-runtime`,
`fflate` to compiled files under Runtime. `loadPixiRig(url, {signal?})` returns
an owned PixiRigAsset. `createInstance({skin?})` creates independent geometry and
transport sharing that asset's pages. Add instance.root to the stage.
Use instance.playback.play/crossFade/pause/resume/stop, speed, onEvent/unsubscribe
and update(dtSeconds). SetSkin is instance.setSkin(name); direct setTime/setPose
detach playback. No automatic ticker, audio, completion callback or registry
package assumption. A complete tested minimal snippet is
[minimal.mjs](minimal.mjs), with its [import-map HTML](minimal.html).

Remove ticker callbacks, unsubscribe, remove roots, destroy all instances, then
asset.destroy(), then the owned application. `PixiRigAsset.from(source,pageMap)`
borrows textures; only the external owner destroys those pages.

## Files

- Editor/Ankhimate.exe: unsigned Windows authoring application.
- Runtime/core/index.js: public evaluation/reader/player entry point.
- Runtime/pixi/index.js: loadPixiRig, PixiRigAsset, PixiRigInstance, PixiPlayback, PixiRigError.
- Runtime/vendor: bundled PixiJS and fflate browser modules.
- Examples/Jade-Sentinel/Sentinelle.ankh and Sentinelle.assets: author project.
- Examples/Jade-Sentinel/Export: verified native v2 data and atlas.
- Examples/Jade-Sentinel/demo.html: two-character demonstration.
- Docs: authoritative release guides. Start-Demo.exe serves only this tree.

## Semantic traps

World Y-up becomes screen Y-down in the adapter; never invert the source JSON.
JSON angles are degrees, evaluated core bone angles are radians. Independent
scalar X/Y tracks retain their own times and outgoing curves. Scale is a setup
multiplier, other transform animation channels are offsets. Weighted FFD is per
authored influence, not one delta per visible vertex. Atlas UVs reference original
source dimensions and pixel centres; trim padding is not extra content.
Static dark alpha is shadow strength. Events use (from,to], ignore t=0 on every
loop, and incoming events only during a fade. Interrupted crossfade outgoing is
the previous incoming clip, not the mixed-pose snapshot (Jade jump 11.8049 units).
Nonlooping end holds the pose while playing can remain true.

Regions, valid rigid/weighted meshes, FFD, compatible skins, tint and sequential
polygon clipping have qualified subsets. Constraints, linked meshes, mesh image
sequences, non-Normal blends and rotated atlases are rejected. Multi-skin
composition, nested mask intersection, WebGPU/WebGL1 and mobile performance
guarantees are outside this release. Read the complete
[matrix](RUNTIME_COMPATIBILITY.md), not only this summary.


---
Source-tree note: file locations and runnable browser examples above refer to
the extracted RC2 archive. Download the [complete alpha archive](https://github.com/Ankhimate/ankhimate/releases/download/alpha-2026.10.18-rc2/Ankhimate-Editor-PixiJS-Alpha-RC2.zip).
Source files here document that same API; GitHub does not execute the demo.
