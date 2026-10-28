# ReplayV1 scaling and Phaser triage

224 conditions =2 characters x2 renderers x4 populations x2 time modes x7 cadences. Each has12 warmup +72 timed logical frames. Cadences30/60/144, irregular,500ms hitch, partial explicit drain and half paused are controlled **logical inputs**, not claims of sustained display FPS. Exact mode uses rational times/ticks; host mode uses the existing C3 absolute bridge.4 additional one-of25 update/disposal checks pass. The one-of25 draw timing includes the example HUD diagnostic read; the separate intrusive profile measures presentation/submission without that HUD. All B6 transaction/copy/context guards remain shipped and enabled.

## Representative60 logical FPS, host mode — CPU ms

|Character|Engine|Instances|Median|P95|Max|
|---|---|---:|---:|---:|---:|
|ranger|Phaser|1|0.50|0.70|0.90|
|ranger|Phaser|5|2.20|3.10|3.80|
|ranger|Phaser|10|8.35|10.20|10.80|
|ranger|Phaser|25|19.60|23.90|26.30|
|ranger|Pixi|1|0.30|0.50|0.60|
|ranger|Pixi|5|1.10|1.50|2.20|
|ranger|Pixi|10|4.80|6.40|8.00|
|ranger|Pixi|25|12.30|15.70|17.10|
|courier|Phaser|1|0.90|1.50|2.50|
|courier|Phaser|5|6.85|8.60|9.90|
|courier|Phaser|10|13.50|16.80|17.60|
|courier|Phaser|25|32.50|39.80|40.10|
|courier|Pixi|1|0.50|0.90|1.20|
|courier|Pixi|5|4.90|6.30|7.60|
|courier|Pixi|10|9.65|13.60|13.80|
|courier|Pixi|25|24.80|32.20|39.00|

PERFORMANCE-SUMMARY.json retains med/P95/max for all stages and224 conditions. Raw samples retain ticks/backlog, heap readings, snapshot/submission counters and creation observations. Simulation, capture, detached-read subset, freeze/pose residual, presentation and submission are separated. Nested subsets are **not added twice**. Browser clock quantization creates zero-valued short substages; it does not imply zero work. Long complex runs show GC and driver pressure; those are part of the observed workload, not a promise of a constant FPS.25 Courier instances are materially too costly to infer60/144Hz display delivery from this machine's data.

Exact/host endpoint differences occur in12 half-paused conditions: paused owners end at117 versus ideal rational118 because the actual represented binary64 pause endpoint is just below an exact tick boundary. Fractional host conversion follows unchanged C3; no floating-delta accumulator, epsilon or dropped numerical tick is introduced. The other endpoints match. EXACT-HOST-ENDPOINTS.json preserves the cases; equal ticks remain the basis of pose parity.

## Localizing the cost

Separate unwrapped CDP CPU profiles cover Scout/Ranger/Courier at25 instances in each renderer. A separate intrusive timer run records nested **exclusive** and inclusive stages and GL calls; do not compare its latency directly with unwrapped measurements. Public Physics-only measurements feed precomputed canonical inputs into real ReplayPhysicsInstance, excluding timeline sampling, rendering and detached reads while retaining mandatory FK/B6/clock/scheduling. Capture is measured separately; freeze and wrapper mapping remain a residual rather than a falsely pure mapping benchmark.

Concrete Courier/Phaser counts over120 updated frames:126,000 Face projections during presentation **and another126,000** during engine submission. Static120 redraws still project126,000 faces because existing Mesh.ignoreDirtyCache is true. Yet presentation Face self-time is31.4ms total (~0.262ms per frame), not the dominant cost. With25 actors the actual count is21*25=525 region draws per frame; both renderers submit525 draws in this case (Phaser drawArrays, Pixi drawElements). Pixi issues more bufferSubData calls here, so draw/buffer counts alone do not explain the ranking.

The expensive difference is repeated native WebGL VERSION queries inside experimental Phaser resource validation. Each updated owner executes3 queries: before presentation cache checks, within guarded pose application, and again at prerender.25 owners/120 frames produce9,000 VERSION reads. The diagnostic wrapper observes436.4ms native-query time for Scout25 and920.6ms for Courier25, versus1.2/1.8ms when only the immutable VERSION return is intercepted in a counterfactual. Scene redraws also validate each owner. These timings include native driver synchronization/wait, not just JavaScript string checks.

The diagnostic-only cache experiment restores the original method, requires identical final bones and real framebuffer SHA, and is **never a product optimization**. Scout25 median changes5.6->1.3ms; Courier25 median16.45->15.75ms despite removing much query time. GPU queue pressure, GC and shifted synchronization make that larger case non-additive: no universal speedup is claimed. Snapshots, validation/geometry allocation and renderer traversal also cost real CPU. Prioritize immutable-context validation design, then measured allocation/reuse work; do not blindly remove Face projection or B6 copies.

## Memory/GC — separate instrumented workload

30 warmup +200 measured logical frames, ending at tick460 per owner. CDP allocation sampling32KiB includes collected objects; estimated churn is **not retained heap or VRAM**. Trace events record observable MinorGC/MajorGC. Post-dispose forced GC is a separate observation with module/demo references still loaded.

|Character|Engine|Instances|Sampled MiB|GC events|Heap after MiB|Heap after dispose+GC MiB|
|---|---|---:|---:|---:|---:|---:|
|ranger|Phaser|1|49.0|13|7.4|6.8|
|ranger|Phaser|5|204.0|34|8.3|6.8|
|ranger|Phaser|10|388.5|35|9.4|6.9|
|ranger|Phaser|25|941.9|38|12.5|6.9|
|ranger|Pixi|1|45.8|16|5.2|4.6|
|ranger|Pixi|5|197.8|35|6.1|4.6|
|ranger|Pixi|10|377.2|35|7.2|4.7|
|ranger|Pixi|25|879.4|36|10.3|4.7|
|courier|Phaser|1|109.0|29|7.5|6.8|
|courier|Phaser|5|528.4|49|8.8|6.9|
|courier|Phaser|10|1014.4|50|10.4|6.9|
|courier|Phaser|25|2497.5|83|16.1|7.0|
|courier|Pixi|1|110.4|28|5.4|4.6|
|courier|Pixi|5|512.4|48|6.8|4.7|
|courier|Pixi|10|986.9|48|8.3|4.8|
|courier|Pixi|25|2413.0|79|12.9|4.9|

All16 runs release asset instance/page references to zero. Scene queues, immutable shared source and engine/module caches have their own lifetimes; this is not a leak-free or GPU-durability certification. Raw profiles/trace/sampling and timing samples are retained.

C4's accepted0.3/1.1/2.6ms Pixi and0.5/3.3/8.7ms Phaser medians remain protected. The unchanged C4 measurement script is also rerun under c4-control with the same Scout and workload. New timing methods, rig complexity, warmup/GC and driver state differ, so do not compare raw totals as a universal engine ranking. No runtime optimization is shipped in C5A.
