import {parseRig} from './rig.js';
import {ReplayError} from './replay-physics.js';
import {ReplaySlots,validateAnimatedSlotsRig,validateReplaySlotState} from './replay-slots.js';
import type {ReplaySlotState} from './replay-slots.js';
import type {ReplayMixState} from './replay-mixing.js';
import type {RuntimeRigData} from './types.js';

export const SLOT_MIX_LIMITS=Object.freeze({slots:128,attachments:512,keys:4096});
const need=(v:unknown,m:string)=>{if(!v)throw new ReplayError('Slot crossfade: '+m);};
/** Admission projections only; the authored source and standalone A4 gate are unchanged. */
export function slotMixSources(source:RuntimeRigData,animationEvents=false):Map<string,RuntimeRigData>{
 const rig=parseRig(structuredClone(source));
 need(rig.slots.length>0&&rig.slots.length<=SLOT_MIX_LIMITS.slots,'slot budget');
 need(rig.skins[0]!.attachments.length<=SLOT_MIX_LIMITS.attachments,'attachment budget');
 need(Object.values(rig.animations).some(a=>a.slots.length||a.drawOrder.length),'animated slot family required');
 const result=new Map<string,RuntimeRigData>();
 for(const[name,a]of Object.entries(rig.animations)){
  need(a.slots.every(t=>t.keys.length<=SLOT_MIX_LIMITS.keys)&&a.drawOrder.length<=SLOT_MIX_LIMITS.keys,'key budget');
  const view=structuredClone(rig);view.animations={[name]:structuredClone(a)};if(animationEvents)view.animations[name]!.events=[];
  validateAnimatedSlotsRig(view,name);result.set(name,view);
 }
 return result;
}
export function validateSlotMixingRig(rig:RuntimeRigData,animationEvents=false):void{slotMixSources(rig,animationEvents);}
/** Normalized native RGBA; discrete source while weight<1, target at exactly1. */
export function mixSlotStates(rig:RuntimeRigData,a:ReplaySlotState,b:ReplaySlotState,weight:number,tick:bigint,clip:string):ReplaySlotState{
 need(Number.isFinite(weight)&&weight>=0&&weight<=1,'weight');
 validateReplaySlotState(rig,a,a.tick,a.clip,rig.defaultSkin!);validateReplaySlotState(rig,b,b.tick,b.clip,rig.defaultSkin!);
 const discrete=weight===1?b:a;
 const slots=a.slots.map((s,i)=>({...discrete.slots[i]!,color:s.color.map((x,k)=>weight===0?x:weight===1?b.slots[i]!.color[k]!:x+(b.slots[i]!.color[k]!-x)*weight)as [number,number,number,number]}));
 const state:ReplaySlotState={kind:'animated-slots/v1',tick,clip,skin:rig.defaultSkin!,slots,drawOrder:[...discrete.drawOrder]};
 validateReplaySlotState(rig,state,tick,clip,rig.defaultSkin!);return state;
}
/** Existing A4 samplers with independent clip phases, called only in the numerical candidate. */
export class ReplaySlotMixer {
 readonly #rig:RuntimeRigData;readonly #samplers=new Map<string,ReplaySlots>();
 constructor(rig:RuntimeRigData,animationEvents=false){this.#rig=structuredClone(rig);for(const[name,view]of slotMixSources(rig,animationEvents))this.#samplers.set(name,new ReplaySlots(view,name));}
 sample(m:ReplayMixState,frozen?:ReplaySlotState):ReplaySlotState{
  const tr=m.transition;
  need(!tr?.source||tr.status!=='active'||!!frozen,'paired frozen slot source required');
  if(frozen){need(tr?.status==='active'&&tr.source?.tick===frozen.tick&&tr.source.clip===frozen.clip,'frozen slot provenance');this.validate(frozen,frozen.tick,frozen.clip);}
  const a=frozen??this.#samplers.get(m.activeClip)!.sample(m.activeTick);
  if(tr?.status==='active')return mixSlotStates(this.#rig,a,this.#samplers.get(tr.to)!.sample(tr.toTick),tr.weight,m.tick,m.activeClip);
  const state={...a,tick:m.tick,clip:m.activeClip};validateReplaySlotState(this.#rig,state,m.tick,m.activeClip,this.#rig.defaultSkin!);return state;
 }
 validate(state:ReplaySlotState,tick:bigint,clip:string){validateReplaySlotState(this.#rig,state,tick,clip,this.#rig.defaultSkin!);}
}
