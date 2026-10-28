# Real Phaser WebGL2 qualification

Tested browser: 156.0.8078.47. GPU: ANGLE (NVIDIA, NVIDIA GeForce RTX 3090 (0x00002204) Direct3D11 vs_5_0 ps_5_0, D3D11). WebGL: WebGL 2.0 (OpenGL ES 3.0 Chromium). Phaser 3.90.0; Pixi 8.17.0 for controls.900x520 drawing buffer, DPR1, no antialias, premultiplied alpha, opaque #28323d backdrop. Only this environment is certified by these observations.

Two final campaigns: original unmodified C1/C2/C3 native fixture and a separate real native C4 export whose torso has animated translation, rotation and two independent nonuniform-scale tracks. Author fixture,PNG sources, native save/reload and export, Rust721-frame ReplayConsumer reference and SHA provenance are preserved in the delivery. Editor checkpoint275082e8 is unchanged. No native runtime JSON was patched. The fault_at_9 clip did not acquire the new scale tracks; its independent oracle remains the original Rust trace.

50 scenario rows total, including46 PNG/RGBA captures:42 simulated pose comparisons against independent Rust frames,4 pure previews whose tests validate preview/context separation rather than claiming an independent simulated Physics oracle. Capture ticks0/1/8/30/60/120,60/8/52 backlog, update without render,30 cached redraws, pause/resume, partial/drained backlog, previews30/90, replay, controlled host-time independence/hitch, parent Container and camera transform, native numerical fault retaining tick8, reset and Scene restart. Lifecycle rows cover independent and last disposal, asset reuse and Game destruction. No external request, unexpected missing resource, browser error/warning or lost context occurred in the final C4 campaigns.

|Quantity|Maximum absolute error|Fixed limit|
|---|---:|---:|
|World matrix linear coefficients|3.403066696e-07|0.0001|
|World matrix translation|6.88827641e-06|0.01|
|Local region corners|1.82043148e-05|0.01|
|Submitted camera-space coordinates|3.145509936e-05|0.02|

Trim support-corners are independently reconstructed from Rust's full region corners and native atlas metadata. Expanded Phaser indices0/1/2/0/2/3 preserve the four logical corners. Camera reference composes the public root/parent world matrix, camera scroll and camera matrix independently of the renderer's GetCalcMatrix. Vertex.tx/ty and u/v versus submitted tu/tv are inspected; the initial mesh set also intercepts real Vertex.load and verifies the Float32 submission fields. No arbitrary camera inversion is introduced.

Pixel controls substitute only independent Rust corners in the **test oracle**, then submit through the same Phaser texture/shader/rasterizer. Production always consumes Replay snapshots. The existing pixel policy and all numeric limits are unchanged. This controls numerical geometry-to-pixels, not a claim of a separate Rust CPU rasterizer's bit-identical output. Preview actual-versus-itself images are observation artifacts, not pixel-parity evidence. No binary Phaser/Pixi raster equality is required.125 modern cross-engine Legacy cases pass separately.

A first real run exposed stale projected vertices at tick1: camera error1.176040902458169 exceeded0.02 while committed geometry was correct. RED log and reconstructed actual/Rust-pose RGBA are retained. The final public Face projection path removes that render lag. An exploratory preUpdate call was rejected by TypeScript because Phaser marks it protected; it is absent from final product code. Initial expanded testing also compared fault_at_9 to the scaled sway oracle by mistake; that failed log is retained, the unchanged fault clip now uses its correct original independent reference. No threshold changed.

Resource cases: success, presentation-error, preabort, bad-json, incompatible-before-pages, page-failure-after-one, abort-after-one, install-second-failure, install-after-second-failure, game-destroy-during-load. Native2-page exports verify no install before all decode, rollback of first installed page if second installation fails, abort cleanup/object-URL revocation, Game cancellation, healthy Physics after a presentation resource failure, listener and texture-key preservation. A separate real Scene.update/performance.now test runs both characters, pauses one while the other advances, resumes and compares the paused visible frames with Rust within0.01.

The independent external TypeScript app compiles strict public imports, creates a real Phaser Scene/WebGL2 canvas, loads native data, exact60/8/52, C3 host control, preview/replay, two owners, refusals and disposal. It imports no internal package files. Temporary dependency junctions are detached after validation. No claim of WebGL1, mobile, context restoration or cross-hardware fidelity.
