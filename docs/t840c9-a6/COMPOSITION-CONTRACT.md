# Composition contract — A6

## Explicit admission

```ts
new ReplayConsumerBridge(native, 'signal_costume', 1n, undefined,
  {animatedSlots:true, animationEvents:true});
```

Exactly those two true flags select the new mode. Extra flags/properties, false values and FFD combinations remain rejected. Exports never activate it implicitly. Both real channel families must be present: at least a slot/draw-order track and at least one event key. Empty single-family data should use its existing standalone mode; the two-flag request does not silently fall back.

`compositionSources` clones/validates source, retains the same clip, duration, bones, skin and constraints, and creates two private admission views. The slot view omits only events; the event view omits only slot/draw-order tracks. Unchanged A4/A5 validators validate their respective original data and every other structural exclusion. These are internal admission/sampler inputs, not patched positive exports or a second pipeline. Neither standalone validator is weakened.

This retains A4 validation of RGBA/curves,known slot/owner/attachment/null,unique complete published order,geometry/atlas; A5 validation of finite native times/payloads,key/string limits; and B4/B6 bone/constraint/clock invariants. Native v1/Legacy readers are untouched. Static/animated dark tint,non-Normal blending,FFD,links,clipping,sequences,mixing,dynamic skins and unsupported constraints remain refused.

## One accepted state

The existing candidate computes bones/Physics, samples slots once at that candidate tick, prepares events for that same interval, attaches validated slot context to new occurrences and exposes the ordinary detached diagnostic observer. The existing accept publishes records/frame/queue together. A4 slot color and A5 event-window authorities are unchanged. No timeline/FK/Physics evaluation happens during present.

ConsumerFrame still carries current bones,records and complete slotState. In A6 only, each drained ReplayEvent additionally carries its own `slotState` with identical accepted tick,clip,skin,owner/attachment,visibility,RGBA and full drawOrder. This is lightweight slot metadata, not stored bone/Physics history or a new native version.

A request may accept several ticks before drain; reading the latest frame would not reconstruct an older event's attachment. The event snapshot solves that without resampling. The app maps event.string to an exact known slot name for this fixture; that mapping is an explicit application convention, not automatic native semantics or name guessing. Unknown/nonmatching text simply has no association.

Private occurrences from the same tick share one closed slot snapshot. Each returned occurrence is cloned separately, so mutation cannot affect committed state,other returned occurrences or future events. Source is snapshotted; later caller-owned edits cannot alter admitted data. Context/session/epoch guards remain those of A5.

## Time and boundaries

120Hz accepted ticks govern both stages; requested backlog is not sampled as accepted state. A4 canonical looping/f32 slot queries and Rust first-color/discrete semantics remain intact. A5 canonical `(previous,new]` lap windows, stable simultaneous ordering and t=0 exclusion remain intact. Loops never reset accumulated Physics.

At an exact loop boundary, a duration-time event belongs to the ending lap, while its slot context is the accepted wrapped frame at canonical clip time0. It does not promise the pre-wrap visual pose. Nonlooping end events instead carry the clamped final slot pose; later ticks produce no new events. This distinction is tested and follows both existing authorities without an epsilon or silent convention change.

Pause,presentation and observation emit nothing. Stop/reset/restart/origin replay discard old pending events and create the existing new session/epoch; newly replayed accepted ticks can naturally emit new identities. Pure seek/sample previews remain refused. A5 drain acknowledges the whole returned batch before handler execution: an exception cannot roll back Physics and does not automatically retry the batch.
