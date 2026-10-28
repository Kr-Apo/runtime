# Experimental ReplayV1 visual skins (PixiJS WebGL2)

From the Runtime root, install the exact lockfile dependencies, `npm run build`, then `node examples/replay-visual-skins/server.mjs`. Open the printed loopback URL. Use Chrome with WebGL2. No cloud/model/service is used.

Choose Festival Ranger (two skins/two atlas pages) or Court Courier (three skins/four pages), and primary/delayed immutable calendars. Play queues no time by itself; request60 advances at most8 ticks, Pump advances the backlog. Live uses the public C3 host-time bridge. Pause/resume, seek pure preview, replay, stop/reset and actor disposal use public consumer APIs. Seek is not historically simulated Physics. The displayed diagnostics distinguish requested/completed/backlog, numerical/visual skin, active records and visible slots. Calendar events are absolute ticks and do not repeat with clip loops. Reload/recreate to replace a calendar.

```js
import { ExperimentalReplayPixiAsset } from '@ankhimate/pixi-runtime/experimental-replay';
const asset = await ExperimentalReplayPixiAsset.load(url, { visualSkins: true });
const actor = asset.createInstance({ clip: 'march', skinEvents: [
  { tick: 0n, skin: 'default' }, { tick: 20n, skin: 'festival' }
] });
app.stage.addChild(actor.root);
actor.consumer.play(actor.consumer.context, 'march', false);
actor.consumer.requestTick(actor.consumer.context, 60n);
actor.present(); // default, completed8/backlog52
actor.consumer.pump(actor.consumer.context, 12);
actor.present(); // festival, completed20/backlog40
app.render();
actor.dispose(); asset.destroy();
```

No direct visual setSkin, no attachment animation, mesh, FFD, clipping, dark tint, advanced blend, mixed constraints, crossfade, layer or gameplay-event support. Omit visualSkins to retain the old fixed-default C2 gate. Native v2 schema is unchanged. Source PNGs and original author schemas are retained under authors; assets are unchanged native exports with Rust references. Native Save/Reload projects and fault variants' author inputs are also retained in the delivery. The example was not authored through GUI automation.

[Contract](../../docs/t840c6a/T840C6A-SKIN-CONTRACT.md) · [Matrix](../../docs/t840c6a/T840C6A-CAPABILITY-MATRIX.md) · [Reproduction](../../scripts/t840c6a/README.md)
