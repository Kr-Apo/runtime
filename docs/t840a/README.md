# T840A — Physics replay characterization

Local branch `dev/t840a-physics-replay-contract`, from accepted local T839
`d720d6a21c0381e8417390bcac02f97c481432b5`. Companion Editor starts at
`ac8ace04cfb34f9ffe812fdde0bb8b9058f90303`. No production evaluator/player/adapter,
package/version or native v1/v2 format change. No push/release.

The companion Editor `docs/t840a/` contains the normative proposal, all 60 measured
rows, option comparison, T840B plan and validation report. Proposed ReplayV1 is
not implemented or the default. Legacy traces are characterization, not green
conformance tests. Current runs have 29 within thresholds and **31 divergences**.

Tools, used after normal workspace build:

```
node scripts/t840a/compare.mjs <Rust-reference-dir> <new-result-dir>
node scripts/t840a/clock-experiment.mjs <Rust-reference-dir> <new-result-file>
node --test scripts/t840a/characterization.test.mjs
```

Produce references with the companion Editor's
`cargo test --locked -p ankhimate-export --test t840a_physics`, setting
T840A_REFERENCE_DIR to a nonexistent folder. Optional T840A_COUPLING_FILE must
also be a new path. Unset output variables before whole-workspace tests.
The copied author files and exported baseline JSON must remain byte-identical to
T839. Derived context variants are real new native exports, not manually patched
JSON. No model, renderer, browser or GPU is needed by these experiments.

Thresholds in `scripts/t840a/thresholds.json` are predeclared: local/world .01
units, wrapped rotation .001 radians, dimensionless affine coefficients .0001.
Full TS/Rust traces, first mismatch and category maxima remain visible. Exit 0
from comparison means measurement completed, not that all parity rows pass.

Eleven explicit tool tests characterize zero-dt hitch draining, mix freeze,
actual player/playback transport, instance independence, reset, nonfinite/missing
reference behavior and the proposed clock calendar. They are deliberately run
separately from unchanged `npm test`, which still covers the historical 231 tests.
The clock model/experiment is test-only; no shipping replay adapter is exported.

Recommendation: fix context safety, then introduce an opt-in instance clock with
one 120Hz tick schedule, per-constraint records, canonical input sampling and
retained backlog. Do not copy Rust's shared-remainder coupling into TS. Its
clock experiment is promising but not transport/long-run/fault qualification.
PixiJS constraints, CPU physics and runtime PathPosition remain refused.
