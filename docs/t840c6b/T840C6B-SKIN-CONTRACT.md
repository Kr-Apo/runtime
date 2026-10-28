# C6B — Phaser committed visual skin contract

Experimental native v2 / Phaser 3.90.0 / real WebGL2, nonempty Physics-only rigs and static regions. The default package entry, Legacy behavior and fixed C4/C5B mode remain unchanged.

## Opt-in and temporal authority

Use `ExperimentalReplayPhaserAsset.load(game,url,{visualSkins:true})`, or `from(game,source,{pageTextureKeys,visualSkins:true})`. Instance options are `{clip,epoch?,skinEvents}`. Events have the same C6A shape `{tick:bigint,skin:string}`. Without the asset flag: one fixed default skin, no skinEvents option. The native default skin must always exist. The explicit calendar may select another native skin at tick zero.

The adapter passes this calendar to the existing ReplayConsumerBridge. ReplayTransport clones it and existing SkinCalendar validates tick zero, strict increasing bigint ticks in [0,8388607], skin identities and memberships. All original skins and clips are validated; nothing is projected away to pass validation. There is no new calendar, mutable visual skin setter, solver, event journal or numeric equation. Calendar time is absolute, not repeated with the clip loop. Stop/reset/replay retain it. Recreate an instance to replace its calendar.

A token carries BOTH immutable bones and skin from the same consumer snapshot. With requested60/completed19/backlog41 the visible skin is Default19. Only completed20 allows Festival20. A redraw never advances Physics. Active constraints are selected only by core B5B1. Native membership excludes ownership of inactive NON-default skins, then restores selected ownership; graphical default fallback does not union default constraint membership. Bone membership is validated without hiding bones or changing FK hierarchy.

## Native attachment resolution

Use selected skin first, then native default. If neither defines the setup slot/attachment, native absence hides this slot. A setup name absent from ALL skins is invalid and refused. Missing texture/page, invalid reference, incompatible attachment, legitimate absence and external page replacement are distinct failures. Courier's festival-only badge, festival thigh fallback and night scarf fallback match native Rust resolution. The14 Legacy missing-attachment divergences retain their separate policy and are untouched.

The per-skin layout only represents legitimate absence. It does not add slot animation channels. The internal existing Phaser presentation facade accepts the token skin with the token pose, reuses appearance/mesh caches and calls the existing regionQuad, Vertex.setUVs and Face.transformCoordinatesLocal path. No Legacy playback is started. A dynamic constructor defers the initial setup presentation until a valid consumer token can resolve absence. Fixed construction retains its original setup behavior.

## Tokens, preview and faults

capture/present tokens are deep-frozen and registered in the owner's WeakMap. Owner/context/epoch/tick/request/backlog/state and kind are checked. Preview19→20→40→19 creates fresh contexts; old tokens refuse. `presentPreview` is explicitly pure FK, not historically simulated Physics. Committed origin remains separately inspectable after seek. Replay reconstructs history from origin. Reset invalidates tokens; get the new consumer context.

A B6 fault on transition20 retains completed19, its skin, bones and spring records. Requested time may remain ahead; health is faulted and reset is mandatory. Presentation errors are thrown separately and cannot undo a numerical commit. displayed/visualSkin update only after successful CPU view application/projection. They are not a GPU-completion certificate. GPU effects are not atomic. A controlled partial update retains the old successful token; a valid retry repairs the view. External irreversible GPU effects are outside rollback.

## Resource and host protocol

Before cached present and inside guarded consumer.present, recheck the existing C5B Game/context qualification and every atlas page. The opt-in path additionally pins TextureSource identity; TextureManager key/object identity, dimensions and PMA remain dynamic. No texture validity cache and no repeated VERSION query on an already qualified live Game. Loss/restoration invalidates C5B qualification; changing renderer/context identity refuses. The host must call present on Scene prerender as in the example; a bare renderer submission without the presentation protocol is not an alternative validation API.

Application transforms belong to the 2D root/parent and camera. Adapter-owned 3D mesh transforms, vertices, shader/texture bindings must not be mutated by the host. Game/Scene lifetime and borrowed-page responsibilities remain C4. Physics uses exact requests or the existing C3 bridge at 1×. User host bridges must be disposed/rebound after context/epoch changes.

Refused: mesh/FFD/clipping, attachment sequences, animated slots/colors/order, dark tint, advanced blends, mixed constraints, crossfade/layers/gameplay events and WebGL1/Canvas. No format/package/version/default-export change.
