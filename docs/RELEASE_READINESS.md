# Release readiness — T-811 local candidate

**Publication is not authorized by this checkpoint.** Candidate version proposal:
Editor/core/Phaser/PixiJS **0.2.0-alpha.1**. The three npm archives must be installed
as one matching set. No registry package or old RC2 core is substituted.

| Evidence | Status / required review |
|---|---|
| Accepted sources | Editor b299d04 (parent 17bceb1), runtime 2b149cb (parent c620ddd) |
| Git provenance | Binary content transfer onto isolated public bases 8badcc0 / c620ddd; no development commit objects imported |
| Rust | Baseline 1,511 pass / 4 existing opt-in ignored; candidate results in final manifest |
| TypeScript | Baseline 219, plus six comparator unit tests; build/typecheck/syntax and package installation gate |
| Pixi numeric snapshots | 457 accepted snapshots must remain identical |
| WebGL headless | 125 PASS, 104 exact, 20 logical lifecycle cleanups; same local sources/textures, DPR 1, 640×520, framebuffer AA off, linear sampling |
| Maintainer AI | Reported targeted Qwen/NInfer Jade workflow; project unsaved, excluded |
| Maintainer MP4 | Reported H.264 1920×1080/60 FPS/2 s/120 frames; motion, decode, cancel and no-overwrite checked |
| New candidate Windows | Extraction, launch, playback, save/reopen, PNG, AI panel and MP4 entry **pending** |
| Interactive runtime GPU | Weighted mesh, FFD, clipping, skin and tint/dark tint in `npm run example:parity` **pending** |
| Documentation/media | No authorized final editor screenshots supplied; no fabricated images or broken image placeholders |
| Publication | **NOT PERFORMED**; docs and new alpha to be reviewed and published together later |

The earlier square video came from historical advanced settings, not the new MP4
presets. Current WebGL results do not retroactively expand public RC2. A new
clean-PC test applies to this new ZIP; the RC2 clean-PC record covers RC2 only.

The optional `Ankhimate_GitHub_Docs_Updated_2026-10-19.zip` was not found in accessible
artifacts, attachments, Desktop or Downloads under its exact name. Current source
documents were reconciled instead. Final screenshots and any later draft still
need maintainer review. See [limitations](KNOWN_LIMITATIONS.md).
