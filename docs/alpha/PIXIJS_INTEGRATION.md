# PixiJS integration

## Files and imports

The shipped browser ES modules are `Runtime/core/index.js` and
`Runtime/pixi/index.js`; PixiJS 8.17.0 and fflate 0.8.3 are in `Runtime/vendor`.
The private Pixi adapter remains version 0.0.0 and is **not a published npm package**.
The core remains 0.1.1. Use an HTTP server and the supplied import map, or configure
your own build to resolve these same module specifiers. Do not install a registry
package and assume it is this qualified local snapshot.

[minimal.html](minimal.html) and [minimal.mjs](minimal.mjs) are the complete,
copyable example, tested against the shipped modules. Open the HTML through the
launcher URL with `/Docs/minimal.html`. The HTML supplies an import map and a host
element; the module imports real public entry points:

```js
import { Application } from 'pixi.js';
import { loadPixiRig } from '@ankhimate/pixi-runtime';
```

## Loading and ownership

`await loadPixiRig(jsonUrl, {signal})` validates native v2 and loads its PNG atlas
pages relative to the JSON URL. `signal` is optional. It owns decoded textures;
partially completed loads dispose successful pages on failure. Catch errors and
display them. Loading unsupported features throws `PixiRigError` before silently
drawing an approximation. See [compatibility](RUNTIME_COMPATIBILITY.md).

`asset.createInstance({skin})` creates private meshes/geometry and a `root`
Pixi Container. `skin` defaults to the authored default. Add `instance.root` to
`app.stage`, set its position and scale, and create another instance from the same
asset to share atlas textures without sharing transport state.

Advanced alternative: `PixiRigAsset.from(source, pageMap)` borrows already loaded,
full-page resolution-1 Pixi textures. The caller owns and later destroys them.
Do not mix borrowed and owned cleanup assumptions.

## Playback and update

Use `instance.playback`; do not construct another controller for that instance.
`play('idle', {loop:true})` restarts at zero. `play('attack', {loop:false})` is a
one-shot and holds the final pose. Without `loop`, the authored flag is used.
`crossFade('attack', 0.75)` blends distinct clips over scaled playback seconds;
duration zero switches immediately, and fading to the same clip is a no-op.

Call `playback.update(dtSeconds)` once per game frame with a finite, nonnegative
delta. With Pixi's ticker use `ticker.deltaMS / 1000`. The adapter does not register
a global ticker for you. `pause()` holds time and pose; `resume()` continues an
attached clip. `stop()` returns to setup. Set `speed` to a finite positive number;
use pause instead of speed zero. Speed scales both clip time and fade duration.
Getters `animation`, `time`, `playing`, `speed`, `events` expose current state.
`playing` indicates active transport, not an unfinished one-shot.

`instance.setTime(clip, time)` samples directly in [0,duration] without events.
It detaches playback; `resume()` then has no clip. Use `play()` to restart.
`setPose(pose)` similarly detaches. Neither is a replacement for continuous update.

## Events

`const unsubscribe = playback.onEvent(event => { ... })` registers a synchronous
callback. Call `unsubscribe()` during scene cleanup. The callback receives `name`,
`time`, optional `int`, `float`, `string` and data-only audio fields. Audio is not
played automatically. The latest `events` batch is read-only.

Intervals are (from,to], ties retain author order, and **t=0 events are ignored
on startup and at every loop boundary**. Only incoming-track events fire during
crossfade. Very large event-producing deltas are rejected before advancing; split
them. Do not recursively call update from an event callback.

## Skins and limitations

`instance.setSkin(name)` changes a compatible authored skin without restarting
time or the current fade. Unknown or FFD-incompatible skins throw. This is one
selected skin with default fallback, not multi-skin composition. Jade Sentinel
contains only `default`; it does not demonstrate an alternate costume.

Interrupted crossfades use the previous incoming clip as outgoing, not a snapshot
of the displayed mixture. Jade qualification measured a world vertex component
jump of up to 11.8049 units. Do not promise continuous multi-way interruption.

## Destruction and errors

Stop/remove your ticker callback first, unsubscribe callbacks, detach each root
from its parent, then call `instance.destroy()` for every instance. Only then call
`asset.destroy()`; it refuses active instances. Owned atlas textures are released
at this final step. Destroy a borrowed texture yourself only after every consumer.
Finally destroy your Pixi Application if your scene owns it. A second character
must survive destroying the first. Shared Pixi programs may remain cached until
the renderer is destroyed.

The complete example cleans up after failed loading and on `pagehide`. In a game,
also clean up on scene transitions. Unsupported rig/data errors, missing pages,
missing clips and destroyed assets must be surfaced to the user or developer;
do not catch and silently continue. See [error reference](TROUBLESHOOTING.md).


---
Source-tree note: file locations and runnable browser examples above refer to
the extracted RC2 archive. Download the [complete alpha archive](https://github.com/Kr-Apo/ankhimate/releases/download/alpha-2026.10.18-rc2/Ankhimate-Editor-PixiJS-Alpha-RC2.zip).
Source files here document that same API; GitHub does not execute the demo.
