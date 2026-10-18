# Candidate assembly (maintainers)

No registry access or publication is part of assembly. Use a Windows x64 machine
with the accepted editor and runtime checkpoints, installed Node.js, Python and
Rust 1.95 MSVC toolchain. End users do not need these build tools.

Build the editor release from the protected checkpoint using locked offline
dependencies, static CRT, stripped symbols, source path remapping and a neutral
target directory. Audit PE imports and embedded paths before shipping. Preserve
the existing crate/font/toolchain license collection whose Cargo.lock must match.
Build core and adapters with the lockfile; run Node tests and typecheck.

Run `python release/assemble.py --help` for required explicit artifact inputs.
The script refuses an existing output directory or ZIP. It assembles compiled
modules, docs, a std-only Rust launcher, the one official sample and licenses.
The private adapter's version is not changed. Source maps are omitted and only
sourceMappingURL comments are removed from copied modules; runtime code is not
rewritten. The manifest records both source and distribution hashes.

The sample input must be the accepted Jade Sentinel delivery (projet,
sources-images, export-natif). No generated reference/oracle sets are bundled.
For an explicitly reviewed sample revision, pass --sample-provenance with its
generated file inventory. The assembler checks every input hash and refuses
missing or additional files. The provenance records the authoring change and
the independent Rust API/native GUI export comparison; it is not a new format.
Supply the license collection from the accepted Windows package and confirm its
Cargo.lock hash against editor build provenance; the script fails on a mismatch.
It also collects the installed PixiJS dependency closure's license texts, including
packages conservatively included even if tree-shaken from Pixi's browser bundle.

The distribution manifest and SHA256SUMS are generated. Archive timestamps and
compiler output are not promised bit-for-bit reproducible. The publisher does not
sign, tag, push, upload or overwrite an older archive. Smoke-test the actual ZIP
after extraction; passing source tests alone does not qualify distribution.

The launcher is a read-only static server, not a production web host. It binds
127.0.0.1 on a random port, requires its exact Host header, confines canonical
paths, rejects Windows streams/traversal, limits requests and has socket timeouts.
It does not implement uploads, writes, a proxy, authentication or telemetry.
Its CSP confines the demo's connections to itself. unsafe-eval is required by
Pixi's generated shader/uniform code, not a bypass of browser CORS controls.
Keep the extracted folder trusted: this is not a sandbox against local processes
changing files or reparse points during a request. Close the console to stop.
