import {parseRig} from "./rig.js";
import {ReplayError} from "./replay-physics.js";
import {linkedGeometry,linkedMeshSources} from "./replay-linked.js";
import {validateWeightedFfdRig} from "./replay-ffd.js";
import {validateReplaySlotState} from "./replay-slots.js";
import type {GeometryOwner} from "./replay-linked.js";
import type {ReplaySlotState} from "./replay-slots.js";
import type {ReplayDeformation} from "./replay-ffd.js";
import type {RuntimeRigData,MeshAttachment,DeformTrack} from "./types.js";
import type {SkinEvent} from "./replay-skin.js";
export interface LinkedFfdOptions {readonly linkedMeshes:true;readonly animatedSlots:true;readonly weightedFfd:true}
export interface LinkedFfdBinding {readonly owner:string|null;readonly slot:string;readonly attachment:string|null;readonly visible:boolean;readonly geometryOwner:GeometryOwner|null;readonly deformOwner:GeometryOwner|null;readonly timelineOwner:GeometryOwner|null;readonly texture:string|null}
export interface LinkedFfdPlan {readonly rig:RuntimeRigData;readonly slots:RuntimeRigData;readonly clip:string;readonly owners:readonly {owner:string;slot:string;attachment:string;size:number;track:DeformTrack|undefined}[]}
export const LINKED_FFD_LIMITS=Object.freeze({meshes:32,owners:16,keysPerTrack:4096,componentsPerFrame:32768,storedComponents:1048576});
// B2 is opened only after independent B1 qualification.
const OWN_TRACKS_QUALIFIED=true;
const need=(v:unknown,m:string)=>{if(!v)throw new ReplayError('Linked FFD: '+m);};
const key=(slot:string,attachment:string)=>slot+'\0'+attachment;
function ownerOf(r:RuntimeRigData,slot:string,name:string){
 const e=r.skins[0]!.attachments.find(e=>e.slot===slot&&e.name===name);need(e,'missing displayed attachment');
 const resolved=linkedGeometry(r,r.defaultSkin!,e!);const a=resolved.attachment;
 const deform=a.type==='mesh'?(e!.attachment.type==='mesh'&&e!.attachment.linked?.inherit_deform?resolved.owner:{skin:r.defaultSkin!,slot,attachment:name}):null;
 return{resolved,deform};
}
/** Dedicated bounded admission. Old static/A3/A8 gates remain closed and unchanged. */
export function linkedFfdSources(source:RuntimeRigData,clip:string,calendar?:readonly SkinEvent[]):LinkedFfdPlan{
 const rig=parseRig(structuredClone(source));need(Object.hasOwn(rig.animations,clip),'missing clip');const a=rig.animations[clip]!;
 need(Array.isArray(a.deform)&&a.deform.length<=LINKED_FFD_LIMITS.owners,'deform track budget');
 const slots=structuredClone(rig);slots.animations[clip]!.deform=[];const projected=linkedMeshSources(slots,clip,calendar);
 const meshes=rig.skins[0]!.attachments.filter(e=>e.attachment.type==='mesh');need(meshes.length<=LINKED_FFD_LIMITS.meshes,'mesh budget');
 const owners:LinkedFfdPlan['owners'][number][]=[],seen=new Set<string>();
 for(const e of meshes){const {resolved,deform}=ownerOf(rig,e.slot,e.name),m=resolved.attachment as MeshAttachment;if(!deform||!m.weighted)continue;const id=key(deform.slot,deform.attachment);if(seen.has(id))continue;seen.add(id);const track=a.deform.find(t=>t.slot===deform.slot&&t.attachment===deform.attachment);owners.push({owner:deform.skin,slot:deform.slot,attachment:deform.attachment,size:2*m.weights.reduce((n,row)=>n+row.bones.length,0),track});}
 need(owners.length>0&&owners.length<=LINKED_FFD_LIMITS.owners&&owners.reduce((n,e)=>n+e.size,0)<=LINKED_FFD_LIMITS.componentsPerFrame,'canonical owner/component budget');
 const tracks=new Set<string>();let stored=0;
 for(const t of a.deform){need(t&&Object.keys(t).sort().join(',')==='attachment,keys,slot','track shape');const id=key(t.slot,t.attachment);need(!tracks.has(id),'duplicate timeline owner');tracks.add(id);
  const e=rig.skins[0]!.attachments.find(e=>e.slot===t.slot&&e.name===t.attachment);need(e,'missing timeline owner');const m=e&&linkedGeometry(rig,rig.defaultSkin!,e).attachment;need(m?.type==='mesh'&&m.weighted,'only weighted FFD owners');
  if(e!.attachment.type==='mesh'&&e!.attachment.linked&&!e!.attachment.linked.inherit_deform)need(OWN_TRACKS_QUALIFIED,'own linked tracks await B2');
  need(Array.isArray(t.keys)&&t.keys.length<=LINKED_FFD_LIMITS.keysPerTrack,'key budget');for(const k of t.keys){need(k&&Object.keys(k).sort().join(',')==='curve,offsets,time'&&Array.isArray(k.offsets),'key shape');stored+=k.offsets.length;}
  // A3 is reused per exact owner in a private admission view. No projected
  // values are sampled or exported. Source binds/geometry stay byte-for-byte native.
  const ffd=structuredClone(projected);ffd.animations[clip]!.slots=[];ffd.animations[clip]!.drawOrder=[];ffd.animations[clip]!.deform=[structuredClone(t)];ffd.slots.find(s=>s.name===t.slot)!.attachment=t.attachment;validateWeightedFfdRig(ffd,clip,calendar);
 }
 need(stored<=LINKED_FFD_LIMITS.storedComponents,'stored component budget');
 need(owners.some(e=>e.track&&e.track.keys.length>0),'at least one applicable weighted FFD timeline; otherwise use static A9');
 return{rig,slots:projected,clip,owners};
}
export function validateLinkedFfdRig(source:RuntimeRigData,clip:string,calendar?:readonly SkinEvent[]):void{linkedFfdSources(source,clip,calendar);}
/** Identity only. No timeline sampling, evaluator or Physics; safe for metadata. */
export function linkedFfdBindings(rig:RuntimeRigData,clip:string,state:ReplaySlotState):LinkedFfdBinding[]{
 validateReplaySlotState(rig,state,state.tick,clip,rig.defaultSkin!);
 return state.slots.map(s=>{if(s.attachment===null)return{owner:null,slot:s.name,attachment:null,visible:s.visible,geometryOwner:null,deformOwner:null,timelineOwner:null,texture:null};
  const {resolved,deform}=ownerOf(rig,s.name,s.attachment),a=resolved.attachment;
  const track=deform&&rig.animations[clip]!.deform.find(t=>t.slot===deform.slot&&t.attachment===deform.attachment&&t.keys.length>0);
  return{owner:rig.defaultSkin!,slot:s.name,attachment:s.attachment,visible:s.visible,geometryOwner:resolved.owner,deformOwner:deform,timelineOwner:track?deform:null,texture:'texture'in a?a.texture:null};
 });
}
const tuple=(a:GeometryOwner|null,b:GeometryOwner|null)=>a===null?b===null:!!b&&Object.keys(b).sort().join(',')==='attachment,skin,slot'&&a.skin===b.skin&&a.slot===b.slot&&a.attachment===b.attachment;
/** After sampling, before B6 accept/clock commit; also reused at presentation. */
export function assertLinkedDeformation(plan:LinkedFfdPlan,d:ReplayDeformation,state:ReplaySlotState,tick:bigint):void{
 need(d&&d.kind==='weighted-ffd/v1'&&d.tick===tick&&state?.tick===tick&&d.clip===plan.clip&&d.skin===plan.rig.defaultSkin,'candidate identity');
 need(Array.isArray(d.entries)&&d.entries.length===plan.owners.length,'canonical owner count');const seen=new Set<string>();
 for(const e of d.entries){const id=key(e.slot,e.attachment),expected=plan.owners.find(v=>key(v.slot,v.attachment)===id);need(expected&&e.owner===expected.owner&&!seen.has(id),'foreign/duplicate FFD owner');seen.add(id);need(Array.isArray(e.offsets)&&e.offsets.length===expected!.size&&e.offsets.every(Number.isFinite),'sampled dimensions/finitude');}
 const expected=linkedFfdBindings(plan.rig,plan.clip,state);need(Array.isArray(d.bindings)&&d.bindings.length===expected.length,'complete linked bindings');
 expected.forEach((e,i)=>{const b=d.bindings![i]!;need(b&&Object.keys(b).sort().join(',')==='attachment,deformOwner,geometryOwner,owner,slot,texture,timelineOwner,visible'&&b.owner===e.owner&&b.slot===e.slot&&b.attachment===e.attachment&&b.visible===e.visible&&b.texture===e.texture&&tuple(e.geometryOwner,b.geometryOwner)&&tuple(e.deformOwner,b.deformOwner)&&tuple(e.timelineOwner,b.timelineOwner),'wrong displayed/geometry/deform/timeline owner');});
}
