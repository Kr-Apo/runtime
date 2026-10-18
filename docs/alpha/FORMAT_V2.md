# Native runtime format v2 reference

This is an integration reference to the existing native preset and compiled
reader, not a new format or migration implementation. The .ankh author project
is a separate contract and is not the JSON loaded by `loadPixiRig`.

## Files and versions

The native preset writes UTF-8 `skeleton.json` and PNG atlas pages. Top level:
`format: "ankhimate-runtime"`, `format_version: 2`, `context_version: 1`, `name`,
`fps`, `bones`, `slots`, `drawOrder`, `defaultSkin`, `skins`, `constraints`,
`constraintOrder`, `animations` and embedded `atlas` metadata. The manifest's
component versions are independent of these format numbers.

The shared core reader accepts v1/v2 (missing format_version means v1). This
Pixi adapter requires explicit v2 and context 1. Unknown versions and malformed
data throw; legacy reader compatibility does not make Pixi a v1 renderer.

## Geometry and units

Author/runtime world coordinates are Y-up; lengths and translation are authored
units, time is seconds. Setup and animation angle values in JSON are degrees;
the evaluator converts to radians. Bone parent is an array index, -1 for a root.
Slot bone and attachment references are names. `drawOrder` orders slots.
The adapter converts world Y to Pixi screen Y once. Position/scale the instance
root for your game; do not invert exported data or the camera to compensate.

Bone animation tracks have independent `translate_x`, `translate_y`, `rotate`,
`scale_x`, `scale_y`, `shear_x`, `shear_y` scalar key arrays. Translation, rotation
and shear are offsets; scale is multiplicative against setup. Each key has
`time`, `value`, `curve`. Curves are `linear`, `stepped`, or
`{type:"bezier",handles:[x1,y1,x2,y2]}`; handles are normalized segment controls,
with X in [0,1], Y may overshoot. The native curve belongs to the outgoing segment.
Keep axes, times and handles intact. Rotation uses shortest arcs, preserving the
sign of exact half turns. Do not turn the independent axes back into paired keys.

## Attachments, skins and FFD

Skin entries identify `slot`, attachment `name` and an `attachment` payload.
Qualified types are `region`, `mesh` and `clipping`. Regions carry source size,
pivot, transform and source UV rectangle. Meshes carry vertices/UVs/triangles;
weighted meshes also carry bone-local influences and weights. FFD uses
`slot`, `attachment`, and keys with `time`, `offsets`, `curve`: two values per
rigid vertex, or two per authored influence for weighted meshes. Offsets must
match topology. Do not reinterpret them as one world delta per weighted vertex.
Linked meshes and mesh sequences are rejected. See [target matrix](RUNTIME_COMPATIBILITY.md).

## Atlas and alpha

`atlas.pages` gives index, relative filename, width and height. Page indices match
array positions. `atlas.regions` gives name, page, packed x/y/width/height,
original_width/original_height, offset_x/offset_y and `rotated` (must be false).
Packed offsets use image coordinates (top-left, Y-down). Mesh UVs address the
original source image; trim offsets are not a new logical origin.

The qualified renderer maps source U to `u*(sourceWidth-1)` texel coordinates,
then into the atlas using pixel centres and trim offsets. Extrusion/padding are
sampling protection, not extra source content. The adapter reconstructs removed
transparent fringe coverage inside authored triangles; consumers should use its
compiled implementation instead of duplicating UV arithmetic.

PNG pages store ordinary RGBA; texture upload premultiplies alpha. Normal
composition uses premultiplied colors. Static optional `slot.dark_color` is
[R,G,B,shadowStrength] in [0,1]. In PMA terms dark RGB contributes
`(texel.a - texel.rgb) * dark.rgb * dark.a`; light tint/opacity also applies.
Dark alpha does not replace attachment opacity. No dark animation track is
fabricated. Missing dark_color means no dark contribution.

## Clips and events

`animations` is keyed by clip name. Each clip contains duration, looping,
bones, slots, deform, drawOrder, ik, transform and events. Slot attachment,
visibility and draw-order changes are discrete. Light-color tracks can have curves.
Event fields are `time`, `name`, optional `int`, `float`, `string`, `audio`,
`volume`, `balance`; audio is data only. The player ignores t=0 events on each
loop and reports positive-time crossings. See [integration](PIXIJS_INTEGRATION.md).

## Validation boundary

The adapter validates version, references, page dimensions, supported attachment
types, finite geometry, FFD dimensions, tint ranges and supported target features.
It is not an adversarial-input resource sandbox. Serve only trusted local assets;
the public loader resolves page URLs from the JSON and is not an origin firewall.
The bundled demo's server policy confines its requests to the extracted archive.


---
Source-tree note: file locations and runnable browser examples above refer to
the extracted RC2 archive. Download the [complete alpha archive](https://github.com/Kr-Apo/ankhimate/releases/download/alpha-2026.10.18-rc2/Ankhimate-Editor-PixiJS-Alpha-RC2.zip).
Source files here document that same API; GitHub does not execute the demo.
