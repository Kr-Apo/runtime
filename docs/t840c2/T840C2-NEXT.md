# T-840C2 — Review and next authorized work

C2 is complete locally and stops here. No implementation of the following has begun.

1. Review the API contract, negative capabilities, ownership semantics and benchmark limitations. Decide whether the explicit experimental entry should remain as-is; do not activate it by default.
2. Qualify a game-time bridge before encouraging general real-time adoption. Define pause segments, quantization remainder, long-session/hitch policy, overflow, speed changes and reset. Require exact rational/tick boundary tests and keep this separate from solver equations and Legacy `RigPlayer` semantics.
3. Port the same narrow asset/consumer/presentation ownership contract to Phaser only after separate authorization. Retain Physics-only/static-default-regions gates and prove completed pose, immutable token semantics, disposal and real WebGL pixels against the same Rust fixture. No Phaser source was changed in C2.
4. Qualify visual skin changes as a separate expansion: reconcile B5B1 numerical membership, current committed tick, atlas page/geometry changes and resource reuse. Do not silently accept existing unsupported skins.
5. Extend one graphical capability at a time (meshes/FFD, clipping, slot channels, dark tint, other blending), with native fixtures and independent geometry/pixel evidence. Crossfade/layers and gameplay events require their own temporal contracts.

Performance follow-up is evidence-led: test larger rigs and longer sessions on additional hardware before claiming budgets; investigate inherited transaction/snapshot allocations without dropping B6 guards or changing accepted numeric traces. Preserve the 31 known Legacy divergences as explicit historical debt. Keep all output directories fresh, the 207 historical goldens, RC2 and prior checkpoints unchanged.

Recommended next scope: time-bridge contract/qualification, followed by a separately authorized narrow Phaser port. Maintainer review is required before either. No package publication, version bump, release, push, merge or tag is authorized by C2.
