# Getting started on Windows

## Extract and start

Extract the complete ZIP into a writable folder. Do not run it inside the ZIP.
Spaces and Unicode are supported in the extraction path. Keep the directory
structure intact. Launch `Editor/Ankhimate.exe` (inside the downloaded archive).
The binary is unsigned; this guide does not ask you to bypass Windows security.

Use **File > Open…** (or startup **Open…**) and select
`Examples/Jade-Sentinel/Sentinelle.ankh` (inside the downloaded archive).
Keep `Sentinelle.assets` alongside the project. The five source drawings in
`Sources` are also included; the project uses the content-addressed asset copies.
Use **File > Save As…** into a separate folder before making your own changes.

## Setup and Animate

**Setup** edits the rig's rest structure. **Animate** edits animation poses.
Switch to **Animate** and use the clip dropdown to select **idle** or **attack**.
The timeline's play triangle starts playback; the playhead can be scrubbed.
`idle` is 2 seconds and loops; `attack` is 1.5 seconds with an impact at 0.75 s.
The project has eight bones, seven slots and two weighted meshes with FFD.

## Export native runtime v2

Open the **Export** dock (cube icon; it is also available from **View > Export**).
Choose **Data / atlas**. The saved sample already has an **Ankhimate runtime**
preset; if none is present use **+ Preset > Ankhimate runtime**. Keep atlas baking
enabled. Do not select Image sequence or Spritesheet for skeletal runtime playback.

Click **Export…**. In the Windows **Export to** dialog choose a new folder inside
the extracted archive, for example `Exports/Jade-New`. Windows may require
entering the folder before **Select Folder** (`Sélectionner un dossier` on French
Windows) confirms it. The proposed output is `skeleton.json` plus atlas PNG pages.

Review **Export preflight**, including Create, Replace and Orphans. The review
does not write files. Errors block publication. Existing files require explicit
replacement consent; orphans are preserved, never automatically deleted.
For this sample the editor may warn about **dark-tint-consumer-unknown** and
**deform-unqualified**: they express the editor's generic consumer qualification,
not a claim that the bundled PixiJS adapter ignores those values. The sample's
static dark tint and FFD were qualified separately against Rust. Read the
[target limits](RUNTIME_COMPATIBILITY.md), then check
**I accept the listed fidelity / qualification warnings** if appropriate and click
**Publish export**. Leave the warning unchecked or choose **Cancel** to stop.
Do not waive warnings for unsupported constraints or blending on another project.

The publisher rechecks paths, permissions, collisions and locks. Ordinary errors
use staging and rollback to preserve previous outputs; there is no promise of
filesystem-wide atomicity or power-loss durability. Keep important backups.

## Run and reload the browser example

Run `Start-Demo.exe` (inside the downloaded archive) at the archive root. It opens the default
browser at a random `127.0.0.1` port. If opening the browser fails, copy the printed
URL. Do not double-click the HTML using `file://`. Keep the console open until
finished; Ctrl+C in that console stops the local server. No network interface
other than loopback is bound; no downloads or telemetry are used by the demo.

The verified bundled export loads initially. In **Runtime JSON path relative to
the extracted archive**, enter `Exports/Jade-New/skeleton.json` and click
**Load export** to use your fresh GUI export. All referenced atlas pages must stay
beside it as specified by the JSON. The launcher serves only the extracted tree.
For another location, copy the entire export into a new subfolder of this tree.

Both characters have **Idle (loop)**, **Attack (one shot)**,
**Crossfade to other clip**, **Pause**, **Resume**, **Speed** and **Alternate clips**.
Manual play, fade or pause disables automatic alternation for that character.
The event log shows `impact` with `int: 7`, `float: 0.25`, `string: "jade impact"`.
Events at t=0 are intentionally ignored. One-shot playback holds its last pose;
the state can remain active after the last key. There is no completion callback.

**Release characters and textures** frees the sample instances and their atlas.
**Load export** creates a fresh pair. A failed replacement load reports the error
and preserves the previous working pair. See [Troubleshooting](TROUBLESHOOTING.md).


---
Source-tree note: file locations and runnable browser examples above refer to
the extracted RC2 archive. Download the [complete alpha archive](https://github.com/Kr-Apo/ankhimate/releases/download/alpha-2026.10.18-rc2/Ankhimate-Editor-PixiJS-Alpha-RC2.zip).
Source files here document that same API; GitHub does not execute the demo.
