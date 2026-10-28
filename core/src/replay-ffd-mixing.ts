import {parseRig} from './rig.js';
import {ReplayDeforms,validateWeightedFfdRig} from './replay-ffd.js';
import type {ReplayDeformation} from './replay-ffd.js';
import type {ReplayMixState} from './replay-mixing.js';
import type {RuntimeRigData} from './types.js';
import {ReplayError} from './replay-physics.js';
export const FFD_MIX_LIMITS=Object.freeze({components:1024,storedComponents:262144,keys:4096,attachments:128,identityUnits:32768,captureUnits:65536,admissionVersion:'weighted-ffd-crossfade/v1'});
const need=(v:unknown,m:string)=>{if(!v)throw new ReplayError('FFD crossfade: '+m);};
const canonical=(v:unknown):string=>typeof v==='bigint'?'{bigint:'+String(v)+'}':v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}';
/** Exact structural rig identity, not a hash. Clip values remain privately immutable and are resampled at capture/replay. */
export function ffdMixSources(source:RuntimeRigData){
 const rig=parseRig(structuredClone(source));need(rig.format_version===2&&rig.skins.length===1&&rig.skins[0]!.name===rig.defaultSkin,'one native v2 default skin');
 need(rig.skins[0]!.attachments.length<=FFD_MIX_LIMITS.attachments,'attachment budget');
 const tracks=Object.entries(rig.animations).flatMap(([clip,a])=>a.deform.map(t=>({clip,t})));need(tracks.length>0,'one authored FFD owner required');
 const target={owner:rig.defaultSkin!,slot:tracks[0]!.t.slot,attachment:tracks[0]!.t.attachment};
 const label=target.owner+'/'+target.slot+'/'+target.attachment;let stored=0;
 const views=new Map<string,RuntimeRigData>();
 for(const[name,a]of Object.entries(rig.animations)){
  need(a.deform.length<=1,name+': multiple owners');
  for(const t of a.deform){need(t.slot===target.slot&&t.attachment===target.attachment,name+': foreign FFD owner '+t.slot+'/'+t.attachment+'; expected '+label);
   need(Object.keys(t).sort().join(',')==='attachment,keys,slot'&&t.keys.length>0&&t.keys.length<=FFD_MIX_LIMITS.keys,name+': track shape/key budget '+label);
   for(const k of t.keys){need(Object.keys(k).sort().join(',')==='curve,offsets,time'&&k.offsets.length>0,name+': empty/full key HOLD or unknown key '+label);need(k.time<=Math.fround(a.duration),name+': key outside duration '+label);const native=(v:number)=>typeof v==='number'&&Number.isFinite(v)&&Number.isFinite(Math.fround(v));need(k.offsets.every(native),name+': native f32 offsets '+label);if(k.curve&&typeof k.curve==='object')need(Array.isArray(k.curve.handles)&&k.curve.handles.every(native),name+': native f32 handles '+label);stored+=k.offsets.length;}
  }
  const view=structuredClone(rig);view.animations={[name]:structuredClone(a)};
  // Closed A3 admission checks real geometry, binds, topology, influences and every key.
  try{validateWeightedFfdRig(view,name);}catch(e){throw new ReplayError(name+'/'+label+': '+String(e));}views.set(name,view);
 }
 need(stored<=FFD_MIX_LIMITS.storedComponents,label+': stored scalar budget');
 const entry=rig.skins[0]!.attachments.find(e=>e.slot===target.slot&&e.name===target.attachment),mesh=entry?.attachment;
 need(mesh?.type==='mesh'&&mesh.weighted,label+': exact weighted owner required');
 const size=mesh?.type==='mesh'?2*mesh.weights.reduce((n,r)=>n+r.bones.length,0):0;need(size>0&&size<=FFD_MIX_LIMITS.components,label+': component budget');
 const {animations:_clips,...structure}=rig;const rigIdentity=canonical(structure);need(rigIdentity.length<=FFD_MIX_LIMITS.identityUnits,label+': structural identity budget');
 return{rig,views,target,size,rigIdentity};
}
export interface FrozenFfd {readonly admissionVersion:typeof FFD_MIX_LIMITS.admissionVersion;readonly rigIdentity:string;readonly deformation:ReplayDeformation}
export class ReplayFfdMixer {
 readonly rigIdentity:string;readonly target:ReturnType<typeof ffdMixSources>['target'];readonly size:number;readonly #rig:RuntimeRigData;readonly #samplers=new Map<string,ReplayDeforms>();
 constructor(r:RuntimeRigData){const p=ffdMixSources(r);this.#rig=p.rig;this.rigIdentity=p.rigIdentity;this.target=p.target;this.size=p.size;for(const[name,v]of p.views)this.#samplers.set(name,new ReplayDeforms(v,name));}
 sampleClip(clip:string,tick:bigint):readonly number[]{const s=this.#samplers.get(clip);need(s,'unknown FFD clip '+clip);const d=s!.sample(tick);const e=d.entries.find(e=>e.owner===this.target.owner&&e.slot===this.target.slot&&e.attachment===this.target.attachment);need(e,'missing exact owner');return e!.offsets;}
 sample(m:ReplayMixState,frozen?:FrozenFfd):ReplayDeformation{
  const tr=m.transition,active=tr?.status==='active';
  let a:readonly number[];
  if(active&&tr.source){need(frozen,'missing frozen FFD');this.validateFrozen(frozen!);a=frozen!.deformation.entries[0]!.offsets;}else{need(frozen===undefined,'foreign frozen FFD');a=this.sampleClip(m.activeClip,m.activeTick);}
  const b=active?this.sampleClip(tr.to,tr.toTick):undefined,w=tr?.weight??0;
  const offsets=b?a.map((v,i)=>w===0?v:w===1?b[i]!:v+(b[i]!-v)*w):[...a];
  const d:ReplayDeformation={kind:'weighted-ffd/v1',clip:m.activeClip,skin:this.target.owner,tick:m.tick,entries:[{...this.target,offsets}]};this.validate(d,m.tick,m.activeClip);return d;
 }
 validate(d:ReplayDeformation,tick:bigint,clip:string):void{
  need(d&&Object.keys(d).sort().join(',')==='clip,entries,kind,skin,tick'&&d.kind==='weighted-ffd/v1'&&d.tick===tick&&d.clip===clip&&Object.hasOwn(this.#rig.animations,clip)&&d.skin===this.target.owner,'deformation identity/tick/clip');
  const e=d.entries?.[0];need(Array.isArray(d.entries)&&d.entries.length===1&&e&&Object.keys(e).sort().join(',')==='attachment,offsets,owner,slot'&&e.owner===this.target.owner&&e.slot===this.target.slot&&e.attachment===this.target.attachment,'exact FFD owner '+this.target.slot+'/'+this.target.attachment);
  need(Array.isArray(e!.offsets)&&e!.offsets.length===this.size&&e!.offsets.every(v=>Number.isFinite(v)&&Number.isFinite(Math.fround(v))),'sampled FFD dimensions/finitude');
 }
 validateFrozen(f:FrozenFfd):void{need(f&&Object.keys(f).sort().join(',')==='admissionVersion,deformation,rigIdentity'&&f.admissionVersion===FFD_MIX_LIMITS.admissionVersion&&f.rigIdentity===this.rigIdentity,'frozen admission/rig identity');this.validate(f.deformation,f.deformation.tick,f.deformation.clip);}
 capture(d:ReplayDeformation):FrozenFfd{this.validate(d,d.tick,d.clip);return{admissionVersion:FFD_MIX_LIMITS.admissionVersion,rigIdentity:this.rigIdentity,deformation:structuredClone(d)};}
}
export function sameDeformation(a:ReplayDeformation|undefined,b:ReplayDeformation|undefined):boolean{return a===undefined||b===undefined?a===b:canonical(a)===canonical(b);}
