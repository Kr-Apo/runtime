> **P01-RC1 local candidate — 28 October 2026.** Read the [current contracts and qualification boundary](replay-v1.md) before the historical notes below. Proposed Classic v0.1.6 is not tagged/released here. Runtime package versions are unchanged; ReplayV1 A17 is explicit and separate from Legacy playback.

# Phaser 3 / PixiJS 8 parity — T-810 local development

This is a **source and local-package checkpoint**, not a public release or an
extension of the frozen Alpha RC2 qualification. Phaser 3.90.0 and PixiJS 8.17.0
are the locked versions. No browser, GUI, shader compiler or GPU test was run
for T-810. The maintainer must qualify the new WebGL output manually.

## Evidence levels and scope

D = deterministic Node evaluation/buffers/uniforms. H = accepted historical
WebGL evidence for the earlier implementation, not a fresh test of T-810.
M = new-build manual visual qualification pending. X = outside Pixi's qualified
native-v2 subset. Presence in core is not proof of renderer support.

| Capability | Core TypeScript | PixiJS 8 | Phaser before T-810 | Phaser after T-810 | Evidence |
|---|---|---|---|---|---|
| Native skeleton v2 | Existing parseRig | D/H, strict adapter gate | Existing reader, weaker geometry checks | D, same parser + adapter checks | Native fixtures, invalid inputs |
| Legacy v1 | Existing reader | Refused by Pixi gate | Existing | Retained, no new v1 fidelity claim | Legacy-reader probe, unchanged core tests |
| Atlas pages/textures | Metadata only | D/H, full-page PMA textures | Scene-owned pages/frames | D, page existence/dimensions/PMA and frame collisions checked | Missing pages, multipage, borrowing |
| Regions | Affine evaluation | D/H, CPU texel centres | Affine quads; u*W, trim stretched | D/M, same derived regionQuad | 422 paired poses including region probes |
| Bones/hierarchy | Existing evaluator | D/H | Affine world transforms | Same evaluator, D/M | Reflections, shear, multibone Rust references |
| Slots/visibility | Existing evaluator | D/H | Existing | D/M, whole-pose validation first | Hidden/end/unknown-attachment cases |
| Draw order | Existing evaluator | D/H | Container sorting | Preserved, D/M | Effective visible order, animated fixtures |
| Skins/fallback | Existing evaluator | D/H, one skin + default | Existing, stale expanded indices possible | D/M, cached appearances and fresh index mapping | Same-name assets, page/topology swaps |
| Rigid meshes | Existing world queries | D/H | Existing local FFD path | D/M, shared binding and atlas geometry | Native rigid and FFD references |
| Weighted meshes | Existing skinning | D/H | Separate adapter math | D/M, shared core query through MeshBinding | Positive weight normalization, multibone poses |
| Bind semantics | Baked per-influence x/y + setup transforms | D/H | Setup inverse vector conversion | Same shared setup conversion | Singular binds refused; Rust oracles |
| Partially weighted mesh FFD | Packed per influence | D/H, rigid vertices own no packed offset | **Divergence**, offsets applied to rigid vertices | **Fixed**, D/M | Red then green, partial_ffd |
| FFD linear/stepped/Bezier | Existing evaluator, f32 time boundary | D/H | Implemented; separate geometry route | D/M, no resampling in adapter | Native samples and fades, overshoots |
| Attachment transforms/pivot | Native region fields | D/H | Implemented | D/M, same region geometry | Asymmetric transforms, trim and source UVs |
| Translate/rotate/scale/shear | Existing scalar axes | D/H | Shared evaluation | Unchanged shared evaluation, D/M | Existing Rust axes tests, whole poses |
| Curves/shortest angles | Existing evaluator | D/H | Shared evaluation | Unchanged | Existing core tests, Rust fixtures |
| Loop/clip/fade/events | Existing RigPlayer | D/H via PixiPlayback | Low-level player, play/fade, events polling | D/M, shared RigPlayback; old API retained | Pause/resume/speed/options, callback guards |
| Direct seek/pose | evaluate | D/H, detaches playback | No equivalent adapter API | setTime/setPose, D/M, transactional validation | Invalid input preserves displayed state |
| Light tint/slot alpha | Evaluated RGBA | D/H, float uniforms | Packed vertex color/alpha | D/M, float slot uniforms + white vertices | Uniform values and real Phaser Face.load |
| Dark tint | Native static dark RGBA/intensity | D/H | Dedicated pipeline when dark active | D/M, same PMA equation including D=0 | Skin/tint fixtures, shader execution still M |
| Clipping | World polygons | D/H, CPU triangle crop | GeometryMask, earlier qualified rectangles/L | GeometryMask retained; hidden introductions/replacement fixed, D/M | Real Earcut/matrices, effective polygon comparisons |
| Inclusive end slot | Evaluated attachment/order | D/H | Skip paths handled, hidden introduction skipped | D/M, introduction before content visibility | Empty/invisible/animated end, replacement |
| Trim/transparent fringes | Export metadata | D/H, source texel centres + zero-PMA fringe | No equivalent retained-source crop/coverage | D/M, shared crop plus matching coverage uniforms | Source UVs/trim/alpha data; pixels M |
| Rotated atlas | Metadata | X, rejected | Legacy implemented path, not fully qualified | Legacy path retained with explicit warning, X | Not included in common parity claim |
| Linked meshes | Data/query paths | X, rejected | One-level adapter path | Retained/labelled; missing/chained/cyclic link refused, X | No new linked-mesh qualification |
| Blend Normal | Data + colors | D/H | H on measured historical cases | D/M | PMA upload required |
| Add/Multiply/Screen | Metadata, no renderer | X, rejected | Legacy mappings, partial old opaque evidence | Retained/labelled, X | No new blend feature or parity claim |
| IK/transform/path/physics | Existing code; native physics target mismatch remains | X, constraints rejected | Legacy paths; native physics not activated | Unchanged/labelled, X | walker compatibility data only |
| Disposal/recreation | No rendering resources | D/H | Mesh/container; masks listened to prerender | D/M, idempotent cleanup and shared pages | Root destroy, masks, listeners, stable meshes |
| Invalid/missing data | Basic parse validation | D/H, refusal | Some omissions silently skipped | Clear refusal before displayed pose mutation | Unknown attachment, weights, FFD, texture errors |

No new evaluator, export schema, triangle/weight/FFD source mutation or renderer
was added. Pure region/trim/mesh helpers, clipping math and the existing Pixi
controller moved into **@ankhimate/runtime/render**. Pixi wrappers keep its public
names and error boundary. A 457-record before/after snapshot (449 successful
native samples + 8 explicit refusals) remains byte-identical, including buffers,
pose data and tint/trim state. Existing Pixi assertions and native oracles are
unchanged; HTML import maps only gain the new pure-module entry.

## Common animation and geometry

Both adapters use the original RigPlayer/evaluate/attachmentWorldVertices. The
shared MeshBinding adapts already sampled FFD to the existing core skinning
query. Weighted offsets stay packed per influence. Rigid vertices inside a
weighted mesh have no packed FFD entry. Original vertices, UVs, triangles, weights
and baked bind coordinates stay untouched. MeshAtlas derives coverage geometry
per appearance and interpolates evaluated world positions; it never edits an
export to suit a backend.

Phaser uses real WebGL Mesh/Face/Vertex projection, not Sprite decomposition.
Shared geometry is Y-down; the adapter converts once to Mesh's Y-up vertex space.
Phaser's own projection produces screen Y-down. No camera inversion is added.
General affine shear, reflection and negative scales remain representable.
setUVs updates both u/v and the tu/tv actually loaded into the vertex buffer.
Expanded triangle mapping is refreshed even when index counts are unchanged.
The Mesh object survives attachment/skin/page changes; clear/addVertices replaces
only derived faces when their count changes. Ordinary updates reuse vertices.
ignoreDirtyCache/setOrtho are public Phaser APIs; the old private-cache write is
removed. This does not promise allocation-free CPU evaluation or better FPS.

Pixi clips derived triangles on CPU; Phaser keeps its GeometryMask. Introduction
precedes visibility and replaces the current mask, without nested intersection.
The end slot is inclusive even when empty/invisible. Masks are transformed during
prerender through root/ancestor matrices and scroll factors. Invalid polygons
are refused using shared validation. No rectangle is substituted for a polygon.

## Phaser loading and API

Preload the **same native JSON and full-page PNGs**; pageTextureKeys is indexed
by atlas.pages[].index. Texture keys are game-owned names, not export patches.
All atlas pages must be loaded at their authored dimensions with premultiplied
alpha (normal Phaser PNG loading). A mismatched existing frame name refuses
rather than overwriting another user's frame. The rig snapshots input data;
subsequent external mutation of the caller's JSON cannot corrupt its instances.

```ts
import { parseRig, PhaserRig } from '@ankhimate/phaser-runtime';
// Phaser Scene:
preload() {
  this.load.json('hero-json', 'hero/skeleton.json');
  this.load.image('hero-page-0', 'hero/atlas.png');
  // Load every additional page using the exact atlas.pages[].file.
}
create() {
  const data = parseRig(this.cache.json.get('hero-json'));
  this.hero = new PhaserRig(this, data, { pageTextureKeys: ['hero-page-0'] });
  this.hero.root.setPosition(320, 280);
  this.offEvent = this.hero.playback.onEvent(e => console.log(e.name));
  this.hero.playback.play('idle', { loop: true });
}
update(_time, deltaMS) { this.hero.update(deltaMS); }
// this.hero.playback.pause(); resume(); stop(); speed = 1.25;
// this.hero.playback.crossFade('walk', 0.35);
// this.hero.setSkin('alternate'); // no time/fade reset
// this.hero.setTime('idle', .5);  // direct sample, no events, detaches playback
// this.hero.setPose(alreadyEvaluatedPose);
// this.offEvent(); this.hero.destroy();
```

Old play(name, restart=true), crossFade(name, seconds), update(milliseconds),
setSkin, root, player and destroy remain. player is now a getter onto the active
core player; do not retain it across the new stop/direct-pose APIs that reset
the controller. Legacy player.play/seek followed by update(ms) remains tested. play(name,false)
refreshes a seeked pose and resumes without resetting time. Paused updates clear
both the high-level event batch and the legacy player.events polling array.
The new playback.update uses **seconds**; do not call both updates per game frame.
Raw RigPlayer control does not replace high-level pause/stop/approval policies.
Source data is snapshotted, not a supported live-edit API via player.rig.

The controller is the original Pixi implementation: finite positive speed,
non-negative deltas, per-instance loop override, pause/resume, direct detachment,
immutable event batches, unsubscription/destruction/reentrant-update guards and
100,000 conservative event bound. Event intervals are (from,to]; t=0 ignored each
lap. Fade events come from the incoming clip. Interruption keeps the existing
core policy and can visibly jump. It is not fixed or advertised away here.

## Packages and source demos

Build all workspaces in order. Install the **local core and Phaser archives
together**: they contain a new render subpath that older registry builds with
the same historic version label do not have. No version bump or npm publication
is performed by T-810. Bundlers resolve the additive exports subpath normally.
For direct browser ESM add this mapping along with the existing core/adapter maps:

```json
{"@ankhimate/runtime/render":"/core/dist/render/index.js"}
```

The source demo and source regression pages have been updated. The frozen RC2
bundle/import maps and historical independently pinned Phaser game snapshots
remain unchanged and must not be mixed with the new source modules.

Run npm ci, npm run build, then npm run example:parity. Manually open the printed
loopback URL. [Quickstart](../examples/phaser-pixi-parity/QUICKSTART.md) lists the
fixtures and manual acceptance checks. The example serves one copy of each
existing native fixture to both engines; no new rig or duplicated atlas is added.
T-810 does not start the server/demo in a browser or execute visual tests.

## Remaining qualification and limitations

- New shaders, PMA fringes, compositing and actual mask rasterization need manual
  WebGL comparison. Node tests observe uniforms/real Vertex/Face data, not pixels.
- Phaser's engine-level camera/container/mesh alpha still enters its standard
  packed tint path; tests use global alpha 1. Slot alpha is now full float.
  Fractional global alpha across engines is a specifically unqualified case,
  with possible backend quantization differences; no exact pixel claim.
- WebGL is required. Canvas refuses explicitly. Phaser 4, WebGPU, mobile,
  WebGL1 fallback and the whole >=3.80 peer range are not newly certified.
- PMA full-page textures are required; missing/deleted pages fail. Atlas frames
  remain owned by the TextureManager and are borrowed/reused, not deleted by a
  rig that could invalidate another instance. Meshes/masks/listeners are freed;
  one tint pipeline per renderer is owned by Phaser's pipeline manager.
- Linked chains, physics, constraints, non-Normal blends and rotated atlases are
  not part of the common qualified subset. Retained legacy paths are named in
  unsupported; an empty list is not a certificate of GPU or feature coverage.
- Dynamic topology/trim can replace derived faces. No zero-allocation or FPS
  improvement claim is made. Callback exceptions propagate after advancement,
  as in Pixi; invalid direct pose/skin data is rejected before visible mutation.

The new deterministic suite uses authentic immutable exports and independent
Rust references at sampled times, including 0/.25/.5/.75 and fade positions.
Historical Node tests still cover v1/v2, events, curves, weights, PNG hashes and
Pixi data. No historical GPU suite is claimed re-executed by this mission.

## T-811 measured headless extension

125 framebuffer comparisons passed predeclared tolerances, 104 exact; 20 logical creation/destruction cycles cleaned up. Actual Chrome 155 / ANGLE NVIDIA RTX 3090 used Pixi WebGL2 and Phaser WebGL1, DPR 1, 640×520, framebuffer AA off and linear textures. Five fractional root-alpha cases were exact. One transformed clipping contour pixel has alpha delta 64 within the frozen edge bound. See [limits](KNOWN_LIMITATIONS.md), [readiness](RELEASE_READINESS.md) and the delivered per-case metrics/captures. No product renderer fix or modified native JSON was required; prior T-810 data evidence and oracles are unchanged.
