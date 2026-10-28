# Frames and transactions — A4

## Frame contract

`ConsumerFrame.slotState` is optional and present only for the opt-in A4 capability. It carries `kind: animated-slots/v1`, bigint accepted tick, clip, fixed skin, every slot in source slot order (name, normalized RGBA, visible, attachment, owner), and a complete drawOrder. Bone matrices and Physics records belong to that same accepted frame. This version is an internal experimental payload, not a new native export format.

`ReplaySlots` owns a structured clone of admitted timelines. It is sampled by the existing `ReplayPhysicsInstance` candidate stage after Physics/finite checks and before the observer/accept boundary. Slot data also populates the candidate pose consistently. B6 still commits the records, active constraints and complete frame together. No new callback or fallible work is inserted between accept and clock commit.

Source, observation, snapshot and presentation data are detached. Tests mutate input data and observer snapshots without changing subsequent accepted state. A throw, invalid sampled RGBA or late slot failure leaves the previous accepted candidate intact; completed prefixes remain accepted under the existing B6 contract. A multi-tick request is not claimed to be one all-or-nothing transaction.

## Admission

The explicit flag opens only color/visible/attachment/draw-order tracks. Validate exact skin/clip ownership, source slot/bone names, texture pages, dimensions, region/mesh geometry, finite vertices/UVs, triangle indices, influence rows/bones, key times, curve shapes, normalized RGBA, discrete values, offsets, uniqueness and complete frame orders. Unknown channels, ambiguous attachments, links, embedded deform, sequences, FFD combinations, extra skins/events/mixing and unsupported constraints fail before presentation. Existing bounded source/frame checks remain in use.

Admission is structural and scoped. It is not a Q1 certificate for arbitrary numerical data or browser code. A4 views require the owning actor's accepted-frame authority and validate complete metadata against that accepted selection; they cannot substitute a foreign tick/color/owner/order under a valid binding.

## Render transaction

The existing two-bank views prepare all draws, resolve each identity, validate geometry and fill the inactive bank before submission. Only a complete successful result becomes front. A graphics preparation or post-submit GL failure does not rewind already accepted numerical Physics. It leaves the old visible front; the same current accepted frame can be presented successfully on retry. Inactive allocations/counters are not fictionalized as rolled back.

Real WebGL tests inject a failure at the last slot and after submission through a test-only served source route. Exact readPixels hashes prove the old front is preserved. Modified tick, owner, attachment, RGBA, visibility, bones, clip, incomplete/duplicate order and stale/foreign frames are refused. Each actor retains private mutable mesh state; Phaser's engine-owned shared batch buffers are not incorrectly treated as actor-owned. Disposing one of two actors leaves its peer and borrowed atlas pages usable.

## Transport

Backlog publishes only completed ticks. Repeated present, placement changes and pause do not advance slot timelines or Physics. Stop/reset and explicit replay from origin produce accepted A4 frames. Pure pose `sampleTick` and seek-preview operations are explicitly refused for A4 before mutation, avoiding a second Legacy path. Historical bone-only/A3 preview policies remain unchanged.

CDP measured exactly 724 slot-stage calls per engine: three actor-origin samples, one first actor tick and 720 main actor ticks. The same number of bone-local samples and existing setup-only `evaluate` seeds ran; deform samples were zero. There is no animated slot sampling in present. `SAMPLING-COUNTS.json` and executed source hashes bind this result to the delivered modules.
