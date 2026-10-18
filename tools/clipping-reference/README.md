# Clipping reference generator — M005.4b3

Test-only tool. Requires the sibling editor at
`17d85aec3da14e82d3e7f1d5b65cea1844c8619c`. No product dependencies are added.
Choose a new output directory; existing directories are refused:

```powershell
cargo run --manifest-path tools/clipping-reference/Cargo.toml --locked --offline -- phaser/test/fixtures/clipping/sources C:/temp/ankhimate-clipping-new
cargo fmt --manifest-path tools/clipping-reference/Cargo.toml --check
cargo clippy --manifest-path tools/clipping-reference/Cargo.toml --locked --offline -- -D warnings
```

Five authoring sources come unchanged from the M005.4a audit. Their real native
JSON and atlas PNGs reproduce byte for byte. Eleven additional authored cases
cover closing slots, animated attachments/visibility, sequential clip groups,
meshes, multiple atlas pages, dark tint, draw order and a simple concave polygon.
All native files come from `run::plan` / `run::write`, without JSON edits.

The independent CPU reference uses Rust authoring wrapper bones to express the
declared Phaser Container/ancestor transforms and camera scroll/zoom/rotation in
Y-up coordinates. The original animation is evaluated by Rust; clipping and
rasterization remain `ankhimate-render`. The wrapper document is used only for
the CPU oracle, never to patch a runtime export. Every mode has four references
at 0, 0.25, 0.5 and 0.75 s, plus explicit inside/masked/after probes.

Compare the 395 regenerated files byte for byte against the fixture tree before
accepting a reference update. `provenance.json` also pins the five original source
files and LF-normalized generator sources. Existing reference hashes are not
automatically refreshed by the test runner.

```powershell
npm test
npm run test:clipping
$env:ANKHIMATE_CLIPPING_CONCAVE='1'
npm run test:clipping
```

The default runner covers 296 rectangular poses and two resource stress cases.
The separate concave run covers 32 poses of the supplied simple L only. Neither
claims general support for arbitrary concave, malformed or nested polygons.
`ANKHIMATE_CLIPPING_CASES` can select comma-separated fixture names. Set
`ANKHIMATE_BROWSER_PATH` to an installed Chromium browser and
`ANKHIMATE_TEST_OUTPUT` to a new proof directory when necessary. Phaser is pinned
to 3.90.0; a real WebGL context is required. Any browser warning, error, missing
resource or pixel failure makes the run fail.

`ANKHIMATE_BASELINE_DIST` may point to a saved pre-fix build with `core/` and
`phaser/` compiled modules. This serves the exact old modules for red evidence;
the native exports are unchanged. GL instrumentation/private view inspection is
test-only; product operations use public runtime and Phaser APIs.
