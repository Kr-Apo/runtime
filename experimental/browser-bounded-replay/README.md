# Supervised Chrome bounded admission (experimental N6)

This is a local CPU qualification bench, not an npm entry, renderer, browser security certification or general Physics capability. N4's Node authority is unchanged. R1/weighted WebGL2 remains HOLD.

## Trust and launch

`createSupervisor({anchorPath, anchorSHA256, dependencyRuntime, chrome})` is Node-only. The launcher must independently pin the anchor digest. Never accept that digest, manifest, executable or code policy from a page or an imported certificate. The anchor seals the separately approved ten-entry N5 bank, N6 code, N3/N5 verification dependencies, numerical JS build, exact Chrome binaries and N5 engine identity. No Near-singular entry is approved.

Before each new authorization the supervisor checks the current anchor, manifest, code, build, native bytes, Rust reference and every proof seal. First use recalculates all N5 comparisons/property journals/certificate claims. Cached numerical results are usable only while every sealed byte remains identical. New tickets are opaque, supervisor-local, instance-bound and single use. Prepared inputs/references are private copies, not mutable caller buffers or later filesystem reads.

The installed Chrome must match N5 Chrome 156.0.8078.47 / V8 15.6.75.19, Windows/x64 host, flags, headless and binary identities exactly. A changed browser is HOLD, not automatic requalification. CDP checks actual executed source bytes before the supervisor supplies a one-shot approved bootstrap. ESM imports remain the original numeric modules. The trusted Playwright router supplies exact local bytes directly (`route.fulfill`); page requests outside that origin and a second bootstrap are refused. This avoids requiring socket access by the page, without substituting Node numerical execution. A loopback server allocates the private origin but page/module bodies are supplied by the trusted router. No Canvas/WebGL is created.

## Surface

The Node authority exposes `authorize`, `start`, `identity`, `costs`, `close`. `authorize` takes the exact approved qualification, history, instance identity, native bytes and full N5 request. `start` consumes a ticket once and creates one independent page/context/consumer.

The page entry `browser.mjs` has no exports or public consumer factory. It installs only `N6.observe/next/execute/preview/present/diagnostics/dispose`. The matching Node proxy also offers detached execution evidence. The consumer, rig, transport, authority tokens, mutable callbacks/providers and free simulation methods are never returned. Old core/Pixi/Phaser APIs can create other consumers; they cannot access this private one.

`next()` returns `{sessionId,cursor,epoch,command}`. Execute only that exact envelope. Transcript order, budgets, restart flags, epochs and inclusive H are fixed by N5. Normal H720, qualified fault prefixes H19; values are read from each approved request. H+1, arbitrary commands even within H, host time, extra pumps, unqualified seeks/resets and post-fault resumption are refused. No clamping or implicit command.

Every Physics candidate is checked privately before B6 commit against the exact corresponding N5 Chrome numerical frame. N5 already establishes the separate Rust tolerance contract, which is independently recalculated; N6 does not loosen it. Initial states, command endpoints and the one qualified pure preview are also checked. Numerical faults preserve the committed prefix, mark the session faulted and require new admission from origin. Presentation errors remain separate. Reset/seek's origin construction follows only the exact unchanged N5-qualified core path; it is not a new arbitrary rollback API.

Snapshots/plans/previews are detached; page outputs are recursively frozen. Instance receiver checks and a busy gate reject borrowed methods/reentrance. Command accessors/cycles/non-plain objects are rejected before invoking user getters. Node inputs are cloned under the busy gate. Dispose is terminal and idempotent. Frozen objects/closures are not protection against an owner rewriting the page, prototypes, engine or trusted launcher.

## Tests and reproduction

Use the independently pinned local launcher configuration supplied with the N6 evidence. Do not turn a self-generated digest for arbitrary data into a claim of maintainer approval. Existing output/scratch paths must not be reused: tests intentionally refuse existing directories.

```text
node --test-reporter=tap experimental/browser-bounded-replay/campaign.test.mjs <trusted-config.json>
node --test-reporter=tap experimental/browser-bounded-replay/fault-bypass.test.mjs <trusted-config.json>
node --test-reporter=tap experimental/browser-bounded-replay/proxy.test.mjs <trusted-config.json>
node --test-reporter=tap experimental/browser-bounded-replay/identity.test.mjs <trusted-config.json>
node experimental/browser-bounded-replay/profile.mjs <trusted-config.json>
```

Instrumented tests create separate copies with independently recorded test anchors: four precommit fault injections and a browser-evaluation test hook. The normal supervisor has no evaluation/injection/provider API. Actual served-module mismatches are refused by CDP. No numerical module, oracle or accepted N5 proof is modified.

Costs distinguish initial full recalculation, rehashed-cache authorization, context/consumer creation, audit, clone, dispatch segment, RPC and destruction. Browser timers are quantized, so a recorded zero is not zero cost. Inclusive dispatch/RPC timings include native work; report those separately from the measured control segment. This is not a renderer benchmark.

Exact execution hashes include line endings: local `-text` attributes preserve the committed bytes used for CDP and supervisor seals. Do not normalize pinned modules without regenerating the local code anchor and rerunning admission evidence.
