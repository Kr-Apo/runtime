# Troubleshooting

Messages below come from the shipped loader/adapter or demo. `{…}` marks a
variable value, not literal text. Browser fetch/decode errors may vary by browser.

| Error or symptom | Recovery |
|---|---|
| `Runtime JSON failed: HTTP 404 ({url})` | Enter the JSON path relative to the archive root, including skeleton.json. Copy a complete fresh export inside the extracted tree. |
| `Atlas page {index} failed: HTTP 404 ({url})` | Restore the referenced PNG beside the JSON at the path in atlas.pages; keep filename case. Do not rename just one file. |
| `Atlas page {index} is not PNG ({url})` | Re-export a real PNG atlas; HTML error pages and renamed JPEGs are not PNG. |
| `Atlas page {index}: decoded dimensions do not match JSON` | Restore JSON and all pages from the same export; do not mix export generations. |
| `Invalid native runtime JSON: …` | Use the native Ankhimate runtime preset, not .ankh, a spritesheet JSON or hand-edited partial data. Inspect the nested format error. |
| `Pixi b.1 requires native format_version 2; the core v1 reader is unchanged` | Re-export with the current native preset. The historical wording is retained by the adapter; this candidate does require v2. |
| `WebGL2 unavailable: use a desktop browser with WebGL2 enabled` | Use a supported desktop browser/GPU environment. Do not bypass OS/browser security settings. WebGPU/WebGL1 are not this candidate's backend. |
| `Use an HTTP(S) server to load native exports` | Run Start-Demo.exe and use its printed URL instead of file://. |
| `TypeError: Failed to fetch` | Keep the local launcher running, check its port and path, and reload. If the launcher restarted it has a new URL. |
| `Choose a skeleton.json path inside the extracted archive` | Use a relative path in this archive; do not paste a drive path or remote URL. |
| `Slot {name}: blend {mode} is unsupported; Normal only` | Use a Normal-only target-compatible project or keep the feature out of this alpha. No blend approximation is provided. |
| `Constraints are not qualified in Pixi b.1 (including physics and paths)` | This target does not support constraint rigs; do not suppress warnings or delete JSON fields to disguise them. |
| `Unknown clip {name}` | Use an authored clip name, case-sensitive. Jade contains idle and attack. This sample demo requires both names; the adapter itself can play other clips. |
| `Unknown skin {name}` / `Skin {name}: incompatible deform attachment/dimensions …` | Select an existing compatible skin; no multi-skin composition or automatic topology conversion is implemented. |
| `Destroy all rig instances before destroying their asset` | Remove ticker callbacks, unsubscribe events, destroy every instance, then destroy the asset. |
| `{slot}: atlas texture was destroyed by its owner` | Keep borrowed page textures alive until every referencing instance is destroyed. |
| Blank canvas | Read the visible status/error first; use HTTP, verify all assets and clips, add root to stage, set visible scale/position, and call update with seconds. The sample positions assume Jade's size. |
| Warning prevents Publish export | Review the preflight. Blocking errors need correction. Fidelity consent is explicit and target-specific; it is not proof that every feature works. |

## Windows and files

Extract the whole ZIP into a writable folder before launching. Keep the console
open for the demo. If the browser does not open, use the URL printed there.
Close the editor before replacing its executable. For a denied/locked export,
choose a new writable folder or close the application locking the destination.
The editor rechecks file safety at publication; the preflight does not reserve files.
Do not delete recovery/backups to hide an error. Cancel preserves the document.

## Expected behavior that can look like a defect

One-shot clips hold their final pose and can report active transport. Events at
zero do not fire. Seeking does not emit events and detaches playback. A fade to
the same clip does not restart it. An interrupted fade can jump because it does
not snapshot the mixture. These limits are documented in the
[compatibility matrix](RUNTIME_COMPATIBILITY.md).


---
Source-tree note: file locations and runnable browser examples above refer to
the extracted RC2 archive. Download the [complete alpha archive](https://github.com/Kr-Apo/ankhimate/releases/download/alpha-2026.10.18-rc2/Ankhimate-Editor-PixiJS-Alpha-RC2.zip).
Source files here document that same API; GitHub does not execute the demo.
