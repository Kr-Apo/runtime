# C5A/C5B CPU and allocation comparison

Exact baseline source27d386117c4e429ac7ba85a57498c64550f95e46 is exported to an isolated directory and independently compiled with installed locked-version dependencies. C5B is built separately. Baseline source/build bytes are not patched. Diagnostic function wrappers use transient HTTP response transforms in separate intrusive runs; unwrapped latency runs use original built modules. Same Chrome156.0.8078.47,RTX3090 ANGLE/D3D11,Phaser3.90.0,WebGL2,fixtures,LINEAR filter and workload. No performance criterion is invented after observing gains: retain only a bounded safe change with measured validation and total-frame benefit.

## Main unwrapped series

Each source runs72 configurations:Scout/Ranger/Courier x1/5/10/25 actors x exact/host x3 repetitions. Each configuration measures6 scenarios: new pose, same-token presentation, redraw, pause, hitch and catch-up;16 warmup +60 samples per scenario. Host time uses C3, exact uses canonical ticks. Hitch adds500ms; catch-up drains the real numerical debt explicitly. Simulation, capture, presentation and CPU submit intervals are separate. Capture may be called again by existing prerender; there is no extra shadow solver. Destruction is timed and resource references checked. All432 paired scenario clock endpoints are identical between sources.

Host mode,new pose,CPU frame median/P95/max ms (180 samples per cell):

|Character|Actors|C5A|C5B|
|---|---:|---|---|
|scout|1|0.40/0.60/0.80|0.20/0.30/0.40|
|scout|5|1.40/1.90/3.60|0.50/0.80/1.10|
|scout|10|2.70/3.60/4.10|0.80/1.10/1.30|
|scout|25|6.15/8.60/10.30|1.80/2.20/2.50|
|ranger|1|0.60/0.90/1.20|0.30/0.50/0.80|
|ranger|5|2.50/3.40/5.30|1.20/1.50/2.20|
|ranger|10|4.10/5.00/5.30|2.20/2.60/3.10|
|ranger|25|9.40/11.30/15.50|5.60/6.50/7.40|
|courier|1|0.90/1.30/3.50|0.60/0.90/1.20|
|courier|5|3.30/4.20/4.60|2.30/2.80/3.20|
|courier|10|7.35/8.50/10.30|4.70/5.70/9.60|
|courier|25|18.30/20.60/25.10|10.85/13.00/17.40|

## Order control at25 actors

A second sequence runs C5B,C5A,C5A,C5B,all3 characters and both time modes. This keeps results from the opposite ordering rather than assuming the first baseline block is stationary. Host,new-pose pooled median/P95/max ms,120 samples per source/character:

|Character|C5A|C5B|Median reduction|
|---|---|---|---:|
|scout|5.45/6.10/7.80|1.90/2.30/2.60|65.1%|
|ranger|9.35/10.90/12.20|5.50/6.40/7.20|41.2%|
|courier|15.50/19.60/22.60|11.10/12.70/18.00|28.4%|

Both sources retain all initial samples. Courier baseline shifts between blocks; the counterbalanced result is more conservative than quoting only the first block. Gains are observable in validation/presentation and whole frame, not just counts. They are CPU timings, not GPU execution time or a sustainable FPS promise.0.1ms timer quantization and occasional GC/driver stalls affect P95/max and small stages; zero samples do not mean zero work.1008 scenario summaries and raw per-frame samples retain exact/host,new/redraw/pause/hitch/drain outcomes. Intrusive measurements are not mixed into these latency totals.

## Cause and limits of attribution

Only immutable VERSION qualification is cached. Real-browser nested-exclusive counters isolate qualification, native VERSION/isContextLost, page checks, TextureManager.get/exists, geometry, Face projection,capture,presentation and CPU submission. Baseline performs3 VERSION roundtrips per new owner/frame; C5B retains3 dynamic validations but no steady-state VERSION queries. Native isContextLost remains checked, and resources are still validated on cached tokens and inside consumer dispatch. The load boundary trace records initial qualification separately from later asset load/borrow.

Texture/page dimension/PMA iteration is the residual self-time of resource validation after subtracting nested context/TextureManager work, not a falsely precise independent microtimer for each field. Face projection/geometry/draw calls are unmodified. Repeated projection, snapshot copies, object allocations, GPU queue synchronization and submission still cost CPU. Removing VERSION does not explain every Phaser/Pixi difference or make complex rigs free. No draw-call or allocator rewrite is shipped.

## Separate allocation/GC workload

Each source runsScout/Ranger/Courier at1/25 owners:30 warmup +200 measured updates,ending tick460. CDP32KiB sampling includes collected objects; GC trace events are retained. Sampled churn is not retained heap or VRAM. Final forced GC is an observation with the example/module still loaded, not proof of zero memory retention.

|Source|Character|Actors|Sampled MiB|GC events|Heap after dispose+GC MiB|
|---|---|---:|---:|---:|---:|
|baseline-memory|scout|1|18.0|10|6.74|
|baseline-memory|scout|25|301.7|38|6.85|
|baseline-memory|ranger|1|49.1|13|6.78|
|baseline-memory|ranger|25|944.0|38|6.95|
|baseline-memory|courier|1|112.4|29|6.81|
|baseline-memory|courier|25|2525.0|82|7.01|
|release-memory|scout|1|18.9|10|6.69|
|release-memory|scout|25|297.4|41|6.85|
|release-memory|ranger|1|47.9|13|6.78|
|release-memory|ranger|25|932.3|38|6.95|
|release-memory|courier|1|114.0|29|6.85|
|release-memory|courier|25|2494.8|83|7.02|

All12 configurations release every asset instance/page reference. Cache state allocates once per Game, not on its hot path; teardown removes both native listeners. Sampling and GC noise preclude a claim of zero additional allocation or a precise retained-byte saving. There is no material new per-frame allocation algorithm in the optimization. See raw profiles and MEMORY-SUMMARY-FINAL.json for the actual observations. The measured CPU gain and small bounded design justify retaining the optimization on the qualified machine; broader hardware remains future work.

## Short-profile hitch witness

The short intrusive run initially scheduled its hitch outside its ten-iteration window; this diagnostic schedule was corrected without changing the long unwrapped workload. Both source profiles were rerun. Their actual hitch progress is retained in FINAL-HITCH-PROFILE.json. An initial auxiliary assertion incorrectly demanded52 ticks of debt for both time modes. Independent Python Fraction decoding of the represented host endpoint566.6666666666666ms predicts requested67/completed16/backlog51; the exact rational schedule requests68/completes16/retains52. Both sources match those distinct exact inputs. No epsilon,core change,threshold relaxation or old oracle modification. This harness incident is not a runtime failure or an all-green first attempt.

## Direct validation cost, separate diagnostic run

Nested-inclusive WebGL validation and exclusive TextureManager/page residual CPU ms per input frame,25 actors/host/new pose,ten inputs including two warmups. Each cell is C5A / C5B. These intrusive timings isolate costs; use the earlier unwrapped series for end-to-end latency. Page residual covers iteration/dimensions/PMA after nested resource/context lookups; it is not added again to the inclusive total.

|Character|WebGL validation incl. ms/frame|TextureManager exclusive ms/frame|Page residual exclusive ms/frame|VERSION calls over10 inputs|
|---|---:|---:|---:|---:|
|scout|3.760 / 0.020|0.050 / 0.050|0.100 / 0.070|750 / 0|
|ranger|3.580 / 0.030|0.080 / 0.050|0.130 / 0.060|750 / 0|
|courier|3.640 / 0.050|0.120 / 0.130|0.120 / 0.060|750 / 0|

All six profiles retain750 validation calls,unchanged Face projection and draw counts. C5B replaces repeated VERSION queries with native loss checks and identity comparisons. Raw inclusive/self times and native call counts are retained in VALIDATION-COST.json; query time can include driver synchronization/wait and is not GPU execution duration.
