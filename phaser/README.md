# Ankhimate Phaser runtime

Phaser 3 playback for the `ankhimate-runtime` JSON and baked atlas produced by
Ankhimate's **Ankhimate runtime** export preset.

Framework-independent parsing, evaluation, playback, constraints, and runtime
types live in `@ankhimate/runtime`. This package adds only the Phaser WebGL
renderer adapter and re-exports the core API for compatibility.

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
borders in Phaser 3.90.0 on Windows. See [dark-tint qualification](../docs/dark-tint.md)
and the independent [dark-tint example](../examples/phaser-dark-tint/).
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

See [`examples/phaser-game`](../examples/phaser-game/) for an independent,
locked local game using the public API, the two real exports, movement,
crossfades and observable footstep events. It includes locally packed tested
runtime artifacts; it does not assume registry packages with the same version
labels contain this correction.

The [PSD → Phaser guide](../docs/psd-to-phaser.md) covers export, loading every
atlas page, animation, versions and known limits. The packages in this checkout
remain core 0.1.1 / adapter 0.1.0; this is not an npm release.

## Development

```sh
npm install
npm test
npm run typecheck
```

Licensed under either MIT or Apache-2.0, at your option.
