# Jade Sentinel

Jade Sentinel is the only official alpha sample. It is original procedural
technical artwork created for qualification, not a commercial art showcase.
The author filename remains [Sentinelle.ankh](Sentinelle.ankh); keep its adjacent
Sentinelle.assets folder. [Sources](Sources/body.png) contains five original PNGs:
body, arm, head, foot and staff. They use jade/gold geometric shapes and alpha.

There are eight bones, seven slots, two meshes with two bone influences per
vertex and two FFD tracks per clip. `idle` is a two-second loop; `attack` is a
1.5-second anticipation/strike/return with impact at 0.75 seconds. Only default
skin and Normal blending are used; no constraints. The body has static dark tint.

[Export/skeleton.json](Export/skeleton.json) and its PNG atlas are a verified
native GUI export, not manually patched data. The demo uses public APIs and two
independent characters. Run Start-Demo.exe at the archive root; see
[Getting started](../../Docs/GETTING_STARTED.md). A fresh export can be selected
by its path inside the extracted archive without editing runtime source.

The alpha revision places the left arm at local X = -28 rather than at the torso
centre, following maintainer review. This was edited and saved in Setup; bone
setup, animation tracks and source images are unchanged. The original T-604b.5.3
qualification project and references remain preserved outside the distribution.

## License and provenance

The five images, project and dedicated sample scripts were created as original
qualification assets in T-604b.5.3 using geometric drawing primitives. They contain
no pixels from Crapaud Pharaon, its private reference, or third-party artwork.
No AI model was integrated. The accepted asset grant permits inspection, use,
modification and redistribution under MIT; see [ASSET-LICENSE.txt](ASSET-LICENSE.txt).
Dependency licenses are separate and are listed in
[Third-party notices](../../THIRD_PARTY_NOTICES.md).
