import {parseRig} from './rig.js';
import {ReplayError} from './replay-physics.js';
import {validateWeightedFfdRig} from './replay-ffd.js';
import {validateAnimatedSlotsRig} from './replay-slots.js';
import type {RuntimeRigData} from './types.js';
import type {SkinEvent} from './replay-skin.js';
export interface ComposedFfdOptions {readonly weightedFfd:true;readonly animatedSlots:true}
export interface ClippedFfdOptions extends ComposedFfdOptions {readonly clipping:true}
const need=(ok:unknown,message:string)=>{if(!ok)throw new ReplayError('Composed FFD: '+message);};
/** Admission-only projections reuse both closed standalone gates. Native geometry/binds stay exact. */
export function ffdCompositionSources(source:RuntimeRigData,clip:string,calendar?:readonly SkinEvent[],clipping=false){
 const rig=parseRig(structuredClone(source)),a=rig.animations[clip];
 need(a&&a.deform.length===1&&a.deform[0]!.keys.length>0,'one nonempty FFD owner required');
 need(a!.slots.length>0||a!.drawOrder.length>0,'nonempty slot family required');
 const target=a!.deform[0]!,slot=rig.slots.find(s=>s.name===target.slot);
 need(slot&&slot.attachment===target.attachment,'stable displayed setup owner required');
 for(const track of a!.slots)if(track.name===target.slot&&track.channel==='attachment')need(track.keys.every(k=>k.name===target.attachment),'FFD target attachment must stay exact, including when invisible');
 const slots=structuredClone(rig);slots.animations[clip]!.deform=[];
 validateAnimatedSlotsRig(slots,clip,calendar,clipping);
 if(clipping)need(rig.skins[0]!.attachments.some(e=>e.attachment.type==='clipping'),'clipping capability requires a real mask');
 const ffd=structuredClone(rig);ffd.animations[clip]!.slots=[];ffd.animations[clip]!.drawOrder=[];
 // Only previously validated non-rendering masks are absent from the FFD admission view.
 // No source vertices/UVs/indices/weights/binds are rewritten. Bone transforms do not depend on masks.
 if(clipping)ffd.skins[0]!.attachments=ffd.skins[0]!.attachments.filter(e=>e.attachment.type!=='clipping');
 validateWeightedFfdRig(ffd,clip,calendar);
 return{ffd,slots,target:{owner:rig.defaultSkin!,slot:target.slot,attachment:target.attachment}};
}
export function validateComposedFfdRig(source:RuntimeRigData,clip:string,calendar?:readonly SkinEvent[],clipping=false):void{ffdCompositionSources(source,clip,calendar,clipping);}
