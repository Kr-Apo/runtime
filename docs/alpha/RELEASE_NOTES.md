# Ankhimate Alpha â€” Windows + PixiJS

**Experimental pre-release Â· Windows x64 Â· PixiJS 8.17.0 / desktop WebGL2**

Distribution identifier: **alpha-2026.10.18-rc2**. This is not a stable release. The component
versions are unchanged: editor crates 0.1.0, TypeScript core 0.1.1, private PixiJS
workspace 0.0.0. This release does not publish an npm package.

## Try the alpha

Download `Ankhimate-Editor-PixiJS-Alpha-RC2.zip`, verify its SHA-256 and extract the
complete folder. Run `Editor/Ankhimate.exe`, open Jade Sentinel, then run
`Start-Demo.exe` to play the native export in a desktop WebGL2 browser. Keep the
console open while using the local demo. No Node.js, npm, Rust installation or
internet download is needed to run the shipped example.

**The Windows executables are unsigned.** Follow Windows security decisions;
this release does not ask you to bypass warnings on untrusted files.

Jade Sentinel is the only official sample: original procedural technical art,
weighted meshes, FFD, `idle` and `attack` clips, and an observable impact event.
Its authoring filename remains `Sentinelle.ankh`; keep its `.assets` folder.

## What is qualified

Within the documented subset: native runtime v2, bones, regions, rigid and
weighted meshes, matching FFD, animation playback/looping, events, distinct-clip
crossfades, compatible authored skins, static dark tint and sequential polygon
clipping with Normal blending. Jade uses only default skin; alternate skins and
clipping have separate historical qualification evidence, not a new Jade demo.

## Known limits

- Experimental alpha; no guarantee for every project, GPU, driver or browser.
- Only a Windows x64 editor binary is distributed. Mobile is not qualified.
- PixiJS uses desktop WebGL2; WebGPU, WebGL1 and Canvas are outside the profile.
- Advanced constraints/physics, linked meshes and Add/Multiply/Screen are excluded
  from this PixiJS profile. Editor support does not imply runtime support.
- Interrupting a crossfade can visibly change the pose. Finish a fade before
  starting another when continuity matters.
- Events at t=0 are ignored, including loop boundaries. Audio event fields are
  data only; the runtime does not play sound automatically.
- Phaser sources/tests remain in the runtime repository but are not officially
  qualified as part of this distributed alpha.
- Project/export recovery has documented filesystem crash limitations; keep
  independent backups. There is no automatic update or signed installer.

## Documentation and source

- [Getting Started](https://github.com/Ankhimate/ankhimate/blob/main/docs/alpha/GETTING_STARTED.md)
- [PixiJS Integration](https://github.com/Ankhimate/ankhimate-runtime/blob/main/docs/alpha/PIXIJS_INTEGRATION.md)
- [Compatibility](https://github.com/Ankhimate/ankhimate-runtime/blob/main/docs/alpha/RUNTIME_COMPATIBILITY.md)
- [Native v2](https://github.com/Ankhimate/ankhimate-runtime/blob/main/docs/alpha/FORMAT_V2.md)
- [Troubleshooting](https://github.com/Ankhimate/ankhimate/blob/main/docs/alpha/TROUBLESHOOTING.md)
- [Runtime source](https://github.com/Ankhimate/ankhimate-runtime) Â· [Editor source](https://github.com/Ankhimate/ankhimate)

The same integration guides are inside the ZIP. Its review-era wording remains
unchanged to preserve the tested bytes; this pre-release notice records the
maintainer's subsequent authorization for public alpha testing. No engine or
asset change was made for publication.

## Validation scope

Accepted RC2 evidence includes archive extraction, Windows native GUI export,
independent Rust/PixiJS comparisons, playback/events/crossfades, resource cleanup
and local offline operation. The maintainer reports six of six acceptance checks
passed on a second Windows PC on 18 October 2026 (RTX 2060, Brave; exact OS build
and browser/driver versions not recorded). Historical regression suites retain
their accepted evidence; not all were rerun during packaging or launch preparation.

## Feedback and license

Use the [bug template](https://github.com/Ankhimate/ankhimate/issues/new?template=bug_report.md). Include this
distribution identifier, environment, exact steps and a minimal original
reproduction you may publish. Redact personal paths; never attach credentials,
private projects or proprietary assets. For vulnerabilities, read
[SECURITY](https://github.com/Ankhimate/ankhimate/blob/main/SECURITY.md) and use private reporting.

Ankhimate code is MIT OR Apache-2.0. The archive includes complete dependency,
font and toolchain notices plus Jade Sentinel's MIT asset grant. Preserve them
when redistributing the archive.

The MPL-2.0 dependency `option-ext` 0.2.0 has unmodified source available at
[crates.io](https://crates.io/api/v1/crates/option-ext/0.2.0/download).
See the accompanying `THIRD_PARTY_SOURCE_NOTICE.md` for the locked source checksum
and dependency/font license details. Ankhimate's own license does not relicense
those dependencies.

## Exact download

File: `Ankhimate-Editor-PixiJS-Alpha-RC2.zip`

Size: **14,443,905 bytes**

SHA-256: `a1c9835fbe83468f6e87bdd5676965a45210c4913305fc18b72c9d426b9553c0`

Check the separate `SHA256SUMS.txt`. These bytes are the previously accepted RC2;
repacking, changing any executable/content or replacing assets requires a new
candidate and appropriate retesting.
