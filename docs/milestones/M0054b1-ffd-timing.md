# M005.4b1 companion — v2 FFD f32 time boundaries

15 October 2026. Separate user-authorized checkpoint on
`fix/m0054b1-ffd-time-boundaries`, based on
`94ec1dfde999d554c9604586c6bdbb419e5c0b23`.

The Rust outgoing-curve fix was independently validated against the M005.4a
fixtures. Its required boundary checks exposed a separate consumer issue:
Rust samples at f32 time; FFD used the JavaScript double directly. A native key
at 0.8f32 is serialized as 0.800000011920929. At a requested 0.8 seconds, a
stepped FFD therefore held the previous value in TypeScript while Rust reached
the endpoint (20 units of error in the real native fixture).

The initial request prohibited runtime changes. The user explicitly authorized
this small TypeScript correction as a **separate checkpoint** after the failure
was reported. This does not authorize skin, clipping or other advanced-feature
changes.

Only v2 FFD sampling time now uses `Math.fround`, matching the existing v2 bone
sampling convention. Key times, offsets, weights, geometry, interpolation and
parsing are unchanged. Legacy v1, with an absent or explicit version, retains
double-precision timing. No API, dependency, package version or runtime format
version changes. Phaser rendering code is untouched.

`core/test/fixtures/ffd_sparse_v2.json` is a new, **unmodified real Rust native
export**, with atlas disabled for the headless evaluator test. It was generated
from the M005.4a stepped fixture with sparse keys at 0.25 and 0.8, using the
existing schema conversion, native template, export planner and publisher.
It was not repaired manually. The external delivery contains its authoring
generator and the independent Rust reference.
Its Git attribute disables line-ending conversion for this new fixture only,
so its native bytes survive Windows checkouts. Existing fixtures are unchanged.

Three tests were added before changing the evaluator: native decimal endpoint
including `RigPlayer.seek`, sparse holds before/after keys, and legacy v1
implicit/explicit timing. Before correction, 33/34 passed and the decimal
endpoint failed. After correction, **34/34 pass**, with build and typecheck.
The real Rust/TS boundary harness passes all thirteen samples, including raw
requested double 0.8, without changing serialized key times.

The five M005.4a FFD fixtures pass twenty real CPU/WebGL comparisons at
0/.25/.5/.75 seconds. The decimal boundary is additionally exercised through
the actual Phaser adapter. Existing **53 WebGL regressions pass**, the original
19 and dark-tint 59 fixture hashes remain unchanged. Windows NT 10.0.26300.0,
Phaser 3.90.0, Chromium 155.0.8059.80, ANGLE RTX3090 D3D11. Flat PMA RGB tolerance
2/255, alpha 1/255; geometry/offset tolerance 0.01; edge mismatch fraction ≤2%.

Old v1/v2 exports remain readable. This consumer fix does **not** relocate wrong
curves in old v2 exports; non-linear FFD exported before the Rust mapping fix
must be exported again. Their four original quarter-second samples retain the
old reader's results. V2 timing at f32 boundaries intentionally changes to match
Rust, whereas v1 timing remains unchanged.

No skin, clipping, physics or other P2 fix, publication, push, merge or amend.
The full delivery report contains both local commit hashes and the separate
validation logs.
