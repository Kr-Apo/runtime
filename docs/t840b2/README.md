# T840B2 — Standalone ReplayV1 clock foundation

The core entry point now exports `ReplayClock` and its associated types. This is
an explicit synchronous scheduling API; RigPlayer, evaluate, PixiJS and Phaser
do not use it. Their legacy behavior remains unchanged.

Read [the clock contract](T840B2-CLOCK-CONTRACT.md) before integrating it.
Use `bigint` u64-domain epoch/time values, initialize with `reset(epoch)`, then
request absolute ticks/rational times. Interactive work is capped at eight;
`pump` drains debt explicitly. Only a reported complete tick advances completed.
There is no floating-seconds bridge, Physics rollback or implicit JSON encoding.

`core/test/replay-clock.test.ts` runs the same new vectors as the Rust core
harness: 21 scenarios, 461 operations, exactly equal counters and tick orders.
The full report, cross-language results and proposed B3 boundary are maintained
in the Editor's corresponding `docs/t840b2/` directory and isolated B2 delivery.
This clock qualification is not a Physics/graphics fidelity qualification.
