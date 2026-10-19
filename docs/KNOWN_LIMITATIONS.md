# Known limitations — local T-811 candidate

- This is an unsigned Windows x64 alpha candidate. New archive launch on the
  maintainer's machine is pending. macOS/Linux distribution, mobile, WebGPU and
  broad GPU support are not qualified. No guaranteed frame rate or memory budget.
- Runtime parity covers the documented native v2 common subset. Constraints/IK,
  physics, linked meshes, rotated atlases and Add/Multiply/Screen are outside it.
  Phaser legacy paths may accept some extras; that is not a fidelity certificate.
  PixiJS requires WebGL2; Phaser used its real WebGL1 context in T-811.
- T-811: 125 framebuffer comparisons passed predeclared tolerances, 104 exact.
  The transformed clipping case has one contour pixel with alpha delta 64
  (0.0198% of foreground, below the 2% edge bound). No uniform pixel exceeded
  tolerance. This measured rasterization difference is preserved, not hidden.
  Five global fractional-alpha cases were exact; arbitrary alpha compositions
  and float precision on every Phaser container/camera are not certified.
- Interrupted crossfades can jump. Events at time zero are ignored at startup
  and on each loop, matching the accepted Rust policy. Skin switches require
  compatible attachments/binds/topology. Core v1 reading does not certify v1
  adapter pixel parity; the common profile is explicit native v2.
- Image/video exports retain default-skin, Normal-only and no-physics restrictions.
  MP4 is opaque, lossy H.264/yuv420p without audio; FFmpeg is separate. Existing
  output videos are refused, even after a native Save dialog confirmation.
  Publication needs hard links (local NTFS recommended). Crash durability and
  fully atomic multi-file exports are not promised; retained staging is reported.
- AI has no artistic correctness guarantee. Provider wire-format support does
  not prove every model supports tools or vision. Long sessions can exhaust
  context: use targeted reads and a shorter conversation. Small local profiles
  reduce budgets but do not certify an 8 GB GPU. No model is supplied/downloaded.
- Qwen/NInfer Jade rigging/assembly/weight tests are maintainer-reported manual
  evidence. Their modified project was not saved and is deliberately not shipped.
  The official sample is unchanged RC2 Jade Sentinel; it has no `qwen_left_arm_test`.
- Alternate-image skin authoring is region-focused; FFD timeline editing and
  complex PSD reconciliation retain their documented limits. Full localization,
  a web editor, a second viewport, autonomous autorigging, complete Spine parity,
  advanced numeric tangent editing and advanced runtime constraints remain open.

No GUI, desktop automation, real inference or GPU benchmark was run for T-811.
Headless WebGL used an installed browser, actual contexts and local assets only;
final interactive and clean-machine checks remain separate.
