# Accepted frames and transactions

## Admission

ReplayConsumerBridge/Transport/Animation accept the additional explicit option `{weightedFfd:true}`; omission retains historical rejection and frame shape. Low-level Physics receives the validated fixed clip capability. Runtime v2, one clip, one fixed default skin, Physics-only constraints, exact displayed weighted non-linked owner, valid geometry/UVs/influences and finite sorted fully dimensioned FFD keys are required. Slot/color/visibility/attachment/draw-order/events/IK/Transform timelines, sequences, links and dynamic skin calendars remain refused.

The internal optional `deformation` object has kind `weighted-ffd/v1`, clip, skin, accepted bigint tick, and entries `{owner,slot,attachment,offsets}`. This is an internal frame payload, **not a new native export format**. Epoch, context, bones and Physics records belong to the surrounding accepted frame. The source and keys are cloned and privately owned. Published frames and observer data are detached; callers may mutate their copy without mutating the owner.

## Numerical commit

Physics #run retains B6 candidate cloning and ordering:

1. Prepare candidate inputs, active constraints and cloned records.
2. Run existing Physics and finite checks.
3. Sample/validate FFD for exactly the candidate tick.
4. Give the observer a detached complete candidate.
5. Accept records, bones and FFD together; the clock commits that tick.

No callback, await or fallible work was inserted between #accept and clock completion. A failure retains the previous complete accepted tick and successful prefix, while preserving requested debt and the existing fault/reset policy. Tests cover nonfinite input, FFD interpolation overflow with finite adversarial source values, rejected observers and mutation of observer copies.

A request for60 initially accepts8 with backlog52: the deformation tick is8. Pause and repeated rendering do not sample future FFD. Reset/stop/restart and explicit replay from origin preserve the capability and context protections. Pure seek preview is refused **before mutation** in this mode; it cannot create a pose combining a preview FFD with committed Physics. No Legacy preview policy was changed for default consumers.

## Presentation

The existing ApplicationActor passes an accepted-frame verifier to its FFD view. It compares supplied detached frame data with its private consumer's current accepted frame; it does not sample keys or run Physics. Frame/owner/dimension/finitude validation and the existing session/cursor/selection checks run before preparing the inactive bank. This application check is not a Q1 security certificate or an admission supervisor.

Both views prepare and fill the inactive bank, submit to its offscreen target, check GL success, then switch the visible surface/front metadata. Test-only HTTP copies inject a preparation exception and a post-submit GL error report; no product injection hook is added. Last published front pixels remain byte-identical, even though inactive resources may have been created or updated. Counters are not rolled back as if those allocations never happened.

A graphical failure after numerical tick60 does **not** roll back tick60. It leaves the prior visible front and can retry the same accepted numerical frame successfully. Tests also reject stale frames and wrong tick/owner/attachment/clip/dimensions/nonfinite/mutated offsets and bones. Independent actors do not share mutable mesh storage; disposing one preserves its peer and shared asset ownership.
