# C6A resource/performance evidence

## Method and equivalent baseline

Independently archived/built exact C5B c3454f3 versus final C6A production code (only subsequent TS indentation change). Same old one-skin Ranger/Courier exports, viewport1000×650, public exact-tick transport, ticks1..720, count1/5/10/25;12 warmup and 708 measured samples. Order C5B/current then current/C5B repeat 25. Browser/GPU match visual qualification. No parallel campaign ran during these measurements. Full validation remains active.

This is instrumented CPU wall time, including request/simulation, extra classification currentFrame copies, capture/presentation and GL submission. It is NOT delivered FPS, GPU execution time, a statistical regression bound or VRAM usage. Buffer instrumentation counts update() calls; it does not count driver upload bytes. Separate intrusive CDP sampling/tracing measures allocation/GC. Timings include browser scheduling/GC outliers; maxima are retained. New multi-skin fixtures have no C5B counterpart: they are measured separately, without stripping or patching native JSON. Their Physics activation differs from old fixtures, so a faster/slower total does not isolate skin overhead.

25 actor equivalent fixed-mode CPU frame milliseconds:

|Character|Campaign|Actors|Median|p95|Max|
|---|---|---:|---:|---:|---:|
|ranger|baseline-fixed-timing|25|4.80|5.40|9.00|
|courier|baseline-fixed-timing|25|9.30|12.00|72.50|
|ranger|green-fixed-timing|25|4.70|5.50|9.00|
|courier|green-fixed-timing|25|9.60|13.50|61.20|
|ranger|green-fixed-repeat 25|25|4.80|5.60|9.60|
|courier|green-fixed-repeat 25|25|9.30|10.40|72.30|
|ranger|baseline-fixed-repeat 25|25|4.70|5.40|9.50|
|courier|baseline-fixed-repeat 25|25|9.10|10.70|79.20|

Ranger medians vary4.7–4.8ms; Courier 9.1–9.6ms across ordering. No claim of a general optimization or zero overhead; these observations and accepted identical pixels support preserving the old path on this machine.

## New visual-skin workload

All counts and both simultaneous/staggered calendars. A no-skin-change frame still advances Physics and must update its pose. A no-tick redraw is different and reuses its token without buffer writes. Median/p95 transition values below include the entire frame, not just a skin setter. The raw summary also reports simulation/classification/presentation/submission independently and maxima, creation, disposal/recreate time, update counts and all708 samples.

|Character|Actors|Schedule|No-skin-change median ms|Transition median ms|Transition p95 ms|No-tick redraw median ms|Geometries / buffers / distinct textures|
|---|---:|---|---:|---:|---:|---:|---|
|ranger|1|simultaneous|0.20|0.20|0.40|0.00|12 / 36 / 2|
|ranger|1|staggered|0.20|0.20|0.20|0.00|12 / 36 / 2|
|ranger|5|simultaneous|0.90|1.00|1.40|0.00|60 / 180 / 2|
|ranger|5|staggered|0.90|0.95|1.10|0.00|60 / 180 / 2|
|ranger|10|simultaneous|1.90|2.00|2.20|0.10|120 / 360 / 2|
|ranger|10|staggered|1.90|1.90|2.10|0.10|120 / 360 / 2|
|ranger|25|simultaneous|4.70|4.70|5.40|0.20|300 / 900 / 2|
|ranger|25|staggered|4.70|5.00|6.30|0.20|300 / 900 / 2|
|courier|1|simultaneous|0.40|0.40|0.80|0.00|21 / 63 / 4|
|courier|1|staggered|0.40|0.40|0.60|0.00|21 / 63 / 4|
|courier|5|simultaneous|1.70|1.80|3.10|0.00|105 / 315 / 4|
|courier|5|staggered|1.70|1.80|2.50|0.00|105 / 315 / 4|
|courier|10|simultaneous|3.40|3.60|4.10|0.10|210 / 630 / 4|
|courier|10|staggered|3.50|3.65|4.20|0.10|210 / 630 / 4|
|courier|25|simultaneous|8.90|9.40|10.70|0.40|525 / 1575 / 4|
|courier|25|staggered|8.80|9.25|10.30|0.30|525 / 1575 / 4|

No-tick redraw60 in EVERY condition produces zero pose submissions and zero buffer updates. Separate safety redraw80 also retains identical framebuffer bytes. At most one quad geometry/three buffers per ever-visible slot per actor: Ranger 12/36, Courier 21/63. A festival-only badge is allocated once when first visible; it is retained while hidden. No subsequent topology/geometries are rebuilt on transitions. Atlas page count is asset-owned2/4 and shared across actors. Distinct textures reported above are the subset actually used, not additional per-view page copies.

## Allocation, GC and disposal

CDP32 KiB sampling, includes objects collected by minor/major GC,200 controlled measured exact-tick frames after 30 warmup. These sampled totals estimate allocation churn over the workload, not resident memory or a leak. Detached/frozen snapshots and test observation produce substantial allocation; no general allocation optimization was authorized. GC event durations are traced main-thread events, not a guaranteed bound.

|Character|Actors|Sampled cumulative MiB|GC count / summed ms|Heap before / after / after disposal+forcedGC MiB|Dispose ms|
|---|---:|---:|---:|---|---:|
|ranger|1|44.7|13/2.54|6.76 / 5.38 / 4.71|2.30|
|ranger|25|838.7|35/18.43|19.54 / 10.90 / 4.90|4.50|
|courier|1|77.0|20/3.97|8.85 / 5.56 / 4.76|2.20|
|courier|25|1574.3|52/29.63|27.95 / 14.28 / 4.97|6.60|

Final asset/view counters are 0/0 in all4profiles; global demo/module references remain until page close. ForcedGC after disposal is a separate observation, not used to improve latency numbers. GPU driver memory/VRAM is not measured. No proof of immediate GPU reclamation after destroy is claimed.

## Repeated transition endurance

Courier performs1,800 skin transitions across 36,000 completed fixed ticks,300 seconds of SIMULATED time, in 7.61 seconds of accelerated wall time including an independently pumped replay. This is not a five-minute live soak. Final poses/spring records are byte-identical between request/pump and replay with different pump budgets. Mesh/geometry/buffer/page counts remain21/21/63/4. All controlled buffers are destroyed and final owned counters0/0. The primary/delayed ordinary campaign also covers repeated transitions around two loop boundaries. No automatic calendar looping is introduced.

Raw delivery evidence: PERFORMANCE-GATES.json, PERFORMANCE-SUMMARY.json, baseline-fixed-timing/, green-fixed-timing/, green-fixed-repeat 25/, baseline-fixed-repeat 25/, visual-timing/, visual-memory/ (allocation profiles and raw traces), visual-endurance/, safety-final/ and load-safety/. Ordinary load failure/abort after completed page decoding destroys every completed new page. Destroying a peer does not destroy shared pages. A resource-validation cache never suppresses page/source checks.
