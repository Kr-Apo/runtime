# Ankhimate Runtimes

**Game-side animation runtimes for Ankhimate**, written in TypeScript. Load exported skeletal animation data, evaluate poses and playback, and render supported rigs in PixiJS or Phaser.

This is the **unofficial Kr-Apo community fork** of [Ankhimate/runtime](https://github.com/Ankhimate/runtime). The source is public under **MIT OR Apache-2.0**, with upstream credits and third-party notices preserved.

> **Status: early development / public source fork.** The companion [Ankhimate Editor v0.1.5](https://github.com/Kr-Apo/editor/releases/tag/v0.1.5) is available as a Windows pre-release. The runtime source has been published separately; **no new npm release is implied**. Runtime package versions remain `0.2.0-alpha.1` and must not be confused with the editor's product version.

## Runtime packages

Each runtime is a separate workspace package because rendering-engine APIs and release cycles differ.

| Package | Source | Purpose |
|---|---|---|
| `@ankhimate/runtime` | [`core/`](core) | Framework-independent author-file/runtime-format parsing, animation evaluation, playback, events and pose data. |
| `@ankhimate/pixi-runtime` | [`pixi/`](pixi) | PixiJS 8 adapter for the supported native runtime v2 subset; WebGL2 is the qualified rendering path. |
| `@ankhimate/phaser-runtime` | [`phaser/`](phaser) | Phaser 3 WebGL adapter for the supported native runtime v2 subset. |

The core does not depend on the editor or a particular rendering engine. Adapters depend on the compatible core. **The PixiJS package is marked private in this repository's `package.json`; source availability is not an npm publication.**

## What works today

- **Portable animation core** — read supported runtime format v1/v2 data, evaluate bone and slot poses, and inspect attachment state without a rendering engine.
- **Animation playback** — play, pause, resume, stop, looping, per-instance time and speed, events, and bounded crossfades.
- **Transform timelines** — compatible translation, rotation, scale and shear tracks, including native v2 independent axes and stepped/linear/Bezier sampling.
- **Slots and appearance** — supported draw order, attachment changes, light color, static dark tint and compatible skin selection.
- **Meshes and deformation** — rigid and weighted meshes, compatible FFD keys, multi-page atlases and tested clipping scenarios within the adapters' documented boundaries.
- **Engine integrations** — separate PixiJS and Phaser implementations, examples and targeted parity/graphics tests.

Implemented code paths are **not** a promise of identical output for every rig or graphics backend. See the [feature scope](docs/FEATURES.md), [known limitations](docs/KNOWN_LIMITATIONS.md) and [Phaser/PixiJS parity notes](docs/PHASER-PIXI-PARITY.md).

## Compatibility and current limits

**Editor v0.1.5** exports compatible game data using its **native Data / atlas** preset. The game runtime consumes the exported runtime JSON and atlas pages, **not** the editor's `.ankh` authoring project directly.

- **PathPosition is unsupported** by the current game runtimes. The editor deliberately rejects incompatible runtime exports rather than silently dropping animation data.
- **Physics, advanced constraints, linked meshes, rotated atlas cases and arbitrary blend/mask combinations** do not have universal runtime fidelity or qualification. Use the specific adapter and feature matrix.
- **PixiJS**: the documented measured adapter targets **PixiJS 8.17.0 / WebGL2**. WebGPU and arbitrary WebGL1 fallbacks are not certified.
- **Phaser**: the documented measured adapter targets **Phaser 3.90.0 / WebGL**. Phaser 4 and Canvas rendering are outside this qualification.
- **Playback boundaries**: interrupted crossfades may jump; event-time-zero and skin/attachment compatibility have documented rules.
- **Evidence scope**: T-838 reran **37 protected, precompiled TypeScript core tests**. That is not a fresh build of every adapter, a new GPU campaign or a full cross-engine certification.

Read [Editor v0.1.5 compatibility](docs/t838-editor-compatibility.md) for the source checkpoints and format versions. The runtime/npm version and editor/product version are independent.
