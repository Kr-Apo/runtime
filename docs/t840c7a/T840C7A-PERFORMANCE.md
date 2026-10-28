# C7A performance and resources

Controlled sequential exact-tick CPU measurements on the same Chrome/RTX3090 configuration. Six workloads at1/5/10/25 actors;12 warmup and228 measured ticks per row;60 cached redraws. CPU stage timings include instrumentation, heap sampling and GC tracing. Raster GPU execution is asynchronous: submission time is CPU only, not GPU duration. Values rounded to0.0ms are below timer resolution, not proof of zero cost.

| Workload | Actors | Native vertices/triangles per actor | Total median/p95 ms | Vertex median ms | Cached redraw median ms | CPU geometry bytes |
|---|---:|---:|---:|---:|---:|---:|
| perf-region | 1 | 8/4 | 0.100/0.200 | 0.000 | 0.000 | 176 |
| perf-region | 5 | 8/4 | 0.300/0.600 | 0.000 | 0.000 | 880 |
| perf-region | 10 | 8/4 | 0.500/0.700 | 0.000 | 0.000 | 1760 |
| perf-region | 25 | 8/4 | 1.200/1.600 | 0.000 | 0.000 | 4400 |
| perf-grid1 | 1 | 8/4 | 0.100/0.200 | 0.000 | 0.000 | 176 |
| perf-grid1 | 5 | 8/4 | 0.300/0.600 | 0.000 | 0.000 | 880 |
| perf-grid1 | 10 | 8/4 | 0.500/0.800 | 0.000 | 0.000 | 1760 |
| perf-grid1 | 25 | 8/4 | 1.200/1.700 | 0.000 | 0.000 | 4400 |
| perf-grid4 | 1 | 29/34 | 0.100/0.300 | 0.000 | 0.000 | 872 |
| perf-grid4 | 5 | 29/34 | 0.300/0.700 | 0.000 | 0.000 | 4360 |
| perf-grid4 | 10 | 29/34 | 0.600/0.900 | 0.000 | 0.000 | 8720 |
| perf-grid4 | 25 | 29/34 | 1.300/1.800 | 0.100 | 0.000 | 21800 |
| perf-grid8 | 1 | 85/130 | 0.100/0.300 | 0.000 | 0.000 | 2920 |
| perf-grid8 | 5 | 85/130 | 0.400/0.700 | 0.000 | 0.000 | 14600 |
| perf-grid8 | 10 | 85/130 | 0.650/1.000 | 0.100 | 0.000 | 29200 |
| perf-grid8 | 25 | 85/130 | 1.600/2.000 | 0.200 | 0.000 | 73000 |
| perf-grid16 | 1 | 293/514 | 0.200/0.400 | 0.000 | 0.000 | 10856 |
| perf-grid16 | 5 | 293/514 | 0.500/0.900 | 0.200 | 0.000 | 54280 |
| perf-grid16 | 10 | 293/514 | 1.000/1.300 | 0.300 | 0.000 | 108560 |
| perf-grid16 | 25 | 293/514 | 2.300/3.000 | 0.800 | 0.000 | 271400 |
| mixed | 1 | 89/52 | 0.500/0.800 | 0.000 | 0.000 | 2384 |
| mixed | 5 | 89/52 | 1.900/2.400 | 0.000 | 0.100 | 11920 |
| mixed | 10 | 89/52 | 3.600/4.500 | 0.100 | 0.100 | 23840 |
| mixed | 25 | 89/52 | 9.400/10.400 | 0.200 | 0.300 | 59600 |

Region and grid1 workloads have identical bones,Physics,clips,images,slot count and two triangles per attachment:8 total vertices/4 triangles. Other grids deliberately increase only one mesh from4/2 to25/32,81/128,289/512 vertices/triangles. The mixed character has a different26-bone/21-slot/8-Physics workload; its timings are not a normalized region comparison. Source vertex counts differ from trimmed derived draw counts.

All24 rows pass at25 actors. Each instance has private geometry/buffers, shared asset textures, stable buffer identities,0 steady WebGL buffer creations,0 geometry buffer updates or pose transfers on cached redraw, and destroyed owned buffers after disposal. Existing renderer still writes UV/index buffers on each changed pose and allocates working world/draw arrays; this was measured rather than optimized away. Baseline snapshots and B6 copying/validation remain intact.

Raw samples separately record simulation,capture,presentation,MeshBinding world-vertex work,MeshAtlas draw work,Buffer.update CPU time,WebGL CPU submission,buffer update/upload counts and bytes,creation/destruction. Vertex and buffer timers are nested inside presentation; do not add nested stages to total. Geometry byte counts are CPU typed-array sizes,not VRAM. Uniform/engine buffer operations may occur during redraw independently of geometry.

| Workload | Heap before / after dispose+GC bytes | Sampled allocation estimate bytes | GC trace events |
|---|---:|---:|---:|
| perf-region | 4341884/4906304 | 341100224 | 129952 |
| perf-grid1 | 4359428/4978364 | 354783584 | 149000 |
| perf-grid4 | 4389392/4982000 | 418561852 | 152938 |
| perf-grid8 | 4455068/4996040 | 626090980 | 157758 |
| perf-grid16 | 4580572/5021340 | 1320256288 | 172357 |
| mixed | 5079524/5266532 | 3278313832 | 253391 |

HeapProfiler uses32KiB sampling and includes collected objects; allocation profiles are statistical estimates, not exact allocation counts. GC trace events include nested phases, not an exclusive pause count. Inclusive traced duration can double-count nesting; raw events and explicit forced-collection round trips (including debugger IPC) are retained. Collection occurs outside timed samples. The page still retains the harness,source metadata,decoded module/renderer code and canvas after asset destruction,so post-GC heap is not expected to return exactly to the pre-run baseline. These observations do not establish unbounded-session leak freedom,driver/GPU-memory residency or crash recovery.

No absolute performance/FPS acceptance promise is inferred. Fair region/grid1 medians are comparable in this controlled workload; grid16 and mixed costs grow with work and allocation volume. Retest across hardware/browsers before broad alpha performance claims. Raw mesh-performance/results.json,GC traces,allocation profiles and PERFORMANCE-SUMMARY.json are retained.
