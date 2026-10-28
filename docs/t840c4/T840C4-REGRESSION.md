# Regression and preservation

Fresh final build/typecheck pass.370 Runtime tests pass: core105, Phaser106 (69 existing +37 new), Pixi153 and pixel-policy6. Historical fixture/determinism checks included by npm test pass.11 historical characterizations,14 separate C1/C2/C3/C4 public/pilot tests and5,968 C3 Fraction vectors pass. No new product warning. Final tests avoid real inference/GUI Editor operations.

B3,B4,B5A,B5B1,B5B2,B6 campaigns are rerun against existing independent Rust references; TypeScript trace files are byte-identical to B6 accepted evidence. LegacyT839 remains29 WITHIN_TOLERANCE and31 known divergent cases, with byte-identical traces and no suppressed divergence.

Fresh Pixi graphics:33 regions +20 playback +115 meshes +232 appearance +352 clipping =752 passing scenarios, **no retry in C4**. The earlier C3 appearance retry remains documented and is not erased.24 C1/C2 exact captures and14 C3 host-time captures are rerun and byte-identical to sealed C3 artifacts.125 modern Phaser/Pixi parity scenarios plus20 lifecycle checks pass. Both C4 fixtures, public external TS app, 10 load-failure scenarios, actual live host control, performance and memory checks pass.

## Older Phaser specialized harnesses — not all green

|Harness|Cases|Pass|Fail|Independent C3 baseline|
|---|---:|---:|---:|---|
|test-webgl|21|0|21|Same semantic outcomes|
|test-dark-tint|32|24|8|Same semantic outcomes|
|test-skin-uv|153|0|153|Same semantic outcomes|
|test-clipping|74|60|14|Same semantic outcomes|

These are failures, not passes. A separate exported checkout of exact C3 compiled the original Phaser source and ran the same unmodified harnesses on the same browser/GPU. Semantic pass/failure/warning outcomes match for every case. The old UV checks expect atlas coordinates preceding the current trim/sampling convention; the synthetic diagnostic omits a required page index;8 filtered transparent-border expectations and14 animated clipping cases fail already on C3. Filtered-border differences remain real historical fidelity/test debt; no new certification is claimed. No test, golden, tolerance, UV, Legacy evaluation or clipping fix was changed to make them pass. LEGACY-BASELINE-FAILURES.json and LEGACY-EXTRA-COMPARISON.json retain the comparison. Modern125-case parity does not erase these failures.

## Incidents retained

Missing experimental entry RED; first-render projection RED; cached-removed-texture RED; corrected scale-versus-fault oracle; post-install callback exception RED/GREEN; initial external TypeScript configuration/narrowing errors and corrected strict consumer; interrupted early harness with pending Game destruction; baseline server's first missing dependency setup/timeout. Original logs remain. Final ordinary Game.destroy/Game.step replaces the stalled experimental loop-start cleanup. The isolated baseline's local browser dependencies corrected only its server setup. No historical acceptance evidence is overwritten.

## Integrity

5,560 protected files rehashed unchanged, including207 historical references and previous sealed deliveries. Core/Pixi source trees, versions, dependencies, lockfile and default Phaser exports are unchanged. All old branches/refs/remotes preserved. Editor275082e8 stays clean; D: originals stay clean at their initial heads. Alpha RC2 is unchanged, SHA256 a1c9835fbe83468f6e87bdd5676965a45210c4913305fc18b72c9d426b9553c0. No new full Rust suite is claimed: the unchanged Editor generated the new native fixture and721 Rust frames using the retained offline helper. No push, merge, tag, version change, npm publication or release.
