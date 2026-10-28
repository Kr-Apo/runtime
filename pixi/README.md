> **T838 local preparation:** package versions are unchanged. Former fork destinations are historical; no replacement URL is created. Read the root README and docs/t838-editor-compatibility.md before following historical installation instructions below.

> **T-811 local candidate:** proposed 0.2.0-alpha.1. Install the matching core and adapter tarballs together; no npm publication. 125 headless pixel comparisons passed on one configuration, 104 exact. See the candidate integration guide (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/RUNTIME_INTEGRATION.md`; new destination pending).

> T-810 source note: pure geometry and playback helpers now live in
> `@ankhimate/runtime/render`, with the public Pixi API preserved. Source import
> maps need that entry. Parity matrix (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/PHASER-PIXI-PARITY.md`; new destination pending) distinguishes
> deterministic non-regression from new Phaser manual qualification. Frozen RC2
> modules are unchanged; do not mix local package snapshots with that bundle.

# Ankhimate / PixiJS — regions, playback and meshes (T-604b.1–b.3)

Private local candidate, proposed version 0.2.0-alpha.1. Not a published package or a full runtime
fidelity claim. Reuses the matching `@ankhimate/runtime` 0.2.0-alpha.1 and its `RigPlayer`. The separately
reviewed shared boundary corrections (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/shared-playback-boundaries.md`; new destination pending)
align negative half turns, event order and time-zero handling with Rust.
PixiJS is pinned to **8.17.0** in the npm workspace lock. WebGL only is qualified;
the example explicitly selects it. The measured backend is WebGL2; WebGL1
fallback is not qualified. WebGPU is outside this contract.

## Run

From the runtime repository, using the existing Node/npm toolchain:

```sh
npm ci
npm run build
npm run example:pixi
# Open the printed http://127.0.0.1:4175/examples/pixi-regions/ URL.
npm test
npm run typecheck
npm run test:pixi-webgl
npm run example:pixi-playback
# http://127.0.0.1:4176/examples/pixi-playback/
npm run test:pixi-playback
npm run test:pixi-meshes
npm run test:pixi-appearance
npm run test:pixi-clipping
```

For the last command, set `ANKHIMATE_BROWSER_PATH` if Playwright's Chromium is
not installed, e.g. the absolute path to an existing Brave/Chrome executable.
No browser download is required when using that executable. Tests save evidence
under `test-results/pixi-webgl`, or `ANKHIMATE_TEST_OUTPUT` when provided.
Open over HTTP, not `file://`. The example needs this checkout and its locked
dependencies; it is a standalone page, not a standalone redistribution bundle.

## Minimal API

```ts
import { Application } from 'pixi.js';
import { loadPixiRig } from '@ankhimate/pixi-runtime';

const app = new Application();
await app.init({ preference: 'webgl', backgroundColor: 0, backgroundAlpha: 0 });
const asset = await loadPixiRig(new URL('/character/skeleton.json', location.href));
const a = asset.createInstance();
const b = asset.createInstance();
app.stage.addChild(a.root, b.root);
a.root.position.set(200, 300);
b.root.position.set(500, 300);
a.setTime('idle', 0.25); // existing core evaluation, seconds in [0,duration]
b.setTime('idle', 0.75);
// Alternatively a.setPose(pose) accepts an already evaluated core RigPose.
a.destroy();
b.destroy();
asset.destroy();
```

`setTime` samples a clip directly. It does not implement playback speed, looping
transport, crossfade or event dispatch. Use `instance.playback` for those.
`setPose` validates the
whole pose before updating visible meshes; its bones/slots/draw order must match
this rig. The caller's pose and input rig are never mutated. Asset creation
snapshots the source data so external edits do not change another instance.

`createInstance({skin: 'name'})` selects one skin with default-skin attachment
fallback. `instance.setSkin('name')` (or `instance.playback.setSkin`) changes it
without restarting playback, advancing time, losing a crossfade or emitting events.
`instance.skinName` reports the current skin. It preserves pause/speed/listeners
and the latest event batch; a subsequent `update(0)` still clears that batch as
before. A detached direct pose keeps its transforms, attachments and colors when
changing skin, rather than jumping to setup. There is no multi-skin composition.

A region sequence displays the `sequenceFrame` produced by the existing core,
without another sampler. Only the included tagged_rig loop is visually qualified;
no general sequence-mode parity claim.

## Per-instance playback API (b.2)

```ts
const playback = a.playback;
const unsubscribe = playback.onEvent(event => console.log(event.name, event.string));
playback.play('idle', { loop: true }); // omitted loop uses the authored flag
playback.speed = 1.5;                  // finite, strictly positive
playback.update(1 / 60);               // seconds, called by the game
playback.pause();
playback.resume();
playback.crossFade('walk', 0.3);        // non-negative seconds
console.log(playback.animation, playback.time, playback.playing, playback.events);
playback.stop();                       // clears transport and displays setup
unsubscribe();
// a.destroy() also destroys its controller and removes every callback.
```

No global ticker is registered. The playback example owns its Application ticker
and passes `ticker.deltaMS / 1000`. Each instance wraps one shared-core RigPlayer;
only per-instance clip looping metadata is copied/overridden, not the tracks.
Textures stay shared, mesh geometry and transport state stay independent.

`play` starts at zero. Pause holds the displayed pose and time. Resume without a
current clip is a no-op. `stop` resets to setup; `speed` remains configured.
Nonloop playback clamps to the last pose (the controller remains active, so a
long crossfade can finish). Zero-duration clips hold time zero and emit nothing.
Finite non-negative delta is required; zero delta emits nothing. A speed-scaled
delta must also be finite. A loop update whose conservative event-count bound
exceeds 100,000 is refused **before** advancement; split such a delta. This is a
resource guard, not a promise to process unbounded event batches.

Looping wraps with the core's modulo; an exact end wraps to time zero, after
dispatching the positive-duration endpoint event. Each event interval is
`(from,to]`; events at time zero are ignored on startup and on every loop.
Events are stably chronological per lap, with authored tie order preserved.
Only the incoming/current clip emits during a crossfade. Fade duration uses
speed-scaled time, as do both tracks. A zero-duration crossfade switches directly.
A fade to the same clip keeps the existing core no-restart behavior. Interrupting
a fade uses the previous incoming track as outgoing, not a snapshot of the
visible composite; this is the existing RigPlayer policy.

`events` is the latest immutable batch, cleared on zero/paused update and control
actions except appearance-only `setSkin`. Callbacks are synchronous, after rendering. Unsubscribe is idempotent.
The event batch is snapshotted; play/pause in a callback affects future updates,
not the remainder of that batch. Destruction stops all remaining callbacks.
Recursive update is refused; a throwing callback propagates after the pose has
advanced. The game must handle its callback errors. The adapter does not play
audio automatically; audio payloads remain data.

Successful `setTime` or `setPose` **detaches playback**, including an active fade;
the direct pose remains until an explicit `play`, `crossFade` or `stop`. Resume
then has no clip to resume. Invalid direct input leaves playback intact. Direct
seek may sample `[0,duration]` including the endpoint without wrapping or events.
The asset snapshots its source rig, so external clip deletion cannot invalidate
an active instance; there is no dynamic clip mutation API. Unknown/refused clips,
invalid options, speed, fade duration and deltas fail before transport mutation.

`playback.destroy()` alone disables the controller/callbacks but leaves the view
alive for direct sampling; instance destruction owns GPU cleanup. Destroying
borrowed textures externally while an instance is active is caller misuse,
not a recoverable transport transaction.

## Regions, trim and coordinates

Region quads use core world affines including hierarchy, scale and shear.
Local attachment position, rotation, scale and pivot are applied to the authored
rectangle. Before drawing, its source UV rectangle is intersected with the
atlas's trimmed source bounds. Offsets/original dimensions therefore preserve
the original placement; the crop is not stretched to fill the authored size.
Vertices are converted once from Y-up to Pixi's Y-down. Do not negate root.scale.y.
Draw order comes from the pose. Light RGB/alpha, static dark RGBA and Normal
are supported by the targeted WebGL two-color shader described below.

## Meshes and evaluated FFD (b.3)

The same `loadPixiRig`, `createInstance`, `setTime`, `setPose` and playback API
now accept native v2 rigid and weighted meshes. No new animation player or FFD
sampler is introduced. `pose.deforms[slot + '\0' + attachment]` comes from the
shared evaluator, including Linear, Stepped, Bézier and crossfade behavior.

Native mesh vertices are in the slot bone's setup-local frame; UVs are normalized
to the original source image. Triangles are vertex indices. Weighted vertices
carry influence-local bind coordinates, a bone name and non-negative weights.
The common `attachmentWorldVertices` API performs the world transform and
normalization by the positive total weight. Missing bones, invalid counts,
negative/non-finite or zero-total influences are refused. Vertices without
influences in a partially weighted mesh use the slot bone's rigid transform.
Singular influence setup affines are refused, rather than approximated.

Rigid FFD stores one XY offset per vertex. Weighted FFD stores one XY offset per
influence, flattened in vertex/influence order. An unweighted vertex inside a
partially weighted mesh owns no packed offset. The adapter converts these
already evaluated offsets from the host setup frame to each influence's setup
frame, prepares a private attachment view, then calls the existing core skinning
API. Authored arrays and poses are not modified. No weighting solver is copied
from Phaser, and neither `core/` nor `phaser/` is changed.

Full atlas regions preserve native topology and map UVs directly to their page.
For a trimmed source, triangles are cropped in static UV space to the retained
source rectangle. Newly introduced boundary vertices interpolate the existing
skinned vertices barycentrically. This preserves authored placement and avoids
sampling neighboring atlas entries; the cropped image is never stretched over
the original mesh. This is atlas cropping; native clipping is a separate geometry operation (below).
Every instance owns its temporary binding data, meshes and buffers. The texture
pages remain shared. Ordinary FFD updates reuse the same MeshGeometry and
buffers. A real attachment/page change that alters vertex/index counts replaces
only the geometry, destroys its previous buffers, and retains the Mesh object.
Equal-sized index changes update the existing index buffer.

All attachment metadata is checked at asset load. Different mesh topologies
across skins are allowed. Before creating/switching to a skin, every authored
FFD track must match its resolved mesh's packed offset count in that skin,
including default fallback. An incompatible appearance is refused even if its
problematic clip is not currently playing; offsets are never truncated or ignored.
The author must maintain meaningful vertex/influence order when reusing a named
FFD target; this is not deformation retargeting. Invalid direct FFD, unknown attachment keys, non-finite influence
affines and dimension errors fail before modifying displayed meshes. Source
UVs must stay within [0,1], triangle indices must be valid, and linked meshes
remain excluded. Mesh image sequences are explicitly refused until separately
qualified; the existing b.1 region sequence is preserved. UV wrapping, rotated atlas packing and dynamic skin composition
are not added by b.3.

The instance root's `onRender` is reserved for the backend guard. WebGPU and
Canvas renderers fail explicitly on rendering; initialize the Application with
`preference:'webgl'`. Only the measured WebGL2 backend is qualified; the guard
does not constitute WebGL1, mobile or WebGPU certification.

The loader decodes full PNG pages as HTML images with
`premultiply-alpha-on-upload`; it bypasses Pixi Assets' global cache to make
ownership explicit. A transparent backbuffer should clear to transparent black
(`backgroundColor:0, backgroundAlpha:0`), not nonzero RGB with zero alpha.
If supplying your own textures through `PixiRigAsset.from(source, pageMap)`,
they must be full-page textures, resolution 1, valid PMA and correctly decoded.
They are **borrowed** and remain the caller's responsibility. Source dimensions
and page rectangles are checked. Cropped Pixi Texture frames are refused.

## Ownership and failures

- `loadPixiRig(url,{signal})` owns its decoded pages; HTTP, JSON, missing regions,
  PNG signature, decode and dimensions fail explicitly. Completed page loads
  are disposed if another page fails. All in-flight loads are settled before
  reporting the failure; without an AbortSignal, a stalled network request can
  delay this. Object URLs are revoked after decoding/failure.
- Instances own meshes/geometries/buffers, share atlas textures, and have no
  autonomous ticker or event listeners on a renderer. Destroy is idempotent.
  Destroying a root also releases its rig resources. Root children belong to
  the rig: put other game objects beside the root, not inside it.
- Destroy all instances before their asset; otherwise asset destruction throws
  rather than invalidating another character. Destroying a borrowed asset never
  destroys its textures. Invalid supplied poses preserve the displayed state.
- Pixi renderer-level caches/batch buffers are renderer-owned. This adapter
  does not claim to free or measure all memory retained by the browser/GPU.

## Explicit refusals / limits

Requires native JSON **format_version 2** and embedded atlas, not `.ankh`.
The existing core v1 reader remains unchanged, but this adapter refuses v1.
All skins are checked conservatively, even inactive ones: linked meshes and
attachments other than regions/meshes/simple clipping perimeters are refused. So are
non-Normal blending, constraints including
IK/transform/physics/path and constraint timelines. Events are now
accepted only with finite in-duration times and correctly typed payloads.
No physics `target`/`bones[0]` workaround is introduced.

Rotated atlas entries are explicitly refused: the current native exporter does
not provide a qualified rotated fixture. Attachment-local rotation and reflected
scale have analytic unit tests, but arbitrary local rotations are not a general
visual certification. Source UVs must be increasing rectangles inside [0,1];
wrapping/reversed UV rectangles and out-of-range light colors are refused.
Multipages, dynamic alternate skins, topology/attachment changes and compatible
FFD are covered by the b.4.1 native fixtures. Invalid changes refuse before
visible mutation; failed target-only texture validation preserves the transport.

## Light/dark tint and blend contract (b.4.1)

For a premultiplied texture sample `(P, a)`, light `(L, o)` and dark `(D, q)`:

```
out.rgb = (P * L + (a - P) * D * q) * o
out.a   = a * o
```

Dark alpha `q` is shadow intensity, not opacity. Components must be finite in
[0,1]. Native v2 carries static dark RGBA; no dark animation channel is fabricated.
Light timelines use the shared core. The same shader handles missing/zero dark,
preventing a second 8-bit PMA tint quantization in Pixi's default mesh batching.
Parent transforms/tint/alpha still pass through Pixi's model/global uniforms.
The shader is WebGL-only, private per slot with independent uniforms; its single
program is shared through Pixi's program cache. Meshes are deliberately unbatched.
This adds draw calls; no 60 FPS/performance claim is made. Instances release their
shader bindings, geometry and buffers; the renderer owns cached GL programs.

Normal uses PMA source-over, with standard destination alpha. Additive, Multiply
and Screen are **refused at load**, including opaque-only games. Their historical
Rust formulas and Phaser/Pixi PMA conventions do not establish a common general
contract: Rust Add/Multiply preserve destination alpha, whereas Pixi increases it;
Rust Multiply/Screen also use straight source RGB differently. An opaque Add case
is not proof of transparent Add compatibility. No blend-name mapping bypasses this
gate, and no offscreen compositor is introduced.

The new pixel oracle decodes the exact independent Rust CPU RGBA8 PNG bytes,
without a Canvas2D premultiplication/unpremultiplication round trip. Its small
trusted-fixture-only PNG decoder is checked against independent Pillow 12.3.0
SHA-256 hashes for all 288 CPU frames. It is not part of texture loading/product
code. Comparison uses floating `RGB * alpha / 255` against `gl.readPixels`, with
**no added rounding**: the original bounds remain 2/255 RGB, 1/255 alpha, zero
failing flat pixels and <=2% edge mismatch. Old tests/oracles keep their original
comparisons. GPU readers additionally apply the actually submitted model uniform
to unbatched local coordinates. Default GL dithering is retained; disabled-dither
and rounded-PMA8 experiments are archived as intermediate diagnostics, not final
qualification. See the report for why Canvas2D introduced the extra error.

Different topology replaces only the slot's geometry, releasing its old buffers.
Repeated same-topology changes reuse buffers. CPU binding/crop caches are bounded
by the rig's declared skins. The 600-change stress tests count GL buffer,
texture and program operations after warming **all** exercised skins/pages.
They demonstrate bounded live resources in those cases, not total VRAM stability.

See b.4.1 validation (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/T604b41-validation.md`; new destination pending) for measured results,
quantization differences and exclusions. Clipping qualification is described below.

## Evidence and fixtures

`test/fixtures/provenance.json` pins unchanged copies of authentic native exports,
atlas PNGs and independent Rust references. The trim test uses a prior isolated
M007.1b3 test export, not the protected original Crapaud. Its crop is 457×406
at source offset (12,15) in an original 480×440 image. Its independent pixel
oracle draws the full original generated PNG using previously recorded Rust
bone matrices through Canvas2D; it does not rebuild pixels from the cropped
atlas or call the adapter's geometry routine. Other pixel references come from
the Rust CPU renderer. No native JSON is patched for successful WebGL cases.
Synthetic unit inputs are labelled; negative tests intentionally corrupt them.

32 real-browser scenarios: tagged_rig four poses; multipage default/alternate
at four times on transparent/opaque backgrounds; trimmed region at five times
on both backgrounds; HTTP page failure and abort. GPU attribute readbacks at
drawElements and framebuffer `gl.readPixels` are recorded. Tolerances: geometry
0.01; UV 1e-6; flat pixels 2/255 RGB,1/255 alpha for multipage/trim. Tagged uses
its historical 8/255 RGB and 99.5% flat-interior threshold; edge mismatch <=2%
of the canvas. Thresholds are fixed in the harness, not widened after failure.
There is no pixel-perfect or 60 FPS claim. See the delivery report for the
actual browser/backend, measurements, commands and current GO code/GO visual.

b.3 adds seven copied native/Rust reference sets and five newly authored native
exports, covering asymmetric polygons, hierarchical/reflected weighted meshes,
partial weights with FFD, animated draw order, trimmed multipage atlases and
topology/page changes. Its browser harness reads actual GPU buffers and pixels
in 115 cases, including 600 repeated FFD renders without new GL buffers after
warmup. The validation is limited to the measured fixtures and WebGL2 backend;
it is not a performance or total GPU-memory guarantee.
See b.3 validation (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/T604b3-validation.md`; new destination pending).

b.2 adds 20 real-browser cases: ten incremental clip samples, five crossfade
samples, loop, event synchronization, two speeds, deterministic replay and the
interactive example. New fixtures come from a new isolated Rust authoring
project, exported with the real native preset, without editing runtime JSON.
Ten CPU frames, 15 Rust poses and seven event windows supply independent oracles.
The fade pixel oracle draws atlas pixels through the Rust-evaluated corners in
Canvas2D; it is not a CPU-renderer fade reference. Geometry tolerance stays 0.01,
UV 1e-6, flat RGB 2/255, alpha 1/255, edges <=2% of canvas. Performance and
WebGL1 remain unqualified. See b.2 validation (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/T604b2-validation.md`; new destination pending).

API reference used for this adapter: [PixiJS MeshGeometry 8.17.0](https://pixijs.download/v8.17.0/docs/scene.MeshGeometry.html)
and [Mesh 8.17.0](https://pixijs.download/v8.17.0/docs/scene.Mesh.html). Only the
public option constructors and buffer/texture lifecycle APIs are used.

## Native clipping (T-604b.4.2)

No additional API is needed. A native `clipping` attachment starts a single
active polygon in evaluated draw order. The named `end_slot` is **inclusive**,
even when that slot is invisible or has no attachment; null means through the
end of the rig. Another clipping introduction replaces the current one, rather
than intersecting a nested mask stack. An end naming the introducing slot has
Rust's existing through-end behavior (the introduction is not a content slot).

The clipping introduction is resolved before content visibility, matching Rust
CPU, including an invisible clipping slot. Null attachment means no introduction.
This differs from historical Phaser for a hidden clipping introduction; Phaser
is unchanged. Skins resolve through selected skin then default as before.

The adapter uses existing core `attachmentWorldVertices` and flips Y once,
then ear-triangulates simple convex/concave perimeters and clips content triangles
against those pieces, interpolating the existing atlas UVs. This targeted geometry
helper follows Rust `core::clipping`; it does not resample animation, rebind bones,
change weights, evaluate constraints or add a renderer. It keeps the existing
Normal/two-color shader. No mask pixels, stencil/scissor changes, mask textures,
listeners or extra mask draw pass are introduced. Parent Pixi transforms continue
to apply to both mask and content geometry together.

The entire pose is prepared before changing visible meshes. Invalid topology,
non-finite, repeated or collinear points, self-intersection, collapsed world
polygons, unknown end slots and unsupported mask fields are refused explicitly.
This is intentionally stricter than Rust's malformed-polygon fallback. No holes,
mask FFD, weighted masks or nested-intersection semantics are qualified. Such
fields are refused; an ordinary second native introduction means replacement.

Qualified with real native exports: regions, rigid and weighted/FFD meshes,
trim/multipage, compatible dynamic skins during fades, light/dark/alpha, multiple
content slots, successive/replacement masks, draw order, visible/empty/invisible
ends, mask disappearance, outside/full masks and a thin triangle. Geometric and
GPU/UV checks use independent Rust poses/clipped geometry; sampled CPU PNGs use
the unchanged 2/255 RGB, 1/255 alpha and 2% edge bounds. Fade checks are numeric
and GPU checks, not independent CPU fade images. WebGL2 hardware and these
fixtures only are qualified. See the validation report (former deleted fork URL: `https://github.com/Kr-Apo/ankhimate-runtime/blob/main/docs/T604b42-validation.md`; new destination pending).

Changing clipped topology currently replaces the slot geometry and frees its
old buffers; equal lengths reuse it. The CPU clipping cost grows with source
triangles times polygon pieces. The existing shader remains unbatched, one draw
per visible slot; no batching/performance/mobile/six-character guarantee is made.
All previous blend, linked-mesh, mesh-sequence, constraint, physics/path, rotated
atlas, multi-skin-composition and WebGPU exclusions remain in force.

### Source texel centres (T-604b.5.1)

Region and mesh atlas UVs address the same bilinear source coordinates as the
Rust CPU renderer, including authored intermediate UVs and UV-crop vertices:

```text
source_x = u * (original_width - 1)
atlas_u  = (region_x + 0.5 + source_x - offset_x) / page_width
```

The vertical equation is identical. GL subtracts half a texel when interpreting
normalized coordinates; the `0.5` therefore addresses the CPU sample, rather
than moving the authored geometry. One-pixel sources address a constant texel.
Linear filtering, premultiplied-alpha upload, padding/extrusion, transforms,
crop weights, indices, polygon clipping and native exports are unchanged.

The 96 detailed-character CPU/WebGL comparisons from T-604b.5.0 pass their
original bounds with this mapping. This does **not** establish complete pixel
parity: at that checkpoint the provisional trimmed-mesh composition had four HOLDs,
18 flat pixels each with a maximum RGB error of 3/255 (allowed: 2/255).
At that fringe the CPU bilinear footprint includes a visible source texel, but
the unchanged UV crop has already removed the GPU triangles covering the point.
Changing texture coordinates alone cannot restore a missing rasterized sample.
This coverage issue, PMA/colour quantization and multilayer composition remain
separate from the texel-centre correction; no baseline or tolerance is updated.
The targeted trim-fringe correction below addresses that coverage limitation.

### Transparent trim fringes (T-604b.5.2)

Native trim removes only zero-alpha source pixels. The atlas retains the source
dimensions, trim offsets and retained rectangle, so no new export field is
needed. Extruded atlas pixels are padding, not the missing source texels.

With retained inclusive source indices `L..R`, CPU sampling at `x=u*(W-1)`
requires coverage from `L-1` through `R+1`, intersected with the authored UV
domain. Region quads and mesh triangles use that derived coverage. Mesh crop
vertices retain barycentric weights into evaluated author vertices; native
vertices, UVs, indices, bones and FFD remain unchanged. Polygon clipping still
applies separately, after the trim coverage crop.

The shader clamps its single bilinear fetch to retained texel centres, then
multiplies all four PMA components by:

```text
qx = clamp(x-L+1, 0, 1) * clamp(R-x+1, 0, 1)
coverage = qx * qy
```

`qy` uses the vertical indices. This reconstructs the zero-PMA source margin
instead of sampling extrusion or a neighbouring atlas region. It handles each
edge, both axes at corners, and a single retained texel. One-pixel source axes
use constant sampling coordinates without division by zero. Dark tint is then
applied by the existing linear PMA equation, followed by Normal source-over.

This uses one shared cached program, private retained per-slot uniform arrays,
the existing page textures and no additional render pass. Equal draw topology
reuses buffers; existing topology changes still release and replace geometry.
The extra shader work is a clamp and a separable coverage factor on trimmed
draws. Untrimmed sources disable the correction. No FPS, mobile or complete
feature-parity claim follows from this targeted validation.

The 20 provisional scenarios and 96 real-character image comparisons pass the
unchanged bounds (flat RGB 2/255, alpha 1/255, no flat violations, nonuniform
violations at most 2% of the canvas). Additional native exports exercise all
sides/corners, small/clear sources, multipage atlases, extrusion, transformed
regions, weighted FFD, skins, attachments and native clipping. Historical CPU
images and native JSON/atlases are preserved; capture differences and any
remaining qualification holds are inventoried in the delivery report.

## Experimental ReplayV1 (local, opt-in)

The separate `@ankhimate/pixi-runtime/experimental-replay` entry provides strictly
validated Physics-only bone playback. Its default C2 mode uses static regions and a fixed default skin.
It requires WebGL2 and keeps the Legacy asset refusal unchanged. No mixing, meshes/FFD, clipping, dark tint or visual skin switching is enabled in that default mode.
See [T-840C2 API contract](../docs/t840c2/T840C2-API-CONTRACT.md) and the
[local pilot](../examples/replay-pixi-pilot/README.md). No version or publication change.


### Explicit static meshes (T-840C7A)

`ExperimentalReplayPixiAsset.load(url, { staticMeshes: true })` (or `from` with the same option) permits native v2 static unweighted meshes alongside regions, with one fixed default skin. Existing bone affines from the completed ReplayV1 tick drive the existing Pixi Mesh renderer. Pivots/offsets are already baked by native region-to-mesh conversion; no second attachment transform is applied.

This option is mutually exclusive with C6A `visualSkins:true`, which remains region-only. Weighted/linked meshes, FFD, clipping, sequences, dark tint, slot/draw-order/event animation and non-Physics constraints remain refused. No Legacy capability or numerical core output changes. New mode pages/sources are pinned; context loss rejects presentation after a renderer is bound. GPU effects are not transactional.

See the [static mesh example](../examples/replay-static-meshes/README.md), [contract](../docs/t840c7a/T840C7A-MESH-CONTRACT.md) and [qualification](../docs/t840c7a/T840C7A-WEBGL-QUALIFICATION.md). No version or publication change.
