> **T838 local preparation:** package versions are unchanged. Former fork destinations are historical; no replacement URL is created. Read the root README and docs/t838-editor-compatibility.md before following historical installation instructions below.

> **T-811 local candidate:** proposed 0.2.0-alpha.1. Install the matching core and adapter tarballs together; no npm publication. 125 headless pixel comparisons passed on one configuration, 104 exact. See the candidate integration guide (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/RUNTIME_INTEGRATION.md`; new destination pending).

# `@ankhimate/runtime`

Framework-independent TypeScript support for Ankhimate data and animation.
It has no renderer, DOM, Canvas, WebGL, WebGPU, Phaser, or editor dependency.

**Local alpha snapshot:** package label 0.1.1 alone is not a compatibility
guarantee. Use the exact `m0061-8888e0e` archives/hashes recorded by the Phaser
example. Native exported physics currently does **not activate** in this reader:
the exporter describes the simulated bone in `target`, while the physics entry
point reads `bones[0]`. Do not ship physics-driven playback from native exports.
Advanced paths, non-Normal blending, linked-mesh chains and combined skins are
outside the qualified alpha scope. Old v2 nonlinear FFD exports must be
re-exported from the corrected editor; a new reader cannot recover lost curves.

## Install

```sh
npm install @ankhimate/runtime
```

## Native `.ankh`

```ts
import { assetRootFor, loadAnkh } from "@ankhimate/runtime";

const projectUrl = "/avatar/animations.ankh";
const bytes = new Uint8Array(await (await fetch(projectUrl)).arrayBuffer());
const root = assetRootFor(projectUrl);
const loaded = await loadAnkh(bytes, {
  async loadAsset(file) {
    const response = await fetch(new URL(file, new URL(root, location.href)));
    if (!response.ok) throw new Error(`could not load ${file}`);
    return new Uint8Array(await response.arrayBuffer());
  },
});
```

`parseAnkh` accepts binary `.ankh`, readable `.ankh.json`, compact
`.ankh.min.json`, or an already-decoded object. Binary input validates the
envelope, decoded-size limit, raw Deflate, length, CRC-32, MessagePack, compact
keys, schema version, asset dimensions, and confined asset paths.

The library never fetches on its own. `loadAnkh` receives a loader callback so
browser games, Node tools, bundlers, native shells, and test harnesses retain
control of transport, caching, authentication, and cancellation.

## Runtime export playback

The package also owns the deterministic evaluator previously embedded in the
Phaser adapter:

```ts
import { parseRig, RigPlayer } from "@ankhimate/runtime";

const rig = parseRig(runtimeJson);
const player = new RigPlayer(rig).play("idle");
const pose = player.update(1 / 60);
```

`evaluate`, attachment world queries, constraints, physics, crossfades, and
events are renderer-independent. An engine adapter consumes `RigPose` and the
atlas metadata to draw.

### Runtime format versions

The reader in this development branch accepts `ankhimate-runtime` exports with
`context_version: 1` and the following independent `format_version`:

- **Absent or 1:** legacy paired `translate`, `scale`, `shear` keys. Their
  shared easing and optional per-bone `offset` retain the original semantics.
- **2:** independent scalar `translate_x`, `translate_y`, `scale_x`, `scale_y`,
  `shear_x`, `shear_y` tracks. Every key has `{time, value, curve}` (extra exporter
  metadata is allowed). Curves describe the segment leaving the key; a Bezier
  curve is `{type: "bezier", handles: [x1, y1, x2, y2]}`. Missing/empty axes keep
  setup values, translation/shear add, and scale multiplies. Shear values are
  degrees. Times already include authoring offsets, so `offset` and paired
  tracks are rejected in v2. Bone sampling rounds the playhead to f32 to match
  Rust at stepped key boundaries. Bezier Y handles may overshoot; X must remain
  within `[0,1]`. Scalar key times/values/handles must be finite and times sorted.

`parseRig` rejects unknown versions and mixed v1/v2 bone tracks. Rotation remains
a scalar track with shortest-arc interpolation. Other channels are unchanged.
This does not upgrade FFD, slots, constraints, or rendering parity by itself.

M005.3b adds optional static `RuntimeSlot.dark_color: [R,G,B,intensity]` and carries
it into `SlotPose.dark_color`. Present values must be four finite numbers; parsing
does not round or clamp them. Missing fields in v1/v2 retain the old pose shape.
There is no dark animation channel. Explicit light-color curves now use the
existing linear/stepped/Bezier sampler (the old implementation incorrectly
sampled every color track as stepped); omitted legacy curves remain stepped.
This describes the local source snapshot, not a new npm release.

V2 exports require this updated reader. Old readers that do not understand the
version field may accept the JSON but ignore the axes. The package version is
still 0.1.1 in the checkout; no npm release/version bump is part of M001a.
Re-export from the authoring project to restore data lost in older exports.
Custom/saved old presets retain their v1 bodies until explicitly replaced.

### Rust/TypeScript parity gate

`npm test` verifies `test/fixtures/runtime_axes_parity.json`, generated by the
editor's actual native preset and Rust evaluator. It compares independent axes,
steps, asynchronous Bezier keys, overshoot, offsets, layered alpha and world
affines. The absolute tolerance is 0.01; failures are never auto-updated.

To also check that the recorded fixture matches a current local editor checkout:

```sh
node scripts/check-rust-parity.mjs /path/to/editor /path/to/cargo
npm test
```

On Windows this can be
`node scripts/check-rust-parity.mjs C:/path/to/editor C:/path/to/cargo.exe`.
The checker is read-only. A deliberate regeneration uses the editor example
`cargo run --quiet --locked --offline -p ankhimate-export --example runtime_axes_parity`
and records its stdout as the fixture after reviewing the changes.

## JSON string round trips

The current native preset preserves Unicode, quotes, backslashes and control
characters using JSON serialization. Runtime format v2 and v1 reader compatibility
are unchanged. `npm test` also reads four real Rust exports with special names
and event payloads, including animation keys `__proto__`, `constructor` and
`toString`. Verify their fixture against the live editor without rewriting it:

```powershell
node scripts/check-rust-strings.mjs C:/path/to/editor C:/path/to/cargo.exe
```

## Boundaries

For a reproducible game using the tested local artifacts, see the
PSD → Phaser integration guide (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/psd-to-phaser.md`; new destination pending) and
standalone example (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/examples/phaser-game`; new destination pending). A package's version label alone
does not identify the unreleased M003.2 source; the example records archive
integrities and the renderer source commit.

- Native `.ankh` parsing returns the complete name-keyed authoring schema.
- `parseRig` reads the normalized `ankhimate-runtime` export optimized for
  evaluation and rendering.
- Converting arbitrary authoring projects into the normalized runtime export is
  exporter work; it is not silently guessed at load time.

Licensed under MIT OR Apache-2.0.

Opt-in absolute host-time conversion for ReplayV1: [T-840C3 time contract](../docs/t840c3/T840C3-TIME-CONTRACT.md). Exact ticks remain authoritative; Legacy playback is unchanged.
