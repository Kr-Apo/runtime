# T840B3 — Physics instance scheduling contract

Status: explicit core-only ReplayV1 surface. No editor transport, RigPlayer,
RigPlayback, PixiJS, Phaser or rendered export is connected to it. LegacyT839
remains the existing behavior; no profile is persisted in .ankh or native v1/v2.

## Qualified surface

Rust: `ankhimate_core::replay_physics::ReplayPhysicsInstance`.
TypeScript: core exports `ReplayPhysicsInstance` and associated input/context/
frame types. The constructor explicitly selects the new path; the clock is private.

B3 accepts **Physics-only constraint sets**, immutable rig snapshots, a fixed
default-skin constraint membership and caller-provided bone-local transforms.
Mixed IK/Transform/Path contexts are refused, even if a non-Physics constraint
would be inactive. This avoids pre-applying other constraints in a different
order while claiming fidelity. Such integration needs additional qualification.
This is a bone simulation surface, not qualification of meshes, FFD, slot
animation, skin switching or rendering. No protective consumer refusal changes.

An instance clones its source rig. Native entity/order/skin references and
finite Physics parameters are checked before initialization. Constraint order
must contain every constraint exactly once; missing/duplicate entries are not
silently ignored. Bones require valid parent-before-child traversal. Singular
parent transforms are refused, not replaced by arbitrary inverse coordinates.

## Lifecycle and identity

`new(rig, epoch, initialInputs)` initializes its B2 clock explicitly and prepares
the initial pose at tick zero. No spring step is performed. For every active
constraint it stores a zero spring record and the parent's actual initial world
origin as anchor. The tests include nonzero initial anchors (50, −20), rotated
parents and nonuniform scale. Initial state is published as frame zero.

Each instance owns exactly one clock and a separate numerical map. A record has
rotation/translation offsets, their velocities and an initialized parent anchor;
**it has no remainder or authoritative time counter**. The immutable context
maps each constraint to exactly one bone, so the effective identity is context,
epoch, constraint identity and driven-bone identity.

`context()` in Rust / `context` in TS returns an opaque instance token. Rust uses
an owned Arc identity and epoch; TS compares the original frozen context object
by reference. Numeric epoch equality alone never authorizes another instance.
Tokens cannot be transferred to a different controller. Destroy/recreate and
reset cannot revive a previous context while its old token is retained.

`reset(rig,newEpoch,initialInputs)` builds and validates a fresh candidate before
replacing the current controller. Epoch must increase under the B2 u64 domain.
On success it clears numerical state, backlog and fault, establishes a new
identity and primes frame zero again. Invalid reset preserves the old instance.
This is a core controller boundary, not a second implementation of File Open or
Undo. B1's existing document lifecycle correction remains unchanged.

## Per-tick input and work

Requests/pumps take a synchronous provider and an observer. The provider receives
`ScheduledTick {epoch,index}` and must supply the **pre-Physics local transforms
for that exact tick N**, whose logical time is N/120. Transforms are radians and
native local units. Missing overrides use setup; unknown/duplicate bone inputs
or nonfinite transforms are refused. Do not supply a pose already containing
the previous Physics offsets. B3 does not sample clips or reconstruct past
display-frame root motion: canonical test inputs are explicit per-tick values.

For each tick:

1. Validate context/clock request before running work.
2. Obtain inputs once for that tick; prepare a fresh setup pose plus overrides.
3. Recompute FK. No previous offsets are added to this input pose.
4. Traverse active constraints in the immutable author order.
5. Measure each parent anchor delta in the current parent's frame; convert wind
   and gravity with its inverse. Advance its numerical record **once** at 1/120.
6. Apply its mixed offsets and update the driven subtree immediately, so a later
   dependent constraint reads the already updated transforms.
7. Verify finite records/pose, form the resulting frame and notify the observer.
8. Publish the frame and return success to B2; only then does B2 commit the tick.

The observer sees a candidate fully evaluated frame before the clock callback
returns. The public latest frame is replaced only after that observer succeeds.
It is not an asynchronous publication/transaction hook. TS passes a detached
copy; Rust exposes a shared reference under the instance's exclusive borrow.
An observer must not rely on rollback of its external side effects if it fails.

Zero mix still advances an active ReplayV1 numerical record while leaving its
pose contribution zero. Inactive default-skin-owned constraints are not primed
or stepped. Membership is fixed for the life of a context; dynamic activation
and incremental topology invalidation are not implemented here.

## Time and progress

The B2 exact tick/rational API, u64 domain, error checks and budgets are reused
unchanged. Interactive requests process at most eight whole instance ticks.
Explicit pump accepts its existing bounded budget and retains all unprocessed
debt. A half-second request commits eight, leaves 52 pending, and publishes
frame 8, not frame 60. An equal request calls neither provider nor observer and
does not drain debt. Positive fractional advancement follows B2's exact-time
rules; floats/deltas are not accepted by this controller.

`clock()` exposes requested/completed/backlog. `frame()` identifies the last
successfully evaluated tick and pose; after a completed public call its tick
matches completed. Rust returns an immutable borrow; TS returns a detached copy.
Stopping between pumps preserves state/debt. No pause, play, event, crossfade,
seek or GUI policy is added.

## Numerical sharing and Legacy isolation

Only the elementary semi-implicit spring equations are shared: Rust
`BoneSim::step` and TS `springStep`. Legacy retains its old mass/clamp/impulse
division, step count, remainder, cap and nonfinite behavior. Replay calls the
elementary operation once with a single-tick impulse; it never invokes or drains
either Legacy accumulator. Pose offset application/FK helpers are reused.
No spring parameter or file meaning changes.

Full Legacy before/after traces are compared separately. Legitimate parent/child
and authored-order effects are retained; independent sibling constraints remain
exactly independent within each implementation.

## Failure boundary

Invalid context and nonrepresentable clock requests fail before work. Tick-input,
numerical or observer failure does not commit the failed tick or replace the
last good public frame. A completed prefix remains completed. Numerical records
may already have been modified: **there is no B6 transactional rollback**.

The instance becomes faulted and refuses subsequent requests/pumps, even an
equal-time request, until explicit successful reset. Rust's pessimistic fault
guard also remains set on panic unwinding; callbacks should return errors.
TS catches callback failures and rejects reentrant mutations while processing.
There is no silent retry of a partially applied spring state. Other instances
remain unaffected. Nonfinite values are never labeled conformant or published
as a successful new frame.

Clock/request validation, rig validation and numerical failures are distinct
from a full recovery transaction. Latest-frame access during fault returns only
the last good completed frame, not evidence that private records were restored.
