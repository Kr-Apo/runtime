# Experimental ReplayV1 Phaser pilot

From the Runtime root, install the existing locked dependencies if needed, run `npm run build`, then `node examples/replay-phaser-pilot/server.mjs`. Open the printed loopback URL. No network CDN is used.

Requires Phaser3.90.0 and an actual WebGL2 context, explicitly passed to Phaser. This is a local experimental example, not a new default player or distributed release. It uses public package entries and native exported PNG/JSON. Existing C1 assets are reused unchanged; `?fixture=scaled` selects the separate native C4 animated-scale export.

Two independent characters share immutable pages. Choose Left/Right. Arm exact, request tick60 (default budget8, backlog52), Pump8, pause/resume, pure seek, replay, stop/reset and disposal are explicit. Restart host time starts at zero using performance.now(); the same absolute domain feeds Scene.update. Prerender only presents the last completed snapshot. Redraw only performs no simulation. Hosts are disposed when changing exact contexts or shutting down a Scene.

Diagnostics expose requested/completed/backlog/displayed tick, simulated/preview label, numerical health, presentation/command errors and exact/host mode. Each character can pause, hitch and dispose independently. A fault requires reset. Use an ordinary HTTP(S) origin; file URLs are unsupported.

Run automated proofs from the root with a **new output folder**:

```text
node scripts/t840c4/webgl.mjs <new-folder>
node scripts/t840c4/resources.mjs <new-folder>
node scripts/t840c4/consumer.mjs <new-folder>
node scripts/t840c4/performance.mjs <new-folder>
node scripts/t840c4/memory.mjs <new-folder>
```

Set `ANKHIMATE_REPLAY_FIXTURE=scaled` for the second WebGL campaign. The TypeScript consumer is copied/compiled outside this repository and uses public ESM package entries. Browser drivers resolve those entries via importmaps from the existing local builds; application TypeScript never imports internal dist paths. See the [API contract](../../docs/t840c4/T840C4-API-CONTRACT.md).
