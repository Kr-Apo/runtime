# Larger native characters — qualification

Two newly authored paper-puppet characters, not an industrial production-asset certification. Original artwork uses deterministic supersampled Pillow drawing, no private character, no imported flattened image and no AI-generated parts. Headless native author schema creation is distinguished from interactive GUI authoring: **no new manual Editor authoring session is claimed**. All parts, pivots, bones, region attachments, Physics definitions and keys are representable in the existing schema. The unchanged Editor B6 loader accepts clean reports, saves `.ankh` plus assets, reloads, and runs its unchanged default native exporter. No runtime JSON patch.

|Character|Bones|Static regions|Hierarchy levels|Physics|Atlas pages|Clips|
|---|---:|---:|---:|---:|---:|---|
|Moss Ranger|14|12|5|2 independent|1 at256 max page|march2s / salute1.5s, looping|
|Clockwork Courier|26|21|8|8, including parent/child dependencies|2 at256 max page|march2s / salute3s, looping|

Both animate pelvis translation, torso translation/rotation/nonuniform scale and articulated arms/legs. Pivots range from0.08 to0.98, sizes10x34 to110x103. Courier's hat/antenna/tip, cape/tip and pack/charm/tip provide deep visible secondary structures. Ranger's small secondary response is intentionally modest; Courier shows stronger dependent motion. At the retained pure-preview sample ticks, Courier cape-tip origin differs by up to6.8663 world units from the simulated pose. Rigid articulation is not continuous skin deformation.

## Native provenance

Originals are retained under delivery `authors/`, saved projects under `native-final/<character>/Character.ankh` with matching assets. Runtime includes source author files/images in examples/replay-character-acceptance/authors and exact native PNG/JSON/Rust frames in assets. Each character/clip has721 real Rust ReplayConsumer frames (tick0..720) and pure Rust previews30/90/240/600. Native snapshot reproduction after formatting the standalone helper is byte-identical for Ranger. SHA256 inventories cover sources, saved projects, exports and references. Editor275082e8 unchanged; no full Editor Rust/WASM suite rerun is claimed. Separate `*-fault` author copies add a stepped zero parent scale at tick9; the healthy originals are preserved.

## Numerical and graphical proof

Eight campaigns:2 characters x2 clips x2 engines.230 final rows:148 captured poses,8 lifecycle/audit cases and74 cross-engine pixel controls. Previews have independent **pure Rust** references, not simulated frames. Ticks0/1/8/30/60/120/240/600 and each clip's loop-1/loop/loop+1 boundaries are captured. Pause, resume,60/8/52, historical replay,500ms C3 hitch and explicit rebind are included.

|Quantity|Maximum absolute error|Fixed limit|
|---|---:|---:|
|Local transform components|3.68517576e-06|0.01|
|World linear matrix|6.02796321e-07|0.0001|
|World translation|5.9792697e-05|0.01|
|Region corners|6.86645508e-05|0.01|
|Camera-space corners|8.62252673e-05|0.02|

Read-only Replay snapshots supply production geometry. Independent Rust world/region corners reconstruct the expected trimmed corners. Test-only pixel controls present those independent corners through the same renderer; this is a geometric-to-pixel oracle, **not an independent CPU rasterizer claim**. Direct Phaser/Pixi pixels also pass the unchanged pixel policy with matched LINEAR filtering and no MSAA. Phaser initially inherited NEAREST when antialias=false while Pixi used LINEAR:74 cross-engine DIFFERENCE results were retained. An intermediate diagnostic used the wrong numeric filter enum; the final harness uses the public Phaser constant and asserts actual GL minFilter9729 versus Pixi linear. No shader, UV rule, golden or tolerance was changed. The final driver gates every aggregate cross-engine status.

## Visual inspection and limits

Actual captures/contact sheets show readable humanoid puppets, march and raised-arm salute, preserved facing, attached limbs and secondary accessories. There is no unexpected inversion, missing atlas page or numerically divergent jump in the tested poses. Small rigid-piece seams at elbows/shoulders and a hat gap remain **author-art limitations**, visible in the retained full images. Piecewise-linear key slopes can produce a deliberate abrupt change in velocity; the tests establish pose/loop parity, not physically polished motion. No FFD/skin smoothness or artist-quality guarantee. Ranger's secondary motion is subtle; Courier provides the stronger visual Physics case.

Reliability tests run on both characters/engines: real native numerical fault at9 leaves8 committed,52 debt, last bones/records unchanged; pump refuses until reset. A real view/buffer failure preserves the already committed healthy numerical tick; retry after restoring the injected renderer field succeeds. Scene restart reuses Phaser assets, Pixi root destruction releases the owner, double disposal and asset destruction release references. Courier tests missing second page and cancellation after a first decode. Actual RAF/performance.now hitch stalls host updates500ms, then exposes real backlog and catches up; no fabricated future clock value. Context loss and broader hardware remain uncertified.
