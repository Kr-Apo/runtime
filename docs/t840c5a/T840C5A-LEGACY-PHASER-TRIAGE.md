# The196 inherited Phaser failures

Original harnesses were rerun unchanged on C5A and on a fresh exact C3 exported checkout, compiled with the same dependencies. All280 cases execute:84 PASS and196 FAIL on each. C4 retained evidence has the same semantic signatures. No threshold, oracle, golden or Legacy source is rewritten. A baseline setup compilation first lacked local type dependencies; its failed log is retained separately from actual graphics results.

|Family|Fail|Primary classification|Evidence|
|---|---:|---|---|
|test-webgl UV|20|Obsolete assertion demonstrated|Old atlas edge UV formula versus native texel centres;12 actual representative pose probes across all3 rigs, same invariant for the bone-only alternate clips|
|test-webgl synthetic diagnostic|1|Invalid/incomplete fixture demonstrated|Synthetic atlas pages omit mandatory index; existing phaserSource rejects before rendering|
|test-skin-uv|153|Obsolete assertions demonstrated|Every stored logical/submitted UV checked independently; same signature for all fixtures/modes/times; all other original checks pass|
|test-dark-tint filtered clear|8|Obsolete sampling oracle demonstrated|Original CPU/PMA checks already differ <=1/255; independent native-centre bilinear probe fixes the conceptual law and reaches alpha<=1,RGB<=1 without changing old tests|
|test-clipping end-unresolved|7|Unresolved reader-policy divergence on dangling attachment|Setup end slot names missing, no matching skin entry; strict Phaser lookup throws before any mask pose can be completed|
|test-clipping end-animated|7|Unresolved reader-policy divergence on dangling attachment|First two valid/null poses pass; at0.5s attachment key becomes missing; strict Phaser throws while historical Rust renderer skips unresolved draw|

Thus181 failed cases have proven obsolete expectations,1 is an incomplete synthetic descriptor,14 remain an explicit product-versus-fixture policy decision. **None becomes an old-harness PASS.** No environment failure remains among the280 executed cases. No valid clipping geometry defect is demonstrated by these14 exceptions; this does not certify every animated clipping interaction.

## UV cause and grouping

Old expectations use `(region.x + u*region.width)/page.width`. Current native Rust source sampling uses `u*(original_width-1)`, and GPU normalized texel centres require `(region.x+0.5+u*(original_width-1)-offset_x)/page.width`, with the analogous V expression and trim support. Neither reverses an axis. UV-153-INDEPENDENT-LAW.json proves all153 cases, including actual u/v versus tu/tv: maximum law error2.8233779e-8, zero logical/submitted drift, every other original geometry, transition, resource and pixel check passes. Cases collapse into one two-assertion signature, with9 art/topology/page/tint configurations; no153-fold manual diagnosis.

## Filtered border cause

The8 failures are alpha2/255 against a1/255 old analytic threshold; GPU versus actual Rust CPU alpha is already<=1. The old oracle maps the pixel centre to `64*u-0.5`; the native rule for a64px source is `63*u`. A separate diagnostic re-evaluates premultiplied bilinear source texels at the native coordinates, with the actual slot opacity, and compares to actual gl.readPixels. All8 cases have alpha0..1 and RGB1 with the **same thresholds**. It imports no regionQuad helper and mutates no test file. This isolates these8 failures as obsolete oracle coordinates rather than evidence of a new broad transparent-fringe defect. Other filtered-alpha/tint configurations remain outside this targeted diagnosis.

## Clipping cause and open decision

Missing attachment lookup, not a changed stencil transform, stops the7 setup cases and7 animated cases. The former also produces a secondary harness update-on-undefined error after construction fails. The latter executes only2 of4 poses. The end_slot itself names an existing slot; the unresolved item is its attachment. Native data carries a dangling reference, while the older CPU oracle treats it as absent and continues clipping termination. Choosing strict rejection, load-time validation, or graceful missing-attachment semantics needs an explicit Legacy contract decision and targeted tests. The observed exception is a real behavioral difference; it is not relabeled a pass or dismissed because C3 does it too. P1 for deciding/documenting malformed-reference handling, then targeted repair if approved.60 other specialized clipping cases and the modern parity set pass.

Recommended separate work: preserve original counters/evidence; review/update stale test laws in a dedicated test-only checkpoint; correct the synthetic fixture independently; decide missing-attachment policy before any Legacy implementation change. No mass Legacy repair, threshold relaxation or new Replay clipping support in C5A.
