# T-840C2 — Performance and allocation evidence

## Method

Same hardware/browser/fixture as [WebGL qualification](T840C2-WEBGL-QUALIFICATION.md). `performance-release/results.json` contains all raw samples. Sequential phases: C1/1, C2/1, C2/10, C1/10, C2/25. Each phase has 210 requestAnimationFrame iterations, 30 warmup discarded, 180 measured. Browser/system warmup is explicit; temperature/power clocks were not instrumented. No simultaneous historical GPU suite was running in this final measurement. Timers are approximately 0.1 ms quantized; no confidence interval or speedup claim from small differences.

C1 source is read from exact parent `20aeefe4` into a separate delivery baseline and served through test-only routes. Both routes use the same unchanged core and rendering equations. Final bones/records/submitted vertices compare equal for matched 1/10 owner phases. C2 additionally measures 25 stable owners; there is no invented historical C1/25 baseline.

Each iteration requests exactly two more ticks per owner, then captures/maps/presents, then renders once. This stress workload is not a game-time converter: the measured median interval is 6.9 ms (about 145 Hz), so logical progress is deliberately faster than real time. Every measured sample has zero backlog. Render time measures CPU submission, not GPU execution or display latency. Median / nearest-rank P95 / maximum in milliseconds follow; phase medians are not additive.

| Route | Owners | Phase | Median / P95 / max ms |
| --- | ---: | --- | ---: |
| C1 | 1 | simulationMs | 0.100 / 0.200 / 0.700 |
| C1 | 1 | transferMs | 0.000 / 0.100 / 0.300 |
| C1 | 1 | pixiUpdateMs | 0.050 / 0.200 / 0.400 |
| C1 | 1 | renderSubmissionMs | 0.100 / 0.200 / 0.500 |
| C1 | 1 | totalMs | 0.300 / 0.500 / 0.800 |
| C2 | 1 | simulationMs | 0.100 / 0.200 / 0.400 |
| C2 | 1 | transferMs | 0.000 / 0.100 / 0.500 |
| C2 | 1 | pixiUpdateMs | 0.100 / 0.200 / 0.300 |
| C2 | 1 | renderSubmissionMs | 0.100 / 0.200 / 0.400 |
| C2 | 1 | totalMs | 0.300 / 0.500 / 0.700 |
| C2 | 10 | simulationMs | 0.500 / 0.700 / 1.100 |
| C2 | 10 | transferMs | 0.100 / 0.200 / 0.600 |
| C2 | 10 | pixiUpdateMs | 0.200 / 0.300 / 0.400 |
| C2 | 10 | renderSubmissionMs | 0.100 / 0.200 / 0.400 |
| C2 | 10 | totalMs | 1.000 / 1.200 / 1.600 |
| C1 | 10 | simulationMs | 0.600 / 0.800 / 1.000 |
| C1 | 10 | transferMs | 0.200 / 0.300 / 0.500 |
| C1 | 10 | pixiUpdateMs | 0.200 / 0.300 / 0.400 |
| C1 | 10 | renderSubmissionMs | 0.100 / 0.200 / 0.200 |
| C1 | 10 | totalMs | 1.100 / 1.300 / 1.600 |
| C2 | 25 | simulationMs | 1.100 / 1.300 / 1.500 |
| C2 | 25 | transferMs | 0.300 / 0.400 / 0.500 |
| C2 | 25 | pixiUpdateMs | 0.400 / 0.500 / 0.600 |
| C2 | 25 | renderSubmissionMs | 0.200 / 0.200 / 0.300 |
| C2 | 25 | totalMs | 2.000 / 2.300 / 2.400 |

C1 and C2 total median/P95 are 0.3/0.5 ms at one owner. At ten owners C1 is 1.1/1.3 ms and C2 1.0/1.2 ms; these differences do not establish an optimization. C2 at 25 owners is 2.0/2.3 ms. Maximum totals are 0.8/0.7/1.6/1.6/2.4 ms in phase order. Destruction takes 1.5/1.4/1.8/1.8/2.3 ms; counts return to zero and owned textures are destroyed. These are small rigs with four bones, three regions and one spring, not an alpha performance budget for arbitrary projects.

## Copies and ownership

New frames use one detached core snapshot for capture, deeply freeze it, then map it once to a cached RigPose. The existing consumer presentation guard performs an additional detached read on submission; `.metrics.guardedReads` records that cost. A normal measured owner has 211 captures/transfers/submissions/guarded reads (origin plus 210 iterations) and two cache hits. Repeated unchanged redraw has no new snapshot or pose-buffer update. C1 and C2 split capture/mapping work differently; compare combined presentation cost and total, not isolated transfer phases as an exact semantic equivalent.

Core B6's per-tick candidate validation and published snapshot copies remain unchanged. Candidate records contain eight scalar state fields per active constraint per tick; immutable rig data is not cloned every tick. No transaction validation was removed for performance. Assets share one atlas texture across 1/10/25 independent owners; physics state is never shared.

## Separate allocation and GC profiling

`memory-release/` is a separate instrumented run, not the source of latency statistics. Chrome CDP sampled allocations at 32,768-byte interval, with collected minor/major objects requested; raw profiles and traces are retained. Each phase performs 600 render updates and 1,200 ticks per owner. Weights below are sampling estimates for the VM window, not exact allocated bytes, retained heap, a leak estimate or exclusive attribution to the adapter.

| Owners | Sampled allocation weight bytes | Allocation samples | Recorded GC events | Sum of event durations ms | Heap used at end bytes |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 46,199,704 | 1,402 | 24 | 4.160 | 5,385,164 |
| 10 | 375,271,516 | 11,431 | 67 | 16.051 | 6,021,120 |
| 25 | 877,490,928 | 26,734 | 88 | 28.289 | 6,820,684 |

MinorGC/MajorGC durations sum recorded trace events; overlapping events need not equal total application stall time. Heap measurements depend on collection timing. Destroyed asset counters are zero for all phases; counters do not prove immediate physical VRAM release. Long sessions, context-loss recovery and many complex characters remain unqualified.

Allocation stacks identify inherited core `#run`/evaluation/finite-pose checks, `Object.values`, maps and frame publication, plus graphics applyPose/regionQuad work. The separate sampling files support this attribution; the entire core transaction stack must not be mislabeled as only candidate-map copying. At larger counts the solver/validation and snapshot/presentation copies dominate the small measured rendering submission. No optimization was attempted beyond safe reuse of unchanged prepared frames; any allocation reduction inside B6 requires independent transaction/parity validation.

## Host-time boundary

The example-only microsecond converter is monotonic-checked, pause-aware, horizon-bounded and preserves hitch debt. Flooring can delay an exact tick boundary by less than one microsecond per running segment and loses submicrosecond fractions across pauses. Three deterministic tests record these effects. The library distributes exact tick/rational control only. No FPS target was selected after seeing results and no frame-rate guarantee is inferred from this machine.
