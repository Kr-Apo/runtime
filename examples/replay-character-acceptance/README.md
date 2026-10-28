# ReplayV1 articulated character acceptance

Optional local C5A harness, using public experimental package entries. This is not a new supported graphical feature set or a distributable alpha.

From the Runtime root, with the locked dependencies installed:

```sh
npm ci
npm run build
node examples/replay-character-acceptance/server.mjs
```

Open the printed loopback URL. Select **Phaser** or **Pixi**, Moss Ranger or Clockwork Courier, and `march` or `salute`. Scout is an unchanged control (its compatible clip is `sway`). Loading a selection creates a fresh page/engine. Set actors to 1–25; the target index chooses the transport owner. Exact controls request/pump canonical ticks; preview is a pure seek, while replay simulates from zero. Live uses the real host-time bridge. Hitch suspends host updates for 500 ms, exposing backlog before draining it. Pause does not turn numerical debt into committed poses. Diagnostics show requested/completed ticks, backlog and health.

Both renderers use explicit LINEAR filtering for comparable pixels. Supported scope remains native v2, static default-skin regions, setup slot/order, Normal, Physics-only bone clips, WebGL2, one clip at a time. No mesh/FFD, clipping, dynamic graphical skins, slot animation, mixed constraints, dark tint, events or mixing are enabled. The application imports package names; its local import map resolves their public export files after building.

## Reproduce automated evidence

The scripts require Node, installed Playwright and a real WebGL2-capable browser. On Windows the default browser is installed Chrome; override `ANKHIMATE_BROWSER_PATH` for another executable. Every output directory below must be new; retain failed runs instead of overwriting them.

```sh
node --test phaser/test/replay-character-acceptance.test.mjs
node scripts/t840c5a/qualify.mjs /absolute/new/qualification
node scripts/t840c5a/reliability.mjs /absolute/new/reliability
node scripts/t840c5a/live.mjs /absolute/new/live
node scripts/t840c5a/benchmark.mjs /absolute/new/benchmark
node scripts/t840c5a/profile.mjs /absolute/new/profile
node scripts/t840c5a/query-probe.mjs /absolute/new/query-probe
node scripts/t840c5a/numerical.mjs /absolute/new/numerical
node scripts/t840c5a/memory.mjs /absolute/new/memory
node scripts/t840c5a/consumer-phaser.mjs /absolute/new/consumer-phaser
node scripts/t840c5a/consumer-pixi.mjs /absolute/new/consumer-pixi
node scripts/t840c5a/legacy-probes.mjs /absolute/new/legacy-probes
```

Benchmark cadences are controlled logical input schedules, not guaranteed display rates. Nested exclusive profile measurements and allocation tracing are separate intrusive runs. CPU WebGL submission does not measure GPU execution. Half-paused binary64 host endpoints can be just below a rational tick boundary; compare equal ticks, not rounded wall-clock ideals. The query probe temporarily intercepts an immutable GL query in its isolated test page and restores it; it ships no runtime cache or optimization.

## Native author and reference provenance

`authors/ranger` and `authors/courier` contain new original paper-puppet artwork and native author-schema JSON. They are headlessly authored, not evidence of a new interactive GUI authoring session. The unchanged Editor B6 loader performs native Save/Reload and the unchanged default exporter generates every `skeleton.json` and atlas. Source art, exported bytes and actual Rust ReplayConsumer references are inventoried by SHA-256 in `assets/*/provenance.json`. Fault variants are separate native author copies with a deliberate singular scale at tick 9, never manually patched runtime JSON.

The optional deterministic art recipe requires Python/Pillow (tested with Pillow 12.3):

```sh
python scripts/t840c5a/create-authors.py /absolute/new/author-directory
cargo +1.95 run --offline --locked --manifest-path scripts/t840c5a/reference/Cargo.toml -- /absolute/new/author-directory/ranger /absolute/new/native-ranger
```

The Rust helper expects the accepted Editor checkout as sibling `../editor`, at `275082e8f26d42389ed05fb92c45e2822006525d`; it does not download or change that checkout. Its inherited standalone Cargo package name is a helper identifier, not a product version change. Saved `.ankh`/assets, all logs, raw profiles and screenshots are retained in the separate C5A delivery. Do not regenerate over accepted evidence.

See [character qualification](../../docs/t840c5a/T840C5A-CHARACTER-QUALIFICATION.md), [performance](../../docs/t840c5a/T840C5A-PERFORMANCE.md) and [Legacy triage](../../docs/t840c5a/T840C5A-LEGACY-PHASER-TRIAGE.md). Art seams, rigid joints and the hat gap are documented author limitations. Device loss, broad hardware support and polished production rigs remain unqualified.
