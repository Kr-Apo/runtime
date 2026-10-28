# T-840C3 — ReplayV1 Host-Time Bridge

Completed locally for maintainer review, 2026-10-23. No publication/default activation. Runtime parent `e69482a7fb1d923ef6f4f34187e445c32ec75f77`, branch `dev/t840c3-replay-host-time`. Editor stays clean at B6 `275082e8f26d42389ed05fb92c45e2822006525d`. Final commit/state are recorded in delivery `LOCAL-COMMITS.json` and appended to the delivered report after committing; source documents cannot include their own commit hash.

## Preliminary preview check

The required seek 30 -> capture/present -> seek 90 -> capture/present test passed on unchanged C2 production code (`preview-precheck.log`). B5A actually creates a new context on every seek. The second token has the new context, tick 90, matching bones, one new preview capture/pose transfer and no stale cache hit. Presenting the old token refuses. Repeated presentation of the second token is cached and leaves completed tick zero. No stale-preview defect was reproduced, so no speculative C2 production correction was made; the regression remains in the Pixi test suite.

## Architecture

`@ankhimate/runtime/experimental-host-time` is a new additive opt-in export, with `ReplayHostTimeBridge`, `HostTimeError`, the domain limit and types. The default core index, Legacy players and all Phaser/Pixi production rendering code remain unchanged. No dependency/version/lockfile/format change.

The adapter owns only host conversion and binding metadata. It delegates canonical integer tick requests to the real existing consumer. It has no physical clock, solver, animation evaluator, graphical pose or hidden pump. Exact binary64 endpoint decoding and integer dyadic accumulation preserve represented fractions across pauses; the only final quantization is floor-to-ticks. Exact ticks remain normative; ideal decimal/rational source readings are not magically recovered from rounded Number values.

Pause records the active tail without advancing the numerical clock or changing backlog. Resume excludes wall time and reanchors without a request; an unchanged first update stays observational. A subsequent changed timestamp can submit the deferred target. Stop/seek/replay/reset are explicit consumer operations; context changes expire the host binding, and explicit reset/rebind requires a ready playing consumer. No delta/speed API is introduced: 1x only, with explicit pause. The demo consistently reads performance.now at start/update/pause/resume instead of mixing a callback's earlier frame timestamp into those readings. See the [time contract](T840C3-TIME-CONTRACT.md).

## Files changed

- `core/src/replay-host-time.ts`, `core/package.json`: shared experimental converter/binding and one export.
- `core/test/replay-host-time.test.ts`, `core/test/fixtures/t840c3/`: 15 deterministic tests and independently fixed Fraction vectors.
- `pixi/test/experimental-replay.test.mjs`: successive-preview regression only; production Pixi code unchanged.
- `examples/replay-pixi-pilot/{app.mjs,index.html,README.md}`: opt-in host mode, diagnostics, explicit pumping, retained exact path. Legacy DemoTime remains available only for old tests/benchmarks.
- `pixi/test/consumer/consumer.ts`, `scripts/t840c2/consumer.mjs`: independent public TypeScript consumer now exercises the shared host entry too.
- `scripts/t840c3/`: public import test, vector receipts, host WebGL campaign, matched benchmarks and memory profiling.
- Root/core README links and six C3 reports. Complete diff and exact changed-file hashes accompany the delivery.

## Tests and results

| Check | Result |
| --- | --- |
| Build / typecheck | PASS |
| Complete Runtime tests | 333 PASS: core 105, Phaser 69, Pixi 153, pixel comparator 6 |
| New host / preview tests | 15 host + 1 preview, included above |
| Pilot / old demo clock / public host entry | 9 + 3 + 1 PASS, separate |
| Historical characterizations | 11 PASS |
| Fixed conversion vectors | 5,968 PASS, independent Python Fraction oracle |
| B3/B4/B5A/B5B1/B5B2/B6 | Re-executed parity; accepted numerical traces unchanged |
| Legacy differences | 29 within thresholds, 31 accepted divergences preserved |
| Exact C1/C2 WebGL | 24 captures + one presentation-error check PASS; actual capture bytes unchanged |
| Host-time WebGL | 14 captures + one regressive-time refusal PASS, real Rust pose/vertex comparisons |
| External consumer and page cleanup | Public TS compile + WebGL + six native loading cases PASS |
| Historical Pixi graphics | 33 regions + 20 playback + 115 meshes + 232 appearance + 352 clipping = 752 PASS |
| Performance / memory | Matched C2/C3 at 1/10/25; pure conversion separately; raw profiles/GC traces retained |
| Product warnings | No new warnings in successful final checks |

No fresh full Rust suite/build/WASM is claimed. Editor and its native fixtures are unchanged; the retained 721 Rust frames and existing campaigns are used as oracles. A preservation inventory covers 4,284 historical evidence/project/archive files, including the entire sealed C2 delivery, RC2 and older goldens. Both original D: repositories, isolated Editor, previous refs and remotes are checked before delivery.

## Failures retained separately

`RED-host-time-entry.log` records the missing opt-in capability before implementation. `targeted-first.log` contains one incorrect manual test assumption: the Number expression near the horizon lies just below the ideal boundary. The already fixed independent Fraction vectors gave the correct lower tick; the test was corrected to use those exact neighboring values, with no epsilon or algorithm change. The initial quality run hit a sandbox denial on an existing loopback-server test; the same unmodified suite passed with local-server permission. One of232 appearance cases hit ERR_NO_BUFFER_SPACE and a45s wait timeout; the other231 passed. That exact case passed using the original driver's existing filter in a fresh browser. Both initial and retry records remain, with no renderer/threshold change. The first performance phase splitter wrapped requestTime only and missed C3's requestTick path; that split is not accepted evidence. The corrected final benchmark wraps both public request methods without double counting. Initial raw outputs remain intact.

## Verdict

GO for review of the experimental absolute-time bridge at 1x, using the documented lifecycle and precision domain. No default activation, release or general arbitrary-clock accuracy certificate. Real-time inputs remain measurements; exact binary64 arithmetic cannot reconstruct fractions already lost by a host. Direct transport pause/resume must not be mixed with a bound bridge; use bridge lifecycle or explicitly rebind. Advanced graphical exclusions C2 remain intact. See [boundaries](T840C3-BOUNDARY-TESTS.md), [WebGL](T840C3-WEBGL-QUALIFICATION.md), [performance](T840C3-PERFORMANCE.md) and [next](T840C3-NEXT.md). STOP after C3.
