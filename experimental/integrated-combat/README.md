# A17 — integrated combat composition (experimental)

Gate A: `{crossfade:true,weightedFfd:true,animatedSlots:true,animationEvents:true}`.
Gate B adds `interruptible:true`; its standalone wrappers are in `../integrated-interruptions`.
Both gates were qualified separately, with Gate A sealed before Gate B was opened.
This is a bounded integration pilot, not new alpha/publication approval.

## Domain
Native v2; exactly Idle/Attack/Hit/Death; one immutable default skin, Normal blending,
Physics-only constraints, positive nonsingular scales, one exact weighted FFD owner.
Its slot is always selected/visible. Attachment and visibility tracks on that slot
are refused even if constant. RGBA and draw order may animate it. Other slots can
change color, attachment and visibility. No linked meshes, clipping, dynamic skins,
sequences, dark tint, additive/layered composition or dynamic binds. Whole absent
FFD track is zero rest; empty tracks/keys or empty/full vectors remain HOLD.
Historical A3–A16 options, limits and refusals are preserved.

## Sampling and transactions
Existing A12/A13 locals and A16 canonical author-space FFD compose before one native
Physics tick. A14 normalized RGBA lerps before PMA. Discretes remain outgoing until
weight1. A15 incoming event owner changes at the first accepted tick, with an empty
first window, then native `(from,to]` windows. Time0 keys remain excluded.
Thus an Attack event can coexist with outgoing Idle eyes and a blended FFD body.
One B6 candidate carries locals, FFD, slots and events; all accept or none accept.
A GPU failure preserves the last graphical front but does not roll back accepted
numerics/events. Retry presents that exact frame without resampling.

Gate B captures flat accepted pre-Physics locals + canonical FFD + normalized slots,
exact structural identity and journal origin. No GPU vertices, Physics-modified
source locals or pending queue is captured. Repeated interruption captures the last
accepted composition. Restore stages all commands and replay checks actual origins.

## Budgets
Integrated-only ceilings:128 bones,32 slots,128 attachments,4 clips,512 FFD scalars,
131072 stored FFD scalars; structural identity32768 UTF16 units; slot snapshot12288
units; command/capture98304 units.64 commands are <=12MiB conservative serialized
UTF16 payload. Numeric FFD <=4KiB/capture, <=256KiB for64. Identity <=64KiB/capture.
Native event payload8192 units; accepted occurrence32768 units,1024 pending <=64MiB
serialized UTF16. No silent eviction. Internal same-tick snapshots can share data;
drain/capture/returned snapshots are detached. Temporary staging/returned clones and
application-retained copies add heap. Serialized bounds are not universal JS heap
bounds or certified throughput for a rig at the ceilings. Tested fixture:6 bones,
7 slots,20 FFD scalars,4 clips; all timing outliers retained in external evidence.

## Reproduce and run
Build core, then run:
```
node experimental/integrated-combat/prepare-demo.mjs NEW_FOLDER DEPENDENCY_RUNTIME core/dist a
node experimental/integrated-combat/prepare-demo.mjs OTHER_NEW_FOLDER DEPENDENCY_RUNTIME core/dist b
node NEW_FOLDER/server.mjs NEW_FOLDER
```
Open pixi.html/phaser.html. Play/Pause/Resume, typed transitions, Gate B interruptions,
Reset, Replay, Drain Events, actor count and accepted state are observable. Reset,
Stop and Replay replace the session and discard pending events: drain first when
needed. Drain is at-most-once, not durable exactly-once external gameplay delivery.
A replay creates new occurrences; this demo performs no damage/audio/particles.

`tools/integrated-combat-reference` creates Combat Frog Integrated with native A10
APIs, Save/Reopen, native publication, actual native clip readback and independent
Rust composition/bind algebra/one Physics. It never consumes TypeScript expectations.
Fixtures are unpatched native exports, with complete Rust per-tick reference traces.
Creation is headless API authoring; no Classic GUI or artistic authoring qualification.
Full reports, captures, APNGs, limits and evidence are in the separate A17 delivery.
