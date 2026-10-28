# T-840C1 — Time and observable boundaries

## Exact qualification

B2 remains the sole Physics clock,120ticks/s, BigInt rational seconds. Exact render
schedules request(frame,fps) for30/60/120/144FPS; irregular requests and exact500ms
hitches use integer/rational time. Request budget8, explicit pump budget, no dropped
debt or hidden future sample. At target60 with8completed, every world/mesh comes
from8, backlog52. Pump3 displays11/debt49. Capture->present is a read-only mapping;
redraw uses already prepared meshes and never invokes request,pump or sampling.

Snapshot owns coherent tick/context/epoch/records/bones. Rendering retains it for
use and cannot read partly updated physics. A graphics error after a successful
request cannot roll back that accepted tick. Candidate integration/audit errors
instead retain last accepted numerical prefix and fault until reset, per B6.

Pause stops requests/pumps and preserves debt. Resume from ordinary pause is explicit.
Stop/reset reconstruct origin with the existing new epoch rules. Each owner has one
active epoch/clock, never a parallel Physics clock; lifecycle reconstruction changes
epoch only as the already accepted transport contract specifies. Pure seek creates
a separate preview type: displayedTick may be60 while committed poseTick is0. Resume
then refuses; explicit replay from zero or restart is required. UI labels simulated,
pure-preview, catching-up and faulted, plus host/solver/presentation error categories.
Replay catch-up never reconstructs history implicitly during redraw.

## Isolated real-time demonstration

Source performance.now (monotonic browser timestamps); each running segment uses
absolute elapsed milliseconds from its origin, multiplied by1000 and FLOORED to
integer microseconds. Add those segment integers with BigInt; send requestTime(n,1e6).
No repeated deltaSeconds accumulation, EPS adjustment, f32 host clock or dropped hitch.
Sub-microsecond fractions are discarded on segment pause: under1microsecond per
completed running segment, plus browser timer quantization/error. This defines the
demo policy, not recovery of an unknowable intended rational cadence. There is no
claim of exact real-time120boundary equivalence for rounded host doubles.

Pause captures running integer microseconds; wall time while paused is excluded.
Resume reanchors a new segment. Restart real time explicitly resets origin/transport,
so switching from arbitrary exact requests cannot create backward time. Monotonicity,
finite/safe integer ranges and B4 horizon (8,388,607ticks, about19.4hours) are checked.
Browser suspension is treated as elapsed active time: it creates backlog; not silently
clamped away. Request performs at most8whole ticks; equal-target debt can pump8.
Rendering cadence and simulation cadence remain separate; no forced120FPSdisplay.

No converter is added to RigPlayer.update, PixiPlayback or distributed package exports.
Short live pause/resume is measured, not a long-session certification. Timer resolution,
clock origins, pause truncation accumulation, tab suspension policy, platform drift,
long sessions, workload/memory and real-time budgets need independent qualification
before a distributable host adapter. Exact integer/rational mode remains normative.
