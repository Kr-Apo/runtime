# Chrome CPU ReplayV1 bounded qualification — N5

Offline/local benchmark only. It does not change core algorithms or adapters and does not provide browser admission. The benchmark may own a raw consumer; this is explicitly different from the private N4 admission surface.

## Execution

`run.mjs <config.json>` uses already installed Playwright to launch the **installed Google Chrome executable**, headless, with a fresh private profile. No model or browser download. It serves exact ES2022/NodeNext core ESM over loopback, checks the actual transitive import graph with CDP `Debugger.getScriptSource`, and records Chrome/V8, binaries, arguments, host and context. No PixiJS/Phaser import, canvas or WebGL qualification.

The config supplies `runtime` (N4 or an isolated N5-only descendant), read-only `editor` E1, `dependencyRuntime`, `coreDirectory` of a fresh unchanged core build, installed `chrome`, source N3 delivery `n3`, and a **NEW** `out` directory. Compile with cached TypeScript first, into that isolated coreDirectory. Runtime source trees are checked; existing outputs are never used as overwrite targets.

The main campaign replays all 13 original N3 trajectories, four histories each. Simple/Mixed repeat in the same Chrome process; Simple/Mixed/Near repeat after closing Chrome and launching a fresh process/profile. Only exact N3 clips, params, default skin, origin, commands, budgets and horizons. H19 for the healthy fault_at_20 prefixes, H720 for normal clips. No horizon extension and no infinite guarantee.

`browser-capture.mjs` is a pure browser module. It fetches original native JSON, computes SHA256 with browser SubtleCrypto, imports real ReplayConsumer and exports raw JSON of actual states plus its browser digest. Nonfinite values use explicit markers. The page does not import Node fs/crypto or N4 authority.

## Proofs

New contract: `ankhimate.browser.bounded/1`, not Node's `ankhimate.replay.bounded/1`. Chrome identity/build and Rust reference provenance are independent. Rust is the actual E1 reference executed in N3, copied byte-for-byte with its build/hash/source request. Node traces are only supplemental; they are never returned as browser results.

`properties.jsonl` records **every** compared scalar, including exact zero differences, with Rust/Chrome values, errors, limit and PASS/FAIL. `errors.jsonl` is the nonzero subset. `comparison.json` includes each tick/history status and first/maximal violations. Pose/Physics contracts cover local transforms, world matrices, records, velocities, anchors, transport, rational clock, constraints and finitude. Mesh vertices, influences, tips and rendering are explicitly outside N5 comparison scope.

`proof.mjs` recomputes and verifies the local evidence using independent expected request/build/browser identities. It is an unsigned local consistency checker, not authentication of a hostile producer and not browser admission. A self-declared favorable status or Node certificate does not authorize anything.

## Tests

```powershell
node scripts/t840c7b-n5/contract.test.mjs <final-campaign-dir>
node scripts/t840c7b-n5/proof.test.mjs <final-campaign-dir> <NEW-negative-scratch>
```

24 comparator tests and 24 proof/negative tests. Separate real Chrome diagnostics exercise an intentional execution exception and real B6 precommit observer failure at tick9 with target19, preserving accepted tick8/bones/records. Those diagnostic commands are **not** favorable qualified histories. No production injection API or new solver.

## Limits

Observed mode: Chrome headless, exact binaries/build/host/options. No claim for headful Chrome, another version, another machine, Windows reboot, or unbounded playback. Private future browser authority requires a separate decision: ordinary page JS cannot authenticate Chrome/V8 binaries or bootstrap trust from its own user-agent string. R1 graphical work remains HOLD.
