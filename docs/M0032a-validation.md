# M003.2a — Phaser fidelity checkpoint

Validated on Windows, 15 October 2026. Base
`f478463cc431550cc8faa9788e52ca5fef667c95`, isolated local branch
`fix/m0032-phaser-alpha`. Editor unchanged at
`25f3a301920a4139db16a7820c42bf5d7c15c822`.

## Reproduced before correction

The two real v2 exports, walker and tagged_rig, failed at all four times
0 / 0.25 / 0.5 / 0.75 s. Tests used an actual NVIDIA RTX 3090 through
ANGLE Direct3D11, Phaser 3.90.0 and Playwright 1.58.2 with the installed Brave.
This was hardware-backed WebGL, not a projection mock or a Canvas fallback.

Phaser `Vertex.transformCoordinatesLocal` negates projected Y. The adapter
also negated world Y when assigning Mesh vertices, making the final image
vertically inverted. Maximum position errors were about 317.5 units for walker
and 512 for tagged_rig. Bone affines already agreed with Rust, locating the bug
in rendering rather than the animation data/evaluator.

The synthetic probes also reproduced an animated draw-order defect:
`setDepth` queues sorting for a Scene display list, but Container children are
rendered in their list order. The mesh depths changed while their visible
overlap did not. Finally, querying an atlas frame before checking `has` emitted
10 or 11 missing-frame warnings per real rig, although the frames were then
successfully added.

## Changes

- Keep world Y unchanged in Mesh vertices. Phaser performs the screen
  conversion; the camera, exported coordinates, UVs and winding are unchanged.
- Sort Container children by their authored depth after applying a pose.
- Check atlas frame existence before calling `get`, avoiding false warnings.
- Add real export/CPU fixtures, hash verification, eight GPU comparison cases
  and independent UV/alpha/order/v1/v2 probes. Playwright is a pinned development
  dependency only, with no new runtime dependency.

## Results

All nine WebGL cases pass after correction, with zero console errors, zero
warnings and zero missing resources. The real-rig results are:

| Rig | Maximum affine component error | Maximum projected vertex error | UV error | Interior RGB match | Whole-image mismatch |
|---|---:|---:|---:|---:|---:|
| walker, four times | 0.000024451 | 0.000038307 | 0 | 100% | 0.815–0.872% |
| tagged_rig, four times | 0.000015259 | 0.000027048 | 0 | 100% | 0.310–0.362% |

Tolerance definitions, source provenance and rerun commands are in
[`phaser/test/README.md`](../phaser/test/README.md). The image thresholds were
fixed before correcting the adapter and have not been relaxed to pass.

All 26 core TypeScript tests pass, including v1/v2 validation, independent-axis
regressions and 128 Rust parity cases / 3,328 components (maximum absolute error
0.000006437307). Core and Phaser build/typecheck pass. The 14 real-export and
CPU reference files match their reviewed hashes. No export format was changed.

## Limits

This is validated for the fixtures and probes above on one GPU/browser setup.
It establishes no full fidelity claim for dark tint, physics, complex weighted
deforms, clipping, or rotated/trimmed atlas combinations. The existing public
`unsupported` array does not provide an exhaustive capability report.

Package versions remain core 0.1.1 and Phaser adapter 0.1.0 in this local
checkout. There is no npm publication or promise that registry packages with
those labels contain this correction. The independent game example must pin
the tested local artifacts and their provenance.
