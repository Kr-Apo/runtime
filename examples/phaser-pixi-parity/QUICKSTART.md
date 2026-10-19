# T-810 — Manual Phaser / PixiJS bench

Pending maintainer qualification. Codex has not opened this page or run a GPU.
Use this isolated runtime checkout and the existing Node/npm toolchain.

1. npm ci --offline (or normal npm ci if your cache is incomplete).
2. npm run build
3. npm run example:parity
4. Manually open http://127.0.0.1:4180/examples/phaser-pixi-parity/.
   No automatic browser launch, CDN, model or editor executable is involved.
   Stop the local server with Ctrl+C. Use HTTP, not file://.

Select a fixture and click Load / recreate. Both views use the same original
JSON/pages, with identical root position/scale. Default clipping/ffd_alt combines
regions, bones, weighted FFD, skins, order, polygon clipping and colors. Other
choices isolate partial weights, trim, topology, multipage and event playback.

- Compare poses at 0, .25, .5 and .75 seconds, then the authored endpoint.
- Switch default/alternate skins, including while playing/fading and paused.
  Incompatible skins must show a precise refusal, not a partial pose update.
- Play/Pause/Resume/Stop; test speed, looping and Crossfade to next clip.
  Check the two event logs, especially endpoints and incoming fade events.
- Compare alpha/transparent fringes and dark tint on the checkerboard; inspect
  concave masks and their inclusive end slot. Any GPU discrepancy remains real
  even when the Node geometry suite passed. Do not patch the exported JSON.
- Switch fixtures repeatedly; Destroy both and Load / recreate again. Check
  developer-console errors, missing resources and cleanup during a long session.
- Separately try fractional root/camera alpha if relevant to your game: this is
  not covered by the deterministic default-global-alpha comparison.

Existing fade interruption may visibly jump. Physics, advanced constraints,
linked meshes, non-Normal blends and rotated atlases remain outside this common
qualified subset. A fixture with one clip cannot demonstrate a two-clip fade.

Record OK/KO/NOT TESTED, GPU/browser/OS, exact fixture, skin, clip, time and error.
No private projects or credentials are needed. The runtime package snapshots
must use matching local core + adapter builds; do not mix them with frozen RC2
or an older registry 0.1.1 just because its version label is the same.

[Contract and full matrix](../../docs/PHASER-PIXI-PARITY.md).

## T-811 candidate

See [candidate integration](../../docs/RUNTIME_INTEGRATION.md) and [limitations](../../docs/KNOWN_LIMITATIONS.md). Run `npm run test:parity` only with an installed browser; no automatic download. Headless results are distinct from your final interactive GPU review.
