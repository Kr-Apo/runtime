# T-840B5B1 — Native skins and Physics activation

Experimental opt-in headless core only. Existing constructors, players, renderers,
export consumers and LegacyT839 defaults stay unchanged. No format/version change.

## Native audit and scope

Author Skin (formats/src/schema.rs) stores named attachments, bone names and
constraint names. convert.rs resolves names to SkinId/BoneId/ConstraintId and reports
missing references; serialization converts back to names. export/src/context.rs and
the native preset already serialize these fields unchanged. RuntimeSkin has the
same membership lists; parseRig validates names. Genuine saved/reopened author
projects are exported through the standard preset in the new regression suite.

Attachment resolution: first selected skin, then the default attachment fallback
(Skeleton::resolve/resolve_many). Membership is DIFFERENT: native
Skeleton::inactive_skin_members excludes the default from inactive ownership,
unions members of other inactive skins, then subtracts members of selected skins.
Unowned constraints remain active. A constraint listed ONLY in default remains
active with another selected skin; membership shared with an inactive alternate
can be suppressed unless the chosen skin explicitly keeps it. No implicit union
with default membership. Rust's helper is reused; the opt-in TS calendar reproduces
that rule. The existing general TS evaluator's simpler owned/selected filter and
all fixed-default APIs are deliberately unchanged. Do not infer general visual
skin fidelity from this numeric qualification.

Skin.bones references are validated. Native evaluate_skinned currently gates
constraint solving, not FK traversal/animation of those bones. B5B1 preserves that
actual behavior, including parent transforms needed for anchors. It does not
invent branch hiding or reparenting semantics. Attachments are not rendered here.
All constraints must remain Physics, even inactive ones. B4 refusals of events,
slot/FFD/constraint tracks, sequences, shifted author tracks and mixed solvers
remain. No PathPosition/export refusal is lifted.

## Explicit APIs and immutable schedule

Rust ReplayTransport::with_skins(rig,clips,name,epoch,&[SkinEvent{tick,skin}]);
TypeScript ReplayTransport.withSkins(rig,name,epoch,events). The explicit TS optional
constructor argument exposes the same opt-in. B3 and B4 also accept a calendar at
construction (Rust with_skins, TS final optional events). Old constructors do not.
The owner freezes/clones the source and schedule. Changes never mutate the rig,
parents, inverse binds, constraint definitions or identities in an epoch.

The calendar must be nonempty, start at tick 0, use unique resolvable skin names,
strictly increasing ticks within [0,8388607], and valid native memberships.
Duplicate/unsorted tick events are rejected, not sorted or last-wins. Constraint
sets are prevalidated in author order, keyed by native ConstraintId or the unique
exported constraint name within this immutable context, never by driven bone alone.
One selected skin at a time; multi-skin composition is not exposed by this API.

skin_at/skinAt(N) is a pure scheduled-selection query returning name + active
constraint identities; it does not change the displayed or simulated frame. Rust
returns owned values, TS immutable values. Out-of-horizon skin queries in opt-in
mode fail. Old fixed APIs return None/null. Disposed transport rejects the query.
For the current displayed selection use snapshot.position; during an observer the
candidate frame tick is ahead of the last committed snapshot. Query using that
candidate tick when inspecting candidate membership.

There is NO editable runtime journal. set_skin/setSkin continues to refuse even
on the opt-in owner: this disallows past, present and future calendar edits rather
than ambiguously reinterpreting backlog. A different calendar requires constructing
a new owner with an explicitly new history/epoch. Legacy B3/B4 reset signatures
construct their historical fixed-default context; construct a new opt-in B3/B4
instance to select a new calendar. Transport reset/stop/seek/replay/restart and
abrupt clip change retain their frozen calendar and restart it from tick zero.

## Whole-tick boundary

At an executed tick N:
1. Sample pure canonical author locals and recompute FK, with no old offsets.
2. Resolve the last scheduled event <= N; compare ordered constraint identities.
3. Delete exiting records (offsets, velocities, anchors); preserve common records.
4. Traverse the new active set in author order. Newly active records start at zero
   and prime the actual current parent anchor AT THEIR TURN, after earlier active
   constraints have updated FK. Then execute exactly one 1/120 step at this same N.
5. Apply mixed offsets, update subtree, check finite values; publish only after the
   observer succeeds and let the sole B2 clock commit the whole tick.

Newly primed anchor delta is zero. Forces can produce a legitimate first-step
response; reactivation does not promise a zero output, only no inherited velocity
or accumulated-absence impulse. No tick, record or private debt exists for inactive
constraints. A half-second backlog uses each historical event at its executed tick,
not request time. Pure visual switches keep the exact records, anchors and velocities.
Active mix=0 still integrates; only output is zero. Zero/one-mix immutable contexts
are compared for equal numerical evolution. There is no mix-animation/edit API;
restoring a parameter inside an epoch is not claimed or added.

## Seek, replay and fault boundary

Seek selects the scheduled skin at the sought tick with pure pose and no historical
records; the fresh simulation clock remains at zero. Replay starts from origin,
reexecutes the same calendar and produces the same complete trajectory. Pauses and
queries do no numerical work. Disposal releases source/calendar/instance ownership.
Prevalidation failures preserve current frame, context and debt. Executing input,
numerical or observer failures retain the last completed frame and fault the owner.
Private record mutation can already have occurred: B6 numerical rollback is NOT
implemented. Reset is required; neither retry nor partial-frame success is implied.
