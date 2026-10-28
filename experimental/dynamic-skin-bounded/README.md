# Q1 private dynamic admission

This is a separate experimental Node-supervised path, not an extension of the
fixed N6 bank and not a public package export. The trusted launcher supplies an
independent anchor path and SHA-256. A certificate cannot approve itself.

`createSupervisor({anchorPath, anchorSHA256, dependencyRuntime, chrome})` verifies
the pinned bank, sources, native/project assets, independent Rust/Node/Chrome
proofs, exact executed JavaScript and exact Chrome/V8/host identity. Authorization
binds one approved trajectory, one of its four exact histories and one instance.
Opaque tickets are single-use and cannot be transferred to another instance.

Only `observe`, `next`, `execute`, `preview`, `diagnostics`, `present`, `evidence`
and `dispose` are exposed by a session. No consumer, rig, context, mutable getter,
free factory, raw pump, runtime skin setter or host-time API is exposed.

Execute the exact envelope returned by `next()`. Session/cursor/epoch and command
must agree. H is inclusive; H+1 is refused before simulation. Snapshots and plans
are detached. Actual completed tick determines skin/selection; preview has its
own tick/skin. Selection describes slots, names, owner, type, page, mesh topology
and influences, or explicit absence. There are no renderer buffers.

Every candidate is checked against the independently qualified Chrome baseline
before commit. A B6 failure rolls back the unaccepted candidate and terminally
faults the session. Already accepted ticks remain. Recover by a new independent
authorization, never by bypassing/resetting a faulted session. Reentrancy and
accessors are rejected. Presentation failures cannot mutate numeric ownership.

`fault-bypass.test.mjs` explicitly copies and reseals the controller for test-only
observer injections and a test eval hook. Normal sources expose neither hook nor
injection. These negative copies never produce favorable certificates.

The trusted Node launcher, anchor, files and local machine are part of the trust
boundary. This is not a sandbox or security guarantee against an owner-controlled
hostile page/process. It authorizes finite numerical trajectories, no graphical
fidelity and no unbounded replay.
