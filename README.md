# Ankhimate Runtime — local fork preparation

Kr-Apo Community Fork (Unofficial), derived from [Ankhimate/runtime](https://github.com/Ankhimate/runtime), MIT OR Apache-2.0 with upstream credits preserved. This T838 copy changes documentation only. The protected source checkpoint is c4c38df269cfcb30f941221454b7202f40d3fa5b; no new runtime release/package exists.

The compatible editor candidate is product0.1.5; this does not change npm versions: @ankhimate/runtime, @ankhimate/pixi-runtime and @ankhimate/phaser-runtime remain0.2.0-alpha.1. Native exportv2 and the v1/v2 reader contract are unchanged. See [editor/runtime compatibility and minimal loading](docs/t838-editor-compatibility.md) and the existing examples. PathPosition remains unsupported; do not bypass editor export refusals.

New community Editor/Runtime forks have not been created. Future URLs are intentionally unset. Do not use the deleted former Kr-Apo fork links as installation destinations. Existing package.json repository/homepage/bugs fields describe the historical packages and must be explicitly reviewed once new repository URLs are authorized, before any npm publication. No functional/package metadata/version change is made here.

For an approved source clone: npm ci, npm run build, npm run typecheck, npm test. Graphics scripts and their prerequisites are separate opt-in qualification;37 protected precompiled core tests replayed in T838 are not a fresh full adapter build. Existing PixiJS8.17.0/Phaser3.90.0 qualification is bounded to its recorded fixtures. Advanced constraints/physics/linked meshes and arbitrary blending do not have universal parity. No new inference/GPU/hardware qualification is claimed.

Retain LICENSE-MIT, LICENSE-APACHE and dependency/asset attributions. Source history and earlier README content remain in Git. No push, fork creation, tag, npm publish or release is authorized in this preparation.
