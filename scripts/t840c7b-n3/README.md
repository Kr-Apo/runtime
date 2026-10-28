# Offline bounded ReplayV1 qualification — T-840C7B-N3

This is **offline tooling**, never imported by `core`, PixiJS or Phaser. It does not change the numerical algorithms, native v1/v2 format, or public ReplayConsumer API. It is not a renderer or an automatic production certificate loader.

The supported scope is an unchanged E1 native v2 export, its exact author project/assets, one closed authored clip, fixed default skin, no external inputs, static default mesh selection, an integer horizon from zero, and the exact enumerated transport histories. Animated FFD/mesh selection/order, linked geometry, non-Physics constraints and other skin schedules are explicitly outside this first tool contract. Existing runtimes remain unchanged.

## Build outside both repositories

Prerequisites: expected clean Editor E1 (`18bfafaf...`), C7A core sources (`fa4e607...`), already installed/pinned TypeScript dependencies, Rust 1.95 and cached Cargo dependencies. Network is not used. Choose NEW work/output directories. Example from the Runtime checkout:

```powershell
node scripts/t840c7b-n3/cli.mjs build --editor <E1-editor> --runtime <C7A-runtime> --work <NEW-build-dir> --target <isolated-Cargo-target>
node scripts/t840c7b-n3/cli.mjs qualify --build <build.json> --project <Character.ankh> --asset <skeleton.json> --fixture <descriptive-id> --clip march --horizon 720 --max-page 256 --trim false --out <NEW-proof-dir>
node scripts/t840c7b-n3/cli.mjs verify --build <build.json> --bundle <proof-dir> --expected <independently-trusted-request.json> --asset <skeleton.json> --project <Character.ankh>
```

The build command compiles unchanged core TS sources into an isolated output (no writes to `core/dist`) and the standalone Rust helper against read-only E1 core/formats/export. The native helper regenerates `skeleton.json` **in memory** using the supplied native export settings and requires byte equality with the input export. It does not save the project or publish textures. The proof output refuses existing directories/files. Build identities include code, lock, binary/modules, compiler, Node/V8 flags and host metadata. No npm/product version changes.

Each ordinary qualification compares every integer tick `0..H`. Four command histories are expanded in full: per-tick committed states, a bulk request with explicit backlog partitions, seek/pause/resume/replay from origin, and a warm-up/reset/cold replay. Intermediate candidate states of bulk/replay are checked against the actual committed per-tick baseline within each engine. Transport endpoints are compared Rust/TS within each history; `playing` and replay-final `paused` are not claimed to be the same transport state. Preview coverage is only the single explicit seek tick, not every possible seek.

`QUALIFIED_BOUNDED` is valid only for these exact identities and histories. The looped clip does not reset Physics state. The certificate never extends beyond its horizon and is not an infinite-loop or arbitrary-command proof. A fault before the requested final tick cannot produce a favorable complete-interval certificate; a separately qualified healthy prefix must name its shorter horizon explicitly.

## Results and verification

`certificate.schema.json` documents the machine-readable result. The executable validator also checks relationships that JSON Schema alone cannot prove: every tick/order, expected bones/records/influences, actual comparisons, history equivalence, full evidence inventory, exact native bytes, and build/parameter/initialization binding.

- `QUALIFIED_BOUNDED`: complete finite evidence, all applicable existing thresholds satisfied.
- `FAILED_NUMERICAL_PARITY`: complete evidence but numerical/transport/history discrepancy.
- `FAILED_NONFINITE`: nonfinite numerical data detected (native markers are explicit, not silently serialized as zero).
- `INVALID_INPUT`: malformed/unsupported/mismatched identities or producer inputs.
- `INCOMPLETE_EVIDENCE`: missing, truncated, malformed or structurally incomplete proofs.

The favorable path requires all evidence. `errors.jsonl` stores every nonzero component discrepancy, including raw/shortest-arc errors, relative errors when defined, and unchanged tolerances. Exact zeros remain recoverable from raw traces and comparison counts. Local matrix errors are diagnostic; no new local-matrix tolerance is invented. Absent mesh/influence families are marked not compared, not reported as measured zero.

The verifier re-hashes all fixed evidence filenames, recalculates the comparisons and difference-log digest, and compares the certificate claims. Changing even whitespace in the native JSON invalidates its byte identity. There is no numerical-canonicalization shortcut. New data, labels, clips, parameters, calendars, builds or horizons require a fresh qualification.

## Trust and isolated admission tests

These are **unsigned local execution records**, not cryptographic authentication of arbitrary producers. A hash alone or a self-declared `QUALIFIED_BOUNDED` does not establish that Rust executed. The qualification command actually runs the identified native binary and TS consumer. Verification checks integrity/consistency of those locally trusted outputs against an independently trusted expected request/build/project; it cannot authenticate a malicious actor who forges every record and expected identity. A future consumer needs trusted issuance/pinned evidence or equivalent authorization. Passing an untrusted bundle's own request as the expected trust anchor does not provide that authorization.

`AdmissionHarness` is an isolated test driver for an already verified bundle. Its callback is a trusted test dispatcher, not a production importer. It enforces the enumerated command cursor and rejects an out-of-horizon target **before** dispatch, including pending backlog; it becomes faulted after an apply/audit failure. It does not activate new behavior in either adapter and must not be used as a generic summary-only certificate permission. B6 remains responsible for preserving accepted numerical state. Production admission/API activation requires a later decision.

## Tests

```powershell
node --test scripts/t840c7b-n3/contract.test.mjs
node scripts/t840c7b-n3/integration.test.mjs <favorable-H12-bundle> <build.json> <native-json> <author-project> <NEW-negative-scratch>
```

The comparator unit fixtures are not real character qualifications. Integration tests use actually executed native/TS evidence, independently expected identities, changed meaningful/nonmeaningful bytes, stale parameters/builds, missing/rehashed/truncated traces, nonfinite markers, forged summaries/tolerances, exact delta-log revalidation and a real consumer with pending backlog/B6 audit rejection. Graphics and weighted-mesh performance remain NOT_RUN.
