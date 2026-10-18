# Local alpha candidate release notes

This candidate combines the protected Windows Editor checkpoint with the accepted
PixiJS runtime snapshot and a single Jade Sentinel example. Exact build IDs,
component versions and content hashes are in the generated
[distribution manifest](../distribution-manifest.json).

## Included

- Windows x64 editor, existing authoring/save/recovery/export behavior unchanged.
- Native v2 export and the local PixiJS 8 WebGL2 adapter.
- Jade Sentinel author project, five procedural source images and verified export.
- Two-instance browser demonstration with independent controls, events and fades.
- Read-only loopback launcher and offline browser dependencies.
- English first-run/API/format/compatibility/troubleshooting guides and AI index.

No runtime algorithm, export format, component version or editor functionality is
changed by release integration. Historical development samples remain in source
control but are not additional official alpha samples.

## Verified limitations

Crossfade interruption can jump (up to 11.8049 world units in the Jade controlled
case). Events at t=0 are ignored. This candidate does not add completion callbacks,
sound playback, multi-skin composition or intersecting nested masks. Generic
editor export qualification warnings remain visible and require explicit consent.
Unsupported target features fail instead of being silently approximated; see the
[matrix](RUNTIME_COMPATIBILITY.md). Jade is technical art, not a production rig.

## Distribution status

Unsigned Windows only. No installer, automatic updater, macOS/Linux package or
public npm adapter release. The candidate is not approved for publication.
The separate validation report records the actual extracted-archive checks and
any remaining clean-machine or release blockers. Previous clean-PC results from
another archive do not qualify this one. The
[external checklist](WINDOWS_SMOKE_TEST.md) must be run against this exact ZIP.

This release-scoped work does not complete all historical T-801, T-802, T-702,
T-709 or T-605 acceptance criteria, nor implement a new format migration.
