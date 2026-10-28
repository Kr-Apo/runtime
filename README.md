# Ankhimate Runtimes

**2D skeletal animation runtimes for games — TypeScript core, PixiJS 8 and Phaser 3.**

Load compatible animations exported from [Ankhimate Classic](https://github.com/Kr-Apo/editor), evaluate skeletal poses, and render supported characters in a web game. The source also includes **ReplayV1**, an opt-in experimental pipeline for deterministic animation, continuous Physics, crossfades, interruptions, weighted FFD, animated slots and events.

**[Ankhimate Classic v0.1.6](https://github.com/Kr-Apo/editor/releases/tag/v0.1.6)** · **[ReplayV1 guide](docs/replay-v1.md)** · **[Runtime integration](docs/RUNTIME_INTEGRATION.md)** · **[Known limitations](docs/KNOWN_LIMITATIONS.md)**

> **Status — public source, experimental features.** The companion editor **v0.1.6** is a public Windows x64 **pre-release**. These runtime sources include the qualified, **opt-in ReplayV1 A17 pilot**, but this is **not** a general production-readiness or device-compatibility guarantee. Runtime package versions remain `0.2.0-alpha.1`; this source update **does not publish new npm packages**.

## Runtime packages

| Package | Directory | Purpose |
| --- | --- | --- |
| `@ankhimate/runtime` | [`core/`](core) | Framework-independent parsing, pose evaluation, animation playback, events and experimental ReplayV1 core. |
| `@ankhimate/pixi-runtime` | [`pixi/`](pixi) | PixiJS 8 adapter for supported native-v2 rigs; WebGL2 is the qualified ReplayV1 rendering path. |
| `@ankhimate/phaser-runtime` | [`phaser/`](phaser) | Phaser 3 adapter for supported native-v2 rigs; WebGL2 is the qualified ReplayV1 rendering path. |

The core is independent of a rendering engine. The adapters use the matching core version. **`@ankhimate/pixi-runtime` is marked `private` in its package configuration**, and public source code should not be mistaken for an npm release.

## From Classic to a game

1. Create and animate your character in **Ankhimate Classic**.
2. Use **Export → Data / atlas** and check the export preflight for incompatibilities.
3. Keep the exported **native-v2 JSON** and all referenced **atlas PNG pages** together.
4. Load those assets over HTTP into a supported PixiJS or Phaser integration.
5. Choose either the **Legacy playback API** or an explicitly admitted **ReplayV1** mode; their capabilities and guarantees are different.

**The runtimes consume exported game data, not the editor's `.ankh` author project directly.** A successful editor preview or CPU/video export does not automatically establish WebGL runtime compatibility.

See the [editor/runtime compatibility contract](https://github.com/Kr-Apo/editor/blob/main/docs/editor-runtime-compatibility.md) and [integration guide](docs/RUNTIME_INTEGRATION.md).

## What is supported?

| Capability | Legacy playback | Experimental ReplayV1 |
| --- | --- | --- |
| Bone transforms and keyed animation | Supported compatible subset | Deterministic, explicitly admitted sampling |
| Play, pause, resume, loops and crossfades | Existing playback APIs | Logical 120 Hz clock, bounded transitions |
| Regions, meshes, weights and FFD | Supported adapter-specific subset | Qualified standalone pilots; weighted FFD mixing in A17 |
| Slots, colors, attachments and draw order | Supported compatible subset | Transactional composition in A17 |
| Animation events | Existing event rules | Incoming-clip ownership and accepted event queue |
| Physics and interruption composition | No general parity guarantee | One continuous Physics instance and accepted-pose interruption in A17 |
| Linked meshes, clipping and dynamic skins | Adapter-/feature-specific limits | Separate pilots; **not composed in A17** |
| PixiJS / Phaser rendering | Supported engine paths | Bounded real-WebGL2 qualification |

**Standalone experimental features are not automatically composable.** See the [full ReplayV1 matrix](docs/replay-v1.md), [feature history](docs/FEATURES.md) and [PixiJS/Phaser parity notes](docs/PHASER-PIXI-PARITY.md).

## ReplayV1 — integrated combat animation (A17)

ReplayV1 is a separate, **opt-in experimental consumer**. It uses one 120 Hz logical clock and a single transactional numerical update before rendering. The A17 pilot combines:

- Bone mixing and bounded crossfades.
- Repeated interruptions using accepted pre-Physics pose snapshots.
- Weighted free-form deformation (**FFD**) before skinning.
- Animated slot colors, visibility, attachments and draw order.
- Animation events associated with the incoming clip.
- One continuously evaluated Physics instance.
- Deterministic replay and transactional rejection of invalid updates.
- PixiJS 8 / Phaser 3 WebGL2 presentation, context restoration and lifecycle handling.

A GPU presentation failure preserves the previous graphical frame **without rolling back numerically accepted state or events**. Rendering a frame again does not resample its animations.

### A17 admission limits

The integrated composition pilot intentionally accepts a **narrow domain**:

- Native export **v2**, fixed **default skin**, **Normal** blending.
- Exactly four clips: `Idle`, `Attack`, `Hit`, `Death`.
- One stable, always-selected/visible weighted FFD mesh owner; immutable topology and binds.
- At most **128 bones**, **32 slots**, **128 attachments** and **512 FFD scalar components**.
- Up to **64 transition commands per session**; no automatic journal compaction.
- Up to **1,024 pending event occurrences**; the application must drain and handle them.
- No A17 composition with linked meshes, clipping, dynamic skins, arbitrary layers, dark tint or additional constraint families.
- Mixed **empty/full FFD key vectors** remain **HOLD**. A complete zero-offset key is different from an empty key.

Event draining removes accepted occurrences **at most once**. It does not guarantee durable, exactly-once delivery of external game actions such as sounds, damage or particle effects.

The full budget, clip-time policy, accepted-pose interruption rules and exclusions are documented in **[ReplayV1 — contracts and limits](docs/replay-v1.md)**. Do not assume that other artistic rigs, longer gameplay sessions, browsers or GPUs inherit the pilot's qualification.

## Build from source

This repository is a TypeScript workspace. Use the matching dependencies and the source tree; **do not assume a published npm package contains the latest ReplayV1 work**.

```bash
git clone https://github.com/Kr-Apo/runtime.git
cd runtime
npm ci --ignore-scripts
npm run build
npm run typecheck
npm test
```

For source-only development, see [`core/`](core), [`pixi/`](pixi) and [`phaser/`](phaser). WebGL tests additionally require a suitable browser and GPU environment; passing Node tests alone does not qualify rendering.

### Run the A17 demo locally

After building the workspace, create a **new output folder** and prepare the bounded integrated-combat demonstration:

```bash
node experimental/integrated-combat/prepare-demo.mjs A17_DEMO . core/dist b
node A17_DEMO/server.mjs A17_DEMO
```

Open the local server's `pixi.html` or `phaser.html` page in a supported desktop WebGL2 browser. The demo exposes animation playback, transitions, interruptions, replay, event draining and actor state. Use a fresh destination rather than overwriting qualified historical fixtures.

**[Integrated Combat demo and contracts](experimental/integrated-combat/README.md)** · **[Gate B interruptions](experimental/integrated-interruptions/README.md)**

The Combat Frog fixture was authored through native APIs and tested for numerical and graphical parity. It is **not** evidence that every corresponding creative operation is available or equally polished in the Classic GUI.

## Qualification and boundaries

The A17 campaign compared native Rust reference trajectories, TypeScript playback and actual graphics submissions on **PixiJS 8.17.0** and **Phaser 3.90.0**. Its historical evidence includes **1,155 workspace TypeScript tests**, **528 selected CPU/GPU/cross-engine poses**, and **1,882 historical GPU captures**. These totals describe the original A17 qualification; they were **not all rerun** for the public-source update.

The P01-RC1 preparation separately reran **1,155 TypeScript workspace tests**, six Rust reference tests and **198 fresh WebGL2 poses** against previously accepted CPU pixels. The accepted historical CPU raster and all historical graphics campaigns were not regenerated.

Measured hardware was a **Windows / Chrome / NVIDIA RTX 3090 WebGL2** environment. This is **not** a certification for mobile devices, WebGPU, arbitrary WebGL1 implementations, every browser, all rig complexities or universal performance.

Read the [ReplayV1 evidence lineage](docs/replay-v1-evidence.md) for the sequence of qualified experimental capabilities and their independent limitations.

## Known limitations

- **PathPosition** is not supported by the game runtimes; incompatible exports should be refused rather than silently degraded.
- Not every Classic constraint, linked/shared mesh, clip combination, blend mode, atlas variation or mask has universal runtime parity.
- Legacy interrupted crossfades can be discontinuous. ReplayV1's accepted-pose interruption guarantees apply **only to explicitly admitted experimental modes**.
- A17's 64-command journal and event-queue limits matter for prolonged gameplay; do not silently reset an actor to hide saturation.
- A successful CPU/video export is not a guarantee of GPU parity.
- Source availability is separate from versioned npm publication; package versions remain `0.2.0-alpha.1`.

See [Known limitations](docs/KNOWN_LIMITATIONS.md) and [ReplayV1 scope](docs/replay-v1.md).

## Documentation

- [ReplayV1 contracts, capabilities and limits](docs/replay-v1.md)
- [ReplayV1 validation lineage](docs/replay-v1-evidence.md)
- [Runtime integration guide](docs/RUNTIME_INTEGRATION.md)
- [Legacy feature scope](docs/FEATURES.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [PixiJS / Phaser parity](docs/PHASER-PIXI-PARITY.md)
- [Ankhimate Classic v0.1.6](https://github.com/Kr-Apo/editor/releases/tag/v0.1.6)

## License and origin

This is the **unofficial Kr-Apo community fork** of [Ankhimate/runtime](https://github.com/Ankhimate/runtime), not an upstream-endorsed release. Source code is dual-licensed under **[MIT](LICENSE-MIT) OR [Apache-2.0](LICENSE-APACHE)**. Original copyright, upstream credits and third-party notices are preserved.
