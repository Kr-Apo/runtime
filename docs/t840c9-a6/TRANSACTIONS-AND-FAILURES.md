# Transactions and failures — A6

B6 remains the only numerical boundary. Its existing private records/pose,finite/constraint checks and detached diagnostic observer are retained. A6 adds no user callback/await between accept and clock commit. The current validated slot snapshot is attached to candidate event occurrences before that boundary; all cloning,capacity checks and other fallible work occur before acceptance. Diagnostic candidate frames are not committed publication and contain no event queue.

## Critical A — slot fails with impact/change at60

A negative isolated runtime source has a valid admitted Bézier whose sampled RGB overshoots the normalized domain precisely at60. It also changes attachment and has an impact event at60. Tick59 is accepted;60 is refused. Tests compare all accepted bones,Physics records,complete slot state/order and tick exactly before/after. Neither attachment nor event publishes; no clamp is introduced. Fault/reset policy is inherited.

## Critical B — event queue saturated

1024 valid filler occurrences are committed at tick1 and remain pending through59. At60, valid new slots are prepared but the impact would exceed capacity. The whole candidate is rejected: completed59,all old slot/bone/Physics data intact,pending1024 without partial append. The prefix remains drainable with slot context tick1;60/impact is absent. Drain does not heal the fault; reset is required, as in A5.

Malformed event payloads associated with a slot-change time are rejected during admission. Since payload source is private/immutable after admission, a caller mutation cannot inject a late invalid key. Late event-side failure is exercised by the real capacity guard; detached-observer failure is injected after both stages are prepared. Both preserve the prior committed frame/queue. Busy/context/presentation guards prevent reentrant drain or mutation. Unqualified combined channels fail before an actor is published.

## Critical C — GPU fails after numerical60

Actual PixiJS and Phaser WebGL2 tests first present59,then accept60 with the moon attachment,visible/front order and the two impact occurrences pending. A test-only served copy injects failure at the final slot's preparation,then a post-submit GL error. Neither publishes a partial bank. Raw readPixels remains byte-identical to the old59 image; accepted Physics/slots remain60 and queue count remains2. The application drains accepted60 events with moon snapshot60,can fail its handler without rolling back Physics,and retries the same current frame. New image60 appears and repeated presentations/drains emit nothing again.

The test-only routing/prototype/GL probes are absent from product modules. No universal CPU+GPU transaction is claimed: numerical commit and graphical publication are separate frontiers. Event receipt describes accepted numerical state, not successful immediate display. Old front/back resource reuse and inactive allocations retain their honest counters; no fake rollback of already created resources is claimed.

## Lifecycle and memory

A6 uses the existing queue and APIs,not a new bus. Capacity remains1024 occurrences,source at most4096 keys and native strings at most1024 UTF16 units each. It holds at most one distinct slot snapshot per pending event tick (at most1024),sharing only privately. With S rig slots,slot-context retention is bounded by O(1024*S),plus event payloads and candidate copies. This is a per-rig bound,not a universal heap byte cap. Drained detached batches belong to the app; retaining them is its responsibility.

Pause/backlog keep accepted pending data. Reset/replay/stop/restart explicitly discard the old queue and renew numerical identity. Disposal drops queue/consumer reachability; later drain refuses. Two actors have independent state,queues and GPU meshes. Context loss/restoration preserves the same accepted frame and event status; no collector runs during redraw. Return acknowledgements are at-most-once dequeue,not durable exactly-once external effects. Source/snapshot/payload mutation tests and25 targeted regressions cover these boundaries.
