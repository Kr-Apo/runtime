# T-840C3 — Fixed boundaries and reference vectors

5,968 vectors fixed before running the converter, generated independently with Python Fraction.from_float. Expected tick is floor(Fraction(ms)*120/1000); cadence idealTick is floor(index*120/rate). Immediate neighbors use math.nextafter. The committed fixture contains input and expected output; delivery `vectors-first/results.json` records observed results. All pass. No epsilon, threshold adjustment or ideal-float identity assumption.

Cadences: 30,60,120,144,240Hz, ten seconds at every frame index. 1175 represented inputs fall one tick below the ideal rational schedule at an ideal boundary; others match. None differs by more than the declared boundary effect in this domain. Variable cadence/hitches are also exercised through actual requests, with no more than eight processed ticks per call and pure repeated observation.

| Vector | Input Number ms | Fixed expected tick | Observed tick |
| --- | ---: | ---: | ---: |
| 10s/before | 9999.999999999998 | 1199 | 1199 |
| 10s/at | 10000 | 1200 | 1200 |
| 10s/after | 10000.000000000002 | 1200 | 1200 |
| 1min/before | 59999.99999999999 | 7199 | 7199 |
| 1min/at | 60000 | 7200 | 7200 |
| 1min/after | 60000.00000000001 | 7200 | 7200 |
| 10min/before | 599999.9999999999 | 71999 | 71999 |
| 10min/at | 600000 | 72000 | 72000 |
| 10min/after | 600000.0000000001 | 72000 | 72000 |
| 1hour/before | 3599999.9999999995 | 431999 | 431999 |
| 1hour/at | 3600000 | 432000 | 432000 |
| 1hour/after | 3600000.0000000005 | 432000 | 432000 |
| horizon/before | 69905058.33333331 | 8388606 | 8388606 |
| horizon/at | 69905058.33333333 | 8388606 | 8388606 |
| horizon/after | 69905058.33333334 | 8388607 | 8388607 |
| subnormal/before | 0 | 0 | 0 |
| subnormal/at | 5e-324 | 0 | 0 |
| subnormal/after | 1e-323 | 0 | 0 |
| 25ms/before | 24.999999999999996 | 2 | 2 |
| 25ms/at | 25 | 3 | 3 |
| 25ms/after | 25.000000000000004 | 3 | 3 |

The first manual horizon assertion incorrectly assumed `8388607*1000/120` represented a value above the ideal boundary. It is actually below. The independent pre-existing vectors already specified8,388,606 at that Number and8,388,607 at the immediate next Number. `targeted-first.log` preserves the failed assertion; only that erroneous assertion was corrected, with no converter/core/sampling change. Requests beyond the next disallowed tick are rejected before numerical mutation.

## Segments and lifecycle

For1,000 active segments [i,i+0.0009] ms, each separated by a pause until i+1, independent Fraction arithmetic predicts exact elapsed milliseconds:

```text
4150517416591235529 / 4611686018427387904
```

Observed numerator/denominator match exactly (approximately0.9ms). C2 DemoTime floors each segment to zero microseconds, losing the entire duration. C3 carries the fractions; physical completed/requested remain0 because pause/resume themselves do not submit time.

Another1,000-pause test retains exactly1,000ms of active time despite2,000ms of host time. Pending target120 is submitted only after a changed post-resume timestamp; the first same-timestamp call stays observational. Alternating0.125ms and24.875ms active segments, separated by100,000ms-scale paused time, retain exactly25ms/tick3. Error tests cover invalid input/domain, NaN/infinities, regression, horizon, disposed/stale contexts, visible external requests, reentrant changes, native singular-parent fault and audit failure. Both failed conversions and refused rebinds preserve numerical state.

High-origin vectors expose lost source precision rather than masking it. At1e12ms, adding0.001ms produces an exact represented delta1/1024ms. A minimum-subnormal increment is retained as a positive rational and produces no tick. At MAX_SAFE_INTEGER, adding0.1 rounds back to the same input and causes no progression. The next out-of-domain input refuses. Long10s/1min/10min/1h/horizon tests qualify conversion and scheduling, not millions of newly re-executed solver ticks; real numerical parity remains covered by the retained B3–B6 campaigns.

Two independent consumers pause/progress/resume separately, then agree on the same completed pose after explicit catch-up. Stop/reset/seek/replay invalidation and rebind are tested; no private time is spliced into a seek preview. Disposal does not destroy the borrowed consumer. The15 host tests are included in the333 full Runtime tests. The extra Pixi two-preview regression passes without a production cache modification.
