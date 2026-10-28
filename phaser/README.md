> **T838 local preparation:** package versions are unchanged. Former fork destinations are historical; no replacement URL is created. Read the root README and docs/t838-editor-compatibility.md before following historical installation instructions below.

> **T-811 local candidate:** proposed 0.2.0-alpha.1. Install the matching core and adapter tarballs together; no npm publication. 125 headless pixel comparisons passed on one configuration, 104 exact. See the candidate integration guide (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/RUNTIME_INTEGRATION.md`; new destination pending).

# Ankhimate Phaser runtime

Phaser 3 playback for the `ankhimate-runtime` JSON and baked atlas produced by
Ankhimate's **Ankhimate runtime** export preset.

Framework-independent parsing, evaluation, playback, constraints, and runtime
types live in `@ankhimate/runtime`. This package adds only the Phaser WebGL
renderer adapter and re-exports the core API for compatibility.

**T-810 source checkpoint:** see Phaser/Pixi parity (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/PHASER-PIXI-PARITY.md`; new destination pending)
for the common native-v2 subset, new playback controller, safe pose/skin checks,
trim/texel-centre fixes and the manual dual-engine bench. Deterministic Node
qualification is separate from the T-811 measured WebGL headless suite (interactive GPU review remains pending).
Use matching local core + Phaser packages; the historic version labels do not
identify these unpublished builds. The public RC2 remains unchanged.

**M006.1 local candidate:** use the exact `m0061-8888e0e` snapshot archives and
hashes in the game example, with Phaser 3.90.0. They include dark tint, FFD timing,
skin UV and clipping corrections; package labels alone do not identify them.
Native exported physics does **not activate** in the TypeScript runtime because
the `target` / `bones[0]` contract is incompatible. Physics, advanced paths,
non-Normal composition, linked-mesh chains and combined skins remain excluded.
Clipping rectangles and the tested simple concave L are qualified only within
the measured scenarios, including Container transforms and skipped end slots.
See the current snapshot guide in `../docs/alpha-snapshot.md`.

## Install

```sh
npm install @ankhimate/phaser-runtime phaser
```

Load the exported JSON and every atlas page in Phaser's preload step, then
construct the rig in `create`:

```ts
import { parseRig, PhaserRig } from "@ankhimate/phaser-runtime";

preload() {
  this.load.json("hero-rig", "hero/skeleton.json");
  this.load.image("hero-atlas-0", "hero/atlas.png");
}

create() {
  const data = parseRig(this.cache.json.get("hero-rig"));
  this.hero = new PhaserRig(this, data, {
    pageTextureKeys: ["hero-atlas-0"],
  });
  this.hero.root.setPosition(400, 500);
  this.hero.play("idle");
}

update(_time: number, delta: number) {
  this.hero.update(delta);
  for (const event of this.hero.player.events) {
    if (event.name === "footstep") this.sound.play("step");
  }
}
```

`RigPlayer` and `evaluate` are exported separately for headless gameplay and
tests. Times accepted by those APIs are seconds; `PhaserRig.update` accepts the
millisecond delta supplied by Phaser.

## Runtime coverage

- setup poses and parented affine bone transforms;
- linear, stepped, and cubic-bezier keys;
- translation, shortest-arc rotation, multiplicative scale, and shear tracks;
- looping, non-looping playback, crossfades, and events;
- slot visibility, color, attachment, and draw-order tracks;
- IK and transform constraints, with the supported IK scalar / transform-mix tracks;
- path and deterministic fixed-step physics constraint code paths (visual parity
  is not qualified here; this does not advertise path/physics animation tracks);
- affine region quads, weighted and rigid meshes, linked meshes, and
  per-influence deform timelines;
- clipping polygons, trimmed and rotated atlas frames, attachment sequences,
  and normal/additive/multiply/screen slot blending;
- world-space bounding-box, path, clipping, and point queries through
  `attachmentWorldVertices` and `attachmentWorldPoint`.

The list above describes implemented paths, **not complete fidelity coverage**.
M003.2 validates the real walker `walk` / `leg_ik` clips and tagged_rig
`animation_1` against independent Rust/CPU references at four times, plus
synthetic UV, alpha, draw-order and v1/v2 probes. M005.3b additionally transports
static `dark_color` RGBA from the M005.3a native preset and renders it with a
dedicated Phaser SinglePipeline. Normal composition is qualified on regions,
an unweighted mesh, four atlas pages, animated light tint and filtered transparent
borders in Phaser 3.90.0 on Windows. See dark-tint qualification (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/dark-tint.md`; new destination pending)
and the independent dark-tint example (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/examples/phaser-dark-tint`; new destination pending).
Physics-driven native playback is incompatible, not merely untested. The
M005.4b1/b2/b3 reports qualify their specific FFD, skin and clipping scenarios;
arbitrary weighted/linked/concave and rotated/trimmed combinations remain outside
that coverage.
Do not interpret `unsupported: []` as a comprehensive capability report.

Rendering uses Phaser WebGL Mesh objects because Phaser Images cannot represent
general affine shear or weighted geometry. Constructing `PhaserRig` under the
Canvas renderer therefore throws a clear error; headless `RigPlayer` and
`evaluate` remain renderer-independent.

Phaser 4 is intentionally outside the 0.1 peer range; its renderer API is a
separate integration target.

Ankhimate world coordinates and Mesh vertices are Y-up. Phaser's Mesh projection
performs the screen Y conversion. Position `rig.root` in ordinary screen
coordinates and use a positive scale; do not flip the camera or exported Y.

## Playable example and integration guide

See `examples/phaser-game` (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/examples/phaser-game`; new destination pending) for an independent,
locked local game using the public API, the two real exports, movement,
crossfades and observable footstep events. It includes locally packed tested
runtime artifacts; it does not assume registry packages with the same version
labels contain this correction.

The PSD → Phaser guide (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/psd-to-phaser.md`; new destination pending) covers export, loading every
atlas page, animation, versions and known limits. The packages in this checkout
remain core 0.1.1 / adapter 0.1.0; this is not an npm release.

## Development

```sh
npm install
npm test
npm run typecheck
```

Licensed under either MIT or Apache-2.0, at your option.

## Experimental ReplayV1 (opt-in)

`@ankhimate/phaser-runtime/experimental-replay` provides Game-owned native assets and Scene-bound ReplayConsumer presentation. It requires a supplied **WebGL2** context and is tested with Phaser 3.90.0. The strict subset is native v2, Physics-only, fixed default skin, static regions and Normal blend; all clips are validated. The Legacy entry and defaults are unchanged.

See the [API contract](../docs/t840c4/T840C4-API-CONTRACT.md), [qualification and limits](../docs/t840c4/T840C4-REPORT.md), and [runnable pilot](../examples/replay-phaser-pilot/README.md). No package version or publication is included.
