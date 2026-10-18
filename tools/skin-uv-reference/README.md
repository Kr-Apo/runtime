# Skin UV regression oracles (M005.4b2)

Test tooling only. Requires the sibling `editor` checkout at
`17d85aec3da14e82d3e7f1d5b65cea1844c8619c`; it adds no runtime dependency.
From the runtime repository, choose a **new**, nonexistent output directory:

```powershell
cargo run --manifest-path tools/skin-uv-reference/Cargo.toml --locked --offline -- phaser/test/fixtures/skin-uv/source.json C:/temp/ankhimate-skin-uv-new
cargo fmt --manifest-path tools/skin-uv-reference/Cargo.toml --check
cargo clippy --manifest-path tools/skin-uv-reference/Cargo.toml --locked --offline -- -D warnings
```

The input is the M005.4a `skins` authoring fixture. `audit-same-light` reproduces
its original native `skeleton.json` byte for byte (SHA-256 recorded in
`phaser/test/fixtures/skin-uv/provenance.json`). The other eight cases add a
region/mesh × one/two atlas pages × light/dark tint matrix. Their textures have
different source dimensions, and their running clip changes attachment at 0.5 s
and 0.75 s. All atlas PNGs and runtime JSON come from `run::plan` / `run::write`;
the generated JSON is never patched.

Each case includes eight independently evaluated Rust poses and CPU PNGs:
default/alternate at 0, 0.25, 0.5 and 0.75 s. `evaluate_skinned` selects the
authored skin. Since `render_frame` intentionally renders the document's default
skin, the oracle document temporarily selects that same default for the CPU
reference only, restoring it afterwards. This does not change the already
exported native data, or extend the supported skin scope of PNG/spritesheet
exports. Compare regenerated files against the recorded fixture bytes; do not
automatically accept changed reference hashes.

```powershell
npm test
npm run test:skin-uv
```

The WebGL runner uses Playwright and Phaser **3.90.0**. Set
`ANKHIMATE_BROWSER_PATH` to an installed Chromium browser if needed and
`ANKHIMATE_TEST_OUTPUT` to a new evidence directory. It requires a working WebGL
context and fails on browser warnings, errors or missing resources. Private mesh
inspection and GL instrumentation belong only to the test harness; playback and
skin changes use public runtime APIs.
