# T-840B4 — Canonical sampling contract

Status: opt-in numerical core surface only. No editor/player/adapter/export activation.

## Ownership and pipeline

`ReplayAnimationInstance` owns immutable rig and selected-clip snapshots plus a B3
`ReplayPhysicsInstance`. Construction resolves exactly one clip name, validates its
domain and the Physics-only rig, samples tick zero and primes anchors. The clock is
owned exclusively by B3. There is no sampler clock and no accumulated floating dt.

Each **executed** integer tick N samples author locals anew, then passes them to B3,
which reconstructs FK and steps constraints once in author order. Old Physics
offsets never enter the next author sample. Backlog is processed with the same
provider at each historical tick, not with the last graphical-frame pose.

Rust uses `pose::animation_locals` and the existing `apply_animations` stage;
TypeScript uses `evaluateBoneLocals` and the unchanged bone loop extracted from
`evaluate`. `sample_tick` / `sampleTick` separately exposes the complete pure pose
for inspection, using the original full evaluator without numerical Physics state.
The normal evaluator still uses exactly the same interpolation rules.

## Canonical time

N is an integer in [0, 8,388,607]. Logical absolute time is N/120, calculated directly
in f64 / JS number. This conservative horizon keeps adjacent ticks distinguishable
at f32 precision (about 19.4 hours). Out-of-domain samples and request targets are
rejected; start a new explicit epoch rather than silently losing precision.
The general deltaSeconds-to-tick bridge remains absent.

The clip duration is the author's f32 value promoted to f64. Native JSON serializes
duration using its shortest decimal (e.g. 0.83), so the new TS surface explicitly
recovers it with Math.fround before modulo. Keys retain their existing native
representation. Only the final clip time is cast to f32 / Math.fround.

- Duration zero: sample time zero, including an empty clip (Setup).
- Nonlooping: clamp time to duration. Physics continues stepping after that time.
- Looping: positive modulo by duration, matching the existing player's wrap policy.
- Exact integral loop boundary (e.g. tick 120 of duration 1): sample zero.
- Fractional duration (tested 0.83 s): modulo uses its recovered f32 period; the
  boundary need not coincide with any simulation tick.
- Modulo is calculated before f32 rounding. A logical time just before a boundary
  can round to the endpoint; it is not spuriously wrapped again after rounding.
- A loop never clears springs, velocities, anchors or clock counters. A discontinuous
  author input at wrapping is a new input to the existing simulation state.

This specifies wrap/clamp intent without reproducing frame-dependent accumulated
playhead rounding. Legacy transport behavior is unchanged.

## Channel domain

One clip, alpha one. Independent native v2 bone translate X/Y, rotate, scale X/Y,
shear X/Y. Translate/shear add to Setup, scale multiplies Setup, rotation adds
degrees converted to radians with native signed shortest-arc interpolation/wrapping.
Unkeyed properties retain Setup. Linear, stepped and native Bezier curves are reused;
Bezier X handles must be finite in [0,1], Y may overshoot. Curves and units are not
rewritten. Numeric tracks hold the first key before it, the last key after it;
empty tracks have no contribution. Keys beyond clip duration are not automatically
trimmed, consistent with the existing evaluator/player separation.

Unknown/duplicate clip names, unknown bone references, duplicate bone/channel tracks,
same-time/unsorted/nonfinite keys, invalid handles/duration, mixed constraints and
nonfinite sampled transforms are errors. Rig snapshot ownership prevents substituting
a sampler for a different instance. Native IDs/names are validated against that rig;
there is no retargeting or semantic inference between rigs with similar bone names.

Slot/color/attachment tracks, draw order, deformation, constraint timelines, events
and attachment sequences are explicitly refused. Markers are nonplaying metadata.
Rust author bone sampling offsets are refused: subtracting an f32 offset from time
versus baking it into v2 key times is not qualified here. Native v2 no longer records
the origin of baked offsets; the TS consumer can read those scalar tracks but no
Rust/TS shifted-author parity is claimed. V1 remains supported by existing readers,
but the new clip wrapper requires v2. No format or existing field meaning changes.

Physics-only and fixed default-skin constraint membership remain B3 restrictions.
No IK/Transform/Path, skin switching, mixing, fades, layers, masks, gameplay events
or external root-input reconstruction is introduced.

## Safety and API

Rust: new(rig, clips, name, epoch), context(), clock(), frame(), sample_tick(N),
request_tick(context,N,observer), request_time(context,n,d,observer),
pump(context,budget,observer), reset(rig,clips,name,new_epoch).
TypeScript: constructor(rig,name,epoch), context/faulted getters, clock(), frame(),
sampleTick(N), requestTick, requestTime, pump, reset(rig,name,newEpoch).

Context identity is B3 instance identity, not just its numeric epoch. Reset validates
a new candidate before replacing the old state, requires an increasing epoch, and
invalidates the previous token. TS forbids reentrant mutation, including reset from
an observer. Rust borrowing enforces the corresponding exclusive mutation boundary.
Source mutation and caller mutation of TS returned poses cannot alter the snapshot.

Failed construction or request validation does not replace the current public frame.
A failure while executing a tick leaves it uncommitted, preserves the last good
public frame and blocks the instance until reset. Private numerical rollback is NOT
provided (B6). No silent Setup fallback or retry is performed. Observer failures
follow the same B3 rules. A pure sample query can be used for diagnosis after a fault;
it does not resume simulation. B3 direct-input APIs remain available unchanged.
