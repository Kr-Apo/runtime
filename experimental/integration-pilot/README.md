# Runtime application integration pilot (I1)

This is a local experimental browser entry, **not supervised Q1 admission** and
not a new npm export. No Physics equations, native data, certificates, G1/G2 views
or validation restrictions are changed. The supplied demos stop at tick256.

## Prepare and run

Use existing installed dependencies; do not upgrade versions to reproduce results.
Build the unchanged runtime modules first. From the runtime checkout:

```text
node experimental/integration-pilot/prepare-demo.mjs NEW_DIRECTORY DEPENDENCY_RUNTIME CORE_DIST
node NEW_DIRECTORY/server.mjs NEW_DIRECTORY
```

The builder refuses an existing directory. DEPENDENCY_RUNTIME is the existing
checkout containing installed PixiJS8.17.0, Phaser3.90.0, fflate and adapter dist
modules; CORE_DIST contains the built native core. The delivery already includes
a ready-to-run `applications` directory, third-party notices and `START.cmd`.
Any ordinary HTTP server can serve it. No Playwright, Node supervisor, RPC server,
certificate, identity binding, network CDN or npm install is used by the browser.
The supplied Node server serves static files on127.0.0.1 only.

Open `/pixi.html` or `/phaser.html`. Both create two independently owned actors
from authentic Courier E1 exports. Choose regions or combined weighted geometry.
Automatic playback uses the native120Hz transport; the browser's render rate is
independent. Manual tick mode is available at `?manual=1`.

## Minimal integration

```js
import {loadPixiAsset, createPixiActor} from './pixi.mjs';
const asset = await loadPixiAsset({source:'/fixtures/combined/skeleton.json'});
const actor = createPixiActor({
  asset, renderer:app.renderer, stage:app.stage, clip:'march',
  skinEvents:[{tick:0n,skin:'default'},{tick:20n,skin:'festival'}],
});
actor.play();
actor.advanceToTick(40);       // bounded native request, may leave backlog
while (actor.observe().backlog) actor.pump(8); // offline example; do not loop on a UI frame
actor.present();
app.render();                 // neither presentation nor rendering advances Physics
actor.pause();
actor.resume();
actor.setPosition(400,300);
actor.destroy();
asset.destroy();              // refuses while any actor still borrows its pages
```

Phaser uses `loadPhaserAsset({source,game})` and
`createPhaserActor({asset,scene,clip,skinEvents})`; call your ordinary Game renderer
after presentation. G2's validated public Vertex/Face projection and shared batch
buffers are reused unchanged. Scene shutdown/destroy also disposes the actor's
consumer. Views own mutable caches/targets, assets own decoded atlas pages, and
the application owns renderer/Game. Destroy actors, assets, then renderer. A
renderer destroyed externally is not permission to keep presenting.

## Time and errors

`play`, `advanceToTick(integer0..256)`, `pump(integer1..8)`, `pause`, `resume`,
`present`, `setPosition`, `observe`, `snapshot`, `inspect`, `resources`, `destroy`
are real operations. `observe` and `snapshot` return detached data. There is one
consumer per actor, no validation-time temporary consumer. `destroy` is idempotent;
other operations refuse after destruction. A view rendering exception does not
roll back a previously committed numerical update, and cannot itself run Physics.
Retry presentation of the same committed frame after an ordinary graphics error.

Optional `startRealtime(performance.now())` uses the existing ReplayHostTimeBridge.
Then `update(performance.now())` accepts an **absolute monotone millisecond time**,
not a delta. Pause/resume must receive the same clock. Pause excludes waiting time
and preserves backlog. Native requests perform bounded work; at a large jump the
pilot requests256, drains bounded backlog on later updates, then pauses. No ticks
are silently dropped and no new infinite trajectory is certified. Explicit tick
control cannot mix with an active realtime clock. Drawing is always separate.
RAF's callback timestamp can precede a newly created anchor: the demo samples
performance.now inside the callback instead of weakening backward-time checks.

Load errors/cancellation release completed pages. Rapid reloads cancel previous
loads and publish only the latest generation. Context loss stops the UI loop,
retains committed numeric state, and redraws after restoration; unavailable GPU
pixels cannot be guaranteed to survive. No universal GPU atomicity/VRAM-free claim.

## Scope and evidence

The internal view envelope retains `admissionState:'ready'` solely to indicate a
well-formed local presentation. Its explicit mode is application-experimental,
its qualificationId is application-only-not-Q1, and certified is false. This
does not authorize any Q1 request. Supervised Q1/N6 tools remain separate and
unchanged. The calendar is supplied using existing native SkinEvent semantics;
the export does not embed Q1's schedule. The catalog copies the approved primary
calendar exactly; free graphical setSkin and visual seek are not exposed.

This pilot accepts the same static Normal/D=0 regions/weighted meshes/Physics-only
native subset as G1/G2. No FFD, linked meshes, clipping, mixing, unsupported
constraints, arbitrary horizons, host-time certification, near-singular parity,
cross-browser/headful qualification or public package API. Pausing at256 is a
deliberate application policy, not proof of correctness for all assets up to256.

Tests: entry.test.mjs and actor.test.mjs use the real consumer without a GUI.
External browser tests use ordinary static pages, genuine WebGL2 buffers/pixels,
reference poses, asynchronous loads, context loss, Scene/Game destruction and
one/two-view CPU/GPU measurements. Test drivers are not a permanent app engine.
