# Phaser WebGL regressions

These tests use the real Phaser 3.90.0 WebGL renderer, not a mocked projection.
Run from the repository root after `npm ci`:

```powershell
# Use an existing Chromium-family browser, or install Playwright's Chromium
# separately with `npx playwright install chromium`.
$env:ANKHIMATE_BROWSER_PATH = 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe'
npm run test:webgl
```

The test server binds only to loopback on an ephemeral port. Each test gets an
isolated browser context. PNG captures and `results.json` go to the ignored
`test-results/webgl/` directory; `ANKHIMATE_TEST_OUTPUT` overrides that location.
Missing pages, console warnings/errors, failed checks and an unavailable WebGL
context fail the command. Playwright is pinned in the root lockfile. The actual
browser and GPU are recorded separately; a successful software renderer run
does not establish hardware coverage.

## Independent Rust references

`fixtures/walker/` and `fixtures/tagged_rig/` contain byte-identical native v2
exports made during M002 through the actual **Ankhimate runtime** preset. The
walker source is `editor/samples/walker.ankh` (`walk`, `leg_ik`). The PSD source
is the editor's `formats/tests/fixtures/tagged_rig.psd`, imported and animated
in Windows during M002: `animation_1` translates root X from 0 to 1 over one
second. Exported JSON and atlas pixels have not been hand-edited.

`cpu-reference.json` and `cpu-0.png` … `cpu-3.png` were generated independently
through the editor's Rust `evaluate`, `RegionAttachment::local_corners`, world
affines and CPU `render_frame`, from editor commit
`25f3a301920a4139db16a7820c42bf5d7c15c822`. Samples are 0, 0.25, 0.5, 0.75 s.
The full generator source and its isolated Cargo manifest are retained with the
M003.2 validation evidence. Generating references required no editor changes.

The game validation adds `cpu-leg_ik-reference.json` and four corresponding PNGs
for walker's second real clip. The complete runner now checks twelve real
poses plus the synthetic diagnostic case.

`provenance.json` records sources and SHA-256 hashes. `npm test` verifies them;
there is no automatic snapshot update. A reference regeneration is a deliberate
review of both Rust inputs and the resulting fixtures, not a way to bless a
failed browser test.

## Assertions and tolerances

- Every Rust affine component agrees within absolute 0.01 (translations in
  world units, linear components dimensionless).
- Actual projected Phaser mesh vertices agree with Rust `(x, -y)` within 0.01
  before the documented root scale/translation. No camera inversion is used.
- Atlas UV error is at most 1e-6. Visible region quads have two non-degenerate
  triangles, six expanded vertices, matching vertex alpha and authored depth.
- The foreground interior is a CPU 3×3 flat-color neighborhood. At least 99.5%
  must match within 8/255 per RGB channel. Across the whole 900×600 image, pixels
  outside that tolerance must remain below 2%. This allows CPU rasterization vs
  GPU filtering/edge differences; it does not assert bit-identical rendering.
- Synthetic probes separately check asymmetric UV quadrants, two overlapping
  half-alpha quads, animated draw order in a Container, and animated v1 paired
  versus v2 independent translation with identical projected placement.

These thresholds were set before the renderer fix. Both real rigs failed the
position and pixel checks before it; the draw-order probe also failed. This
suite does not qualify dark tint, physics-driven rendering, clipping, rotated
or trimmed atlas combinations, or complex mesh deformation. Those need
dedicated projects and image oracles.

M005.3b supplies that dedicated static-dark-tint qualification separately:
`npm run test:dark-tint`, [`docs/dark-tint.md`](../../docs/dark-tint.md), and the
new `dark_tint` / `dark_tint_filtered` fixtures. The original M003.2 references
above are preserved, including their hashes and the limited scope of their proof.
`test:webgl` now also checks eight new `walker_dark` CPU poses, for 21 cases in
that runner; `test:dark-tint` separately checks 32 tint/filter/alpha cases.
