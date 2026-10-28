# C6B — measured performance and limits

## Comparable workloads

Exact C5B c3454f3 was independently archived and built. C5B fixed and C6B fixed use IDENTICAL old one-skin Ranger/Courier exports, same harness,720 exact ticks,1/5/10/25 actors. C6B constant opt-in uses those SAME native bytes and a tick-zero default calendar; only the test harness load/create options change. No runtime JSON simplification. New C6A multi-skin transitions are a separate workload: different atlas packing and Physics memberships prevent attributing all cost differences solely to the adapter.

Each case records708 samples after 12 warmup ticks, median/p95/max, simulation/classification snapshot reads, capture/presentation, GL CPU submission, creation and disposal/recreation. The UV-call counter instrumentation is applied equally to comparable sources. Resource inventory runs outside recorded phase intervals. Runs were sequential with no other validation campaign during timing. C5B→C6B and C6B→C5B25actor ordering controls are retained. Extra currentFrame classification reads are included and reported separately. This is not delivered FPS, GPU duration, VRAM or a statistical performance guarantee.

25actor equivalent fixed/constant CPU frame milliseconds:

|Character|Campaign|Median|p95|Max|
|---|---|---:|---:|---:|
|ranger|baseline-fixed-timing|8.90|10.40|91.20|
|courier|baseline-fixed-timing|9.50|10.70|20.20|
|ranger|green-fixed-timing|8.90|11.10|83.50|
|courier|green-fixed-timing|17.40|21.70|165.60|
|ranger|green-fixed-repeat25|4.90|10.40|18.60|
|courier|green-fixed-repeat25|16.80|20.20|160.40|
|ranger|baseline-fixed-repeat25|4.90|10.00|23.90|
|courier|baseline-fixed-repeat25|17.00|20.10|149.60|
|ranger|green-constant-timing|8.70|10.30|93.40|
|courier|green-constant-timing|17.00|19.60|160.20|

Large run-to-run variation is retained: Courier's first baseline9.5ms and later baseline17.0ms differ substantially; the reverse-order pair is C6B16.8ms versus C5B17.0ms. Ranger varies4.9–8.9ms. These data do not establish a formal regression bound or a general speedup. No threshold was relaxed and no solver/render optimization was added to improve the numbers.

## Actual multi-skin workload

|Character|Actors|Calendar|No-transition median ms|Transition median ms|Transition p95 ms|Cached redraw median ms|Face arrays / Vertex arrays / used page textures|
|---|---:|---|---:|---:|---:|---:|---|
|ranger|1|simultaneous|0.20|0.30|0.70|0.00|12 / 12 / 2|
|ranger|1|staggered|0.20|0.20|0.30|0.00|12 / 12 / 2|
|ranger|5|simultaneous|0.90|0.90|1.30|0.10|60 / 60 / 2|
|ranger|5|staggered|0.90|0.90|1.10|0.10|60 / 60 / 2|
|ranger|10|simultaneous|3.30|1.90|4.10|0.30|120 / 120 / 2|
|ranger|10|staggered|3.60|3.70|6.00|0.40|120 / 120 / 2|
|ranger|25|simultaneous|8.70|9.30|9.80|0.90|300 / 300 / 2|
|ranger|25|staggered|8.90|8.55|10.60|0.80|300 / 300 / 2|
|courier|1|simultaneous|0.40|0.40|0.70|0.00|21 / 21 / 4|
|courier|1|staggered|0.30|0.40|0.60|0.00|21 / 21 / 4|
|courier|5|simultaneous|1.60|1.70|2.60|0.10|105 / 105 / 4|
|courier|5|staggered|1.70|1.60|3.30|0.30|105 / 105 / 4|
|courier|10|simultaneous|6.20|6.40|7.10|0.40|210 / 210 / 4|
|courier|10|staggered|6.20|6.20|7.70|0.60|210 / 210 / 4|
|courier|25|simultaneous|15.70|16.50|17.80|1.50|525 / 525 / 4|
|courier|25|staggered|8.10|14.40|17.70|0.50|525 / 525 / 4|

Transition samples include first use of appearances and later reuse. Per-phase maxima, creation/disposal and all raw samples remain in PERFORMANCE-SUMMARY.json and timing folders. No-skin-change still means a new Physics pose. No-tick redraw is observation only:60 repeats in every case cause zero new pose submission and zero UV updates. There is no full renderer reconstruction on a transition.

## Separate phase and driver profile

phase-profile-final has four intrusive conditions (Ranger/Courier×1/25), with actual appearance-cache lookup/preparation, shared region geometry, mesh reuse, setTexture, Vertex.setUVs and Face.transformCoordinatesLocal timings/calls. applyInclusive contains attachment lookup, geometry, mesh updates, tint and sorting; nested values must NOT be summed. Pure attachment-map resolution is not isolated from that residual without changing product code; it is not falsely reported as an independent timing. Snapshot and presentation phases are separately recorded in normal timing. Driver bufferSubData calls are retained; new buffer/texture creation is zero in these warm profiles. VERSION calls remain zero. These intrusive timings do not replace latency measurements.

## Allocation, GC, memory and destruction

CDP32 KiB sampled allocations include collected objects.200measured exact-tick frames after 30 warmup, separate from latency. Allocation totals measure churn, not resident usage. GC counts/durations are observed trace events. Heap columns are before / after / after disposal+forcedGC MiB; dispose includes owned resource cleanup. Demo globals remain until page close.

|Campaign|Character|Actors|Sampled cumulative MiB|GC count / sum ms|Heap MiB|Dispose ms|
|---|---|---:|---:|---|---|---:|
|visual-memory|ranger|1|47.1|12/2.26|9.17/7.59/6.94|1.30|
|visual-memory|ranger|25|870.1|36/19.56|19.91/13.21/7.13|2.10|
|visual-memory|courier|1|81.9|21/4.57|11.82/7.71/6.93|1.20|
|visual-memory|courier|25|1669.3|54/31.95|30.63/16.48/7.20|2.20|
|baseline-fixed-memory|ranger|1|50.2|13/2.42|9.04/7.37/6.78|1.30|
|baseline-fixed-memory|ranger|25|940.0|38/20.90|21.80/12.55/6.95|1.70|
|baseline-fixed-memory|courier|1|107.9|29/5.29|10.88/7.49/6.81|1.40|
|baseline-fixed-memory|courier|25|2517.1|82/50.28|46.92/15.52/7.01|3.70|
|green-fixed-memory|ranger|1|48.6|13/2.48|10.81/7.38/6.78|1.30|
|green-fixed-memory|ranger|25|938.7|38/20.32|29.41/12.56/6.96|2.00|
|green-fixed-memory|courier|1|110.9|29/5.04|8.81/7.50/6.82|1.30|
|green-fixed-memory|courier|25|2502.5|82/49.12|46.93/15.60/7.02|4.30|

All12 profiles end at 0 live instances/0page references. Full profiles/traces are retained. Safe detached snapshots and test observations still allocate substantially; no broad allocation optimization was authorized. GPU reclamation timing and universal no-leak behavior are not claimed. Long-run mesh/vertex/page bounds and accelerated simulated duration are documented in RESOURCE-LIFECYCLE.
