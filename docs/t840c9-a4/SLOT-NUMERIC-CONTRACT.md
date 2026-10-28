# Slot numerical contract — A4

Authority: native Rust author/evaluator and A2 export. Audit precedes the changes (`work/t840c9-a4/PLAN.md` in the delivery drivers). The slot sampler is independent only as a channel stage within the same candidate, not a second pose/FK/Physics evaluator.

## Time and interpolation

Use the existing ReplayV1 accepted candidate tick, canonical loop time and f32 query time. Never use the requested/backlogged tick. The clip duration is 1.5 seconds in the reference; ticks 0 through 720 include four clip laps with continuously accumulated Physics. Looping presentation does not reset Physics each lap.

Rust `core/src/pose.rs` holds the first interpolatable color backwards before its first key. Legacy TypeScript gates that channel on discrete presence and retains setup before that key. A4 explicitly follows Rust, while Legacy `evaluate()` is unchanged. Discrete visibility, attachment and draw order retain setup until the first key.

Linear, Stepped and Bézier reuse the existing scalar/vector interpolation primitives and A2 outgoing-curve convention. Finite Bézier Y handles may overshoot. Handles are not rewritten; a sampled component outside [0,1] is refused before acceptance, never clamped. At an exact authored color-key time A4 returns the exact key values. The pre-fix test at alpha zero measured approximately 6.82e-13 from the numerical Bézier bisection; RED/GREEN-exact-zero-alpha logs preserve the evidence and correction. This does not change Legacy or FFD interpolation.

## Values and discrete state

Setup color uses the existing native RGBA8 hexadecimal field; arbitrary setup f32 precision is not promised. Animated RGBA keys retain the native numeric values. Each component must be finite and normalized. Alpha zero is a visible, selected attachment with transparent draw submission, distinct from invisible and from null.

No attachment track or an empty track retains setup. An explicit null means no attachment and null owner, with no fallback. Invisible retains its current named attachment/owner. A named entry resolves exactly by fixed default skin, slot and attachment name. Missing or duplicate identities are refused.

Native draw keys contain partial setup-relative integer offsets, not a partial published permutation. Apply the existing directional half-step tie bias and stable ordering relative to setup, then publish a full unique slot permutation. Empty offsets restore setup. Offset targets outside the slot range are refused in this initial domain rather than silently clamped. Full frame orders must contain every slot exactly once. Sparse JavaScript arrays are rejected as incomplete data, including RGBA, Bézier handles, triangles and orders (separate RED/GREEN receipts).

## Independent comparison

Before testing, PLAN fixed normalized-color tolerance at 1e-5; GPU color/opacity tolerance at 1e-6; visibility, attachment, owner and full order require exact equality. Retained limits: bone linear coefficients 1e-4, translations/world vertices 0.01 unit, Physics angle/angular velocity 0.001, other Physics values 0.01. No thresholds were widened.

The unchanged Rust Replay consumer rejects slot channels. The test generator therefore supplies that consumer a private clip copy with only the four slot families removed; it evaluates the original full author clip with Rust Pose for slot state, then installs the accepted Rust bones for independent native mesh/region geometry. The positive native export is untouched. No TypeScript geometry creates the Rust reference.

721 successive ticks pass. Max errors: RGBA 9.110902e-7; bone matrix/world components 1.001787e-5; Physics record components 3.340901e-6; active world vertex coordinates 2.277963e-5 unit. Full rows and semantic assertions are retained in delivery `NUMERIC.json`; selected 43 frames are committed with the fixture. Native mesh inverse-bind and all influences, including zero/nonunit rows, are preserved.
