import {parseRig} from "./rig.js";
import {evaluate} from "./evaluate.js";
import {ReplayError} from "./replay-physics.js";
import {validateAnimatedSlotsRig} from "./replay-slots.js";
import type {RuntimeRigData,SkinAttachment,MeshAttachment} from "./types.js";
import type {SkinEvent} from "./replay-skin.js";
export interface LinkedMeshOptions {readonly linkedMeshes:true;readonly animatedSlots:true}
export interface GeometryOwner {readonly skin:string;readonly slot:string;readonly attachment:string}
const need=(v:unknown,m:string)=>{if(!v)throw new ReplayError('Static linked meshes: '+m);};
/** One-level resolution of admitted immutable data. Displayed texture/dimensions, source geometry.
 * No evaluation, bind inversion, UV rewrite or source mutation. Do not use as admission alone. */
export function linkedGeometry(rig:RuntimeRigData,skin:string,entry:SkinAttachment):{attachment:SkinAttachment['attachment'];owner:GeometryOwner}{
 const a=entry.attachment,own={skin,slot:entry.slot,attachment:entry.name};
 if(a.type!=='mesh'||a.linked===null)return{attachment:a,owner:own};
 const l=a.linked;need(skin===rig.defaultSkin&&(l.skin===null||l.skin===rig.defaultSkin),'source skin outside fixed default');
 need(typeof l.slot==='string'&&typeof l.attachment==='string'&&typeof l.inherit_deform==='boolean'&&Object.keys(l).sort().join(',')==='attachment,inherit_deform,skin,slot','link shape');
 const entries=rig.skins.filter(s=>s.name===rig.defaultSkin).flatMap(s=>s.attachments.filter(e=>e.slot===l.slot&&e.name===l.attachment));
 need(entries.length===1,'missing/ambiguous geometry owner');const source=entries[0]!.attachment;
 need(source.type==='mesh'&&source.linked===null,'source must be a real mesh; chains/cycles forbidden');
 if(source.type!=='mesh')throw new ReplayError('not a mesh');
 const dimensions=a as MeshAttachment&{source_width:number;source_height:number};
 return{owner:{skin:rig.defaultSkin!,slot:l.slot,attachment:l.attachment},attachment:{...source,texture:a.texture,sequence:a.sequence,linked:null,source_width:dimensions.source_width,source_height:dimensions.source_height} as MeshAttachment};
}
/** Admission-only derived view. Exact tuples, immutable native data and unchanged source binds. */
export function linkedMeshSources(source:RuntimeRigData,clip:string,events?:readonly SkinEvent[]):RuntimeRigData{
 const r=parseRig(structuredClone(source));need(r.format_version===2&&r.skins.length===1&&r.skins[0]!.name===r.defaultSkin,'native v2 fixed default skin required');
 const entries=r.skins[0]!.attachments,ids=new Set<string>();let links=0;
 for(const e of entries){const id=e.slot+'\0'+e.name;need(!ids.has(id),'ambiguous displayed attachment');ids.add(id);if(e.attachment.type==='mesh'&&e.attachment.linked!==null){links++;need(e.attachment.sequence===null&&!['ffd_keyframes','deform','vertex_animation'].some(k=>Object.hasOwn(e.attachment,k)),'linked embedded deformation/sequence');linkedGeometry(r,r.defaultSkin!,e);}}
 need(links>0,'at least one real link required');
 const projected=structuredClone(r);projected.skins[0]!.attachments=entries.map(e=>({...e,attachment:structuredClone(linkedGeometry(r,r.defaultSkin!,e).attachment)}));
 validateAnimatedSlotsRig(projected,clip,events);
 const setup=evaluate(projected);const determinant=(name:string)=>{const b=setup.bones.find(b=>b.name===name);need(b&&Object.values(b.world).every(Number.isFinite)&&Math.abs(b.world.a*b.world.d-b.world.b*b.world.c)>=1e-12,'absent/singular bind '+name);};
 for(const e of projected.skins[0]!.attachments){const a=e.attachment;if(a.type!=='mesh')continue;determinant(projected.slots.find(s=>s.name===e.slot)!.bone);for(let i=0;i<a.triangles.length;i+=3){const ids=a.triangles.slice(i,i+3);need(new Set(ids).size===3,'degenerate indices');const [x,y,z]=ids.map(n=>[a.vertices[2*n]!,a.vertices[2*n+1]!] as const);need(Math.abs((y![0]-x![0])*(z![1]-x![1])-(y![1]-x![1])*(z![0]-x![0]))>1e-12,'degenerate source triangle');}for(const row of a.weights){need(new Set(row.bones.map(b=>b.bone)).size===row.bones.length,'duplicate influence bone');let sum=0;for(const w of row.bones){sum+=w.weight;determinant(w.bone);}need(Number.isFinite(sum)&&(row.bones.length===0||sum>0),'invalid influence total');}}
 return projected;
}
export function validateLinkedMeshRig(source:RuntimeRigData,clip:string,events?:readonly SkinEvent[]):void{linkedMeshSources(source,clip,events);}
