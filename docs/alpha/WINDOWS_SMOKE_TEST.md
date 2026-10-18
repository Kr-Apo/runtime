# Clean Windows smoke test

Use this exact ZIP on a separate Windows x64 PC without Node.js, npm or Rust.
Record candidate SHA-256 from the supplied checksum, Windows/browser/GPU versions,
and pass/fail plus exact errors for each step. Do not reuse results from an older ZIP.

1. Extract into a writable directory containing spaces and a non-ASCII character.
2. Launch Editor/Ankhimate.exe. Open Jade Sentinel with its adjacent assets.
3. In Animate, play idle and attack; confirm both clips and the visible character.
4. Use Save As into a test subfolder. Make a small reversible edit and use
   File > Quit: confirm Save / Discard / Cancel. Choose Cancel; verify the
   document remains. Undo the test edit and save the copy if needed.
5. Follow Getting Started to export Data / atlas using Ankhimate runtime into
   Exports/Jade-New; read preflight, consent to the documented sample warnings,
   then Publish export. Confirm skeleton.json and atlas.png.
6. Run Start-Demo.exe. Both characters must render. Load
   Exports/Jade-New/skeleton.json in the relative-path field.
7. Disable Alternate clips; play Idle, then Attack. Read impact payload
   int=7, float=0.25, string="jade impact". Crossfade between distinct clips.
8. Pause one character; the other must continue. Resume; change only one speed.
9. Release characters and textures, then Load export again. No blank leftovers
   or errors should remain. Test a missing JSON path; the error must be visible.
10. Disconnect external networking and repeat the browser demo. Loopback remains
    required. Do not change firewall/browser/security policy to force a pass.
11. Close the editor and browser; stop the launcher's console with Ctrl+C.

Report any failure to the maintainer without sending private projects or machine
credentials. These steps are a distribution smoke test, not full regression or
production performance certification. [Getting started](GETTING_STARTED.md).


---
Source-tree note: file locations and runnable browser examples above refer to
the extracted RC2 archive. Download the [complete alpha archive](https://github.com/Kr-Apo/ankhimate/releases/download/alpha-2026.10.18-rc2/Ankhimate-Editor-PixiJS-Alpha-RC2.zip).
Source files here document that same API; GitHub does not execute the demo.
