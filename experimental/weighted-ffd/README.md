# Weighted FFD Replay (experimental A3)

See [the six reports](../../docs/t840c9-a3/REPORT.md). This is a fixed-skin, one-clip vertical slice, not a stable npm API or Q1 admission certificate.

```js
const consumer = new ReplayConsumerBridge(native, 'impact', 1n, undefined, {weightedFfd:true});
consumer.play(consumer.context, 'impact', false);
consumer.requestTick(consumer.context, 60n); // bounded work: initially accepts8
while (consumer.currentFrame().backlog) consumer.pump(consumer.context, 8);
const accepted = consumer.currentFrame(); // bones/Physics/FFD all tick60
```

Use `pixi.mjs`/`phaser.mjs` factories with the existing I2 application coordinator. Neither factory samples keys nor advances a second numerical controller. The accepted frame verifier is required by FFD views. Pure seek preview, dynamic skins, linked meshes and other timeline channels remain refused.

Build/test from repository root after installing the lockfile dependencies:

```
npm run build
npm test
node --test experimental/weighted-ffd/geometry.test.mjs
npm run typecheck
node experimental/weighted-ffd/prepare-demo.mjs NEW_OUTPUT EXISTING_BUILT_RUNTIME core/dist
```

The builder refuses an existing output directory. The built dependency runtime supplies already installed PixiJS/Phaser/fflate and compiled graphics helpers; the current core and experimental adapter sources are copied from this checkout. Launch the result with `node server.mjs .`; open pixi.html or phaser.html at http://127.0.0.1:4188. No network dependencies, admission supervisor or browser automation is needed to run the apps.

To independently regenerate the author/native/Rust reference, place the read-only Editor A2 checkout as a sibling named `editor` of this runtime checkout, then:

```
cargo run --locked --manifest-path tools/weighted-ffd-reference/Cargo.toml -- NEW_REFERENCE_OUTPUT
```

This headless tool uses native Save/Reload, document rebind and real A2 export. `fixtures/skeleton.json`, atlas.png and the22 selected Rust references are copied from its output without native JSON patching. Its complete721-tick trace accompanies the local validation delivery. The saved project and asset folder are under fixtures/author. Negative tests mutate copies only. Historical banks, certificates and original projects remain unchanged.
