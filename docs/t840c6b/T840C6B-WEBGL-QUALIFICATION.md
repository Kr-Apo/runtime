# C6B — real WebGL2 qualification

Chrome 156.0.8078.47, Windows x64, Phaser3.90.0, WebGL2 ANGLE/D3D11 on NVIDIA RTX3090. Actual hardware renderer is recorded in raw results. This is one environment, not a browser/hardware certification.

## Unchanged native inputs

Ranger:14 bones,12 regions,2 skins,2 Physics constraints,2 pages. Courier:26 bones,21 setup slots,3 skins,8 Physics constraints,4 pages. Source PNGs, author schemas, saved native projects/assets, unchanged native exports, calendars and Rust references are the exact accepted C6A bytes. Four variants include actual native fault clips with stepped singular torso scale at transition20. No new fixture, runtime JSON patch or manual skin data mutation. Native Save/Reload provenance is retained from C6A, not claimed as a new GUI authoring or Rust validation run.

## Numeric, geometry and pixels

210 PASS rows:206 framebuffer/numeric comparisons and 4 lifecycle rows. Each checks requested/completed/backlog, actual snapshot skin, presented skin, active spring record names/values, native visible slot order, bone locals/worlds, region geometry, UV, actual atlas pages, source texels and owned counters. Preview and fault rows remain explicitly labeled. Core poses are independently compared against Rust; the new unit suite also compares all2,884 committed poses for both calendars.

|Metric|Maximum error|Gate|
|---|---:|---:|
|Bone local|3.712239007e-06|0.01|
|World translation|5.788461975e-05|0.01|
|World affine coefficients|6.200936519e-07|0.0001|
|Spring state|4.228329765e-05|0.01|
|Submitted local vertices|6.484985352e-05|0.01|
|Atlas UV|2.931375975e-08|0.000001|
|Camera/screen coordinates|8.146056609e-05|0.02|

Vertex.load is hooked in the diagnostic driver to verify the actual Float32 batch submission of tx/ty/tu/tv. Stored u/v must equal tu/tv. Public C4 face projection and root/parent/camera matrix rules are reused; nonuniform root/parent transforms, rotation, camera zoom/scroll/rotation are checked on Festival. No camera or UV flip was introduced.

Independent Rust-resolved full quads plus explicit trim produce a second GPU submission with Rust-derived vertices. This is a Rust-geometric GPU control, not a new CPU raster oracle. Separately, original source PNG texels are bilinearly sampled using Rust corners, UV×(extent−1), PMA source-over and native light tint. 63,920 uniform foreground samples have zero errors above 3 RGBA8 units. Raw top-down PMA RGBA and display PNGs are retained. Historical policy remains uniform3, large-edge24, at most2% of foreground, nonempty content; no threshold or oracle changed.

184 comparable captures PASS against sealed C6A PixiJS screenshots, after PNG decode/re-premultiplication for display-format references.22 additional Phaser captures have no identical C6A capture: complementary Pixi comparison is NOT_RUN, not PASS. Their Rust/source-PNG checks did run and pass. Binary equality between different rasterizers is not required.

## Scenarios and additional actors

Exact ticks around20/40 and half-cycle119/120/121 and loop boundary239/240/241; backlog60/8/52 and partial19/20; pause/resume; previews19/20/40/19; replay/reset; C3 host hitch and resume without jump; default/festival/night page changes; native absence/fallback; opaque/transparent backgrounds; real B6 transition fault retaining19; independent calendars and shared pages.

A separate two-actor campaign adds14 framebuffer/numeric comparisons and 2 lifecycle rows. BOTH actors' bones, spring records, native pages/UV/vertices/source pixels are compared independently with primary/delayed Rust refs at 20/27/40, including A paused while B replays, then A Night while B Festival, disposal of A while B remains valid, and instance recreation. No proof relies only on different skin names.

21 real dynamic C5B safety scenarios include a native context-loss/restoration cycle and Scene restart AFTER reaching Night40, source/key replacement and both cached owners, all-page checks, foreign/stale/old-epoch tokens, other Game, WebGL1/Canvas refusal and Game destroy. Lost rendering is refused; actual restored pixels/numerics match, with exactly one requalification. Existing Phaser loss/restoration warnings and expected lost-context refusals are retained. This is one controlled recovery cycle, not seamless universal recovery.

Raw evidence: webgl-final/, multiple-actors/, dynamic-safety-final/, dynamic-resources-final/, external-phaser/, preserved Rust files in native/, pixi-reference/ and their provenance. Supplemental NOT_RUN controls remain explicit in pixi-comparison-final.json.
