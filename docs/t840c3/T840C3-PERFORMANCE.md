# T-840C3 — Conversion, end-to-end cost and memory

## Pure conversion without solver

`conversion-first/results.json`: Node, same Windows CPU,10,000 warmup calls then100 batches of1,000 calls (100,000 measured). C2 DemoTime performs microsecond flooring; C3 pure preview includes exact binary64 conversion, context/binding validation, transport metadata and a frozen rational time snapshot. Neither requests/pumps Physics; requested/completed stay0. This compares different guarantees, not equivalent capability or a speedup. Per-call microseconds, median/P95/max:

| Route | Microseconds per call |
| --- | ---: |
| C2 | 0.0397 / 0.0886 / 0.8151 |
| C3 | 1.7659 / 1.9888 / 2.7387 |

Node process memory snapshots and GC observations accompany raw results. No Node GC events were delivered within these measured windows; this is not a claim of no allocation/collection. Browser GC is measured separately below. Every conversion uses a small8-byte DataView/buffer, bounded BigInts and immutable result metadata; no rig or images are copied by the converter.

## Matched browser benchmark

`performance-release/results.json`: C2 source served from exact parent e69482a7, C3 current source, same native fixture/hardware/context as qualification. Six sequential phases: C2/1, C3/1, C3/10, C2/10, C2/25, C3/25. Each has210rAF iterations,30warmup discarded,180 measured. Explicit host timestamps advance25ms per iteration, an exactly representable interval yielding3ticks per owner. Numerical final bones/records and submitted vertices compare equal C2/C3 for1/10/25; all measured backlog is0. The workload is controlled, not a claim of running at a prescribed wall-time FPS.

A test-only wrapper times actual public consumer requestTime/requestTick calls, without replacing their implementation. Numerical request cost includes B6 guards/validation, not just the spring formula. ConversionOverhead is total progression minus the timed nested numerical request; it also includes adapter/result bookkeeping. Presentation is capture/transfer plus Pixi update; render is CPU submission, not GPU completion/display latency. Quantized ~0.1ms browser timers hide many per-owner differences; a zero median overhead does not mean free conversion. Temperature/clock throttling were not instrumented. Independent phase medians do not add.

| Route | Owners | Phase | Median / P95 / max ms |
| --- | ---: | --- | ---: |
| C2 | 1 | conversionOverheadMs | 0.0000 / 0.1000 / 0.2000 |
| C2 | 1 | simulationMs | 0.1000 / 0.3000 / 0.7000 |
| C2 | 1 | progressionMs | 0.2000 / 0.3000 / 0.7000 |
| C2 | 1 | presentationMs | 0.1000 / 0.2000 / 0.2000 |
| C2 | 1 | renderSubmissionMs | 0.1000 / 0.2000 / 0.3000 |
| C2 | 1 | totalMs | 0.3000 / 0.5000 / 0.8000 |
| C3 | 1 | conversionOverheadMs | 0.0000 / 0.1000 / 0.2000 |
| C3 | 1 | simulationMs | 0.1000 / 0.3000 / 0.5000 |
| C3 | 1 | progressionMs | 0.2000 / 0.3000 / 0.5000 |
| C3 | 1 | presentationMs | 0.1000 / 0.2000 / 0.8000 |
| C3 | 1 | renderSubmissionMs | 0.1000 / 0.2000 / 0.2000 |
| C3 | 1 | totalMs | 0.3000 / 0.6000 / 1.0000 |
| C3 | 10 | conversionOverheadMs | 0.0000 / 0.2000 / 0.3000 |
| C3 | 10 | simulationMs | 0.6000 / 0.8000 / 0.9000 |
| C3 | 10 | progressionMs | 0.7000 / 0.9000 / 1.0000 |
| C3 | 10 | presentationMs | 0.3000 / 0.4000 / 0.5000 |
| C3 | 10 | renderSubmissionMs | 0.1000 / 0.2000 / 0.2000 |
| C3 | 10 | totalMs | 1.1000 / 1.3000 / 1.5000 |
| C2 | 10 | conversionOverheadMs | 0.0000 / 0.0000 / 0.1000 |
| C2 | 10 | simulationMs | 0.6000 / 0.8000 / 1.0000 |
| C2 | 10 | progressionMs | 0.6000 / 0.8000 / 1.0000 |
| C2 | 10 | presentationMs | 0.3000 / 0.5000 / 0.5000 |
| C2 | 10 | renderSubmissionMs | 0.1000 / 0.2000 / 0.3000 |
| C2 | 10 | totalMs | 1.1000 / 1.3000 / 1.5000 |
| C2 | 25 | conversionOverheadMs | 0.0000 / 0.1000 / 0.2000 |
| C2 | 25 | simulationMs | 1.4000 / 1.6000 / 2.1000 |
| C2 | 25 | progressionMs | 1.4000 / 1.7000 / 2.2000 |
| C2 | 25 | presentationMs | 0.8000 / 1.0000 / 1.1000 |
| C2 | 25 | renderSubmissionMs | 0.2000 / 0.3000 / 0.3000 |
| C2 | 25 | totalMs | 2.4000 / 2.8000 / 3.4000 |
| C3 | 25 | conversionOverheadMs | 0.0000 / 0.2000 / 0.4000 |
| C3 | 25 | simulationMs | 1.4000 / 1.7000 / 1.9000 |
| C3 | 25 | progressionMs | 1.5000 / 1.7000 / 2.0000 |
| C3 | 25 | presentationMs | 0.8000 / 1.0000 / 1.2000 |
| C3 | 25 | renderSubmissionMs | 0.2000 / 0.3000 / 0.3000 |
| C3 | 25 | totalMs | 2.5000 / 2.8000 / 3.0000 |

The first `performance-first` split incorrectly instrumented requestTime alone while C3 uses requestTick, misattributing solver work to conversion. Its phase split is invalid and retained for transparency; only the corrected `performance-release` split is accepted. No product optimization or numerical change was made to obtain the corrected result.

## Allocations and GC

`memory-release/` separately profiles matched C2/C3 at1/10/25 owners. Setup/reanchoring and30warmup updates occur before profiling; then600updates perform1,800 measured ticks per owner (1,890total includingwarmup). Chrome CDP allocation sampling interval32,768bytes includes collected objects when supported, and raw MinorGC/MajorGC traces are retained. Sampling weights estimate the VM window, not exact allocated or retained bytes and not exclusive converter allocations. Instrumented timings are not used for latency statistics. Initial `memory-first` includes setup and remains preliminary; final memory-release isolates the warmed update phase.

| Route | Owners | Sampled allocation weight bytes | Samples | GC events | Sum recorded GC durations ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| C2 | 1 | 58,608,980 | 1,780 | 27 | 4.011 |
| C3 | 1 | 61,101,292 | 1,856 | 28 | 5.345 |
| C2 | 10 | 473,415,900 | 14,421 | 76 | 17.194 |
| C3 | 10 | 491,646,904 | 14,976 | 76 | 20.186 |
| C2 | 25 | 1,119,868,348 | 34,116 | 87 | 27.773 |
| C3 | 25 | 1,133,753,768 | 34,539 | 71 | 29.880 |

GC event duration sums can include overlap; they are not exact application stall time. Collection timing makes counts nondeterministic. Shared asset texture count stays1 across owners; all owned counts return to0 on destruction. Counter release does not establish immediate physical VRAM reclamation or long-session leak freedom.

Host conversion adds bounded scalar BigInt/DataView/result allocations, not per-tick rig clones. C2's immutable prepared pose cache still avoids snapshot/buffer work on unchanged redraw. New presentations still retain the inherited extra guarded consumer read; no B6 copy/validation is removed. Existing solver/evaluation/finite-pose and committed-frame publication dominate this small fixture as owner count grows. Profiling supports investigating those inherited stacks separately; no safety check was removed or optimization attempted here.

No post-hoc FPS budget, constant-cadence claim, mobile certificate or large-rig scaling guarantee is derived from these small four-bone/three-region/one-spring fixtures. Pure conversion uses a monotonic host source chosen by the caller; correctness and quantization policy take precedence over comparing against C2's lossy demo clock.
