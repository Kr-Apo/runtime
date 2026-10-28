# A15 experimental crossfade events

Explicit `{crossfade:true,animatedSlots:true,animationEvents:true}` selects Gate A.
Add `interruptible:true` for Gate B. Native v2 stays unchanged. A5/A6/A12–A14
remain separate; event data alone never enables this capability.

The consumer owns one B6 queue (capacity1024), one clock and one continuous
Physics instance. Immutable per-clip A5 samplers are reused; no second animation
system or renderer-side delivery is introduced.

A request accepted after tickN starts atN+1, weight0, at explicit incomingTick.
That first owned event window is EMPTY, even for a nonzero/restarted phase.
Afterward incoming is the sole event owner. A5 `(previous,current]` f32 windows,
exact duration laps, stable authored keyIndex/ordinal and t=0 exclusion apply.
Completion continues the same owned phase without reinitialization/double emit.
An interruption abandons the previous target's FUTURE generation at its first
accepted start tick; previously queued or drained occurrences stay accepted.
Frozen poses/slots never own an event timeline.

Events intentionally follow incoming intent, while A14 discrete visuals follow
the source until weight1. An Attack event may carry Idle-labelled slots/eyes.
Use the accepted associated snapshot, not a freshly sampled target appearance.

```ts
const c = new ReplayConsumerBridge(native, 'Idle', 1n, undefined, {
  crossfade: true, animatedSlots: true, animationEvents: true, interruptible: true
});
c.play(c.context, 'Idle', false);
c.requestTransition(c.context, {to: 'Attack', durationTicks: 48n});
// In the host update: use the existing120Hz request/pump or host-time bridge.
// After committed updates, independently of graphics success:
const batch = c.drainEvents(c.context); // detached and acknowledged before return
```

Each occurrence retains native `event` payload (including its authored time),
`keyIndex`, stable `ordinal`, clip owner, global accepted tick/lap/session/epoch/id.
A15 adds `clipTick` (absolute local phase), `clipTime` (current wrapped/clamped
canonical phase), complete accepted `slotState` and `mixing`. At a loop endpoint,
a duration-key belongs to the ending lap while current clipTime/slots may wrap.
`ApplicationActor.drainEvents()` appends its actorId; core sessions independently
identify numerical instances. These are process identities, not durable IDs.

Capacity/pose/color/order/observer failure refuses the ENTIRE candidate: no
partial append, dropped-oldest or solver advance in accepted state. Prior queue
remains drainable under fault; draining alone does not heal a fault. Reset is
explicit. No callbacks/await are added to the acceptance boundary.

Drain is at-most-once removal of the returned batch, not durable exactly-once
external gameplay/audio effects. A caller exception after drain does not restore
the batch. No runtime action applies damage, plays audio or spawns particles.
A game needing retries must retain its own detached batch.

Pause retains queue/session. Stop/reset/restart/reload/disposal drop pending
reachability; origin replay creates a fresh session/epoch and discards old pending.
Replay reconstructs numerical occurrences with new IDs: consuming them again
is an explicit application choice, not a guarantee against duplicate side effects.

A14 limits apply: fixed default skin, Normal, regions/static/weighted nonlinked
meshes, Physics-only constraints,2..16 clips,256 bones,128 slots,512 attachments,
4096 keys/channel/slot/draw/event track,64 journal commands, durations1..7200 ticks,
2^23-1 sample ticks. No per-event journal entry. These bounds are not universal
heap, maximum-rig throughput or mobile certification.

No FFD/links/clipping/dynamic skins/dark tint/layers/additive/sequences/new
constraints or constraint mixing. Audio names remain opaque metadata only.
All clips are validated; unknown/unqualified channels are refused.

## Demo and reference

After locked workspace build, run:
`node experimental/events-crossfade/prepare-demo.mjs NEW_DIR . core/dist a`
(or `b` for Gate B), then `node server.mjs .` inside NEW_DIR. Open pixi.html or
phaser.html. Ordinary pages run RAF; `?manual=1` is diagnostic explicit ticks.
The UI shows only counters and the last128 accepted occurrences, actor/epoch,
owner, phase, key, payload and accepted expression. Drain is also explicit via
a button. Reset/replay queue replacement is documented in the controls.

Combat Frog — Events & Reactions is authored via native A10 APIs, saved/reopened
and genuinely exported (no positive JSON patch). This is not GUI/artistic
qualification. Reference tool: `tools/mix-events-reference`, with readonly A10
sibling `../editor` at cca30f97c2dd28b49da1d42a6c2cb31a779666ac. Modes gate-a,
single, repeat generate three1441-frame native trajectories and independently
reexecute the native replay; vectors generates genuine exports covering f32
loops, short multi-laps, simultaneous keys, nonzero phase and clamping.

The experimental event-ownership policy is not an implied Spine/Legacy contract,
an alpha release qualification, an admission certificate or publication approval.
