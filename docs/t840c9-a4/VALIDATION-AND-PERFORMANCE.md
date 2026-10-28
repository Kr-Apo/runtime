# Validation and performance — A4

## Final checks

| Check | Result |
|---|---|
| npm run build | PASS, all workspaces |
| npm test | PASS: 216 core + 142 Phaser + 215 Pixi + 6 pixel-policy = 579 |
| npm run typecheck / check:syntax | PASS |
| A4 targeted core | 77 PASS, included in 216 |
| A4 geometry / historical A3 geometry | 9 / 10 PASS |
| C3 vectors; B6 private fault checks; N3 contract | PASS |
| B3/B4/B5B2/B6 trace drivers | PASS, byte-identical accepted N6 TypeScript traces |
| New Rust reference crate | locked/offline author + repeat export; fmt; Clippy all-targets -D warnings PASS |
| Numerical continuous comparison | 721 ticks PASS |
| New actual GPU/pixel samples | 86 transparent + 6 opaque, CPU and cross-engine PASS |
| Historical GPU rerun | I2 72 + A3 44 framebuffers byte-identical to accepted captures |
| Autonomous demos | Play/Pause/Resume/Reload, both engines PASS |
| Fault/lifecycle/performance probes | Both engines PASS |

No new product warnings. Expected context-loss and missing-resource diagnostics are isolated and retained in their injected tests. Git line-ending notices are tooling notices, not runtime/build warnings; explicit staging preserves original source bytes.

## Red to green

Initial admission tests ran against A3 before implementation and failed because only weightedFfd was recognized. RED-admission.log preserves that result. RED/GREEN-exact-zero-alpha demonstrates the intermediate Bézier-key zero residual and exact-key fix. RED/GREEN-sparse-rgba and sparse-structure show strict rejection of incomplete JavaScript arrays rather than implicit zero/default values. GREEN-sparse-structure has all 77 targeted tests passing. Earlier local experiment logs are retained; they are not counted as final successes.

Tests include empty/missing tracks versus null, setup and delayed color, Linear/Stepped/Bézier, complete/stable order, named/hidden/transparent mesh state, multiple laps, detached references, source mutations, observer failure, numerical faults, invalid references/shapes/flags, pause/backlog/reset/replay, pure-seek refusal, independent actors, untouched bone-only frames and historical A3 admission.

The independent 721-tick maxima are documented in SLOT-NUMERIC-CONTRACT.md and NUMERIC.json. Pixel thresholds are unchanged: uniform-channel 3, neighbor range 4, large-edge 24, at most 2% of foreground, no registration; all 92 cases have zero uniform pixels outside tolerance and zero large-edge fraction. Real nonzero raw differences are retained, not hidden by a white/black background.

## Performance (small fixture only)

600 advancing ticks and 40 steady GPU query samples per engine and actor count, RTX 3090, hardware headless Chrome. Approximate medians in milliseconds:

| Engine | Actors | Numeric tick | Present + draw | Steady GPU |
|---|---:|---:|---:|---:|
| PixiJS | 1 | 0.10 | 0.40 | 0.0061 |
| PixiJS | 2 | 0.10 | 0.70 | 0.0082 |
| Phaser | 1 | 0.10 | 0.40 | 0.0686 |
| Phaser | 2 | 0.10 | 0.70 | 0.1894 |

Browser clock resolution limits short CPU timings. GPU queries are retained with disjoint flags. One consumer per actor, mesh plateau ten per actor, balanced destruction; post-GC used-heap deltas remain approximately +0.88 to +1.04 MB (not a claim of no allocations/leak proof). PERFORMANCE-SUMMARY.json and performance-final/RESULTS.json preserve raw measurements and initialization/destruction timings. No ten-minute endurance campaign was rerun.

## Preservation versus rerun

50,825 historical files / 61,632,764,928 bytes match the protected map. Extra A2/I2/A3 sealed trees match their own manifests. RC2 remains SHA256 a1c9835fbe83468f6e87bdd5676965a45210c4913305fc18b72c9d426b9553c0. Original branches, HEADs and remotes are checked before/after; only the new local A4 branch/commit is added.

I2 72 and A3 44 actual GPU samples were rerun using current modules and compared byte-for-byte. B3/B4/B5B2/B6 and selected N3/C3 checks were rerun. Existing Q1/G1/G2/N3–N6 complete certificates/campaigns were preserved, not reissued or rerun in full. Existing core/render tests retain their own historical fixture guards. Editor workspace Rust/WASM suites were not unnecessarily rerun: the Editor is read-only and unchanged, and only the new independent Rust reference crate is built here.

The final strict sparse-array admission changes only rejected-input behavior. Fresh final build/tests, numerical trace, GPU source fingerprinting, transparent/opaque byte-identity, context-restoration and UI smoke bind the final sources to the earlier fault/performance measurements. All scripts, raw measurements and receipts are delivered.
