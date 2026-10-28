# Experimental ReplayV1 linked weighted FFD (A11)

Opt in explicitly with `{linkedMeshes:true, animatedSlots:true, weightedFfd:true}`.
This is separate from A9 static `{linkedMeshes:true, animatedSlots:true}` and is
not implied by native v2, the published package, or Legacy playback.

## Ownership and scope

One default skin, one clip, Normal blending, immutable source geometry/influences/
binds, one direct link to a nonlinked mesh, existing Replay Physics and animated
slots. Geometry, weights, source UVs and vector binds come from the exact source
skin/slot/attachment. Texture comes from the displayed attachment. For
`inherit_deform=true`, the canonical source timeline wins even when a contradictory
own track exists and even when the source is hidden. For `false`, use the exact own
track; absence means zero offsets, never substitution by vertex count.

The accepted `ConsumerFrame.deformation.entries` has canonical owner tuples.
`bindings` records displayed, geometry, effective deform and timeline identities
(including explicit absent/rest), visibility and texture for every current slot.
There are no native JSON aliases. The resolved slot view is private admission/
graphics data, not a second animation sampler. `ReplayDeforms` samples once per
candidate inside B6; post-sample dimensions/finitude/identity validation precedes
observation and numerical acceptance. Present never evaluates keys or Physics.

Bounds: 32 meshes, 16 canonical owners/tracks, 4096 keys per track, 32768 packed
components per frame, 1048576 stored components. Every track is checked through
existing A3 validation on an exact private owner view, including ignored own tracks.
No deform data requires static A9 instead. Offsets must have complete per-influence
vectors. Empty/reset mixed-length key spans are explicitly refused: A10 does not
independently qualify their Rust/TS interpolation. Rigid meshes are static here.

No dynamic skins/fallbacks, chains/cycles, events, clipping composition, sequences,
new constraints, animated dark tint, mixing/crossfade or mutable topology/binds.
Old admission modes and numeric tolerances are unchanged. Seek uses replay from
origin, not direct Physics pose sampling.

## Reproduce

From the runtime root with dependencies already installed:

```sh
npm run build
node --test experimental/linked-ffd/geometry.test.mjs
node experimental/linked-ffd/prepare-demo.mjs NEW_OUTPUT DEPENDENCY_RUNTIME core/dist b2
```

`b1` selects the byte-identical A10 fixture; `b2` selects the native author extension
with own/rest/contradictory/decoy tracks. Builders refuse existing output folders.
Run `node server.mjs .` inside the prepared output and open pixi.html/phaser.html.
All browser dependencies are copied locally with existing notices.

`tools/linked-ffd-reference` requires sibling Editor A10 at
`../../../editor` relative to that tool (read only). Run its Cargo manifest with
one NEW_OUTPUT argument. It uses native Document APIs, Save/reopen/rebind/export,
then an explicit owner table, independent f64 affine/vector algebra and Bezier
bisection against accepted native continuous Physics. Positive native JSON is
never patched. The checked-in B1 oracle is unchanged A10; B2 is separately labeled.
These are headless authoring proofs, not GUI/artist qualification.

Detailed receipts, real GPU captures, rollback/context/resource measurements and
sealed historical comparisons are in the local A11 delivery. Qualification is
bounded to those scenarios and the tested Chrome/ANGLE/WebGL2 environment.
