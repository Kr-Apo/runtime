import {linkedFfdSources,linkedFfdBindings,assertLinkedDeformation} from "./replay-linked-ffd.js";
import type {LinkedFfdPlan,LinkedFfdBinding} from "./replay-linked-ffd.js";
import type {ReplaySlotState} from "./replay-slots.js";
import {sampleDeformOffsets,evaluate} from './evaluate.js';
import {parseRig} from './rig.js';
import {canonicalTime} from './replay-animation.js';
import {ReplayError} from './replay-physics.js';
import type {SkinEvent} from './replay-skin.js';
import type {DeformTrack,RuntimeRigData,MeshAttachment} from './types.js';

/** Experimental capability, never implied by native v2 or historical qualification. */
export interface WeightedFfdOptions { readonly weightedFfd:true }
export interface ReplayDeformEntry {readonly owner:string;readonly slot:string;readonly attachment:string;readonly offsets:readonly number[]}
export interface ReplayDeformation {readonly kind:'weighted-ffd/v1';readonly clip:string;readonly skin:string;readonly tick:bigint;readonly entries:readonly ReplayDeformEntry[];readonly bindings?:readonly LinkedFfdBinding[]}
const need=(ok:unknown,message:string):void=>{if(!ok)throw new ReplayError('Weighted FFD: '+message);};
const finite=(v:readonly number[])=>v.every(Number.isFinite);
export function ffdOption(options?:WeightedFfdOptions):boolean {
 if(options===undefined)return false;
 need(options!==null&&typeof options==='object'&&Object.keys(options).join(',')==='weightedFfd'&&options.weightedFfd===true,'explicit weightedFfd:true required');return true;
}
/** Original native data, strict single-skin/single-clip domain. No stripped projection. */
export function validateWeightedFfdRig(source:RuntimeRigData,clip:string,events?:readonly SkinEvent[]):void {
 const rig=parseRig(source);need(rig.format_version===2,'native v2 required');
 need(rig.skins.length===1&&rig.skins[0]!.name===rig.defaultSkin,'one fixed default skin required');
 need(events===undefined||events.length===1&&events[0]!.tick===0n&&events[0]!.skin===rig.defaultSkin,'dynamic skins forbidden');
 need(Object.keys(rig.animations).length===1&&Object.hasOwn(rig.animations,clip),'one exact clip required');
 need(rig.constraints.length>0&&rig.constraints.every(c=>c.type==='physics'),'Physics-only required');
 const a=rig.animations[clip]!;need(a.duration>0&&Number.isFinite(a.duration),'positive duration');
 const allowed=new Set(['duration','looping','bones','deform','slots','drawOrder','events','ik','transform']);
 need(Object.keys(a).every(k=>allowed.has(k)),'unknown clip property');
 for(const k of ['slots','drawOrder','events','ik','transform']as const)need(Array.isArray(a[k])&&a[k].length===0,'unsupported channel '+k);
 const skin=rig.skins[0]!,bones=new Set(rig.bones.map(b=>b.name)),slots=new Set(rig.slots.map(s=>s.name)),names=new Set<string>();
 for(const s of rig.slots)need(bones.has(s.bone)&&s.blend==='normal'&&s.dark_color===undefined,'slot properties');
 const setup=evaluate(rig);const sizes=new Map<string,number>();
 for(const e of skin.attachments){
  const key=e.slot+'\0'+e.name;need(slots.has(e.slot)&&!names.has(key),'ambiguous attachment');names.add(key);
  const m=e.attachment;need(m.type==='region'||m.type==='mesh','unsupported attachment');
  if(m.type!=='region'&&m.type!=='mesh')continue;
  need(m.sequence===null,'sequences forbidden');
  if(m.type==='region')continue;
  need(m.linked===null&&!['ffd_keyframes','deform','vertex_animation'].some(k=>Object.hasOwn(m,k)),'linked/embedded deformation forbidden');
  need(typeof m.weighted==='boolean','weighted flag');
  need(Number.isInteger(m.vertex_count)&&m.vertex_count>=3&&m.vertices.length===2*m.vertex_count&&m.uvs.length===m.vertices.length&&finite([...m.vertices,...m.uvs]),'vertex/UV dimensions');
  need(m.uvs.every(v=>v>=0&&v<=1)&&m.triangles.length>0&&m.triangles.length%3===0&&m.triangles.every(i=>Number.isInteger(i)&&i>=0&&i<m.vertex_count),'topology');
  need(m.weights.length===(m.weighted?m.vertex_count:0),'weight rows');
  for(const row of m.weights){need(row.count===row.bones.length,'influence count');let sum=0;
   for(const w of row.bones){need(bones.has(w.bone)&&finite([w.x,w.y,w.weight])&&w.weight>=0,'invalid influence');sum+=w.weight;const b=setup.bones.find(b=>b.name===w.bone)!;need(Math.abs(b.world.a*b.world.d-b.world.b*b.world.c)>=1e-12,'singular bind');}
   // Empty rows have no FFD offsets: native rigid fallback. Nonempty zero totals
   // use a different Rust deform fallback; refuse instead of approximating it.
   need(Number.isFinite(sum)&&(row.bones.length===0||sum>0),'zero-total deform influence row');
  }
  if(m.weighted)sizes.set(key,2*m.weights.reduce((n,r)=>n+r.bones.length,0));
 }
 need(skin.attachments.some(e=>sizes.has(e.slot+'\0'+e.name)&&rig.slots.find(s=>s.name===e.slot)?.attachment===e.name),'displayed weighted mesh required');
 const seen=new Set<string>();need(Array.isArray(a.deform),'deform list');
 for(const track of a.deform){const key=track.slot+'\0'+track.attachment;need(!seen.has(key),'duplicate deform owner');seen.add(key);need(sizes.has(key),'missing/nonweighted deform owner');
  const slot=rig.slots.find(s=>s.name===track.slot);need(slot?.attachment===track.attachment,'deform must target displayed setup attachment');
  let previous=-Infinity;need(Array.isArray(track.keys),'deform keys');
  for(const keyframe of track.keys){need(Number.isFinite(keyframe.time)&&keyframe.time>=0&&keyframe.time>previous,'deform times');previous=keyframe.time;
   need(Array.isArray(keyframe.offsets)&&keyframe.offsets.length===sizes.get(key)&&finite(keyframe.offsets),'deform dimensions/finitude');
   const c=keyframe.curve;need(c==='linear'||c==='stepped'||c?.type==='bezier'&&c.handles.length===4&&finite(c.handles)&&[c.handles[0],c.handles[2]].every(v=>v>=0&&v<=1),'deform curve');
  }
 }
}
/** Owns immutable native key/owner data; samples once inside each B6 candidate. */
export class ReplayDeforms {
 readonly #linked:LinkedFfdPlan|null;
 readonly #skin:string;readonly #clip:string;readonly #duration:number;readonly #looping:boolean;
 readonly #entries:{owner:string;slot:string;attachment:string;size:number;track:DeformTrack|undefined}[];
 constructor(rig:RuntimeRigData,clip:string,events?:readonly SkinEvent[],onlyTracked=false,linked=false){
  this.#linked=linked?linkedFfdSources(rig,clip,events):null;
  if(this.#linked){const p=this.#linked,a=p.rig.animations[clip]!;this.#skin=p.rig.defaultSkin!;this.#clip=clip;this.#duration=a.duration;this.#looping=a.looping;this.#entries=structuredClone([...p.owners]);return;}
  validateWeightedFfdRig(rig,clip,events);const copy=structuredClone(rig),a=copy.animations[clip]!;
  this.#skin=copy.defaultSkin!;this.#clip=clip;this.#duration=a.duration;this.#looping=a.looping;
  this.#entries=copy.skins[0]!.attachments.filter(e=>e.attachment.type==='mesh'&&e.attachment.weighted&&copy.slots.find(s=>s.name===e.slot)?.attachment===e.name&&(!onlyTracked||a.deform.some(t=>t.slot===e.slot&&t.attachment===e.name))).map(e=>({owner:this.#skin,slot:e.slot,attachment:e.name,size:2*(e.attachment as MeshAttachment).weights.reduce((n,r)=>n+r.bones.length,0),track:a.deform.find(t=>t.slot===e.slot&&t.attachment===e.name)}));
 }
 validateCandidate(d:ReplayDeformation,tick:bigint,state?:ReplaySlotState){if(this.#linked)assertLinkedDeformation(this.#linked,d,state!,tick);}
 sample(tick:bigint,state?:ReplaySlotState):ReplayDeformation {
  const time=canonicalTime(tick,this.#duration,this.#looping);
  const entries=this.#entries.map(e=>{const offsets=e.track?sampleDeformOffsets(e.track,time):undefined;const out=offsets??Array<number>(e.size).fill(0);need(out.length===e.size&&finite(out),'nonfinite sampled deformation');return{owner:e.owner,slot:e.slot,attachment:e.attachment,offsets:out};});
  return{kind:'weighted-ffd/v1',clip:this.#clip,skin:this.#skin,tick,entries,...(this.#linked?{bindings:linkedFfdBindings(this.#linked.rig,this.#clip,state!)}:{})};
 }
}
