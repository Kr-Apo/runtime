import {parseRig} from "./rig.js";
import {ReplayError} from "./replay-physics.js";
import {ffdMixSources} from "./replay-ffd-mixing.js";
import {validateSlotMixingRig} from "./replay-slot-mixing.js";
import {mixEventSources} from "./replay-mix-events.js";
import type {RuntimeRigData} from "./types.js";
import type {ReplaySlotState} from "./replay-slots.js";
import type {ReplayDeformation} from "./replay-ffd.js";
/** A17 bounds are independent of every historical capability. Units are UTF16 code units. */
export const INTEGRATED_LIMITS=Object.freeze({bones:128,slots:32,attachments:128,components:512,storedComponents:131072,identityUnits:32768,captureUnits:98304,slotUnits:12288,eventPayloadUnits:8192,eventUnits:32768});
const need=(v:unknown,m:string)=>{if(!v)throw new ReplayError('Integrated combat: '+m);};
export const integratedUnits=(v:unknown)=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?'#bigint:'+String(x):x).length;
/** Explicit coordinated views. Every removed family is admitted independently on the unmodified source. */
export function integratedSources(source:RuntimeRigData){
 const rig=parseRig(structuredClone(source));
 need(Object.keys(rig.animations).sort().join(',')==='Attack,Death,Hit,Idle','exact four combat clips');
 need(rig.bones.length<=INTEGRATED_LIMITS.bones&&rig.slots.length<=INTEGRATED_LIMITS.slots&&rig.skins.length===1&&rig.skins[0]!.attachments.length<=INTEGRATED_LIMITS.attachments,'rig budget');
 const ffd=structuredClone(rig),slots=structuredClone(rig),events=structuredClone(rig);let stored=0;
 for(const[name,a]of Object.entries(rig.animations)){
  ffd.animations[name]!.slots=[];ffd.animations[name]!.drawOrder=[];ffd.animations[name]!.events=[];
  slots.animations[name]!.deform=[];events.animations[name]!.deform=[];
  for(const t of a.deform)for(const k of t.keys)stored+=k.offsets.length;
  for(const t of a.slots)for(const k of t.keys)need(k.time<=Math.fround(a.duration),'slot key outside clip');
  for(const k of a.drawOrder)need(k.time<=Math.fround(a.duration),'draw key outside clip');
  for(const e of a.events)need(integratedUnits(e)<=INTEGRATED_LIMITS.eventPayloadUnits,'event payload budget');
 }
 const p=ffdMixSources(ffd);validateSlotMixingRig(slots,true);mixEventSources(events);
 need(p.size<=INTEGRATED_LIMITS.components&&stored<=INTEGRATED_LIMITS.storedComponents&&p.rigIdentity.length<=INTEGRATED_LIMITS.identityUnits,'FFD/identity budget');
 const slot=rig.slots.find(s=>s.name===p.target.slot);
 need(slot&&slot.attachment===p.target.attachment,'setup exact FFD attachment');
 for(const a of Object.values(rig.animations))for(const t of a.slots)need(t.name!==p.target.slot||t.channel==='color','FFD slot attachment/visibility tracks excluded, including constant tracks');
 return{rig,ffd,slots,events,target:p.target};
}
/** No timeline sampling: joint invariant at the B6 boundary and before journal capture. */
export function assertIntegratedState(slots:ReplaySlotState,d:ReplayDeformation):void{
 const e=d?.entries?.[0],s=slots?.slots?.find(s=>s.name===e?.slot);
 need(e&&d.entries.length===1&&s&&s.visible===true&&s.owner===e.owner&&s.attachment===e.attachment&&slots.tick===d.tick&&slots.clip===d.clip&&slots.skin===d.skin,'selected visible exact FFD owner in composed frame');
 need(integratedUnits(slots)<=INTEGRATED_LIMITS.slotUnits,'slot snapshot budget');
}
export function assertIntegratedEvent(event:unknown):void{need(integratedUnits(event)<=INTEGRATED_LIMITS.eventUnits,'accepted event snapshot budget');}
