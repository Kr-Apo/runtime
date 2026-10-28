# T-840C3 — WebGL qualification

## Setup

Actual installed Chrome156.0.8078.47, PixiJS8.17.0, WebGL2, ANGLE NVIDIA RTX3090/D3D11 on Windows11Pro build26300, i7-13700K (24logical processors). C2 machine metadata is preserved; each new browser campaign records current renderer/context metadata. Local loopback only, no CDN/download/inference. Pilot captures900x520, DPR1, opaque background, no MSAA. These results qualify one configuration, not mobile/other hardware/browser families.

## Controlled host campaign

`host-verified/`:14 captures plus a regressive-time refusal, all PASS. The public bridge drives the actual C2 consumer and Pixi view. Two independent owners start at host0. Regular25/50ms updates display ticks3/6. A pauses while B progresses; A resumes at10,000ms without a jump. A's next25ms active time advances to6. A500ms hitch displays14 (eight additional ticks) with52 debt; another hitch adds demand before draining. Explicit partial/full pumping reaches25 then126. Thirty unchanged update/observe/redraw iterations change neither transport nor capture/submission counters; raw pixels remain identical. A rejected backwards host time preserves numerical progress and is visible in diagnostics.

Pure previews30 then90 are displayed explicitly, followed by full replay126. Preview captures are labeled pure and are not passed off as independent historical Physics oracle coverage. The real native fault_at_9 clip displays the last accepted tick8 after solver failure, with identical pixels and fault state. Adapter/view/consumer/asset destruction and request-after-disposal refusal pass.

Independent Rust matrices/quad corners, not visible pixels alone, are checked. As in C2, test-only expected buffers receive independently computed Rust corners, are rendered/readPixels, and actual buffers are restored. No runtime JSON or application snapshot is patched. Maximum discrepancies:

| Quantity | Maximum observed | Unchanged limit |
| --- | ---: | ---: |
| Affine | 2.08304921284e-07 | 0.0001 |
| World values | 8.77009832045e-06 | 0.01 |
| Submitted vertices | 1.82043147987e-05 | 0.01 |
| Camera-space vertices | 3.27677665837e-05 | 0.02 |

All compared Physics pixel pairs pass the existing comparator. No JS errors/warnings, missing/external requests or context loss. Graphical submission is not a GPU transaction or acknowledgement of display completion.

## Exact and historical regression

`exact-verified/`:24 C1/C2 captures plus the distinct presentation-error check PASS in exact mode, using unchanged native fixture and721 Rust reference frames. Actual `.rgba` bytes are verified equal to the sealed C2 outputs, which themselves equal C1. No golden/threshold replacement.

Historical Pixi campaigns re-executed:33 regions,20 playback,115 meshes,232 appearance,352 clipping =752 unique passing cases. The initial appearance run had231pass/one ERR_NO_BUFFER_SPACE timeout; its sole failed case passed on a filtered fresh-browser retry, using the unchanged original runner. The initial failure is preserved alongside the retry and explicit merged coverage receipt, not overwritten. Expected advanced blend refusals remain negative evidence, not ReplayV1 blend support. Phaser code and its browser campaigns are not extended. Native v2, Physics-only, static regions, fixed default skin, Normal/no-dark-tint, no slot channels/events/FFD/clipping/mixing exclusions remain unchanged.

The independent TypeScript consumer compiles outside the runtime checkout with only declared exports and exercises the new shared host entry, pause/reanchor and exact completed-frame presentation. Its browser run and six page-loading/cancellation cases pass. Temporary dependency junctions are detached after success without deleting package targets.

## Reproduction

After building local packages, use fresh nonexistent output directories:

```text
npm run build
npm run typecheck
npm test
node --test scripts/t840c1/pilot.test.mjs scripts/t840c2/time.test.mjs scripts/t840c3/public-entry.test.mjs
node scripts/t840c3/vectors.mjs NEW_VECTOR_OUTPUT
node scripts/t840c1/webgl.mjs NEW_EXACT_OUTPUT
node scripts/t840c3/webgl.mjs NEW_HOST_OUTPUT
node scripts/t840c2/consumer.mjs NEW_EXTERNAL_CONSUMER_OUTPUT
node scripts/t840c3/performance.mjs NEW_PERFORMANCE_OUTPUT
node scripts/t840c3/memory.mjs NEW_MEMORY_OUTPUT
node scripts/t840c3/conversion-performance.mjs NEW_CONVERSION_OUTPUT
```

Use installed dependencies/Chrome; ANKHIMATE_BROWSER_PATH overrides its location. Matched C2 benchmarks require the exact C2 Git parent locally. Historical scripts use ANKHIMATE_TEST_OUTPUT for fresh destinations. The initial sandbox denied one existing loopback test (EACCES); the permitted local-server final run passes unchanged. No whole Editor suite is claimed re-executed.
