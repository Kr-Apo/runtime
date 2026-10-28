# Experimental ReplayV1 / PixiJS visual pilot (T-840C1/C2/C3)

Local development harness only. Existing Pixi/Phaser readers and LegacyT839 remain
unchanged. Requires the installed Node dependencies, a WebGL2 browser and this complete
local checkout, including core/dist and pixi/dist. No CDN, model or cloud API.

From the runtime repository:

```text
npm run build
node examples/replay-pixi-pilot/server.mjs
```

Open http://127.0.0.1:4188/examples/replay-pixi-pilot/ . The server binds loopback only.
The two scouts share immutable atlas textures, not numerical state or mesh buffers.
Choose Left/Right to address one owner.

1. Click **Arm exact playback**, request tick60: completed8, displayed8, backlog52.
2. Pump8 repeatedly, or pause/resume. **Redraw only** does not simulate.
3. **Pure seek preview** shows a pure pose, with displayed tick separate from completed0.
   Resume refuses; choose **Replay from zero**, then pump, or restart explicitly.
4. **500ms hitch** requests60 more exact ticks; debt remains visible, never discarded.
5. **Precommit audit fault** retains the last accepted pose. Only explicit reset clears
   numerical fault. The automated native `fault_at_9` clip also tests a real singular
   parent during solving, independently of the injected observer error.
6. **Restart real time** explicitly restarts at zero. It uses performance.now absolute
   timestamps through the opt-in shared `ReplayHostTimeBridge`. Represented binary64
   fractions are preserved across pauses; quantization to ticks happens only at the
   request boundary. No implicit pumping. It is not a RigPlayer delta adapter.

Diagnostics distinguish simulated/preview, committed/displayed tick, debt, health,
host-time failure, solver failure and presentation failure. A failed presentation
cannot undo completed simulation or external GPU effects.

## Scope and implementation

Only nativev2, one fixed default skin, static region attachments, Normal blend,
no dark tint and bone-transform-only clips. No authored meshes/FFD/clipping/slot or
attachment tracks, sequences, animated draw order, mixed constraints, mixing or events.
B4/B3/B6 checks stay authoritative. Unsupported source is rejected before texture loading.

The pilot now uses the public C2 entry
`@ankhimate/pixi-runtime/experimental-replay`. Its asset owns pages and instances;
each instance owns the real public `consumer`, root, immutable captured presentations
and existing Pixi view. There are no relative imports into private dist modules,
no stripped validation descriptor and no duplicate renderer or solver. Legacy
PixiRigAsset still refuses Physics. All original constraints and clip channels are
validated before renderer construction. The standalone consumer and contract live
in docs/t840c2/ and pixi/test/consumer/.

```js
import { ExperimentalReplayPixiAsset } from '@ankhimate/pixi-runtime/experimental-replay';
const asset = await ExperimentalReplayPixiAsset.load(nativeExportUrl);
const actor = asset.createInstance({ clip: 'sway' });
app.stage.addChild(actor.root);
const replay = actor.consumer;
replay.play(replay.context, 'sway', false);
replay.requestTick(replay.context, 60n); // default budget8,52ticks still due
actor.present();                     // actual committed tick8, never tick60
app.render();                        // redraw is observational
```

The exact API is retained. The shared `@ankhimate/runtime/experimental-host-time`
entry is opt-in; old DemoTime is retained only for historical tests/comparisons. Explicit preview
presentation is separate from simulated presentation. Destroy actors with dispose(),
then asset.destroy(); borrowed textures (from()) remain the caller's responsibility.
New WebGL2-only validation does not relax Legacy WebGL/constraint capability gates.

## Reproduction

```text
node --test scripts/t840c1/pilot.test.mjs
node scripts/t840c1/webgl.mjs NEW_EXACT_OUTPUT_DIRECTORY
node scripts/t840c3/webgl.mjs NEW_HOST_OUTPUT_DIRECTORY
```

The WebGL runner uses installed Chrome by default, overridable through
ANKHIMATE_BROWSER_PATH; no browser download. NEW_OUTPUT must not already exist.
It records actual WebGL2 vendor/renderer, raw readPixels, captures, independent Rust
pose comparisons, timings and lifecycle results. No historical golden is replaced.

The artwork is original deterministic synthetic fixture art; it is not Jade Sentinel
or the private Pharaon reference. `assets/skeleton.json` and atlas.png are untouched
native exports from scout.ankh.json plus source PNGs. Rust reference frames use the
same unchanged core, native Save/Reload and preset. Generate them with the editor
B6 checkpoint available locally:

```text
node scripts/t840c1/generate.mjs PATH_TO_EDITOR NEW_OUTPUT_DIRECTORY
```

The helper creates an isolated temporary Cargo project, offline, with local path
references; it does not edit the editor or add runtime dependencies. Uses installed
Rust1.95. It refuses existing output. See docs/t840c1/ for the complete qualification,
time and performance limits. See [C3 time contract](../../docs/t840c3/T840C3-TIME-CONTRACT.md) for 1x-only
absolute milliseconds, precision bounds, pause/deferred-tail semantics and explicit
rebind after seek/replay/reset. No default renderer activation.
