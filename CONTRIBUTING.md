# Contributing

Small, reproducible changes are welcome. Explain the user-visible problem,
the affected release/commit and the verification performed. Discuss larger work
before implementation; do not treat every editor feature as a runtime promise.

## Safety and scope

Contribute only code and assets you may redistribute. Do not copy, translate or
closely paraphrase another animation editor's source. Describe behavior and use
original implementations. Preserve existing copyright and dependency notices.
If you have read the source of a GPL-licensed animation editor, do not contribute
to the matching Ankhimate feature; choose a different task.
For this repository's code, contributions are MIT OR Apache-2.0 unless explicitly
agreed otherwise. Dependency and sample-asset licenses remain separate.

Never attach private projects, credentials, access tokens, local configuration or
unredacted personal paths. Construct a minimal synthetic rig where possible.
Keep `.ankh` assets alongside any shareable project. Include only the files needed
to reproduce; verify ownership before posting screenshots or sample artwork.

## Changes and validation

Keep changes focused and add a regression before a confirmed bug fix. Explain
which checks were run and which historical evidence was retained. UI changes
need relevant interaction checks; rendering changes need numerical/pixel evidence,
not just screenshots. Do not update reference outputs simply to make tests pass.

Use explicit staged paths and review the complete diff. Do not include generated
build/cache files, backups, private recordings or dependency directories.
Do not introduce a new format version, package publication or release asset as an
incidental part of a fix. Read SECURITY.md for vulnerability reporting.

## Runtime commands and compatibility

Use Node.js 22+ and `npm ci` with the lockfile.

```sh
npm run build
npm run typecheck
npm test
```

For adapter changes, run the appropriate `test:pixi-*` or Phaser test scripts in
package.json using Playwright's matching browser. Some qualification scenarios
need external Rust-generated references; document their prerequisites rather
than inventing missing fixtures. Keep source API compatibility, independent
per-instance state, resource ownership and v1/v2 core reader regressions intact.
The alpha Pixi renderer accepts explicit v2 only. Never waive a target rejection
to advertise unsupported physics, constraints, linked meshes or blending.
