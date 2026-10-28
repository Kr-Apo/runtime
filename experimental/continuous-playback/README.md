# I2 — continuous application playback

Separate application experiment based on I1. I1, the supervised Q1/N6 authority,
core equations, formats, and G1/G2 renderers remain unchanged. No npm export is
added. No new animation capability is introduced.

## Run the supplied applications

Serve the ready-to-run `applications` directory with `START.cmd` or
`node server.mjs .`, then open `/pixi.html` or `/phaser.html`. The Node process is
only a static localhost HTTP server; there is no supervisor, browser driver,
certificate, model, CDN or permanent test process in either application.

Rebuild from existing installed dependencies, without overwriting a delivery:

```text
node experimental/continuous-playback/prepare-demo.mjs NEW_OUTPUT DEPENDENCY_RUNTIME CORE_DIST
```

The demo supports `?actors=1` or2, `?manual=1`, `?fixture=regions` or combined,
and `?calendar=fixed` or primary. Reload explicitly destroys/recreates actors at
origin; it is not a per-loop reset. The default page runs continuously. Tick,
clip, skin, Physics health, epoch, backlog, suspensions and errors are visible.

## Minimum integration recipe

`manifests/*.json` are optional **application companions, not runtime v2**:

```json
{"schema":"ankhimate.application/1","native":"skeleton.json","clip":"march"}
```

This uses the native default skin. Optional `skinEvents` contains strictly
ordered integer ticks, starting at0 and known skin names. It supplies an external
absolute calendar; the native export does not contain that timeline. The JSON's
own atlas page names, geometry, constraints, clip duration and looping are the
authority. No atlas remap, forged native field or duplicate looping flag is used.

```js
const recipe = await loadIntegrationManifest({
  source:'/fixtures/combined/integration.json', loadAsset:loadPixiAsset,
});
const actor = createPixiActor({
  asset:recipe.asset, clip:recipe.clip, skinEvents:recipe.skinEvents,
  renderer:app.renderer, stage:app.stage,
});
actor.play();
actor.startRealtime(performance.now());
// In the owning application's RAF, while visible/active:
actor.update(performance.now()); // absolute monotone milliseconds, NOT delta
actor.present();
app.render();                   // never advances Physics
```

Phaser uses loadPhaserAsset({source,game}) and createPhaserActor({asset,scene,...}).
The demo shows the full visibility/freeze/context coordinator; an embedding
application owns those browser events and must implement its suspension policy.
Actor itself does not install global document hooks or invent a physical clock.

## Time contract

- One ReplayConsumerBridge per actor; optional ReplayHostTimeBridge only borrows it.
- Manual: play, nondecreasing advanceToTick, explicit pump(1..8), pause/resume.
- Realtime: explicit startRealtime anchors to the existing requested tick,
  preserving backlog; update(now) uses the existing host bridge and8tick budget.
- Realtime cannot revert to manual on an active actor, even while paused. Recreate
  explicitly to restart/change mode. play then startRealtime is valid.
- Pause/resume in realtime take the same absolute clock. Waiting time is excluded;
  backlog and active fractional tail are preserved. Draw and repeated timestamps
  never secretly drain backlog. No interpolation or hidden tick dropping.
- I1's256cap is absent. The unchanged native MAX_SAMPLE_TICK=8388607 still applies;
  the underlying clock's larger u64 range does not override sampling safety.
- The supplied default policy pauses on document hidden, page freeze and context
  loss. A user pause survives system resume. Redraw the accepted pose after GL
  restoration, before resuming the clock. A renderer failure can precede the loss
  event: pause based on actor state, not merely a running RAF flag.
- A late callback without a suspension event requests the true elapsed target and
  leaves an observable backlog. At very low rendering rates8ticks/request may
  not keep up; there is no automatic speedup or universal FPS promise.
- Invalid/backward/out-of-domain times refuse without changing accepted Physics.
  The UI stops RAF and reports the original failure. Outside native time bounds,
  even pause(now) may refuse: reload/recreate is required, never a hidden reset.

Clip looping wraps sampling time only. Absolute skin events, epoch and Physics
state do not restart. After the final primary event241/festival the skin stays
festival; periodic costume changes require another author/runtime contract.

## Resources, errors and scope

Views own two mutable banks/targets and borrow shared asset pages. The asset
refuses disposal while borrowed. Destroy actors, asset, then renderer/Game.
Scene/Game destruction is guarded. Partial loads and canceled/replaced generations
release staged pages; errors never install half an actor. Context loss invalidates
pixels; there is no universal GPU atomicity or physical VRAM-free promise.

The real ten-minute RAF sessions and accelerated numerical/graphic campaigns are
separate local application evidence. They do **not** extend Q1's H256 certificate.
Q1 still refuses257. No universal browser/headful/hardware, near-singular, infinite
playback, FFD, linked meshes, clipping, mixing, dark tint or blend-mode guarantee.
The tested long weighted case is Courier's final festival mesh4; night mesh5 is
exercised at its original early absolute transitions, not a new long-night test.

Tests include real-core unit tests, independent E1 Rust re-export/reference,
Decimal/CPU/GPU comparisons, controlled boundary errors and genuine Chrome lifecycle
events. Test clock injections are labeled and never presented as realtime or
artistic evidence. Native-reference.rs is a test-only producer, not a new solver.
