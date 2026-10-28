# C5B validation reproduction

These optional scripts use the public C5A character example and actual WebGL2. No product instrumentation, runtime query interception or renderer feature expansion is installed by them.

Build the Runtime with its locked dependencies. Keep an independently built, unchanged source checkout/archive of C5A `27d386117c4e429ac7ba85a57498c64550f95e46` for comparisons. Its browser dependencies must be inside its server root (the fixture server rejects escaping links). Use the same installed dependency versions and browser for both sources. Do not regenerate accepted evidence in place.

Run from the Runtime root, with **new absolute output directories** and an absolute source root:

```sh
node scripts/t840c5b/measure.mjs NEW_OUTPUT SOURCE_ROOT
node scripts/t840c5b/measure.mjs NEW_OUTPUT SOURCE_ROOT instrument
node scripts/t840c5b/boundaries.mjs NEW_OUTPUT SOURCE_ROOT
node scripts/t840c5b/memory.mjs NEW_OUTPUT SOURCE_ROOT
node scripts/t840c5b/safety.mjs NEW_OUTPUT SOURCE_ROOT
```

For the unchanged baseline safety campaign, append `baseline`. Its two identity gaps are recorded explicitly rather than silently counted as preexisting protection. For another browser set `ANKHIMATE_BROWSER_PATH`; the tested default is installed Chrome on Windows. Node/Playwright and a real WebGL2-capable GPU are required. No model, external API, published package or download is involved in the campaign.

`measure` defaults to three repetitions, Scout/Ranger/Courier, 1/5/10/25 actors and exact/host modes. Each runs new pose, cached token, unchanged redraw, pause, hitch and catch-up. `C5B_COUNTS=25` and `C5B_REPETITIONS=1` select the smaller counterbalanced order control. Run latency, intrusive counters and memory tracing **separately and sequentially**. CPU submission is not GPU duration; logical cadences do not certify display FPS.

Instrumentation transforms only served diagnostic JS responses to count nested-exclusive qualification/page validation; neither source nor built files are patched. Native context loss tests retain expected presentation refusals and Phaser warnings; they test explicit restoration on one browser, not seamless general recovery. Do not enable arbitrary whole-campaign retries or loosen an oracle/threshold to obtain PASS.

The C5A and C4 scripts remain the graphical/numerical oracles. Run their unchanged qualification, lifecycle, live host, external consumer and historical campaigns against C5B. Specialized Legacy suites still produce their 196 accepted failures. See [safety contract](../../docs/t840c5b/T840C5B-SAFETY-CONTRACT.md) and [performance report](../../docs/t840c5b/T840C5B-PERFORMANCE.md).
