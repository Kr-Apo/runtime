# T-840C9-A3 — Weighted FFD ReplayV1

Decision: **GO for this experimental vertical slice**, subject to human review. No stable npm API or general numerical certification is claimed.

## Scope and source

Runtime parent: `e8eaa0c2ac5343effc076c4aa4795b3ab7ddb188` (I2). Local branch: `dev/t840c9-a3-weighted-ffd-replay`. Author/export reference: read-only Editor A2 `1f76349731e2242376b61880ac427267fd0712b9`; E1 `18bfafaf0973bf74a570324ea637ead2238256cc` is preserved.

The opt-in `{weightedFfd:true}` carries a detached, validated FFD payload in each accepted ReplayV1 frame. Physics equations, scheduler, native v2 and Legacy rendering remain unchanged. The existing I2 actor owns one consumer. G1/G2 views retain their double banks, atlas projection, textures and resource ownership; they consume accepted offsets and cache only setup bind conversions. There is no presentation-time Physics evaluation or FFD key sampler.

## Authentic positive fixture

`experimental/weighted-ffd/fixtures/author/Impact-Frog.ankh` and its asset directory are a new isolated author project. Six bones, nonidentity setup transforms, one displayed weighted mesh, per-vertex influence counts 2/3/5/0, a zero coefficient retained in a positive row, a non-unit sum, active Physics, one fixed default skin and a 1.5-second looping clip. Five authored FFD keys implement rest, transition, impact, a Stepped boundary and return.

`tools/weighted-ffd-reference` uses the actual A2 formats/save/load, document rebind, exporter preset and staged native publisher. The complete project is saved/reopened with schema equality, then exported unchanged to native v2. This is a headless author API test, not a GUI authoring qualification. No native JSON was patched for positive tests. A second independent generation produces identical project, export, PNG and Rust reference bytes.

## Evidence and outcome

- RED: I2 rejects the real deform track with `B4 unsupported clip channel deform`; see delivery `RED-admission.log`.
- GREEN: 502 full workspace JavaScript/TypeScript tests, including 34 new A3 core cases; 10 additional geometry cases.
- 721 independent Rust/TypeScript accepted frames: maximum world vertex error **0.0000218191**, offset error **0.00000689951**; limit **0.01** unchanged.
- 50 WebGL2 poses (44 transparent and 6 opaque), real GPU vertices/UVs/indices, 50 CPU pixel comparisons and 50 cross-engine comparisons pass unchanged policies.
- 72 non-FFD I2 GPU captures are byte-identical to accepted I2 captures. B3/B4/B5B2/B6 numerical traces are byte-identical to N6 regressions.
- Real RAF playback, pause/resume, reload, concurrent loading, shared pages, independent actors, Scene/Game disposal and context loss/restoration pass. Restored GPU geometry is checked explicitly.
- 50,825 historical protected files (61,632,764,928 bytes) verified unchanged; RC2 SHA-256 remains `a1c9835fbe83468f6e87bdd5676965a45210c4913305fc18b72c9d426b9553c0`.

See the other five reports for contracts, measurements and exclusions. The local delivery folder contains raw results, failed attempts, source fingerprints, independent references, full patch, Git receipts and runnable demos. Its `COMMIT.json` identifies the final local checkpoint. Nothing is pushed or published.

## Changes

Core: `replay-ffd.ts`, optional frame/options propagation in physics/animation/transport/consumer, a small reusable sampler entry in `evaluate.ts`, explicit exports and A3 tests. Experimental: cached geometry mapper, two narrow factories, author fixture, standalone builder; default-off hooks in existing loader/actor/G1/G2 validation and views; the I2 demo coordinator displays FFD status when enabled. Existing I2 builders include the new static import dependency. Rust reference tool and this documentation are additions only. No Editor source or historical reference is staged.

## Limits

One fixed default skin, one clip, weighted non-linked FFD, static topology and Normal blending. Missing/empty deform tracks yield rest. Empty influence rows stay rigid; nonempty zero-total rows are refused. Other timeline families, dynamic skins+FFD, links, clipping, sequences, mixing and pure seek preview remain refused. Origin replay is explicit and supported. Geometry extremes outside this measured fixture are not certified merely by passing structural admission. See NEXT.md; no next slice has been started.
