# T-840C5B — experimental Phaser WebGL validation

GO for local maintainer review. The smallest production change caches immutable WebGL2 VERSION qualification per actual Game/renderer/context/canvas,lifetime-bound and invalidated by native loss/restoration. Every dynamic resource check and consumer presentation boundary remains. Measured validation and total CPU frame costs improve on Scout,Ranger and Courier,including the counterbalanced25-owner series. No renderer/geometry/evaluator refactor or Legacy change.

## Sources and architecture

Exact Runtime parent27d386117c4e429ac7ba85a57498c64550f95e46,new branch dev/t840c5b-phaser-webgl-validation. Editor remains275082e8f26d42389ed05fb92c45e2822006525d on dev/t840b6-physics-transactions. C5A/C4 reports/contracts read. A pristine C5A source archive is independently built for new measurements; prior outputs are protected,never reused as fresh execution evidence.

Before:every resource-validation call synchronously queries VERSION. A new owner pose plus prerender executes3 such queries; even unchanged redraw executes1. After:the same dynamic validation calls execute,but VERSION is read only on initial Game qualification or after invalidation. The fast path still checks identities,real WebGL2 type,renderer/native loss and Game lifetime. Per-asset texture identity/dimensions/PMA and both callback guards are unchanged. Native context restoration and callback-time atlas mutation are tested explicitly.

## Changes and results

- Production:only phaser/src/replay-load.ts. Test fixture doubles gain isContextLost;9 focused tests are added. New profiling/safety/reproduction scripts and6 reports accompany the patch. No dependency,version,format,public Legacy or default-export change.
-387 Runtime tests pass:core105,Phaser123,Pixi153,pixel6. Build/typecheck,syntax,11 characterizations,14 separate pilot/public tests,5968 host-time vectors and numerical trace parity pass.
-230 C5A rows,50 C4 scenario rows,10 load/resource cases,752 Pixi cases and125 modern comparisons plus20 lifecycle controls pass. External strict TypeScript applications and live host loops pass.
-20 real-browser safety cases pass. Baseline renderer/context identity gaps are made explicit and closed in the experimental path. Native loss rejects presentation; restoration requalifies once and preserves exact pixels/numerics. One expected uncaught example refusal during loss exists in both sources; automatic seamless recovery remains unqualified.
-72 unwrapped configurations per source plus24 counterbalanced runs produce1008 timing scenario summaries.432 paired clock endpoints match.12 separate allocation/GC runs release all asset instance/page references. See performance report for actual median/P95/max and sampling limits.
-196 specialized Legacy failures remain exactly visible and semantically unchanged:181 stale expectations,1 incomplete descriptor,14 unresolved attachment-policy divergences. No broad all-green claim.

## Limits and preservation

One Chrome/ANGLE/D3D11/RTX3090 environment; controlled native loss/restoration only. Existing rigid-puppet art limits and graphical Replay exclusions remain. Driver synchronization and timer quantization affect latency. Allocation sampling is not VRAM or a proof of zero leaks. No new full Rust/WASM suite on the unchanged Editor. No product/compiler warning introduced; expected native loss warnings,Git line-ending advice,setup errors and development failures are retained.

All protected historical files,RC2 and original projects are checked. Core numerical modules,Pixi,Legacy,Editor,old branches/refs/remotes and original D: repositories remain unchanged. Final commit/diff and clean Git states are in the delivery receipts,not a self-referential source SHA. No push,merge,tag,version bump,npm or release. STOP for maintainer review.

[Safety](T840C5B-SAFETY-CONTRACT.md) · [RED/GREEN](T840C5B-RED-GREEN.md) · [Performance](T840C5B-PERFORMANCE.md) · [Graphics/regressions](T840C5B-GRAPHICS-REGRESSION.md) · [Next](T840C5B-NEXT.md).
