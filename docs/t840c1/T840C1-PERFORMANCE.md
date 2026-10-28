# T-840C1 — Browser performance

## Configuration and method

13th Gen Intel(R) Core(TM) i7-13700K (24logical processors), Windows
10.0.26300 build26300, ANGLE (NVIDIA, NVIDIA GeForce RTX 3090 (0x00002204) Direct3D11 vs_5_0 ps_5_0, D3D11), Chrome156.0.8078.47,
PixiJS8.17.0, WebGL2,900x520opaque, DPR1, noMSAA. Native fixture4bones,
3regions/meshes,1spring,1atlas page. Local offline server; headless installedChrome,
no browser/model download. Final measurements in webgl-release/performance.json.
Previous trials retained. This is one hardware configuration, not a minimum-spec SLA.

One then ten live independent owners:210rAFframes per phase, first30warmup discarded,
180samples retained. Each benchmark frame explicitly requests2more ticks per owner,
then snapshots/maps/presents each view, then one app.render. This exact stress workload
is NOT the real-time demonstration converter: at a145Hzdisplay it intentionally
advances about290logical ticks/s. Render interval is measured, not assumed60/120.
CPU render time measures submission, NOT GPUcompletion/presentation latency.
P95 uses nearest-rank ceil(.95*N)-1; median uses the middle pair. No invented budget.

|Owners|Phase|Median ms|P95 ms|Max ms|
|---|---|---:|---:|---:|
|1|Replay request|0.1000|0.3000|0.4000|
|1|snapshot + pose mapping + meshes|0.1000|0.2000|0.2000|
|1|Pixi render CPU submission|0.1000|0.2000|0.3000|
|1|total measured CPU|0.3000|0.4000|0.5000|
|1|rAF interval|6.9000|7.1000|7.2000|
|10|Replay request|0.9000|1.1000|1.3000|
|10|snapshot + pose mapping + meshes|0.8000|0.9000|1.1000|
|10|Pixi render CPU submission|0.2000|0.3000|0.4000|
|10|total measured CPU|1.8000|2.1000|2.5000|
|10|rAF interval|6.9000|7.1000|7.2000|

The measured samples process2ticks/frame/owner (360ticks per owner after warmup),
backlog0 in both phases. Separate deterministic hitch tests retain52due and bound
pumps; this benchmark is not a worst-case huge-rig catch-up certification. The rAF
cadence is not a guarantee of sustainedGPUFPS or constant60FPSon other hardware.

## Copies, memory and lifecycle

B6 allocates a candidate map with8numeric scalars per spring, entry arrays/objects
and active array each simulated tick; fresh FK/pose and detached audit frame already
exist. B5B2 currentFrame deep-copies committed pose/records. The pilot capture also
asks previewFrame (its existing nonpreview guard obtains a detached committed frame),
then currentFrame; mapping clones bones and static slots/order before setPose. Existing
Pixi applyPose prepares typed quad/UV/index arrays and updates real mesh buffers.
No new immutable rig clone per tick, but owner/source clones happen at construction.
Diagnostic getters introduce additional snapshot reads. Counts are method calls, not
instrumented allocation-byte totals. Redraw only reuses already prepared meshes.
A future reusable-buffer/capture optimization must preserve B6 isolation and timing.

|Owners|Heap used before bytes|Heap used after bytes|Heap total before bytes|Heap total after bytes|
|---|---:|---:|---:|---:|
|1|15950178|30590998|80223170|80223170|
|10|30590998|31855718|80223170|80226290|

Chromium performance.memory snapshots are coarse, process-wide, affected by JIT/GC;
no explicitGC forced, no allocation profiler, GCevent trace or GPUheap accounting.
A decreasing heap is compatible with GC, not proof of a leak-free application.
No long soak or broad memory certification. Twenty teardown/recreate-frame cycles
(one/two owner alternation) median1.4000ms, P951.8000ms, max1.9000ms include
destruction, new owners/views, initial presentation, render submission and diagnostics.
Old roots and geometry/index buffers are marked destroyed. Live view count matches
actors; atlas pages stay1; final destroy gives0views/0textures. These are actual
resource lifecycle checks, not merely a mock constructor count.

Live mode short pause/resume: before pause completed60,
after resume completed79; paused ticks do not advance. This
short observation is not a precision benchmark or five-minute soak. Graphics/capture
passes finish before measuring; no simultaneous regression browser run is used for
these final samples. No safety check removed and no product optimization included.
