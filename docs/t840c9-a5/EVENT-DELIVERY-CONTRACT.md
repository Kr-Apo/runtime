# Committed event delivery — A5

## Numerical transaction

For candidate tick N, existing B6 clones records, evaluates native bone inputs, executes Physics and verifies finitude. A5 then prepares a candidate event queue from the same accepted interval, validating data/capacity. Candidate events remain private: they are absent from ReplayFrame, ConsumerFrame and the diagnostic precommit observer. The observer gets its ordinary detached pose/records only. Drain/status reject reentrance while numerical work is busy.

Before acceptance, the new queue array and detached payloads are fully prepared. The existing private accept step performs pointer assignments for records, active constraints, frame and queue; then the unchanged clock commits. No app event callback, await or external effect runs in that boundary. A late observer throw or a numerical/capacity fault cannot publish candidate events. Previously accepted ticks and their queued occurrences remain accepted and drainable, even when the transport is faulted. A multi-tick request is a sequence of commits, not one global transaction.

A render failure after numerical commit cannot undo events or Physics. Existing banks may keep the old visible picture while the application receives the already accepted events. Retrying the same presentation, observing snapshots, pause or placement changes cannot emit a second event.

## API and acknowledgement

`ReplayConsumerBridge.drainEvents(context)` returns a detached array of committed occurrences and clears that queue before returning to application code. `eventStatus(context)` reports session, pending count and capacity. Context object identity is required; a matching epoch integer, stale frame or foreign context cannot drain. The methods require the explicit event capability and reject disposal, numerical reentrance and mutation during presentation. `ApplicationActor.drainEvents()` forwards with its owned context and adds its actorId.

Each occurrence carries session, epoch, clip, accepted tick, absolute lap, authored keyIndex, per-tick ordinal, id and the original native event object. Authored time is event.time. Session IDs are unique within this process; id includes session/epoch/tick/lap/keyIndex. They are not durable launch identities or security capabilities. Independent actors have distinct queues/sessions. Payloads are not returned by live reference; mutating returned data cannot alter the source or subsequent occurrences.

Drain is acknowledgement of the entire returned batch. A user callback exception after drain does not roll back Physics and does not automatically retry the consumed batch, including unprocessed remaining entries. Applications needing retries/durable side effects must retain the detached batch themselves. This is at-most-once dequeue within a session, not a promise of exactly-once external effects across crashes.

## Bounded storage

Capacity is 1024 queued occurrences. Key count and string sizes are bounded at admission. Candidate enumeration is bounded before looping over very short-clip laps. If a whole candidate batch would exceed capacity, the entire candidate fails before commit: no partial append, drop-oldest, coalescing or silent truncation. The existing B6 fault state requires reset. Pending accepted prefix remains drainable before reset; draining alone does not heal a fault. Applications should drain after each update and monitor eventStatus; the demo does this. This simple policy can require replay after a slow consumer; no automatic retry policy is invented.

The file may hold 1024 detached payload objects plus the prepared bounded candidate copy. String/occurrence limits bound reachability, not an exact JavaScript heap byte budget. There is no unbounded event ledger in the core. The demo keeps only the last128 entries and a count.

## Lifecycle matrix

| Operation | Pending events / identity |
|---|---|
| Repeated frame, render or paused observation | No new events, queue retained |
| Request/pump | Only completed ticks enqueue; future backlog does not |
| Pause/resume | Retain queue/backlog and same session; no replay |
| Stop, reset, explicit restart | Discard old pending queue, new numerical session/epoch |
| Origin replay | Discard old pending queue; newly accepted replay ticks produce new-session occurrences |
| Pure seek/sample preview | Refused without changing state/queue |
| Reload/recreate | Old actor/consumer destroyed; fresh session; no old events leak |
| Dispose | Drop transport/source/instance/queue reachability; further drain refuses |

If a pending event matters, drain before an explicit reset/stop/replay. No t=0 event is generated on any new session. The existing host bridge retains its policy: an identical host timestamp does not pump debt; pause preserves backlog and defers the active tail. Browser hidden/freeze/context loss uses the existing suspension logic rather than fabricating event windows from RAF.
