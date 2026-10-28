# Experimental Phaser WebGL qualification safety

Only `phaser/src/replay-load.ts` changes production behavior. No renderer, geometry, shader, atlas algorithm, numerical module or Legacy API changes. The qualification cache is a private WeakMap keyed by the actual Game: one independent state per Game, shared by its assets/owners, not a global qualification flag.

## Qualification and fast validation

Initial qualification requires a renderer with a real WebGL2 context in the browser, VERSION matching WebGL 2.0, no pending Game destruction, no renderer loss flag and native `gl.isContextLost() === false`. State pins actual renderer, context and renderer canvas references. The initial VERSION result is not cached across different Games/identities. Native validity is checked again after initial qualification, before recording success.

Each later call still checks Game lifetime, actual renderer/context/canvas identities, WebGL2 instance type, renderer loss and native context loss. It avoids only the redundant VERSION read. A replaced renderer/context is refused even if it has another genuine WebGL2: old assets must not cross GPU ownership. Create a new Game/asset rather than attaching old resources to a replacement renderer. Canvas and WebGL1 are refused. Failed qualification is never recorded as valid.

Native canvas loss AND restoration events invalidate qualification, including a whole lost/restored interval without presentation. An observed loss before asynchronous event dispatch also invalidates it. Restoration of the same identities requires a new full qualification. Phaser owns the actual restoration of texture/buffer/program wrappers; this cache restores none. Game destruction marks a terminal tombstone and detaches both native event listeners. The final tombstone drops the renderer/context/canvas references, so keeping a destroyed Game for diagnostics does not keep former GL objects through this cache. The WeakMap owns no textures, assets or snapshots and adds no per-frame state allocation. Applications still own orderly Game destruction.

## Dynamic resources and presentation

All original page checks remain on every validation: TextureManager key exists, texture object equals the exact registered object, source dimensions equal the native page and GL wrapper is PMA. There is no texture-validity cache. Both pages remain checked even if only one is visible. Same-key replacement is refused on already displayed tokens, for both owners sharing an atlas.

The pre-cache resource check, check inside `consumer.present`, and Scene prerender validation all remain. Their call counts are unchanged. Keeping the callback check protects the window between phases, demonstrated by atlas removal during consumer dispatch. No time-based skip, cadence cache, guard removal or geometry optimization is introduced. All owner/token/context/epoch/staleness checks, disposed refusal and B6 numerical transactions remain unchanged. A graphical refusal leaves accepted numerical state intact; a rejected Physics tick does not become a committed frame.

## Actual browser loss/restoration qualification

Native WEBGL_lose_context events, Phaser restoration, explicit presentation and gl.readPixels were tested in Chrome156/ANGLE/D3D11/RTX3090. Lost-context presentation is refused; the same context is requalified once after restoration and produces byte-identical pre/post pixels and numerical state. This is a controlled single-context experiment, not certification of arbitrary device loss, browsers, drivers, multiple loss cycles or seamless host recovery.

The common example can attempt presentation during a lost context: one uncaught presentation-refusal error and Phaser's existing loss/restoration warnings are explicitly recorded on BOTH baseline and C5B. The host should suspend/catch graphical presentation while lost. No claim that this example now handles all recovery UX automatically. The first immediate restoration request timed out; a retained subsequent test waits one second after the native loss event before requesting restoration. No synthetic event is substituted for browser proof.
