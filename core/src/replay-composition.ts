import {parseRig} from "./rig.js";
import {ReplayError} from "./replay-physics.js";
import {validateAnimatedSlotsRig} from "./replay-slots.js";
import {validateEventRig} from "./replay-events.js";
import type {RuntimeRigData} from "./types.js";
import type {SkinEvent} from "./replay-skin.js";
export interface SlotsEventsOptions {readonly animatedSlots:true;readonly animationEvents:true}
/** Admission projections only. Neither the authored/native source nor either standalone gate is changed. */
export function compositionSources(source:RuntimeRigData,clip:string,calendar?:readonly SkinEvent[]){
 const r=parseRig(structuredClone(source)),a=r.animations[clip];
 if(!a||!(a.slots.length||a.drawOrder.length)||!a.events.length)throw new ReplayError("Slots/events composition requires both nonempty channel families");
 const slots=structuredClone(r);slots.animations[clip]!.events=[];
 const events=structuredClone(r);events.animations[clip]!.slots=[];events.animations[clip]!.drawOrder=[];
 validateAnimatedSlotsRig(slots,clip,calendar);validateEventRig(events,clip,calendar);return{slots,events};
}
export function validateSlotsEventsRig(source:RuntimeRigData,clip:string,calendar?:readonly SkinEvent[]):void{compositionSources(source,clip,calendar);}
