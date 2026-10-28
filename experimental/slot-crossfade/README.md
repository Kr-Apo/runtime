# Experimental composed crossfade and animated slots (A14)

This opt-in application pilot composes A4 and A12/A13 in the existing ReplayV1
consumer. It is not Q1 admission, an expanded parity certificate or a release.
Native v2 and its readers are unchanged.

```ts
const gateA = { crossfade: true, animatedSlots: true } as const;
const gateB = { crossfade: true, animatedSlots: true, interruptible: true } as const;
const actor = new ReplayConsumerBridge(native, "Idle", 1n, undefined, gateB);
actor.play(actor.context, "Idle", false);
actor.requestTransition(actor.context, {to: "Attack", durationTicks: 48n});
// After accepted ticks during that transition:
actor.requestInterrupt(actor.context, {to: "Hit", durationTicks: 24n});
```

Advance through the existing tick/host-time bridge; presentation never advances
animation, the mixer or Physics. Requests start on the next accepted tick at
weight0; completion is D ticks later. The clock is120Hz. Use current contexts,
drain backlog before commands, and explicitly stop/reset before64 commands.

Each clip is projected into an unchanged A4 admission view. The bone mixer
samples locals; ReplaySlotMixer uses existing ReplaySlots at each clip's own
canonical phase. RGBA is interpolated as normalized native values, before PMA.
No byte mixing or clamping. Exact endpoints avoid arithmetic at weights0/1.

Experimental V1 discrete policy: source visibility, attachment/owner and full
draw order remain authoritative for weight<1; all target discretes take over
at1 in one accepted candidate. The live source timeline keeps advancing in
Gate A. This can change its own attachment mid-transition. There is one drawn
attachment per slot, never a double-render fade or a guarantee of visually
continuous attachment replacement. This is not a claim of Spine/Legacy mixing
semantics.

Gate B freezes the accepted pre-Physics locals AND complete accepted slot state
at tickN. The flat journal entry includes source clip, local tick/time, global
tick and skin provenance. N+1 starts from this exact pair, while the existing
single Physics state advances once. GPU-late display is never a capture source.
Consumer/journal results are detached copies. Replay verifies captures against
accepted origins; missing/foreign/corrupted pairs fail before accepting N+1.

Finite RGBA in[0,1], all owners, complete permutations and local matrices are
validated before the B6 commit. Valid Bezier keys can still overshoot; such
samples fault atomically. A GPU error after numerical acceptance preserves the
previous front and allows a pure retry of the same accepted frame.

Admission:2..16 clips,1..256 bones,1..128 slots, at most512 fixed-skin attachment
entries and4096 keys per bone channel/slot track/draw-order track. Existing
sampling horizon2^23-1 ticks, transition1..7200 ticks and64 commands remain.
Budgets are bounds, not maximum-size performance or mobile certification.

Fixed default skin, Normal, regions and static/weighted nonlinked meshes only;
Physics-only constraint scheduling remains unchanged. All clips are checked.
No FFD, links, clipping, events/audio, dynamic skins, dark tint, sequences,
constraint mixing, layers/additive or unqualified singular/sign-changing scales.
Standalone A4, A12 and A13 admissions and behavior stay separate.

## Reproduction

From this runtime, with locked workspace dependencies installed:

- `npm run build`, `npm test`, `npm run typecheck`.
- Gate A: `node experimental/slot-crossfade/prepare-demo.mjs NEW_DIR . core/dist a`.
- Gate B: same command ending in `b` (separate `slot-interruptions` wrappers).
- In the new directory: `node server.mjs .`; open pixi.html/phaser.html.
- Use Play/Pause/Resume, Attack/Hit/Death, Reset and accepted-history replay.
- `?manual=1` disables RAF playback for diagnostic explicit tick control.

The fixture is Combat Frog — Animated Expressions: Idle/Attack/Hit/Death,
reaction RGBA (including alpha0), Linear/Bezier/Stepped, two face slots,
open/closed eyes, sun/moon/null accessory, visibility and animated order.
It was authored using A10 native APIs, saved/reopened and exported, never patched
as positive runtime JSON. This is a headless author proof, not GUI authoring or
artistic approval. The independent Rust composer is in
`tools/slot-crossfade-reference`; place the read-only A10 Editor sibling at
`../editor`, checkpoint `cca30f97c2dd28b49da1d42a6c2cb31a779666ac`.
Run with NEW_OUTPUT and `gate-a`, `reference`, or `before`; it refuses existing
output. It independently samples native clips/slots, composes policy, and feeds
one native Physics instance. Atlas projection enrichment is oracle metadata,
not a change to the positive native export.

The delivery reports retain raw captures, CPU comparisons, boundaries,
rollback/context/lifecycle, two actors, retained timing outliers and historical
exact-byte checks. The measured six-slot fixture is not a universal heap budget.
No broad hardware qualification, alpha packaging or publication is implied.
