# Q1: immutable dynamic-skin numerical qualification

Experimental local tooling, separate from the fixed N3/N5 contracts. This is not
an npm entry point, graphical renderer, public attestation service or general
Physics guarantee. Existing core, fixed certificates and banks are unchanged.

## Contracts

- Offline request/certificate: `ankhimate.replay.dynamic-skins/1`.
- Chrome request/certificate: `ankhimate.browser.dynamic-skins/1`.
- Chrome raw trace: `ankhimate.browser.dynamic-trace/1`.
- Admission bank: `ankhimate.chrome-dynamic-skin-bank/1`.
- Independent launcher anchor: `ankhimate.chrome-dynamic-skin-anchor/1`.

`schedule.schema.json` describes a nonempty array of `{tick, skin}`. Ticks are
exact JSON integers in `0..H`, `H <= 8388607`; first tick is zero, ticks strictly
increase, and skins must exist. The executable validator enforces relationships
not expressible in the schema. Conversion to Rust u64 / TypeScript bigint is
exact. Events are absolute in the epoch, installed once at construction, not
re-injected when the authored animation loops. Reset/replay uses the same
immutable calendar. No runtime `setSkin` operation is admitted.

The entire schedule, exact native bytes, author project/assets, clip, Physics
definitions, origin, horizon, four command transcripts, producer builds and
qualifier source identities bind the request. Changing one event invalidates it.
Do not turn a fixed certificate into a dynamic certificate by editing JSON.

## Reproduction

Use Node 24.18.0 and the installed locked TypeScript/Playwright dependencies.
Build the standalone reference against the clean Editor E1 checkpoint and the
unchanged runtime core (paths below are explicit caller inputs):

```text
node scripts/t840c7c2-q1/cli.mjs build --editor <E1> --runtime <runtime> --work <new-build> --target <new-target>
node scripts/t840c7c2-q1/cli.mjs qualify --build <build.json> --project <Character.ankh> --asset <skeleton.json> --fixture <id> --clip march --horizon 256 --max-page 256 --trim false --calendar <calendar.json> --out <new-offline-folder>
node scripts/t840c7c2-q1/cli.mjs verify --build <build.json> --bundle <offline-folder> --expected <request.json> --asset <skeleton.json> --project <Character.ankh>
```

Fresh output directories are mandatory; evidence is never overwritten. The
standalone native helper supports `prepare <source.ankh> <new-output> regions`
or `combined`: native load, optional native mesh creation/bind, save, reload,
standard E1 export. It never merges runtime JSON. The reference regenerates
the native export and requires byte equality before qualification.

`browser-run.mjs` exports `campaign(config)`; use the archived Q1 driver/config
with `buildPath`, `dependencyRuntime`, exact historical `fixedAnchor`, `chrome`,
new `browserOut`, and cases `{id, native, project, offline}`. Chrome must match
the historical binary/flags/host identity. `proof.mjs.verify` requires independent
expected request/build/browser and real Rust bytes, then recalculates all claims.

Tests (explicit fixture config and fresh scratch/output paths):

```text
node scripts/t840c7c2-q1/contract.test.mjs <approved-config.json>
node scripts/t840c7c2-q1/proof.test.mjs <approved-config.json> <new-scratch>
node experimental/dynamic-skin-bounded/admission.test.mjs <approved-config.json> <new-output>
node experimental/dynamic-skin-bounded/fault-bypass.test.mjs <negative-config.json>
```

`native-fault.rs` is a separate diagnostic executable using real E1 Consumer
rollback. Never compile it over the favorable producer binary. It is not a
qualification reference or new product API.

## Observations and bounds

Actual committed Consumer frames provide skin, bones, records, clock, health and
transport state. Candidate PhysicsFrame observers do not expose a skin field:
candidate attachment/membership projections use the approved immutable calendar
at candidate tick, plus actual candidate bones and records. Every step tick and
all committed endpoints independently check actual ConsumerFrame.skin. The full
step baseline and all candidate transcripts are compared, including reset.

Attachments resolve by native slot/name, selected skin then native default
fallback; numerical membership uses native inactive-member rules, never that
graphical fallback. Missing attachments, varying mesh vertex counts and influence
identities are explicit. Projection contains no Physics solver.

Historical numerical limits are imported unchanged. `localMatrix` is a derived
diagnostic with no independent historical threshold; local transforms and world
matrices retain their existing gates. Cross-engine derived trig is not promised
bit-identical. In-engine history equivalence and Chrome admission candidate
audits are exact.

Q1 admission covers only independently pinned finite requests/transcripts. The
approved pilot covers Courier regions and a real saved/reopened E1 combined
region/weighted-mesh project, two calendars, four histories, H256 inclusive.
No FFD, linked meshes, other constraints, arbitrary commands or host-time are
qualified. Graphical C7C2 work requires a distinct maintainer decision.
