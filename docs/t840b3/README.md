# T840B3 — Explicit Physics instance scheduling

Core exports `ReplayPhysicsInstance` as an opt-in B3 surface. It is not connected
to RigPlayer, RigPlayback, PixiJS, Phaser or any current consumer. Legacy behavior
and native file formats remain unchanged.

Read [the scheduling contract](T840B3-SCHEDULING-CONTRACT.md). B3 accepts immutable
Physics-only rig snapshots, fixed default-skin membership and explicit per-tick
pre-Physics local inputs. No real clip/fade sampler or float-delta bridge exists.
Each instance has one private B2 clock and independent spring records with no
remainder; context identity is stronger than numeric epoch equality.

Failure blocks continuation until reset; private numerical rollback is not
implemented. Do not retry a partially mutated failed tick as if it were restored.
No graphical qualification is implied by these core tests.

`core/test/replay-physics.test.ts` uses real native Rust exports. The optional
`scripts/t840b3/compare.mjs` consumes a newly generated Rust reference directory
and writes a new result directory, checking every tick against predeclared limits.
Full report, parity results and B4 prerequisites are in Editor `docs/t840b3/`
and the isolated B3 delivery. No public package/version change in this task.
