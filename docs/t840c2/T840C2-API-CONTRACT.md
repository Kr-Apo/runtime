# T-840C2 — Experimental API contract

## Entry and compatibility

Use `@ankhimate/pixi-runtime/experimental-replay` from a locally built checkout. This additive ESM/types export does not change the default `@ankhimate/pixi-runtime` entry or publish a new version. PixiJS 8.17.0 / WebGL2 was tested. Legacy `PixiRigAsset.from/load` continues to refuse Physics constraints. The core v1 reader is unchanged, but this graphics entry requires native v2.

Exports: `ExperimentalReplayPixiAsset`, `ExperimentalReplayPixiInstance`, `validateExperimentalReplayPixiSource`, `DeepReadonly`, `ReplayPixiPresentation`. Create instances through an asset; direct instance construction requires an internal runtime token and is not a supported consumer API.

## Loading and validation

`await ExperimentalReplayPixiAsset.load(url, {signal?})` accepts HTTP(S), validates JSON before requesting atlas pages, and owns decoded page textures. It waits for all page outcomes and destroys completed pages on ordinary failure/cancellation. JSON errors, bad status, unsupported source data, missing pages and aborts reject the promise. Abort does not guarantee immediate completion if an external network operation never settles. No partial asset is returned.

`ExperimentalReplayPixiAsset.from(source, pages)` accepts native JSON data/string and a read-only page-index map of caller-owned Pixi textures. It validates full, correctly sized, untrimmed texture pages/PMA through the existing checks and borrows those textures. It copies the map; destroying this asset does not destroy caller textures. The caller must keep borrowed textures alive for all views. `.source` returns a detached inspection clone; `.resources` returns immutable counts and disposal state. Do not change underlying borrowed texture content while presenting.

`validateExperimentalReplayPixiSource(source)` returns a validated detached rig. Every clip and every renderer property must satisfy the [matrix](T840C2-CAPABILITY-MATRIX.md); unused clips are not hidden. Core numerical validation is preserved, including native clamping conventions. No alternate unvalidated descriptor is fed to the simulator.

## Creation and exact progression

```ts
import { ExperimentalReplayPixiAsset }
  from '@ankhimate/pixi-runtime/experimental-replay';

const asset = await ExperimentalReplayPixiAsset.load('/export/skeleton.json');
const instance = asset.createInstance({ clip: 'sway', epoch: 1n });
app.stage.addChild(instance.root); // app must use WebGL2
const consumer = instance.consumer;
consumer.play(consumer.context, 'sway', false);
consumer.requestTick(consumer.context, 60n); // default bounded batch: 8 ticks
const token = instance.capture();
// token.kind === 'simulated'; completed 8, requested 60, backlog 52
instance.present(token);
app.render();
while (consumer.currentFrame().backlog > 0n) {
  consumer.pump(consumer.context, 8);
  instance.present();
}
instance.dispose();
asset.destroy();
```

Creation accepts only `{clip, epoch?}`; unknown JavaScript options, including skin, layers and crossfade, reject. No suffix mapping or implicit visual feature fallback. The instance owns the real `.consumer`; its getter cannot be replaced. Its transport API and context validation remain those of the existing bridge: `requestTick`, `requestTime(numerator,denominator)`, `pump`, `transportStatus`, `currentFrame`, `play`, `pause`, `resume`, `stop`, `seekTick/seekTime`, `replayFromOrigin`, `reset`, `dispose`. Always use the current `.context`; reset/replay can replace it. Tick units are 1/120 second. Rational requests avoid an implicit floating wall-clock conversion. The B4 tick horizon is 8,388,607, about 19.4 hours; inherited bounds and errors remain authoritative. No gameplay-event support is added.

## Presentation and preview

`capture()` obtains a deeply immutable detached `simulated` token containing completed/requested/backlog, poseTick, health, skin and bones from the committed frame. Static slots/draw order come from the validated setup layout, whose channels cannot animate in this subset. Requested time never fills in a partially completed pose.

`present(token?)` applies only an authentic, current token owned by that instance. Forged, foreign, wrong-kind, stale context/epoch/completed/request/status tokens refuse. `capturePreview()` returns a `pure-preview` token or null; `presentPreview(token?)` is the explicit preview path. A preview is pure FK at the seek position, not a committed Physics checkpoint. Resume directly from preview follows B5A refusal; use replay-from-origin/reset as required. Instance methods do not weaken transport rules.

`.displayed` is the last successfully submitted token, not a GPU completion acknowledgement. Applying a new pose reuses `PixiRigInstance.setPose`, the existing meshes and buffers. An unchanged `capture()/present()` and app redraw reuse the immutable token/pose: no new solver tick, frame clone or buffer update. `.metrics` counts captures, preview captures, transfers, submissions, guarded reads and cache hits. New submission uses `consumer.present` for its mutation/reentrance guard, which performs one additional detached frame read; caching does not remove that check.

## Faults and destruction

Inherited B6 candidate failure commits no partial numerical tick. The last good frame remains presentable with a fault/debt diagnostic; reset is required before continuing. Observer failure and native solver failure are tested separately. A failed view update does not advance or fault the numerical transport and does not replace `.displayed`; arbitrary renderer/callback side effects are not a GPU transaction. Handle errors visibly and retry/rebuild graphics as needed without changing numerical history.

`instance.dispose()` destroys the view/listeners/geometries/buffers, disposes its consumer, clears presentation references and releases its registration; it is repeatable. `root.destroy()` also triggers the registered cleanup. Do not dispose recursively during presentation. `asset.destroy()` refuses while instances are live, then destroys owned pages once; borrowed pages stay alive, while the asset's own map is cleared. Dispose instances before their asset, and remove application-owned references. Directly disposing `.consumer` stops numerical use but does not replace `instance.dispose()` for graphics cleanup. Resource counters establish ownership release, not physical VRAM reclamation timing.

## Host time

No game-time converter is exported. The example's `DemoTime` accumulates monotonic `performance.now()` segments, flooring each segment to integer microseconds, then requests rational microseconds/1,000,000. It preserves hitch debt, excludes pauses, rejects backward/nonfinite readings and the inherited horizon, and resets its anchor. At the first boundary 8,333 microseconds maps to tick 0; 8,334 maps to tick 1. Repeated pause/resume loses a fractional microsecond per segment (1,000 segments of 0.9 microseconds produce zero). Session length and this quantization make it unsuitable as an implicitly distributed replacement for `RigPlayer.update(deltaSeconds)`. Exact ticks/rationals are the qualified conformance interface.
