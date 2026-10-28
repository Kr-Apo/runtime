# T-840C3 — Next review and C4 proposal

STOP after this local checkpoint. No Phaser implementation begins in C3.

Proposed next separately authorized mission: **T-840C4 — ReplayV1 Phaser Experimental Integration**.

- Reuse the exact same existing ReplayConsumer and shared host-time entry; never introduce a Phaser spring/clock copy.
- Keep a distinct experimental opt-in package API, retaining Legacy defaults/refusals and C2's strict native-v2, Physics-only, compatible bone clip, static regions, fixed default skin, Normal/no-dark-tint/WebGL2 subset.
- Share assets while owning per-instance numerical state, context-bound presentation, meshes/buffers and listeners explicitly. Handle load cancellation/failure and borrowed versus owned pages.
- Present only completed ticks, distinguish pure seek preview, preserve B6 fault transactions and explicit pumping. Test repeated seeks and cache identity, stop/reset/replay/rebind, same-time observations and stale contexts.
- Qualify real Phaser WebGL geometry and pixels against the same independent Rust fixtures and completed states, not merely a moving screenshot. Match Pixi/Phaser camera/UV/PMA conventions without export patches or camera tricks.
- Add an external TypeScript consumer and matched1/10/25 measurements. Reuse exact/rational clocks for numerical conformity; time-host tests must respect the C3 rounding and lifecycle contract.

Deferred beyond that port: delta-time input, variable speeds/reverse time, automatic wall-clock policy, layers/crossfade, graphical skin changes, advanced render capabilities, larger rigs/long sessions and broad hardware qualification. No export format, equation, version, npm publication, push, merge, tag or release is authorized by C3. Review this evidence before deciding C4's scope.
