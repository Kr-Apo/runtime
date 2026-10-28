export { createEvaluationState, evaluate, multiply } from "./evaluate.js";
export type { EvaluateOptions } from "./evaluate.js";
export { attachmentWorldPoint, attachmentWorldVertices, findAttachment } from "./attachments.js";
export { RigPlayer } from "./player.js";
export { animationOf, parseRig, RigFormatError, unsupportedFeatures } from "./rig.js";
export { AnkhFormatError, assetRootFor, loadAnkh, parseAnkh, safeAssetPath } from "./ankh.js";
export type { LoadAnkhOptions, ParseAnkhOptions } from "./ankh.js";
export { ANKH_COMPACT_FIELDS, expandCompact } from "./compact.js";
export { decodeMessagePack, MessagePackError } from "./messagepack.js";
export type * from "./ankh-types.js";
export type * from "./types.js";
export { ReplayClock, ClockError, SimulationProfile, TICKS_PER_SECOND, INTERACTIVE_BUDGET, MAX_BUDGET, MAX_CLOCK_INTEGER } from "./replay-clock.js";
export type { ClockErrorCode, ClockSnapshot, RationalTime, ScheduledTick, TickResult, TickConsumer, ClockStop, ClockProgress } from "./replay-clock.js";
export { ReplayPhysicsInstance, ReplayError } from "./replay-physics.js";
export type { ReplayContext, ReplayLocal, ReplayRecord, ReplayFrame, ReplayProvider, ReplayObserver } from "./replay-physics.js";
export { ReplayAnimationInstance, canonicalTime, MAX_SAMPLE_TICK } from "./replay-animation.js";
export { ReplayTransport } from "./replay-transport.js";
export type { TransportContext, TransportSnapshot, TransportState, PoseKind } from "./replay-transport.js";

export type { SkinEvent, SkinSelection } from "./replay-skin.js";

export { ReplayConsumerBridge } from "./replay-consumer.js";
export type { ConsumerFrame, ConsumerPreview } from "./replay-consumer.js";

// Explicit experimental weighted FFD; historical default admission is unchanged.
export {validateWeightedFfdRig} from "./replay-ffd.js";
export type {WeightedFfdOptions,ReplayDeformation,ReplayDeformEntry} from "./replay-ffd.js";

// Experimental A4, mutually exclusive with weighted FFD; native v2 unchanged.
export {validateAnimatedSlotsRig,validateReplaySlotState} from "./replay-slots.js";
export type {ReplayClippingOptions,ReplayOptions,AnimatedSlotOptions,ReplaySlot,ReplaySlotState} from "./replay-slots.js";

export {EVENT_QUEUE_CAPACITY,validateEventRig} from "./replay-events.js";
export type {ReplayEvent,AnimationEventOptions} from "./replay-events.js";

export {validateSlotsEventsRig} from "./replay-composition.js";
export type {SlotsEventsOptions} from "./replay-composition.js";

export {validateComposedFfdRig} from './replay-ffd-composition.js';
export type {ComposedFfdOptions,ClippedFfdOptions} from './replay-ffd-composition.js';

export {linkedGeometry,linkedMeshSources,validateLinkedMeshRig} from "./replay-linked.js";
export type {LinkedMeshOptions,GeometryOwner} from "./replay-linked.js";

export {linkedFfdSources,linkedFfdBindings,validateLinkedFfdRig,assertLinkedDeformation,LINKED_FFD_LIMITS} from "./replay-linked-ffd.js";
export type {LinkedFfdOptions,LinkedFfdBinding,LinkedFfdPlan} from "./replay-linked-ffd.js";

export {ReplayMixPlan,mixBoneLocals,validateMixingRig,MIX_LIMITS,MIX_ANGLE_TIE} from './replay-mixing.js';
export type {CrossfadeOptions,FrozenOrigin,FrozenPose,TransitionRequest,MixTransition,ReplayMixState,ReplayMixSample,MixCommand} from './replay-mixing.js';

export {ReplaySlotMixer,mixSlotStates,slotMixSources,validateSlotMixingRig,SLOT_MIX_LIMITS} from './replay-slot-mixing.js';

export {ReplayMixEvents,mixEventSources,mixingEventOwner} from './replay-mix-events.js';

export {ReplayFfdMixer,ffdMixSources,FFD_MIX_LIMITS} from './replay-ffd-mixing.js';
export type {FrozenFfd} from './replay-ffd-mixing.js';

export {integratedSources,INTEGRATED_LIMITS,assertIntegratedState} from "./replay-integrated.js";
