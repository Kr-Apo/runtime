# C6A — committed visual skin contract

Experimental, opt-in, native v2 / PixiJS 8.17 WebGL2 only. No format, solver, calendar or Phaser change.

## Authority and API

`ExperimentalReplayPixiAsset.load(url, {visualSkins:true})` (or `.from(source,pages,{visualSkins:true})`) opts in. `createInstance({clip,epoch?,skinEvents})` requires an explicit nonempty calendar of `{tick:bigint,skin:string}`. Omit the asset opt-in to retain C2: exactly one fixed native default skin and no instance skinEvents. The native default remains present even when calendar tick zero selects another skin.

The existing core `ReplayConsumerBridge` receives the calendar directly. `ReplayTransport` clones it; `SkinCalendar` validates and owns immutable selections. Tick zero first; strictly increasing bigint ticks in [0,8388607]; unique native skin identities, known names and valid memberships. No renderer-side calendar, mutable skin setter, inferred left/right mapping, attachment timeline or runtime JSON patch. Events are absolute simulation ticks; clip looping does not repeat/reset the calendar. Replace it by creating a new instance. Stop/reset/replay retain the existing calendar; epochs and presentation tokens follow B5B2.

For each accepted presentation the immutable token supplies BOTH bones and skin. Committed skin is `currentFrame().skin`, resolved at completed/poseTick, never requested time. Requested60/completed8/backlog52 therefore displays default8; completing20 displays festival20. `visualSkin` names the last successfully presented snapshot, not a forecast. Inspect `displayed.kind`: a `pure-preview` is labeled and may show another skin without any simulated Physics history at that tick. The committed frame after seek remains origin; replay explicitly reconstructs history. Pause/pump/resume and C3 host time remain core-controlled.

## Native membership versus graphical resolution

Audited sources: Editor `core/src/replay_skin.rs`, `core/src/replay_consumer.rs`, skeleton attachment resolution; Runtime `core/src/replay-skin.ts`, `replay-transport.ts`, `replay-consumer.ts`, `attachments.ts`; Pixi `rig.ts`, `experimental-replay.ts`.

Constraint activation preserves native order. Start with all constraints; exclude memberships owned by other NON-default inactive skins, then remove exclusions owned by the selected skin. Default attachment fallback is NOT a union of default constraint membership. Skin bone membership is validated; it does not hide bones or change hierarchy/FK.

For a setup slot/attachment name, resolve the selected skin first, then the default skin. If neither owns it, native Rust resolves no attachment: hide the slot in this opt-in presentation. An attachment name absent from ALL skins is a broken reference and rejected on load. Courier's badge exists only in festival; left_thigh falls back to default in festival; scarf falls back in night. These are qualified against native Rust resolve results. Legacy's separate14 missing-attachment divergences remain untouched.

Only the new Replay facade passes a validated skin with the immutable pose to existing `PixiRigInstance.applyPose`. It reuses the existing region geometry, shaders, UV/alpha mapping and slot mesh cache. It never starts Legacy playback or calls its setSkin. Setup visibility/order/color remain static. The cached per-skin layout only represents legitimate native absence; it does not fabricate animation channels.

## Errors and ownership

Native B6 fault at a transition rejects that candidate tick, membership changes and spring records. The last committed skin/bones remain; `health=faulted`, reset required. Presenting this retained frame is permitted. A graphics failure cannot commit or roll back numerical ticks and never publishes a successful display token.

Stale/forged/foreign/wrong-kind/old-epoch tokens refuse. Full-page dimensions, resolution1, PMA, live textures/sources and pinned page/TextureSource identity are revalidated before a cached present, inside guarded presentation and on render. Caller map entries are snapshotted: replacing an entry in the original map does not replace an asset page. Destroying or changing an owned/borrowed TextureSource is refused. Other out-of-band mutation of adapter-owned meshes/shaders is unsupported. Context loss/recovery is not newly certified here.

`from` borrows pages; disposal never destroys them. `load` owns decoded pages and cleans completed decodes on ordinary failure/abort. Live views block asset destruction. Views own meshes/geometries/buffers/effects, not page textures. A peer disposal preserves shared pages. Final owned asset destruction releases original pages. One new mesh per newly visible slot is allowed; a hidden mesh is retained for bounded reuse, not leaked.

Redraw with no changed token is observational: no new pose transfer/submission/buffer update. Resource validation still executes. A presentation can have externally visible partial GPU effects: it is NOT a GPU transaction. The last successful token stays published; a dirty marker forces a subsequent valid retry to repair controlled view buffers. Resource identity failures before presentation do not modify the view. No multi-context, device-loss, total GPU memory or hardware-wide safety claim.
