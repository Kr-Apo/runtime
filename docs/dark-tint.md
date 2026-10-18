# Static dark tint — M005.3b

This local runtime reads the optional M005.3a native export `slots[].dark_color`
array and renders its static contribution with Phaser 3.90.0 WebGL. It does not
change `format_version`, authoring formats or the editor's preflight warning.
No npm package has been released by this milestone. Core remains labelled 0.1.1,
adapter 0.1.0; source/archive hashes identify the tested local snapshots.

## Reading and evaluation

```ts
interface RuntimeSlot {
  // Existing name/bone/attachment/color/blend fields retain their meanings.
  dark_color?: [number, number, number, number];
}
```

The order is R, G, B, shadow intensity. A present field requires an actual array
of exactly four finite numbers, including when input is an object passed through
the public `parseRig` API. Null, undefined, holes, typed arrays, wrong lengths,
non-numeric channels, NaN, infinities and JSON exponent overflow are refused.
Finite values are preserved without rounding, clamping or f32 coercion. Rendering
qualification below concerns normalized colors/intensity 0–1, not arbitrary HDR.

Call `parseRig` for external data before `RigPlayer` / `PhaserRig`. The typed
evaluation/player APIs are not general-purpose validators of subsequently mutated
objects. V1 and v2 without the field remain readable and retain their previous
pose shape. Evaluation copies static RGBA into the optional readonly pose tuple;
there is no new animated dark channel.

The new Rust/CPU fixture revealed that the old evaluator used stepped lookup
even for **explicitly linear/Bezier light-color keys**. M005.3b uses its existing
numeric-array sampler for those authored curves. This intentionally fixes their
previous stepped appearance; omitted curves in older hand-written API inputs
retain stepped behavior. Attachment/visibility remain stepped. Light blend
weights and crossfade ordering retain the existing rules.

## Rendering and alpha

For a straight-alpha texel `T`, light `L`, static dark value `D`, the Rust CPU
convention is:

```text
source.rgb = T.rgb*L.rgb + (1-T.rgb)*D.rgb*D.a
source.a   = T.a*L.a
```

Phaser PNG loading uploads **premultiplied** texels `P.rgb=T.rgb*T.a`, `P.a=T.a`.
The fragment shader therefore produces:

```text
pma.rgb = (P.rgb*L.rgb + (P.a-P.rgb)*D.rgb*D.a) * lightAlpha
pma.a   = P.a * lightAlpha
```

No division by texture alpha is needed. Transparent texels remain transparent,
and LINEAR interpolation is performed on premultiplied texture samples. Light
RGB uses per-mesh float uniforms, while light/parent/camera opacity continues
through Phaser's existing packed vertex alpha (8-bit quantization remains).
The adapter explicitly refuses non-premultiplied textures when dark tint is
active; tested native PNG loading supplies the required texture convention.

The runtime registers one lazy `SinglePipeline` per WebGL renderer. It obtains
the constructor from the active public pipeline instance, preserving type-only
Phaser imports and existing UMD/ESM consumption without loading another Phaser
copy. `setPipeline`, `setPipelineData` and the documented `onBind` hook transport
per-mesh uniforms. A flush precedes uniform changes so adjacent meshes cannot
inherit each other's colors. Phaser owns pipeline destruction with the renderer;
rig recreation reuses the one cached pipeline. This trades batching efficiency
for a small, conventional implementation; no throughput claim is made.

No tint contribution (field absent, zero intensity or zero dark RGB) retains the
original mesh pipeline. Position, projection, UVs, face indices, draw sorting,
atlas-page selection, animation and event delivery use their existing paths.
No Phaser prototype/renderer/vertex layout is patched; no camera/data correction
or second renderer is introduced. Default SinglePipeline availability is required.

## Independent fixtures and checks

`tools/dark-tint-reference` is a standalone **test generator**, using the sibling
editor at Rust commit `367238cfa432fb597bbe3c40a64f1c75217a4312`. It builds an
authoring project, calls the real native preset/planner/publisher and independently
renders CPU frames. Runtime JSON is never manually repaired. Each output includes
its authoring source, four atlas pages, native JSON and CPU reference PNGs.
The generator refuses an existing output directory. No original M003.2 fixture
is regenerated or overwritten.

```powershell
# From the runtime repo; editor sibling must be at the reviewed Rust commit.
$env:CARGO_TARGET_DIR = '<external-test-target-directory>'
cargo run --offline --manifest-path tools/dark-tint-reference/Cargo.toml -- <new-output-directory>
# Optional last argument 1.25 also offsets the camera by 0.25 screen pixels.
```

Native and fractionally scaled fixtures cover intensity 0/.5/1, extreme and
fractional f32 RGB, clear texels, partial opacity, regions/unweighted mesh,
four pages, attachment switches, overlapping slots and draw-order animation.
Two clips are sampled at 0, .25, .5, .75, on transparent and opaque backgrounds:
32 actual WebGL framebuffers and 32 independent CPU PNGs.

`walker_dark` adds a real character: the original editor `samples/walker.ankh`
is loaded read-only, dark RGBA is assigned in the authoring model, and the same
native preset emits an untouched runtime JSON/atlas. Eight additional CPU/WebGL
poses cover `walk` and `leg_ik` at the four times. Their existing M003.2 image
thresholds remain 8/255 on ≥99.5% flat interior pixels and <2% whole-image
differences (including filtering/raster edges); geometry remains ≤.01 and UVs
≤1e-6. This character check supplements, not replaces, the strict tint/alpha
oracles above. Generate a separate new directory with `--bin walker`.

All 59 new fixture files are pinned in `phaser/test/fixtures/dark-tint-provenance.json`.
`npm test` checks their SHA-256 hashes and the normalized generator-source hashes.
Reproduction into three fresh directories produced identical bytes for all 59
files, including exports and independent CPU images.

```powershell
npm ci
npm test
npm run build
npm run typecheck
$env:ANKHIMATE_BROWSER_PATH = 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe'
npm run test:webgl
npm run test:dark-tint
```

The runner reads `gl.readPixels`, not DOM appearance, and records context
attributes, browser, GPU, errors, warnings and resource failures. PNG captures
are visual evidence in addition to framebuffer assertions. Contexts are isolated.
Texture LINEAR filtering is enabled explicitly even though MSAA is disabled for
deterministic geometry coverage. Shader/alpha checks are not based on a mock.

| Check | Tolerance and scope |
| --- | --- |
| Flat normal CPU/GPU samples | Premultiplied RGB ≤2/255, alpha ≤1/255; 810 pixels/case, including mesh, fractions, animated light and reordered overlap |
| Filtered border vs independent GPU-coordinate bilinear oracle | Premultiplied RGB ≤2/255, alpha ≤1/255; thousands of pixels/case, including transparent/color boundaries |
| Alpha ramp vs CPU PNG | Premultiplied RGB ≤4/255, alpha ≤3/255; explicit separate bound, not a replacement for the strict shader oracle |
| Original M003.2 without dark tint | All 13 canvas PNGs byte-identical to the pre-change captures; original 19 fixture hashes preserved |

The CPU samples `u*(width-1)`, while a GPU texture samples `u*width-.5`.
Across a 32-texel alpha ramp, that ≤.5-texel offset can account for about two
output alpha bytes at half opacity, plus byte rounding. This explains the
separate CPU ramp bound. **No UV/pixel offset is added to hide it.** The independent
PMA bilinear oracle still enforces the strict shader/alpha threshold, and uniform
regions enforce the strict CPU comparison. Float math, uploaded PMA byte rounding
and Phaser packed alpha explain the remaining one/two-byte differences.

To reproduce before/after without touching working files:

```powershell
node scripts/capture-dark-tint-baseline.mjs 6d8f3454aacd6b69fbc3c242b54ba98e19c23f79 <new-baseline-directory>
$env:ANKHIMATE_BASELINE_DIST = '<new-baseline-directory>'
node scripts/test-dark-tint.mjs # fails with the old rendering
Remove-Item Env:ANKHIMATE_BASELINE_DIST
node scripts/test-dark-tint.mjs # current rendering
```

The historical-source compiler records input SHA-256 hashes and the installed
TypeScript version. Baseline requests only substitute local compiled product
modules; the exact same tests, real export, CPU references and WebGL renderer
are used on both sides. No working files are reverted.

## Qualified blend modes and remaining limits

**Normal** is compared against Rust for the cases above, including transparency.
Add, Multiply and Screen retain Phaser's blend equations and pass dedicated RGB
probes over an **opaque** destination (≤2/255). That is not a claim of general
Rust parity: Rust Multiply/Screen currently combine straight-alpha source RGB
differently from Phaser's PMA blend factors. Transparent-destination non-Normal
compositions, HDR/overshoot tint, arbitrary texture sources, rotated/trimmed atlas
combinations, clipping and complex weighted/linked/deformed meshes require
separate qualification. Physics-driven visuals remain unqualified. No new dark
timeline, Canvas renderer, Phaser 4 or editor capability is provided here.

The [standalone dark-tint example](../examples/phaser-dark-tint/) uses only public
runtime APIs with the real export. Its five-minute check exercises events, loops,
movement/crossfades and 30 rig destruction/recreation cycles, checking stable
GPU wrapper, pipeline, display-object and mesh counts. These bounds do not prove
absence of every JS heap leak or qualify every GPU/browser.

## Editor warning recommendation

Leave `dark-tint-runtime-unapplied` in the editor unchanged in this milestone.
After review, coordinate **a new core version and matching adapter dependency**
containing these exact changes, publish/distribute them only with authorization,
and qualify the consuming game's versions. The old 0.1.1/0.1.0 registry labels
and old saved native templates cannot establish this capability.

Then replace the blanket "TypeScript/Phaser do not apply it" statement with a
version/capability-specific warning: static normalized dark RGBA with Normal is
qualified only for the tested renderer path; legacy consumers or old presets
retain their loss warning, and unqualified combinations retain consent. Do not
remove unrelated fidelity warnings or advertise complete two-color parity.

If no consumer version is selected/verified in the editor, retain consent with
a message such as: "Static dark tint is exported. Playback requires the reviewed
M005.3b core and Phaser adapter versions; older readers ignore it. Normal is
qualified for the documented paths. Confirm your game uses compatible versions."
Neither format v2 nor a newly selected preset proves that a game's installed
runtime has the corresponding implementation.
