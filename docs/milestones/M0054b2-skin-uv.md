# M005.4b2 — stale Phaser skin UVs

Scope: A02 only. Base runtime `b599a1bdcd8cd8f9c1328221f983eda626f48a87`,
branch `fix/m0054b2-skin-uv`. The editor's clean `develop` was fast-forwarded
from `367238c` to its single direct descendant `17d85ae`, as authorized.
No other editor changes, upstream changes, package version changes or publication.

## Cause and minimal fix

`PhaserRig.ensureView` correctly retains the mesh when slot, attachment name and
index count remain the same. Applying another skin updates geometry, atlas page,
frame and `vertex.u/v`. Phaser 3.90.0's `Vertex.load` submits **`tu/tv`** instead.
Those still described the old atlas region. `Vertex.setUVs(u, v)` is the public
API that updates all four fields. The only product change calls this method.
Geometry, indices, renderer projection, texture ownership and format v1/v2 are
unchanged. No new renderer or resource reconstruction is introduced.

## Red / green evidence

The native M005.4a skins export is reproduced exactly:
`20f6a5d37f4c8a4cd5f4dcc71f5488effeaee263b29ee6ee93ebed7e4e80bd79`.

Before the fix, **72/144** cases pass: 36 default constructions and 36 direct
alternate constructions. All 36 default→alternate cases and 36
alternate→default→alternate cases fail. Every intermediate skin is actually
rendered; checking only the final alternate would miss the failing default leg.

At 0.5 s on the original fixture, geometry already agrees with Rust within
`0.00000311` world units, but the first vertex has `u=0.5526315789473685`,
`tu=0.02631578947368421`. `gl.readPixels(144,135)` returns PMA
`[32,64,96,128]` instead of `[255,32,16,255]` (screen point 144,120).
After the fix `u=tu`, and the readback is exactly `[255,32,16,255]`.

After the fix, **153/153** WebGL cases pass:

- 9 native fixtures × 4 modes × 4 clip times = 144 pose/readback cases.
- 9 stress cases × 256 rendered skin changes = 2,304 changes, retaining mesh
  and vertex identity, one mesh child, one view, stable texture counts and zero
  additional GL buffer/texture creates or deletes after warmup.
- Regions and rigid meshes; same-page and multi-page atlases; same attachment
  names with different textures/dimensions; running clips and attachment keys;
  static dark tint and alpha; actual interleaved vertex submission capture.

Maximum error against the independent Rust oracles: bone affine
`1.1921e-7`, vertex `6.57194e-6` world units (limit 0.01), atlas/submitted UV
error 0. Flat CPU/GPU interior pixels differ by at most **1/255 RGB and 0/255
alpha**, with no interior failures. The test permits 2/255 RGB, 1/255 alpha and
at most 2% edge disagreements to account for distinct CPU/GPU rasterization.
All intermediate center probes stay within 1/255 of Rust.

## Historical compatibility and checks

- 34 TypeScript tests, core/Phaser build and typecheck pass.
- All 77 accepted WebGL cases pass: 21 character/projection, 32 dark-tint,
  20 FFD and 4 decimal-boundary FFD cases.
- 76/77 historical canvas PNGs are byte-identical. The other (`walker_dark`,
  0.25 s) differs by one channel level at one edge pixel out of 540,900 pixels.
  Four repeated baseline/candidate pairs reproduce that same 1-pixel/1-level
  variation with unmodified b599a1b as well; three pairs are pixel-identical.
  This is measured rasterization variability, not strict byte identity for all
  executions. No interior regression or tolerance expansion was used.
- All 72 new no-switch control captures are byte-identical before/after.
- Four more poses of the existing identity-container clipping case match Rust
  within the recorded pixel tolerances. This does **not** qualify or fix A03.
- Live Rust exporter/evaluator still matches 128 animation parity cases and
  four escaped-string round trips. Existing v1/v2 and FFD time tests pass.
- The generator passes format checking and Clippy with `-D warnings`.
  Its 112 generated export/oracle files reproduce byte for byte; the fixture
  checker additionally protects the original source and generator hashes.

Windows environment: Brave/Chromium `155.0.8059.80`, Phaser `3.90.0`, actual
ANGLE/NVIDIA RTX 3090 Direct3D11 WebGL. Browser warnings, JS errors and missing
resources: zero in successful validations.

The independent Phaser game is installed outside the repository from fresh
local core/Phaser package archives; all 56 installed build files match the
candidate build. Its five-minute real-time playback, movement, clip switching,
events, loops and resource loading are validated separately in the delivery
report. Existing example vendor archives are preserved.

## Reproduction and remaining limits

Use `npm test`, `npm run typecheck`, `npm run build`, `npm run test:skin-uv`,
`npm run test:webgl` and `npm run test:dark-tint`. See
`tools/skin-uv-reference/README.md` for independent Rust oracle regeneration.
The 24 historical FFD cases and clipping comparison reuse the external
M005.4a/b1 harness; their logs, screenshots, exact inputs and current compiled
modules are included in the delivery evidence.

No changes to the data model, v1/v2 serialization/reader, authoring, physics,
paths, blending, linked meshes or clipping implementation. The present tests
do not establish universal fidelity for those features. No M006 or A03 work.
