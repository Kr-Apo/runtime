# Validation and performance — A5

## Final validation

| Check | Result |
|---|---|
| npm build / workspace tests | PASS,630 tests:267 core +142 Phaser +215 Pixi +6 pixel policy |
| A5 targeted tests included | 51 PASS |
| Typecheck / source syntax | PASS |
| A4 geometry / A3 geometry | 9 /10 PASS |
| C3 vectors / N3 contract / B6 private faults | PASS;54 B6 cases |
| B3/B4/B5B2/B6 numerical trace drivers | PASS;byte-identical accepted N6 TypeScript traces |
| New native Rust reference tool | locked/offline run/repeat,fmt,all-target Clippy -D warnings PASS |
| Independent main Rust/TS events/Physics | 721 ticks,28 events PASS |
| Additional independent Rust event vectors | 1332 advancing windows PASS |
| New WebGL2 / independent CPU / cross-engine | 32 captures,all comparisons PASS |
| Historical current-module GPU reruns | I2 72 +A3 44 +A4 86 =202 byte-identical captures |
| Browser lifecycle and app event consumption | Both engines PASS,real RAF,two actors,context/reload |

Final receipts: validation-final-verified. Earlier failed runs are retained, not counted as successes. RED-admission ran the test against A4 and demonstrated that no event capability/drain existed. RED-f32-duration exposed admission of a duration that underflows native positive f32; the added admission check fixes it. Final targeted tests include zero/first-positive/exact/end/near-loop, equal-time order, short/multiple laps, empty windows/nonlooping, payload types, malicious/sparse input, immutability, context/session/refusal, precommit fault, prefix acceptance, queue overflow, callbacks, backlog/pause, resets/replays/disposal and old-mode gates.

One test initially tried to pump host debt with unchanged timestamps and was corrected to respect the existing host contract (no product clock change). A new-worktree alias typo caused a module-resolution test failure and was corrected only in ignored build links. The B6 throwaway sidecar recognizes double-quoted relative imports; the new production import follows that existing convention. Its 54 fault assertions and source of record are unchanged. An initial graphics driver lacked projected oracle UV metadata; the derived metadata was added using unchanged native atlas arithmetic. A profiling serialization failed on bigint and was rerun with explicit string serialization. These are retained development-harness errors, not final proof or hidden product regressions.

## Independent data and pixels

Native project Save/Reopen/export is reproduced byte-for-byte. The Rust reference is composed from native event-window calls plus accepted Rust bone/Physics frames, never TypeScript results. Numerical output and event list are exact for the tested windows; old thresholds are unchanged. Main max bone component1.001787e-5,Physics component3.340901e-6. The main trace and all raw samples remain available.

The new actual GPU set uses16 accepted ticks ×2 engines, including 0,1,15,30,59,60,61,178,179,180,181 and later loops. GPU buffer/Vertex/Face positions,UVs,indices,page selection and real uniforms are checked against independent Rust geometry. The unchanged I2 CPU rasterizer and unchanged raw premultiplied RGBA8 pixel policy compare all32 frames, plus32 cross-engine comparisons. All PASS; actual raw differences/diffs are retained. The final modules reproduce these buffers byte-for-byte. No CPU/GPU pixel-perfect identity claim is made. Historical202 captures are exactly byte-identical, with SHA receipts.

CDP coverage counts721 event-candidate calls per engine:720 main actor advancing ticks +one first-actor tick. Three actor origins collect no events. The ordinary three consumers correspond to three created actors; redraw/pause/readback do not collect again. Final executed-source fingerprints and EVENT-COLLECTION-COUNTS.json bind this to the delivery.

## Performance and storage

The separate headless collector measurement retains5000 per-tick timing samples. Real WebGL measurements retain600 advancing ticks and40 GPU query samples for each engine with one/two actors. Drains occur after each numerical update;26 events per actor are consumed in600 ticks, pending remains0 under that normal loop. The explicit negative queue test reaches1024, rejects the next whole candidate and retains every accepted prefix entry. No silent drop/growth occurs.

On this small fixture/RTX3090 run, median combined numerical update is approximately0.10ms; median drain is below the browser's0.1ms timer granularity and reports0.00ms, not zero cost. Median present/draw and GPU samples, maxima, post-GC deltas and standalone collector timings are in PERFORMANCE-SUMMARY.json with all outliers retained in raw files. Direct collection is measured separately from Physics; no performance conclusion is extrapolated to large games.

The fixed three selected attachment identities use six cached meshes per actor across two banks; three atlas pages are borrowed, two targets are owned. Destruction balances meshes/consumers and drops queue reachability; peer actors remain valid. Observed post-GC used-heap deltas are about+0.89..+1.12MB and include retained profiling arrays/events. This is bounded reachability evidence, not a zero-allocation or leak-free proof. No new ten-minute endurance campaign.

## Preservation

The protected map verifies50,825 historical files /61,632,764,928 bytes, including unchanged RC2 SHA256 a1c9835fbe83468f6e87bdd5676965a45210c4913305fc18b72c9d426b9553c0. Additional A2/I2/A3/A4 sealed manifests and their files are checked. Git receipts preserve original HEADs,branches,remotes and all clean worktrees; only the new A5 local branch advances. Native format,Legacy,Physics equations and historical fixtures/goldens/certificates are unchanged.

Old complete Q1/G1/G2/N3–N6 campaigns were preserved, not rerun or newly certified. Editor workspace Rust/WASM was not rebuilt: no Editor code changed. Only the new Rust reference tool is built/linted. No new product warnings; injected HTTP404/context-loss diagnostics are expected only in those negative scenarios. No push/public operation.
