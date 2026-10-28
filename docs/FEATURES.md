> **P01-RC1 local candidate — 28 October 2026.** Read the [current contracts and qualification boundary](replay-v1.md) before the historical notes below. Proposed Classic v0.1.6 is not tagged/released here. Runtime package versions are unchanged; ReplayV1 A17 is explicit and separate from Legacy playback.

> **Historical T838 baseline:** current source repositories are Kr-Apo/editor and Kr-Apo/runtime; consult the ReplayV1 guide for later experimental contracts.

# Candidate feature scope

This document describes the **local T-811 / 0.2.0-alpha.1 proposal**, not the frozen
public RC2. This remains an unofficial Kr-Apo community fork of Ankhimate.
Jade Sentinel is the only official distributed sample. Legacy `docs/alpha/`
documents describe RC2 unless explicitly stated otherwise.

| Surface | Available scope | Evidence / boundary |
|---|---|---|
| Windows editor | Setup/Animate, bones, timeline/curves, slots/skins, attachments, meshes, weight painting, FFD, image/PSD import, Undo/Redo, save/recovery | Rust regressions; new ZIP startup/reopen still needs maintainer review |
| Rendered exports | PNG/JPEG/WebP sequences, PNG spritesheets, batch/framing/trim/padding; shared CPU renderer | Default skin, Normal blending, physics refused; native spritesheet JSON is Ankhimate metadata |
| Video | Simple File → Export → Video MP4: 720p/1080p, 24/30/60 FPS, 1–3 cycles, opaque background | External FFmpeg/libx264 required; no overwrites; historical advanced MP4/GIF retained |
| Native export | v2 independent scalar axes, atlas pages and existing fidelity diagnostics | Older v1/v2 readers retained; no format migration in T-811 |
| AI assistant | Six configured provider profiles, streaming, bounded reads, animation, Setup rigging, region assembly and existing mesh-weight operations | Native proposals, explicit approval, atomic commands and Undo/Redo; no autonomous autorigging claim |
| Vision | Explicit viewport capture consent, exact endpoint/model capability controls and budgets | Synthetic transport tests for six providers; maintainer Qwen/NInfer Jade scenario only, not every model |
| Shared runtime | TypeScript evaluation, playback, events and non-interrupted distinct-clip crossfades | Rust/Node numeric references and historical fixtures |
| PixiJS 8.17.0 | Explicit native v2; regions, rigid/weighted meshes, FFD, trim, multi-page atlas, compatible skins, light/static dark tint, sequential clipping, Normal composition | WebGL2; 125 bounded dual-engine headless comparisons in T-811 |
| Phaser 3.90.0 | Same documented common v2 subset, public high-level playback and legacy millisecond update | T-811 compared actual Phaser WebGL1 with PixiJS WebGL2 on one ANGLE/NVIDIA configuration; not universal GPU certification |

See [limitations](KNOWN_LIMITATIONS.md), AI (former deleted fork URL: `https://github.com/Kr-Apo/editor/blob/main/docs/AI_ASSISTANT.md`; new destination pending),
MP4 (former deleted fork URL: `https://github.com/Kr-Apo/editor/blob/main/docs/EXPORT-MP4.md`; new destination pending), and [release readiness](RELEASE_READINESS.md).
