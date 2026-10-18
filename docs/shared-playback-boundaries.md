# Shared playback boundary correction (T-604b.2 prerequisite)

This separately authorized checkpoint changes `core/src/evaluate.ts` and
`core/src/player.ts`. It applies to every consumer of the shared core, including
Phaser. The historical Phaser branch remains frozen; no adapter, schema, fixture,
package version or dependency is changed by this checkpoint.

* Angular scalar interpolation keeps the sign of an exact half turn. The Rust
  reference for 0 to -180 degrees at 0.5 seconds is -90 degrees. Previously the
  TypeScript result was +90, moving a length-10 bone tip by 20 units. The final
  pose still uses the existing wrapped angular representation; +180 and -180
  have equivalent endpoint matrices. Ordinary shortest arcs are unchanged.
* Events are stably sorted by time for emission, without changing authored
  storage. Ties retain their authored order. Sorting happens within each lap,
  not across laps.
* Every interval is `(from, to]`. **Events at time zero are ignored on startup
  and on every lap**, as in the current Rust implementation. This policy was
  explicitly chosen during review. Previously TypeScript emitted a time-zero
  event only when a step overshot a loop boundary, making dispatch depend on
  how the application split its delta.
* An event at the positive clip duration fires on reaching that endpoint.
  Zero delta and zero-duration clips emit nothing. Crossfade emission still
  belongs only to the incoming/current track; the outgoing track is silent.

Red evidence: the 34 historical core tests passed, while the new signed-half-turn
and chronological-order tests failed. A third test reproduced the zero-time
partition inconsistency before its correction. Green: all 37 core tests pass;
the unchanged native Rust/TypeScript fixture retains its 128-case parity check
(3,328 components, maximum error below 0.000007).

These are deliberate corrections to shared historical behavior, not a new
Pixi-specific temporal convention. Callers relying on the old negative-half-turn
direction, authored-but-unsorted dispatch, or overshoot-only zero-time event
must account for this change. Payloads and runtime v1/v2 formats are unchanged.
