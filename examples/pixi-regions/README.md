# Two independent region poses

From the repository root: `npm ci`, `npm run build`, `npm run example:pixi`.
Open the printed URL. Move the left slider, then the right one. The other
character must keep its pose, orientation and shared textures. Reload and check
that no HTTP/resource/JavaScript errors occur in the browser console.

The page uses the adapter's public `loadPixiRig`, `createInstance` and `setTime`
API on the unchanged native tagged_rig export in `pixi/test/fixtures/tagged`.
It never opens or converts `.ankh`. Shader effects, crossfade, events and a
combat demo are deliberately absent. This is a checkout-based dedicated page,
not new alpha packaging. The existing Phaser examples are untouched.

Manual smoke: confirm WebGL in the console, both figures visible on the checker
background; set different slider values and compare independent poses; inspect
Network for successful JSON/PNG loads. For measured trim/PMA/multipage cases,
run `npm run test:pixi-webgl`; its results identify the browser/backend. This
manual procedure alone does not establish pixel parity.
