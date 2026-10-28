# ReplayV1 Phaser experimental API contract

This is an additive opt-in subpath of the existing package, not a new package or a default activation:

```ts
import { ExperimentalReplayPhaserAsset, validateExperimentalReplayPhaserSource }
  from '@ankhimate/phaser-runtime/experimental-replay';
import { ReplayHostTimeBridge } from '@ankhimate/runtime/experimental-host-time';
```

The default `@ankhimate/phaser-runtime` exports and Legacy behavior are unchanged. Tested engine: Phaser **3.90.0**, supplied with an actual WebGL2 context. The existing peer range does not certify every Phaser 3 version. Phaser's default WebGL1 context is insufficient for this entry. Phaser 3.90's GameConfig.context TypeScript declaration names CanvasRenderingContext2D even though its WebGL renderer accepts a supplied WebGL2 context. The independent TypeScript consumer uses one explicit `unknown as CanvasRenderingContext2D` configuration cast for that upstream typing gap; it does not weaken the experimental API types.

## Validation and loading

`validateExperimentalReplayPhaserSource(unknown)` returns a detached validated native rig. It inspects the original source and **all clips**, including unused clips; it never removes channels or constraints. Parsing, existing graphics validation, and actual ReplayConsumer construction enforce the numerical and graphical policy. See [capabilities](T840C4-CAPABILITY-MATRIX.md).

`ExperimentalReplayPhaserAsset.load(game, jsonUrl, {signal?})` fetches native JSON and PNG atlas pages over HTTP(S). Validation precedes page fetching. Decodes are staged outside TextureManager. All pages must decode with the declared dimensions before any texture is installed. Abort and ordinary decode/install failures, including a callback throwing after insertion, remove entries installed by this load and revoke temporary object URLs. A Game destroy aborts outstanding loads. There is no promise of recovery from GPU/context loss or external mutation during a renderer callback.

`Asset.from(game, source, {pageTextureKeys})` borrows distinct existing full-page premultiplied textures. Their dimensions, identity and availability are checked. Caller owns borrowed textures; the asset never removes them. The caller must keep them alive through the last instance.

`asset.source` is detached. `asset.resources` is a frozen diagnostic count of live instances and page references, **not total driver memory**. Generated owned texture keys are unique. Destruction never removes another owner's replacement entry. Named atlas Frame metadata added to borrowed pages remains until the page owner's destruction; this is the existing Phaser atlas convention.

## Instances and transport

```ts
const asset = await ExperimentalReplayPhaserAsset.load(game, jsonUrl);
const instance = asset.createInstance(scene, {clip: 'sway'});
const c = instance.consumer; // actual ReplayConsumerBridge, not a facade clock
c.play(c.context, 'sway', false);
c.requestTick(c.context, 60n); // bounded default request: completes8, backlog52
instance.present();          // presents tick8, never tick60
c.pump(c.context, 8);        // explicit catch-up
```

`createInstance(scene,{clip,epoch?})` requires an active Scene in the asset's Game. Only clip/epoch options are accepted. Every instance owns its consumer, transport, clock, Physics state, snapshots and mutable Mesh/Vertex buffers. Static pages may be shared. One asset can survive Scene shutdown and create fresh instances after Scene restart.

Exact time also uses `c.requestTime(c.context,numerator,denominator)`; no floating delta accumulation is introduced. Pause/resume/stop, `seekTick`, `replayFromOrigin`, and `reset(context,newEpoch)` remain the core APIs. Get the current context after seek/replay/reset; old tokens and host bridges become invalid.

For real time, bind **one existing C3 ReplayHostTimeBridge** to the consumer and an absolute monotone millisecond source such as performance.now(). Use the same domain for start/update/pause/resume. `host.advance(now)` retains C3's exact binary64 conversion, 1x speed, bounded request/backlog, no implicit drain, horizon and regression/nonfinite checks. Use host.pause/host.resume while bound. Rebind explicitly after transport context changes. Host bridge disposal is the caller's responsibility; a disposed consumer makes a surviving bridge unusable.

## Snapshot presentation

`capture()` returns a deeply frozen, owner/context-bound `{kind:'simulated',snapshot}` token. `present(token?)` validates it and transfers the latest completed pose to Phaser. It refuses forged/foreign/stale/wrong-kind tokens. Repeated observation/redraw reuses cached snapshots and does not tick Physics or rewrite unchanged geometry. Resource identity is checked even on cached presentation.

`capturePreview()` returns null unless the transport is in pure seek preview. `presentPreview(token?)` is explicit and remains labeled `{kind:'pure-preview',snapshot}`. A preview is not a committed simulated frame, and successive seek previews are distinct. Resuming simulation requires the core's explicit replay operation.

`displayed` describes the last successful presentation, or null after disposal. `metrics` counts detached captures, preview captures, pose transfers, guarded reads, submissions and cache hits. These are not an allocation profiler.

Update requests/progresses simulation; Scene prerender observes and presents. Existing Phaser region geometry and Vertex.setUVs are reused. Orthographic adapter-owned Meshes have identity 3D model/view. The adapter uses public Face.transformCoordinatesLocal after the pose update so Phaser's preceding preUpdate cannot leave the submitted geometry one render behind. Application position/rotation/nonuniform scale belong to the public **2D root Container**, optionally nested under another Container. Do not mutate adapter-owned Mesh model/view/projection, vertices or textures. Normal camera scroll/zoom/rotation and root transforms are qualified.

## Errors and ownership

Numerical B6 faults retain the last valid snapshot and latch Physics until explicit reset. They do not become renderer faults. Invalid source/renderer/resources and presentation failures throw separately; external GPU effects are not transactional. A failed presentation does not retroactively roll back a committed numerical tick.

- Game owns TextureManager and engine pipelines. Asset owns only pages it loaded.
- Scene owns its display/update lists; shutdown/destroy disposes its instances.
- Instance root destruction also disposes consumer, detaches listeners and releases asset membership.
- `instance.dispose()` is idempotent. Disposing one/last instance does not destroy a shared asset.
- `asset.destroy()` is idempotent but refuses live instances. Game destruction disposes them first and tolerates TextureManager's earlier teardown.
- In a stopped deterministic harness, call normal `game.destroy()` then the public `game.step()` to process pending destruction; in a running game the next engine frame processes it. Do not call private runDestroy.

No context-restoration/device-loss certification, crossfade, gameplay events, dynamic skins, mesh/FFD or mixed constraints is claimed. See [qualification](T840C4-WEBGL-QUALIFICATION.md) and [next work](T840C4-NEXT.md).
