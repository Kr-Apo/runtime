# T-840B6 — ReplayV1 numerical transactions

This contract supersedes the numerical-fault limitations in the retained historical
B3/B5A/B5B1/B5B2 contracts. Those accepted documents/evidence remain unchanged.
LegacyT839, every current renderer/export compatibility gate, formats and versions
are unchanged. Only the explicitly constructed ReplayV1 core owners use this path.

## Ownership audit

Mutable tick state is the constraint-identity -> Record map, each Record's spring
rotation/position offsets, angular/linear velocities and parent anchor; the active
constraint vector; fresh per-tick locals/worlds; and the accepted ReplayFrame cache.
Calendar definitions, native rig/constraints/binds/author clips are immutable owner
snapshots. There is no stored current-skin object to mutate: effective skin resolves
at the last completed frame tick, while skinAt(N) remains a pure calendar query.
Clock requested/time/completed/backlog, fault and busy flags have separate roles.

Rust Record owns a Copy BoneSim and Vec2 anchor. Candidate cloning owns the map
values and ordered IDs; no mutable reference points back to committed records.
TS ReplaySpring currently has eight scalar numbers; cloneRecords explicitly copies
all eight into new objects and a new Map. The active array is copied; its references
target private immutable Physics definitions, which are never mutated by solving.
Fresh FK/pose allocation already existed before B6; no old accepted pose is mutated
and no immutable rig/geometry/clip is copied anew on each tick. Constraint identity
is native ConstraintId / validated unique name in the immutable context, not bone.

## Alternatives considered

| Mechanism | Safety / work / maintenance |
|---|---|
| Snapshot then restore | Similar state-copy cost; every error/early-return/unwind needs a complete restoration guard over records, membership and frame. Live committed state can be exposed to callbacks before restoration. More fragile than necessary. |
| Candidate then commit (chosen) | Copy only mutable numerical records and active IDs, compute fresh pose, discard on failure. Simple ownership proof in both languages; allocates per tick. Immutable rig stays shared within its owner. |
| Reusable staging/double buffer | Could reduce allocator pressure, but requires correctly cleaning stale creations/deletions after every fault and guarding retained snapshots/observers. Defer until a separate measured optimization proves identical fault semantics. |

## Exact tick boundary

1. Existing context/fault guards and B2 request validation run first.
2. Mark the executing owner conservatively faulted, preserving its committed data.
3. Clone committed records and active IDs into a local candidate.
4. Obtain canonical input, validate/apply locals and compute fresh pure FK.
5. Resolve the immutable calendar at this EXECUTED tick. Delete exiting candidate
   records; preserve common candidates; prime new ones at their author-ordered turn.
6. Integrate exactly once per active constraint, apply offsets/update FK immediately
   for subsequent dependent constraints. All existing finite checks remain.
7. Build complete candidate frame, with owned numerical snapshots. In TS allocate
   the Complete result before acceptance and pass only a structuredClone to audit.
8. Execute the existing synchronous precommit observer/audit.
9. After every fallible operation succeeds, replace records, active vector and frame
   together inside a callback-free acceptance block; clear numerical fault.
10. Return Complete. B2 immediately increments completed for that whole tick.

No user callback, await, fallible numerical work or host presentation occurs between
acceptance and B2's checked completed increment. Rust exclusive borrowing and TS's
existing busy guards forbid mutation across the synchronous boundary. TS reads from
inside an audit still see the OLD committed records/frame/clock. Rust cannot borrow
the same owner reentrantly. An observer may inspect a clearly labeled candidate,
but it is not a published ConsumerFrame. No clock rewrite or second clock is added.
New physical state is not externally observable paired with the old counter; after
the command returns, state/frame/clock describe the same accepted prefix.

## Failure and request intent

Any returned input/numerical/solver error or thrown observer exception abandons the
candidate. Old offsets, velocities, anchors, active membership, frame locals/worlds
and next-step numerical state remain EXACTLY the last accepted prefix. No reverse
integration, epsilon correction or approximate pose-based rollback is performed.
Skin removal/priming affects only the discarded candidate. The schedule itself
is immutable, so asking skinAt(futureTick) may still describe a planned skin, never
proof that it was accepted. ConsumerBridge uses the committed tick and keeps old
skin/records/pose coherently visible after a fault.

The valid request's requested/time intention remains accepted; completed does not
include the rejected tick and backlog remains due. Example request60: ticks1..3
succeed,4 fails -> requested60/completed3/backlog57/faulted. The command is NOT wholly
rolled back. A fault on tick9 after the initial eight ticks leaves52 due of60.
No further request/pump/implicit retry is allowed until explicit reconstruction.
Reset is mandatory despite restored numerics; B6 does not authorize resume/retry at
an intermediate checkpoint. Existing reset rules remain: B3/B4 legacy reset chooses
fixed-default context; Transport/Consumer reset retains its frozen calendar. A new
opt-in constructor can explicitly reconstruct a chosen calendar from origin.

Cancelled B2 offers via queueTime occur before the integrator, so no candidate or
numerical mutation is created. Host cancellation between bounded pumps preserves
accepted ticks/debt. No asynchronous interruption during synchronous integration.

## Rust unwind / TS exceptions

Rust candidate ownership also discards mutations during a caught panic unwind from
provider, integration or audit; the pessimistic fault guard remains set. Tests use
a private generic integration seam, inaccessible through the public API. Panic=abort,
allocator/process abort, hard kill and undefined behavior are not recoverable and
are not advertised as rollback/durability guarantees. No author document/file I/O
occurs in this transaction.

TS catches synchronous exceptions and keeps every candidate object separate.
A shallow Map copy of mutable values would be insufficient: the eight fields are
explicitly copied, and detached observer frames include all nested arrays/affines.
Tests mutate nested observer records/pose arrays and throw (or return successfully)
without modifying accepted data. Async callbacks, monkey-patched JS globals, external
thread mutation and fatal VM/OOM termination are outside this synchronous contract.
Any future nested mutable ReplaySpring field must extend the typed copy and tests.

External callback effects (logging, network, user state, renderer changes) CANNOT be
rolled back. Precommit audits should be side-effect-free. Presentation errors stay
outside numerical simulation, as in B5B2; the bridge does not render a refused frame.
No GPU or resource transaction is implied by numerical atomicity.

## Read-only audit surface and tests

ReplayPhysicsInstance.numerical_state() / numericalState() returns detached active
identities and private accepted record values in native constraint order. It is an
observation-only audit view, not restore/checkpoint/mutation authority, and remains
available while faulted. It is used to prove real private rollback, not just compare
the already protected public frame. Rust's typed ReplayNumericalState is available
from the module; existing callers need not use the additional method.

Rust test-only module injects returned errors and unwinds after native integration
through a private helper (no public fault hook). TS creates a throwaway instrumented
copy of the compiled module OUTSIDE the repository; the sidecar's injection closure
is absent from the real production module/API. It records the exact source hash.
It exercises real candidate/commit code and cannot be used by a shipped reader.
No global mutable Physics state or dependency is added to production.
