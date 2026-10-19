# Building the local T-811 candidates

No publication command is part of this procedure. Proposed version 0.2.0-alpha.1
must be approved together with the documentation and new archive. Never alter RC2.

Clone the maintainer forks into new directories, recurse the pinned editor
`community-plugins` submodule, and select the reviewed candidate commits. Do not
push private source histories. The candidate records a content-only integration
from editor b299d04 and runtime 2b149cb onto public 8badcc0 / c620ddd.

Use pinned Rust 1.95/MSVC and the committed npm lockfile. Run fmt, workspace Rust
locked/all-targets tests, Clippy, workspace build, core WASM and `xtask docs-check`.
Generated reference Markdown must be LF (the candidate adds a targeted Git rule).
For runtime: npm ci, tests, build, typecheck, check:syntax, the 457-snapshot compare
and matching local package install/type/ESM checks. No ESLint is configured.

For a portable Windows release, use `cargo build --locked --release -p ankhimate-editor`
with `-C target-feature=+crt-static`, stripped symbols, no debug info,
`-C link-arg=/PDBALTPATH:Ankhimate.pdb`, and remap Rust source/home/build prefixes
to neutral paths. Also set the MSVC native C flags via
`CFLAGS_x86_64_pc_windows_msvc=/experimental:deterministic /pathmap:<absolute-cargo-target>=native-build`:
QuickJS C assert paths are UTF-16 and Rust remapping alone does not remove them.
Audit both ASCII and UTF-16 strings and PE imports; do not patch binary bytes.
No VC-runtime redistributable imports are allowed in the portable profile.

Assemble the verified binary, matching compiled runtime modules (including nested
`core/render`), the already-licensed local demo launcher and pinned browser bundles,
Jade Sentinel only, current English docs and current Windows normal/build dependency
notices. Keep the project's assets/export bytes unchanged. Include the
`@ankhimate/runtime/render` mapping in browser import maps. Source-map comments may
be removed from distributed JS only with source/destination hashes in the manifest.
Do not ship node_modules, target, FFmpeg, models, credentials, logs or private projects.

Generate checksums and manifests, create a new ZIP exclusively, extract to an
isolated path and verify all hashes, module references, licenses and archive
contents. Record manual GUI/clean-PC checks as pending until performed. Historical
`release/alpha` / old packaging scripts describe RC2 and must not be used blindly
for this candidate. No tag, push, npm publish, Actions change or Release is authorized.
