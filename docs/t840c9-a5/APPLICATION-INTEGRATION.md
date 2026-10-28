# PixiJS / Phaser application integration — A5

The event API belongs to the Replay consumer and the existing I2 actor, not to rendering code. The two new thin factories are `experimental/replay-events/pixi.mjs` and `phaser.mjs`. They reuse existing asset loading, Texture/Vertex/Face handling, static/weighted geometry, atlas projection, double banks and lifecycle ownership; they only pass the explicit capability and accepted-frame authority. No shader or event-aware renderer is introduced.

```ts
const consumer = new ReplayConsumerBridge(native, 'signals', 1n,
  undefined, {animationEvents: true});
consumer.play(consumer.context, 'signals', false);
consumer.requestTick(consumer.context, 60n); // existing bounded work budget
for (const occurrence of consumer.drainEvents(consumer.context)) {
  // Already accepted and acknowledged. Handle failures here, outside Physics.
  onAnimationEvent(occurrence);
}
// Pump remaining backlog explicitly as appropriate, then drain again.
```

With either factory's ApplicationActor:

```js
actor.startRealtime(performance.now());
// Ordinary host loop; actor owns one existing ReplayHostTimeBridge/consumer.
actor.update(performance.now());
for (const e of actor.drainEvents()) {
  if (e.event.name === 'impact') flashImpactPanel(e.tick);
}
actor.present();
```

There is no onEvent callback invoked inside B6 and no need to inspect native event timelines from the app. `actor.eventStatus()` reports bounded queue state. These experimental factories remain source-level pilots rather than a new versioned npm API. Native optional payload fields retain their exported values, including audio name/gain/balance metadata; there is no audio playback capability in this mission.

## Autonomous demos

Extract `Replay-Events-PixiJS-Phaser.zip`, run `node server.mjs .`, open the printed loopback URL with `/pixi.html` or `/phaser.html`. All framework modules/data/notices are local. No npm install or supervisor is needed. Node is only the static HTTP server. Hardware WebGL2 is required. Use `?actors=2` for two independent actors or `?manual=1` for explicit tick controls; manual and real-time clock ownership cannot be mixed.

Both pages show the same authentic native project, event count, last event/name/accepted tick, queue count, clip, playback/backlog and epoch. Play/Pause/Resume/Reload work. IMPACT flashes via an ordinary application DOM animation only when a drained native impact event is received. The demo never rereads event keys to reconstruct a visual cue. Reload clears its bounded event log/count and constructs fresh actor sessions.

Source snapshots and queue payloads are isolated from caller mutation. Read-only frames contain no event queue, so forged or stale snapshots cannot enqueue or consume events. Views in A5 also require the current owning accepted-frame authority. Tests verify context/drain refusals; real browser tests verify that redraw, context restoration and pause do not duplicate events.

## Qualification

Both engines run actual hardware WebGL2 in Chrome156 / ANGLE RTX3090 D3D11, PixiJS8.17.0 and Phaser3.90.0. Native event traces, submitted GPU geometry/textures/uniforms and framebuffer readback are retained. Actual RAF application trials run beyond tick500 for two actors, validate delivered events independently against Rust and exercise pause/resume, browser freeze/resume, context loss/restoration, missing/cancelled/concurrent load, five reloads and Scene/Game disposal. Test-driven freeze/resume events exercise the actual application suspension handlers; they do not certify every browser/OS tab-throttling policy.

No Editor UI automation, audio system, new Physics solver or full hardware compatibility claim is included. Existing full numerical/graphical certificates are preserved rather than reissued. See delivery lifecycle-delivery, graphics-final and screenshots for final-source evidence.
