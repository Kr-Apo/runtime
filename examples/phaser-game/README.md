# Ankhimate × Phaser — independent local game

A small playable proof using only public runtime/Phaser APIs. Move with Left /
Right or A / D to collect five stars. The buttons select the actual `walk` and
`leg_ik` clips; Space switches between them with a 0.25-second crossfade.
The footstep counter shows real exported event names and payloads.

The separate geometric character is the real tagged_rig PSD export, playing
`animation_1` and its attachment sequence. It has one clip, not invented idle or
walk animations. The test art is intentionally simple, not a production character.

## Run on Windows

Tested with Node 24.18.0. Node 22+ is required. From this folder:

```powershell
npm ci
npm run check
npm start
```

Open **http://127.0.0.1:4173**. Stop the local server with Ctrl+C. To use another
port, set `ANKHIMATE_PORT` before starting. A WebGL-capable browser is required.
Do not open `index.html` with `file://`: JSON, textures and ES modules need HTTP.
There is no CDN, telemetry service, editor process, build server or API key.

This folder can be copied outside the runtime repository and run with the same
three commands. Its own lockfile pins Phaser 3.90.0 and all transitive packages.
The included runtime archives are built locally from renderer code commit
`8888e0e74ad642818c076c6446cca3d9358dd05f` (snapshot m0061-8888e0e), including
the M005.3b/M005.4b1/b2/b3 fixes.
They are intentionally included so the example does not depend on a future npm
release or on links back into this checkout.

`vendor/provenance.json` records SHA-256 hashes of those archives and of the
unchanged real JSON/atlas exports. `npm run check` verifies them. Package labels
remain core 0.1.1 / Phaser adapter 0.1.0; labels alone do not identify these
unreleased fixes. No package is published by the launch/check commands.

## Code to read

- `src/game.js`: load exported JSON, preload every atlas page, construct
  `PhaserRig`, position the public `root`, update in milliseconds, crossfade and
  consume `player.events` immediately after each update.
- `index.html`: browser import map for the public package entry points.
- `server.mjs`: local-only static server; it does not import parent repository
  code or serve files outside this project.
- `assets/`: byte-identical copies of the real M002 exports, never patched to
  compensate for renderer behavior.

The integration guide in the repository's `docs/psd-to-phaser.md` explains how
to author and export your own PSD rig. A copied standalone folder contains this
guide as `INTEGRATION.md` too.

## Reproduce the five-minute acceptance test

From the **runtime repository root**, after root `npm ci` and this folder's
`npm ci`, set a browser path if Playwright Chromium is not installed:

```powershell
$env:ANKHIMATE_BROWSER_PATH = 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe'
npm run test:game
```

The runner presses actual keys and buttons, checks movement/collection and both
clips, then observes at least 300 seconds of **wall time and advancing playback**.
It fails on JavaScript errors, browser warnings, failed resources, stalled
playback or missing events. Captures and JSON go to `test-results/game/`.
`ANKHIMATE_TEST_OUTPUT` changes that directory. A shorter development smoke run
can set `ANKHIMATE_SOAK_SECONDS=5`; it does not satisfy the five-minute gate.
The passive `window.ankhimateExample` telemetry is for this test, not a runtime API.

## Limits

No audio file is provided; footstep events are displayed, not synthesized into
sound. Crossfade events follow the incoming clip; `leg_ik` has no authored
events. Looping follows each exported clip's `looping` flag. There is no API in
this example for inventing a missing clip or repairing an old lossy export.
Dark tint, physics-driven visuals and complex mesh deformation are not qualified
by this game. See the guide for the exact compatibility and visual coverage.

## Prepared Windows candidate

The candidate ZIP contains browser-ready copies of these exact local archives.
Run `node server.mjs` from its game folder; no npm/global package or TypeScript
build is needed there. Node is a separate prerequisite, not included. The editor
EXE needs neither Node nor Rust. See ../../docs/alpha-snapshot.md for preparation
and the canonical editor alpha matrix for supported cases and exclusions.
