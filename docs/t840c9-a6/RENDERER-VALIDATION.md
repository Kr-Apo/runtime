# Renderer validation, resources and performance — A6

Both views reuse A4 geometry,RGBA/PMA,visibility,null/attachment resolution,texture pages,draw order,matrices and double banks. Only explicit source capability forwarding changes. Events are consumed by ApplicationActor/application after numerical work; renderers never inspect event keys. Per-event slotState makes the UI's exact event.string→slot association truthful even on delayed drain. There is one existing consumer per actor.

## Real graphics and applications

Hardware Chrome156 / ANGLE NVIDIA RTX3090 D3D11,PixiJS8.17.0,Phaser3.90.0,actual WebGL2 (no SwiftShader).33 selected ticks per engine give66 transparent samples; three additional opaque samples per engine give72 total. Real GPU vertex/UV/index buffers,Phaser Vertex/Face batch data,texture pages and actual uLight/uOpacity uniforms are compared with independent native Rust state. Geometry/camera/alpha/draw-order tolerances remain unchanged.

The unchanged I2 CPU rasterizer uses independent Rust geometry plus source images and native atlas metadata.72 CPU and72 same-tick cross-engine comparisons pass the inherited raw premultiplied RGBA8 policy (uniform3,neighbor4,large-edge24,max2% foreground,no registration). Actual nonzero differences and diff images are retained; passing is not CPU/GPU byte identity. Final-source transparent buffers match the independently compared set byte-for-byte.

Both autonomous apps run ordinary RAF/host time,display counters,last event/accepted tick and associated slot/attachment from that event's snapshot,and flash only after receiving native impact. Full-page screenshots capture moon at event tick60 and an active application effect,without external tick commands. Captured46-frame-per-engine sequences and APNG excerpts show the real visual transitions. The APNG is a recorded1.5-second excerpt,not a claim that accumulated Physics resets on each loop.

Two-actor pause/resume,backlog,freeze/resume handlers,context loss/restoration,missing/aborted/concurrent loads,five reloads and real Scene/Game disposal pass. Synthetic freeze/resume exercises the actual handler,not every OS/browser throttling policy. At318,the paused weighted-fan frame restores identical GPU geometry and readPixels SHA while event status remains identical. Expected HTTP404/context warnings are isolated to those tests; normal app probes have no page errors/warnings. CaseC late preparation/GPU failure and retry is independently verified on the final bundle.

## Tests and regressions

655 workspace tests:292 core (25 new composition),142 Phaser,215 Pixi,6 pixel-policy. Build,typecheck,syntax,A3 geometry10,A4 geometry9,C3 vectors,N3 contract and54 B6 private-fault cases pass. A3/A4/A5 regression tests are unchanged and continue to pass,including rejection of both flags on single-family sources. B3/B4/B5B2/B6 trace drivers produce byte-identical accepted N6 traces.

Current modules rerun234 historical captures:72 I2,44 A3,86 A4,32 A5; every raw framebuffer matches the accepted one byte-for-byte. Q1/G1/G2/N3–N6 full campaigns/certificates are preserved,not rerun/reissued. Historical protected maps and five A2/I2/A3/A4/A5 sealed trees match. RC2 remains unchanged. No ten-minute campaign. RED-admission/GREEN logs retain feature absence before implementation and complete final behavior. Temporary harness/type preparation failures are retained and excluded from positive evidence.

## Measurements

Existing profiler reused:600 advancing ticks and40 GPU query samples per engine with one/two actors;5000 direct event collector samples measure A5's stage separately. Full numeric update includes slot sampling and event-context preparation; direct collection does not. Raw outliers remain in the files.

| Engine | Actors | Median numeric ms | Median present/draw ms | Median GPU ms |
|---|---:|---:|---:|---:|
| PixiJS | 1 | 0.10 | 0.40 | 0.0061 |
| PixiJS | 2 | 0.10 | 0.80 | 0.0092 |
| Phaser | 1 | 0.10 | 0.60 | 0.0594 |
| Phaser | 2 | 0.10 | 1.20 | 0.2048 |

Normal drain observes peak2 pending occurrences per actor,then0;32 occurrences per actor are consumed in600 ticks. Saturation tests separately reach1024 and reject the next full candidate. Browser timer granularity limits tiny drain timings (often0.00ms); this is not zero cost. PERFORMANCE-SUMMARY.json retains maxima,collector timings,queue observations,post-GC heap deltas and resource/destruction counts. Profiling arrays intentionally retain detached data; no zero-allocation/general leak-free or throughput guarantee is claimed.

The five attachment identities reach ten cached meshes per actor across two banks,three borrowed pages and two targets. Destruction balances owned meshes/consumers; a peer remains usable and borrowed textures retain their proper owner. Memory scales with rig/queue size as documented,not elapsed play time without bound. No general optimization is introduced without evidence. Broader hardware/domain qualification is outside this tranche.
