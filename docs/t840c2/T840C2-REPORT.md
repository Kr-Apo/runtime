# T-840C2 — ReplayV1 PixiJS integration

Local implementation complete; ready for maintainer review. ReplayV1 remains experimental and opt-in. No publication, version change, merge, push or Editor change. Runtime parent: `20aeefe4aeccd824d9e87861167915a205782f64`; branch: `dev/t840c2-replay-pixi-integration`. Editor remains at `275082e8f26d42389ed05fb92c45e2822006525d`. The delivery's `LOCAL-COMMITS.json` records the final commit and clean states without a self-referential commit hash in this source document.

## Architecture and scope

The pre-implementation proposal is preserved in `WORKING-API-PROPOSAL.md` in the delivery. C1 consumed private validators/loaders and a stripped graphics descriptor. C2 replaces this with one explicit package subpath, `@ankhimate/pixi-runtime/experimental-replay`. The default package entry is unchanged.

`ExperimentalReplayPixiAsset` validates the original native v2 data: every clip is checked by the actual ReplayConsumer/ReplayV1 constructors, and renderer properties are checked separately on the same full rig. No Physics constraint is removed. A shared renderer-only helper and texture-page validator reuse the existing Pixi implementation; Legacy retains its original constraint/order refusal before invoking that helper.

Each instance owns one real `ReplayConsumerBridge`, one existing Pixi view, immutable prepared presentation tokens, and resource/disposal bookkeeping. Transport calls are delegated through `.consumer`, with no new clock, solver or integration equations. The view receives only the last completed pose and the validated static layout. Pure seek preview is explicitly separate. Context-bound cached tokens avoid new snapshots and buffer writes during unchanged redraws. New presentation still performs the existing consumer guard's extra detached frame read; this is measured rather than hidden.

## Changes

- `pixi/src/experimental-replay.ts`: separate asset/instance API, strict gates, ownership, presentation and disposal.
- `pixi/src/validate.ts`, `pixi/src/rig.ts`: extract shared validation helpers, preserving Legacy checks and rendering calculations.
- `pixi/package.json`: one additive export, unchanged versions/dependencies. Default `index.ts`, core and Phaser trees are untouched.
- `examples/replay-pixi-pilot/`: migrate to the public entry; retain example-only host-time policy.
- `pixi/test/experimental-replay.test.mjs`, `pixi/test/consumer/`, `scripts/t840c2/`: strict negative/lifecycle tests, independent TypeScript consumer, real browser loading and performance evidence.
- `scripts/t840c1/`: migrate pilot tests and use independent Rust corner geometry for the browser oracle without submitting forged application tokens.
- `pixi/test/fixtures/t840c2/multipage/`: genuine two-page native export produced through unchanged Editor B6 Save/Reload/export code; no patched runtime JSON. Generation sources and native project are retained in delivery evidence.
- Scoped `.gitattributes`, README links and six C2 documents. The delivery includes the complete binary diff, changed-file SHA inventory and commit patch.

## Red to green

`RED-public-entry.log` demonstrates the missing public entry before implementation (a missing capability, not a historical numerical defect). Two additional focused negatives found and closed integration gaps: `RED-WebGL1-refusal.log` and `RED-unsupported-options.log`. Final tests reject WebGL1/WebGPU and unqualified JavaScript skin/layer/crossfade options. Preliminary compiler/tool failures remain separate from accepted results. An initial negative-test assumption that mass zero was invalid was corrected: native B3 clamps that value; C2 preserves those semantics and tests a nonfinite mass instead.

## Final validation

| Check | Result and evidence in delivery |
| --- | --- |
| Build, typecheck, complete npm tests | PASS; 317 tests: core 90, Phaser 69, Pixi 152, pixel comparator 6; `RELEASE-CHECKS.json`, `release-*.log` |
| New experimental Pixi tests | 39 PASS, included in the 317 |
| Pilot and demo host-time tests | 9 + 3 PASS, separate from the 317 |
| Existing characterizations | 11 PASS; retained final quality logs |
| B3/B4/B5A/B5B1/B5B2/B6 parity | Re-executed; 90/45/50/60/18/33 scenario traces byte-identical to accepted B6; `PRESERVATION.json` |
| Legacy differential campaign | 29 within thresholds, 31 known divergences retained unchanged |
| Migrated C1 browser | 24 captures + one distinct presentation-error check PASS; all actual capture bytes identical to accepted C1 |
| Historical Pixi browser campaigns | 33 regions + 20 playback + 115 meshes + 232 appearance + 352 clipping = 752 PASS |
| Independent public TypeScript consumer | Compile and actual WebGL2 exercise PASS; no internal dist imports |
| Native page load lifecycle | Six browser cases PASS, including cancellation/failure after one decoded page |
| Performance | Matched C1/C2 at 1 and 10 owners, C2 at 25; separate allocation/GC profiling |
| Preservation | 3,019 protected files, RC2 digest, original D: repositories, prior refs/configs checked |
| Product warnings | None in final validation logs |

The browser campaigns qualify the tested subset, not a general expansion of ReplayV1 capabilities. In particular, advanced Legacy graphics coverage does not permit meshes, FFD, clipping, dark tint or alternate skins through this entry. Rust workspace/build/WASM are not claimed freshly re-executed: Editor is unchanged; the native fixture helper compiled and exercised actual save/export code, and existing Rust reference frames were retained and compared.

## Limits and verdict

GO for review and controlled use of the explicit experimental API on the tested native region/Physics-only subset. Not GO for default activation or publication. Real-time conversion remains a demo policy; graphics errors cannot roll back arbitrary external GPU/callback effects. Measurements cover one Windows/Chrome/NVIDIA configuration and small fixtures. Visual skin switching, events, mixed constraints, crossfade/layers and advanced graphics remain refused. The retained 31 Legacy divergences are not silently corrected.

See [API contract](T840C2-API-CONTRACT.md), [capability matrix](T840C2-CAPABILITY-MATRIX.md), [WebGL qualification](T840C2-WEBGL-QUALIFICATION.md), [performance](T840C2-PERFORMANCE.md) and [next steps](T840C2-NEXT.md). STOP after C2; subsequent work requires a new authorization.
