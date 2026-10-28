# T-840C9-A6 — Slots + Events composition

Verdict: GO for human review of the explicit, bounded A6 subset. Parent runtime: `4275a260b651e067009e834c19d96010fc87399a` (A5). Branch: `dev/t840c9-a6-slots-events-composition`. Read-only Editor A2: `1f76349731e2242376b61880ac427267fd0712b9`. Final local commit is in delivery COMMIT.json. No push, merge, tag, version bump or publication.

A single existing ReplayConsumerBridge now owns animated bones, accumulated Physics, complete A4 slot state/draw order and the A5 committed event queue. Both engines consume that same per-actor authority. Their views remain graphics-only; the application drains events. There is no new bus, pose evaluator, Physics instance or qualification framework.

The explicit two-flag mode requires native v2, one clip, one fixed default skin, Normal blending, static nonlinked regions/unweighted/weighted meshes and at least one admitted Physics constraint. Both channel families must actually be nonempty. FFD, dynamic skins, links, clipping, mixing, sequences, dark tint and new constraints remain refused. Standalone A3/A4/A5 gates and formats stay unchanged.

## Minimal change

- `core/src/replay-composition.ts`: typed explicit mode and reuse of unchanged A4/A5 validators on private admission projections.
- Existing options/animation/transport propagation: preserve both capabilities through reset/replay rather than selecting one ternary branch.
- Existing Physics candidate: use the admitted slot/event channel sources and attach that candidate's validated slotState to new event occurrences before the existing accept. No change to solver, clock or B6 acceptance ordering.
- `ReplayEvent.slotState` is optional, A6-only application metadata; it is not a native-format field. It makes delayed drain truthful about the attachment at the event tick. Public occurrences are detached independently.
- Existing admission/asset/actor/views forward the explicit combination; A4 geometry/shaders/banks are reused. The shared demo shows an exact application association from event.string to a known slot name.
- Thin factories, real author/native fixture, reference tool,25 core regression tests and these six reports are added.

## Results

All three critical cases pass. A slot-color failure at tick60 prevents the new attachment and impact from committing. Queue saturation prevents the whole tick60 frame and event batch from committing. After a valid numerical tick60, graphics preparation or post-submit GPU failure keeps the front image at59; Physics/slots stay60 and the two events remain drainable. Retrying presentation emits nothing again.

655 workspace tests pass:292 core (25 new A6),142 Phaser,215 Pixi and6 pixel-policy tests. Build,typecheck,syntax,A3/A4 geometry,C3,N3 and54 B6 private-fault checks pass. Main independent Rust comparison covers721 ticks/four laps and36 events. Nonzero maximum errors are retained: RGBA9.110902e-7, bone components1.001787e-5, Physics components3.340901e-6 and world vertices2.277963e-5 unit. Existing tolerances are unchanged.

Actual WebGL2 GPU buffers/uniforms/textures and72 CPU/cross-engine pixel cases pass.234 representative old I2/A3/A4/A5 captures reproduce exactly. Real autonomous applications pass event/attachment association at60,pause/resume,reload,two actors,context and resource lifecycle. Captured APNG excerpts and full-page impact screenshots are delivered.

## Delivery and limits

Signal Costume Frog is an isolated native author copy, with its assets and real unchanged A2 Save/Reopen/export. Native positive JSON is never repaired to force a pass. An early preparation script accidentally appended test text to a temporary author-01 native JSON; that run is quarantined/excluded. Fresh author-final and author-reproduced exports match the clean committed fixture and each other byte-for-byte. No original author project or historical data was involved. The author proof is headless native API work, not an Editor GUI test.

The existing1024-occurrence queue, acknowledgement-before-handler and reset/disposal policies remain. Slot snapshots add bounded per-rig memory proportional to pending events and slot count; no fixed universal byte budget or durable exactly-once side effects are promised. A6 does not combine FFD or certify arbitrary rigs/hardware. See the other five reports and delivery README for precise contracts, measurements and preserved-versus-rerun scope. Stop after A6 for review.
