# Local alpha runtime snapshot M006.1

The canonical capability matrix is editor/docs/alpha-scope.md, copied unchanged
into the Windows candidate as docs/alpha-scope.md. This file records packaging,
not a second capability matrix. Snapshot **m0061-8888e0e** contains runtime code
8888e0e74ad642818c076c6446cca3d9358dd05f, including static dark tint (M005.3b),
FFD time precision (M005.4b1), GPU skin UV refresh (M005.4b2), and clipping (M005.4b3).

Package labels remain core 0.1.1 / Phaser adapter 0.1.0. Phaser is pinned to
3.90.0 and fflate to 0.8.3. These are local snapshots, not published packages.
Use the two *m0061-8888e0e.tgz archives and vendor/provenance.json SHA-256 hashes
in examples/phaser-game; its lockfile pins their SHA-512 integrity. Older vendor
archives and historical dark-tint examples are retained as historical proofs,
not the complete current candidate. Never infer contents from package labels.

From a built checkout with the example dependencies installed:

```powershell
npm ci
npm run build
npm --prefix examples/phaser-game ci
npm --prefix examples/phaser-game run check
node scripts/prepare-alpha-game.mjs <new-output-directory>
```

The preparation verifies source/dist/archive hashes and copies only browser JS,
local dependencies, real exported assets, licenses and a loopback server. The
prepared game requires Node 22+ (tested 24.18.0), but no npm installation, global
package or TypeScript build. Launch `node server.mjs` and visit the printed URL.
The editor binary itself needs none of Node/Rust/Cargo. No double-click or file://
launch is promised. The preparation does not publish anything.

format_version remains 2; v1 reading is retained. Old incorrectly serialized
nonlinear FFD v2 exports require re-export from their authoring project.
Native physics is incompatible: Rust writes the simulated bone to target with
bones empty, while TS requires bones[0], so it does not activate. Advanced paths,
non-Normal composition, inherited linked deform, linked chains, multi-skin
compositions and arbitrary concave clipping remain outside the alpha guarantee.
Static dark tint Normal is qualified only for this exact snapshot combination;
other consumers require explicit fidelity consent. Do not remove preflight warnings.
