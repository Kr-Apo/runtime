# Ankhimate static dark tint — independent Phaser example

From this directory:

```powershell
npm ci
npm run check
npm start
```

Open the printed loopback URL. Arrow keys move the rig; `pulse` / `alternate`
buttons crossfade over .25 seconds. Space changes clips. The status displays real
exported `step` events. The canvas is transparent over a CSS checkerboard.

`assets/` is a byte-identical real native export from the M005.3a Rust preset,
with four atlas pages. No exported JSON is patched. The new runtime applies the
static dark RGBA and interpolates the authored light-color curve. It uses public
`parseRig`, `PhaserRig`, `root`, `RigPlayer` seek/crossfade and event APIs only.
Passive test telemetry does not change rendering or export data.

`vendor/` contains unpublished local core 0.1.1 / adapter 0.1.0 tarballs with the
M005.3b code. **Those version labels alone do not identify this implementation.**
Their exact SHA-256 hashes, source identity and real export hashes are recorded
in `vendor/provenance.json`, checked by `npm run check`. The lockfile pins the
archives, fflate and Phaser **3.90.0**. Nothing is published by these commands.
The folder runs independently of the editor and runtime checkouts after install.

From the runtime repository root, test an installed standalone copy with:

```powershell
$env:ANKHIMATE_BROWSER_PATH = 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe'
$env:ANKHIMATE_DARK_EXAMPLE_DIR = '<absolute-example-directory>'
npm run test:dark-tint-game
```

The default is at least 300 seconds of wall time **and** advancing playback.
Events, loops, clip changes, keyboard movement, resource failures, JS errors and
warnings are checked. Thirty destroy/recreate cycles must preserve GPU wrapper,
pipeline, mesh and scene-object counts; these counts remain bounded throughout.
`ANKHIMATE_SOAK_SECONDS=5` is a smoke test only. Captures/JSON default to
`test-results/dark-tint-game`; `ANKHIMATE_TEST_OUTPUT` overrides it.

Normal, static normalized dark tint, regions/unweighted mesh, light animation,
atlas pages and filtered borders are qualified by the dedicated CPU/WebGL suite.
Add/Multiply/Screen are qualified only by opaque-background Phaser equation
probes, not this transparent demo or general Rust parity. No physics, arbitrary
complex deformation, Canvas/Phaser 4 or general two-color-tint fidelity claim.
See `QUALIFICATION.md` for the full tested contract and remaining limits.
