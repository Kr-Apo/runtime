# Next slice — recommendation only

A3 establishes an explicitly bounded fixed-skin weighted FFD frame alongside Physics. It does not qualify all Classic/native features or combine FFD with dynamic skins.

Recommended next slice: **static linked mesh ownership and explicit inherited FFD**, beginning with an audit of Rust CPU/export behavior. Existing historical CPU linked-deform divergence means an alias cannot simply reuse another visible mesh's offsets. Require exact resolved owner, parent topology, skin fallback and inherit_deform semantics, with independent Rust reference, atomic accepted payload and explicit refusal of ambiguous/cyclic links. If Rust author/export truth is inconsistent, stop for a separate Editor authorization before a runtime correction. No linked implementation has begun.

An alternative lower-risk next slice is static slot visibility/color/attachment state at accepted tick. It still needs one complete accepted-frame payload, fixed owner resolution, unchanged transparent/PMA behavior and bank preparation checks; it must not merely remove global guards.

Events should follow a separately agreed tick-zero, loop, backlog and reentrancy delivery policy. Clipping requires transaction-safe range/end-slot preparation in both renderers. Mixing requires a coherent Physics transport/reset policy and should come later. Dynamic skins plus weighted FFD needs ownership/topology and activation-transition qualification before opt-in admission.

Each proposal needs human review and a new authorization. No A4, new channel, Editor change or publication is included in A3.
