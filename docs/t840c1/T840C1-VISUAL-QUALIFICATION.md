# T-840C1 — Visual qualification

Actual WebGL2, not mocks or CSS animation. Browser 156.0.8078.47, PixiJS 8.17.0.
Windows 10.0.26300 / build26300; 13th Gen Intel(R) Core(TM) i7-13700K.
GPU: ANGLE (NVIDIA, NVIDIA GeForce RTX 3090 (0x00002204) Direct3D11 vs_5_0 ps_5_0, D3D11). Canvas900x520, DPR1, resolution1, antialiasfalse,
opaque background #28323d, premultiplied alpha, preserveDrawingBuffertrue.
No CPU Physics renderer or silent format patch used.

## Scenes and oracles

Two scouts share one immutable atlas. Character command/pause/replay and meshes are
independent. A one-scout scene tests cadence/fault; ten scouts test performance.
PNG art remains static; mesh vertices are driven by accepted ReplayConsumer worlds.
Rust reference:721successfully simulated frames, computed from the same native author
fixture and unchanged export. Region corners use Rust core local_corners, then the
accepted world; clipping of atlas trim coverage is independently interpolated from
those full corners. Actual MeshGeometry buffers and toGlobal camera coordinates are
compared; native draw order and displayed tick are asserted. This is vertex-baked
hierarchy, not per-bone Containers whose transforms could be compared directly.

Same-renderer Rust-pose pixel comparison isolates simulation/mapping. It does not
independently certify shaders or CPU-rendered Physics. Existing33region GPU tests
are also rerun. Existing pixel policy was retained BEFORE captures: uniform channel
limit3, large-edge limit24 and max2%foreground; no registration or threshold change.
Pure preview is intentionally not compared to historically simulated Physics pixels.
Its pixels must differ from the same-time simulated scene, and the underlying
committed origin remains0. All raw GPU bytes and display PNGs are retained.

## Measured maxima

|Quantity|Maximum absolute|Limit|
|---|---:|---:|
|Bone affine coefficient|3.40306669622e-07|0.0001|
|Bone world translation|6.88827640971e-06|0.01|
|Mesh vertex, scene units|1.23494788085e-05|0.01|
|Camera/global vertex, pixels|2.22290618126e-05|0.02 (scene tolerance scaled x2, set before capture)|

Tick0 is the primed origin, not a positive Physics integration. Tick1 also matches
Rust; no constructor discontinuity or extra Legacy step is introduced. Motion differs
from pure sampling at60, with nonzero actual Physics records. Alpha correctly blends
transparent artwork on the qualified opaque background. Transparent render targets
are NOT newly qualified by this scene.

## Capture inventory (authoritative webgl-release)

|Capture|Displayed ticks|State|Pixel reference status|
|---|---|---|---|
|00-tick-zero|0,0|stopped,stopped|PASS|
|tick-1|1,0|playing,stopped|PASS|
|tick-30|30,0|playing,stopped|PASS|
|tick-60|60,0|playing,stopped|PASS|
|tick-120|120,0|playing,stopped|PASS|
|paused|120,0|paused,stopped|PASS|
|redraw-observational|120,0|paused,stopped|PASS|
|backlog-8-of-60|8,0|playing,stopped|PASS|
|pump-partial-11|11,0|playing,stopped|PASS|
|caught-up|60,0|playing,stopped|PASS|
|simulated-before-seek|60,0|playing,stopped|PASS|
|pure-seek-preview|60,0|seek_preview,stopped|PASS|
|replay-partial|8,0|replaying,stopped|PASS|
|after-replay|60,0|paused,stopped|PASS|
|fault-last-good|8,0|faulted,stopped|PASS|
|after-reset|0,0|stopped,stopped|PASS|
|two-independent|30,120|playing,playing|PASS|
|before-native-solver-fault|8|playing|PASS|
|native-solver-fault-last-good|8|faulted|PASS|
|cadence-30|240|playing|PASS|
|cadence-60|240|playing|PASS|
|cadence-120|240|playing|PASS|
|cadence-144|240|playing|PASS|
|irregular-hitch|240|playing|PASS|

PNG and raw .rgba files have matching names; *-rust-pose.png uses independent Rust
worlds through the same Pixi presenter. Max channel/pixel differences are in results.json,
not hidden by PNG display conversion. All24captures PASS; one separate invalid-pose
presentation test keeps solver health/tick intact. Native singular-parent failure
at9 preserves exact tick8 pixels and backlog52; refused audit also preserves its
last pose. Redraw repeats produce the identical raw hash. No future requested pose.

First webgl-first/final/qualified runs are retained; webgl-release is authoritative
after diagnostic refinements. New images are isolated artifacts, not replacements
of the207historical references. ZeroJSerrors, WebGLwarnings, missing/externalrequests
or observedcontextloss. Twenty teardown/recreate cycles check roots and all retained
geometry/index buffer destroyed flags, one atlas page, expected live mesh counts.
These lifecycle assertions do not measure all driver allocations or prove no long-run leak.
No manual artistic test or wider hardware certification is claimed.
