# Ankhimate Editor + PixiJS Alpha

Ankhimate is a Windows editor for 2D skeletal animation. The editor creates rigs
and animations; the separate TypeScript runtime plays native exports in games.
This candidate includes the Windows x64 editor and a PixiJS 8.17.0 WebGL2 adapter.
It is unsigned, local, and intended for review before external alpha testing.

Start with [Getting started](Docs/GETTING_STARTED.md). Open the bundled
**Jade Sentinel**, export its rig, then run **Start-Demo.exe**. No Node.js, npm,
Rust installation or internet download is needed to run the bundled demonstration.
A modern desktop browser with WebGL2 is required. Keep the launcher's console open.

Jade Sentinel is the only official alpha sample: a small procedural technical
character with weighted meshes, FFD, two clips and events, not production artwork.
The sample's authoring filename remains `Sentinelle.ankh`.

- [Documentation index](Docs/README.md)
- [PixiJS integration](Docs/PIXIJS_INTEGRATION.md)
- [Compatibility and exclusions](Docs/RUNTIME_COMPATIBILITY.md)
- [Release notes](Docs/RELEASE_NOTES.md)
- [Troubleshooting](Docs/TROUBLESHOOTING.md)
- [Licenses](THIRD_PARTY_NOTICES.md)
- [AI documentation index](llms.txt)
- [Build and content manifest](distribution-manifest.json)

Normal blending and the documented runtime subset are qualified. Constraints,
linked meshes, non-Normal blending, WebGPU and WebGL1 are outside this candidate.
There is no signed installer, automatic update, macOS or Linux distribution.
See the compatibility matrix before exporting another character.

To report a problem to the maintainer, include the candidate identifier from the
manifest, Windows/browser/GPU versions, exact steps and error text. Share a minimal
project only if you have permission to distribute its assets. Do not send private
files or credentials. Nothing in this archive publishes or uploads a report.
