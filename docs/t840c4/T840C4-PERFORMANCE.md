# Phaser / PixiJS measured performance

Same unmodified C1 native small rig,3 regions, one Physics constraint, same logical3 ticks per25ms host request. Phaser 3.90.0 versus Pixi 8.17.0, same Chrome/RTX3090 WebGL2 machine. Final numerical bones/records and all completed ticks are exactly equal across engines at each population. No backlog remains.

Each latency run:30 warmup +180 measured requestAnimationFrame observations,630 completed ticks/owner. No other browser campaign ran concurrently during the final measurements. Values are instrumented CPU milliseconds, not GPU completion times or a general engine ranking.

|Engine|Owners|Total median|P95|Max|Destroy ms|
|---|---:|---:|---:|---:|---:|
|Phaser|1|0.500|0.700|0.900|1.200|
|Pixi|1|0.300|0.500|0.700|2.300|
|Phaser|10|3.300|3.900|4.400|1.400|
|Pixi|10|1.100|1.300|1.700|2.800|
|Phaser|25|8.700|10.100|10.500|1.600|
|Pixi|25|2.600|2.900|4.200|4.800|

|Engine|Owners|Host overhead|Replay compute|Capture total|Snapshot copy|Freeze/map residual|Presentation total|Public buffer/projection subset|Submission|
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
|Phaser|1|0.000|0.100|0.000|0.000|0.000|0.200|0.000|0.100|
|Pixi|1|0.000|0.100|0.000|0.000|0.000|0.100|0.000|0.100|
|Phaser|10|0.000|0.600|0.100|0.100|0.000|1.800|0.000|0.750|
|Pixi|10|0.000|0.600|0.100|0.100|0.000|0.200|0.000|0.100|
|Phaser|25|0.000|1.400|0.400|0.300|0.100|4.900|0.100|1.900|
|Pixi|25|0.100|1.400|0.400|0.300|0.100|0.500|0.000|0.200|

Browser timer quantization produces many0.0ms substage samples; this means unresolved small work, not zero cost. The cumulative instrumentation itself adds overhead.

`PERFORMANCE-SUMMARY.json` in delivery contains median/P95/max for every raw stage. `release-performance/results.json` retains180 individual samples per row. Host overhead subtracts nested-safe public request timings from advance timing. Capture includes a detached core read, freeze and pose wrapper; snapshot-copy timing is separately instrumented. Freeze/map is the residual, **not a pure mapping microbenchmark**. Presentation includes the B6 guarded detached read, resource/context validation, region geometry and vertex updates. Public Vertex.setUVs/Face projection timings are an instrumented subset inside presentation, not an additional disjoint phase. Pixi's position Buffer.update is a different architecture, so these subsets are not identical work. Phaser Game.step and Pixi app.render include traversal and CPU WebGL submission; no gl.finish/GPU timer claim.

## Separate memory/GC run

30 warmup and600 measured logical frames,1,800 measured ticks per owner, ending at tick1,890. CDP allocation sampling interval32,768 bytes with collected objects included; raw samples and trace events retained under release-memory. Sampled weights estimate churn, **not retained heap, exact allocation counts or VRAM**. Top-level MinorGC/MajorGC events below are observable renderer-thread GC events, not proof of every collection.

|Engine|Owners|Sampled allocation MiB|Top-level GC events|GC event ms sum|
|---|---:|---:|---:|---:|
|Phaser|1|59.38|18|4.580|
|Pixi|1|56.68|27|6.403|
|Phaser|10|484.31|76|22.293|
|Pixi|10|468.04|76|23.460|
|Phaser|25|1132.59|74|48.141|
|Pixi|25|1074.85|71|31.650|

Raw before/after CDP metrics retain heap/object evidence; instance metrics count snapshot/copy/submission operations. Every disposal leaves zero live instance/page references. Engine TextureManager/pipelines live at Game lifetime; borrowed atlas Frame metadata follows page lifetime. No memory-leak-free claim follows from a short tiny-rig workload. Independent longer real-project/hardware testing remains necessary. The stronger transaction, ownership and context checks were retained throughout.
