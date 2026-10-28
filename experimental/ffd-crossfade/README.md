# A16 — experimental weighted FFD crossfade

Gate A is explicit `{crossfade:true,weightedFfd:true}`. Gate B adds `interruptible:true`.
No other channel combination is implied. This is a dedicated qualification, not
universal replay parity or alpha/publication approval. A3/A8/A11 and A12–A15 keep
independent options and refusals. Native v2, Editor and Physics solver are unchanged.

## Domain and sampling

One immutable native skeleton, fixed default skin, Normal, Physics, 2..16 clips,
one exact displayed weighted FFD owner `(default,slot,attachment)`. All tracks
must refer to that same owner and full per-influence offset layout. Other regions
and static meshes remain static. Setup binds/topology/UVs/indices/weights never
change. Missing whole FFD track means native zero rest; an empty track or empty
key vector is refused. The A11 empty/full key HOLD is preserved.

Each clip uses its own accepted canonical120Hz phase and unchanged A3 Linear,
Stepped/outgoing Bezier sampling. Source A and incoming B author-space vectors
blend componentwise `A+(B-A)*w`; endpoints0/1 preserve exact source/target values.
No positions, influence coefficients or UVs are interpolated. FFD key values and
Bezier handles must be finite and f32-representable at admission. Offsets must remain
finite and f32-representable after sampling/blending; valid finite native keys
can still overflow between keys and then the whole tick is refused.

The existing one Physics simulation consumes mixed bone locals once. The frame
carries the same accepted deformation and mixing provenance. DeformGeometry
adds each offset through the linear inverse bind (no translation on vectors),
then uses accepted Physics world matrices and native influence normalization.
The renderer never samples keys or calculates a mixing weight.

No linked/inherited FFD, animated slots/events/audio, clipping, dynamic skins,
new constraints/constraint mixing, layers/additive, sequences, dark tint or
unqualified scales. No owner/attachment/topology/bind switching. Unknown timelines
and unsupported capability combinations refuse before playback.

## Interruptions, memory and transactions

A request after N starts at accepted N+1 with weight0. Gate B captures the exact
accepted prePhysics locals and complete accepted canonical offsets at N. Captures
include owner, globaltick, clip provenance, structural rig identity and admission
version. The source stays flat/frozen; no abandoned live source is sampled.
Later interruptions capture the latest accepted pair, never GPU/front positions.

Structural identity is exact canonical text of the immutable parsed rig except
animation arrays, not a hash. Private original clip data remains the plan's
sampling authority. Identity matching alone does not validate a capture: exact
resampled local/offset equality and origin metadata are checked at restore and
again against the actual accepted origin during replay.

New-mode bounds: 1024 target scalar components,4096 keys/track,262144 stored
scalars across clips,128 attachments,32768 UTF16 identity code units. Capture
commands are limited to65536 serialized UTF16 code units before journal append.
At64 journal commands this conservatively bounds serialized capture payload to
8MiB UTF16, and offset doubles alone to512KiB for64 maximum-size copies. JS object
headers, immutable rigs/samplers, current/candidate frames and detached caller
copies add overhead; these are not exact heap/VRAM caps. The usual first request
is nonfrozen, leaving at most63 frozen sources in64 entries. Existing historical
modes retain their budgets. No per-tick cache. Stop/reset/disposal drops old
owned plans/captures; callers may retain their detached public copies.

A wrong owner/size/nonfinite value, corrupt origin, budget or observer failure
refuses the complete B6 transaction, preserving prior accepted pose, Physics,
offsets and journal. A full journal refuses65 without eviction. Replay stages
and validates all64 bounded commands, reconstructs each pair and continuous
Physics from origin. No nested blend tree or saved GPU state is an authority.
Graphics failures keep the old front and permit same-frame retry without a new
sample/Physics tick. Separate actors own mutable numerical and geometry state.

## Demo and reproduction

After workspace build:
`node experimental/ffd-crossfade/prepare-demo.mjs NEW_DIR . core/dist a`
(or `b` for Gate B). Run `node server.mjs .` inside NEW_DIR, open pixi.html or
phaser.html. Ordinary pages use RAF; `?manual=1` is explicit diagnostic tick mode.
Gate B offers Attack/Idle, interrupt Hit/Death, pause/resume/reset/replay and
accepted owner/tick/max offset/weight/Physics/journal status. No CSS animation
or gameplay effect substitutes for mesh deformation.

`tools/ffd-crossfade-reference` requires pinned readonly Editor A10 sibling
`../editor` at cca30f97c2dd28b49da1d42a6c2cb31a779666ac. Genuine native APIs author
Combat Frog — Morphing Crossfade, Save/reopen/export, then independently compose
native per-clip locals/FFD and a declared new blend rule with one native Physics.
Independent f64 Setup bind/vector algebra supplies expected contributions/vertices.
Modes gate-a/single/repeat produce1441 states and independently rerun native
replay. This is headless authoring, not GUI or artistic qualification.
