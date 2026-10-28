import {validateClipping} from "./render/clipping.js";
import {parseRig} from "./rig.js";
import {sampleSlotChannels} from "./evaluate.js";
import {canonicalTime} from "./replay-animation.js";
import {ReplayError} from "./replay-physics.js";
import {ffdOption} from "./replay-ffd.js";
import type {WeightedFfdOptions} from "./replay-ffd.js";
import type {SkinEvent} from "./replay-skin.js";
import type {RuntimeRigData,Curve} from "./types.js";
export interface AnimatedSlotOptions {readonly animatedSlots:true}
export interface ReplayClippingOptions {readonly animatedSlots:true;readonly clipping:true}
export type ReplayOptions=import("./replay-mixing.js").CrossfadeOptions|import("./replay-linked-ffd.js").LinkedFfdOptions|import("./replay-linked.js").LinkedMeshOptions|import("./replay-ffd-composition.js").ClippedFfdOptions|import("./replay-ffd-composition.js").ComposedFfdOptions|ReplayClippingOptions|WeightedFfdOptions|AnimatedSlotOptions|import("./replay-events.js").AnimationEventOptions|import("./replay-composition.js").SlotsEventsOptions;
export interface ReplaySlot {readonly name:string;readonly owner:string|null;readonly attachment:string|null;readonly visible:boolean;readonly color:readonly [number,number,number,number]}
export interface ReplaySlotState {readonly kind:"animated-slots/v1";readonly tick:bigint;readonly clip:string;readonly skin:string;readonly slots:readonly ReplaySlot[];readonly drawOrder:readonly string[]}
const need=(ok:unknown,message:string):void=>{if(!ok)throw new ReplayError("Animated slots: "+message);};
const finite=(xs:readonly number[])=>Array.from(xs).every(Number.isFinite);
const rgba=(v:unknown)=>Array.isArray(v)&&v.length===4&&[0,1,2,3].every(i=>typeof v[i]==='number'&&Number.isFinite(v[i])&&v[i]>=0&&v[i]<=1);
const shape=(v:object,keys:readonly string[])=>Object.keys(v).every(k=>keys.includes(k));
const curve=(c:Curve|undefined)=>c==='linear'||c==='stepped'||c?.type==='bezier'&&Array.isArray(c.handles)&&c.handles.length===4&&finite(c.handles)&&[c.handles[0],c.handles[2]].every(v=>v>=0&&v<=1);
/** Explicit capabilities; FFD remains separate and standalone gates stay closed. */
export function replayMode(options?:ReplayOptions):'bones'|'ffd'|'slots'|'events'|'slots-events'|'clipping'|'ffd-slots'|'ffd-clipping'|'linked-slots'|'linked-ffd-slots'|'crossfade'|'crossfade-slots'|'crossfade-slots-events'|'crossfade-ffd'|'integrated-crossfade' {
 if(options&&typeof options==='object'&&['animatedSlots,animationEvents,crossfade,weightedFfd','animatedSlots,animationEvents,crossfade,interruptible,weightedFfd'].includes(Object.keys(options).sort().join(','))&&Object.values(options).every(v=>v===true))return 'integrated-crossfade';
 if(options&&typeof options==='object'&&((Object.keys(options).sort().join(',')==='crossfade,weightedFfd')||(Object.keys(options).sort().join(',')==='crossfade,interruptible,weightedFfd'&&(options as import('./replay-mixing.js').CrossfadeOptions).interruptible===true))&&(options as import('./replay-mixing.js').CrossfadeOptions).crossfade===true&&(options as import('./replay-mixing.js').CrossfadeOptions).weightedFfd===true)return 'crossfade-ffd';
 if(options&&typeof options==='object'&&Object.keys(options).sort().join(',')==='animatedSlots,animationEvents,crossfade,interruptible'&&(options as import('./replay-mixing.js').CrossfadeOptions).crossfade===true&&(options as import('./replay-mixing.js').CrossfadeOptions).animatedSlots===true&&(options as import('./replay-mixing.js').CrossfadeOptions).animationEvents===true&&(options as import('./replay-mixing.js').CrossfadeOptions).interruptible===true)return 'crossfade-slots-events';
 if(options&&typeof options==='object'&&Object.keys(options).sort().join(',')==='animatedSlots,animationEvents,crossfade'&&(options as import('./replay-mixing.js').CrossfadeOptions).crossfade===true&&(options as import('./replay-mixing.js').CrossfadeOptions).animatedSlots===true&&(options as import('./replay-mixing.js').CrossfadeOptions).animationEvents===true)return 'crossfade-slots-events';
 if(options&&typeof options==='object'&&Object.keys(options).sort().join(',')==='animatedSlots,crossfade,interruptible'&&(options as import('./replay-mixing.js').CrossfadeOptions).crossfade===true&&(options as import('./replay-mixing.js').CrossfadeOptions).animatedSlots===true&&(options as import('./replay-mixing.js').CrossfadeOptions).interruptible===true)return 'crossfade-slots';
 if(options&&typeof options==='object'&&Object.keys(options).sort().join(',')==='animatedSlots,crossfade'&&(options as import('./replay-mixing.js').CrossfadeOptions).crossfade===true&&(options as import('./replay-mixing.js').CrossfadeOptions).animatedSlots===true)return 'crossfade-slots';
 if(options&&typeof options==='object'&&Object.keys(options).sort().join(',')==='crossfade,interruptible'&&(options as import('./replay-mixing.js').CrossfadeOptions).crossfade===true&&(options as import('./replay-mixing.js').CrossfadeOptions).interruptible===true)return 'crossfade';
 if(options&&typeof options==='object'&&Object.keys(options).join(',')==='crossfade'&&(options as import('./replay-mixing.js').CrossfadeOptions).crossfade===true)return 'crossfade';
 if(options&&typeof options==='object'&&Object.keys(options).sort().join(',')==='animatedSlots,linkedMeshes,weightedFfd'&&(options as import('./replay-linked-ffd.js').LinkedFfdOptions).linkedMeshes===true&&(options as import('./replay-linked-ffd.js').LinkedFfdOptions).animatedSlots===true&&(options as import('./replay-linked-ffd.js').LinkedFfdOptions).weightedFfd===true)return 'linked-ffd-slots';
 if(options&&typeof options==='object'&&Object.keys(options).sort().join(',')==='animatedSlots,linkedMeshes'&&(options as import('./replay-linked.js').LinkedMeshOptions).linkedMeshes===true&&(options as import('./replay-linked.js').LinkedMeshOptions).animatedSlots===true)return 'linked-slots';
 if(options&&typeof options==='object'&&Object.keys(options).sort().join(',')==='animatedSlots,clipping,weightedFfd'&&(options as import('./replay-ffd-composition.js').ClippedFfdOptions).weightedFfd===true&&(options as import('./replay-ffd-composition.js').ClippedFfdOptions).animatedSlots===true&&(options as import('./replay-ffd-composition.js').ClippedFfdOptions).clipping===true)return 'ffd-clipping';
 if(options&&typeof options==='object'&&Object.keys(options).sort().join(',')==='animatedSlots,weightedFfd'&&(options as import('./replay-ffd-composition.js').ComposedFfdOptions).weightedFfd===true&&(options as import('./replay-ffd-composition.js').ComposedFfdOptions).animatedSlots===true)return 'ffd-slots';
 if(options&&typeof options==='object'&&Object.keys(options).sort().join(',')==='animatedSlots,clipping'&&(options as ReplayClippingOptions).animatedSlots===true&&(options as ReplayClippingOptions).clipping===true)return 'clipping';
 if(options&&typeof options==='object'&&Object.keys(options).sort().join(',')==='animatedSlots,animationEvents'&&(options as import('./replay-composition.js').SlotsEventsOptions).animatedSlots===true&&(options as import('./replay-composition.js').SlotsEventsOptions).animationEvents===true)return 'slots-events';
 if(options&&typeof options==='object'&&Object.keys(options).join(',')==='animationEvents'&&(options as import('./replay-events.js').AnimationEventOptions).animationEvents===true)return 'events';
 if(options&&typeof options==='object'&&Object.keys(options).join(',')==='animatedSlots'&&(options as AnimatedSlotOptions).animatedSlots===true)return 'slots';
 return ffdOption(options as WeightedFfdOptions|undefined)?'ffd':'bones';
}
export function validateAnimatedSlotsRig(source:RuntimeRigData,clip:string,events?:readonly SkinEvent[],clipping=false):void {
 const r=parseRig(source),names=new Set(r.slots.map(s=>s.name)),bones=new Set(r.bones.map(b=>b.name));
 need(r.format_version===2&&r.defaultSkin!==null&&r.skins.length===1&&r.skins[0]!.name===r.defaultSkin,'native v2, one fixed default skin required');
 need(events===undefined||events.length===1&&events[0]!.tick===0n&&events[0]!.skin===r.defaultSkin,'dynamic skins forbidden');
 need(Object.keys(r.animations).length===1&&Object.hasOwn(r.animations,clip),'one exact clip required');
 const a=r.animations[clip]!;need(Number.isFinite(a.duration)&&a.duration>0&&typeof a.looping==='boolean','clip duration/loop');
 need(shape(a,['duration','looping','bones','slots','drawOrder','deform','events','ik','transform']),'unknown clip channel');
 for(const k of ['deform','events','ik','transform'] as const)need(Array.isArray(a[k])&&a[k].length===0,'unsupported channel '+k);
 need(r.constraints.length>0&&r.constraints.every(c=>c.type==='physics'),'Physics-only required');
 need(r.drawOrder.length===names.size&&new Set(r.drawOrder).size===names.size&&Array.from(r.drawOrder).every(n=>names.has(n)),'incomplete/duplicate setup draw order');
 for(const s of r.slots)need(bones.has(s.bone)&&s.blend==='normal'&&s.dark_color===undefined&&/^[0-9a-f]{8}$/i.test(s.color),'setup slot properties');
 const owners=new Set<string>();
 for(const e of r.skins[0]!.attachments){
  const id=e.slot+'\0'+e.name,m=e.attachment;need(names.has(e.slot)&&typeof e.name==='string'&&!owners.has(id),'ambiguous attachment');owners.add(id);
  if(clipping&&m.type==='clipping'){need(m.vertex_count<=64,'mask exceeds64vertices');need(m.end_slot!==e.slot,'self end slot excluded');validateClipping(m,id,names,need);continue;}
  need((m.type==='region'||m.type==='mesh')&&m.sequence===null,'unsupported attachment/sequence');if(m.type!=='region'&&m.type!=='mesh')continue;
  // A2 native mesh image dimensions are extra to the general Legacy mesh type.
  const dims=m as typeof m & {source_width:number;source_height:number};
  need(finite([dims.source_width,dims.source_height])&&dims.source_width>0&&dims.source_height>0,'source dimensions');
  if(m.type==='region')need(finite([m.x,m.y,m.rotation,m.scale_x,m.scale_y,m.width,m.height,m.pivot_x,m.pivot_y,...m.uv])&&m.width>0&&m.height>0&&m.uv.length===4&&m.uv[0]!<m.uv[2]!&&m.uv[1]!<m.uv[3]!,'region geometry');
  need(r.atlas?.regions.some(v=>v.name===m.texture&&r.atlas!.pages[v.page]),'missing attachment texture/page');
  if(m.type==='mesh'){
   need(m.linked===null&&!['ffd_keyframes','deform','vertex_animation'].some(k=>Object.hasOwn(m,k)),'linked/embedded deform forbidden');
   need(typeof m.weighted==='boolean'&&Number.isInteger(m.vertex_count)&&m.vertex_count>=3&&m.vertices.length===2*m.vertex_count&&m.uvs.length===m.vertices.length&&finite([...m.vertices,...m.uvs]),'mesh vertex/UV shape');
   need(m.uvs.every(v=>v>=0&&v<=1)&&m.triangles.length>0&&m.triangles.length%3===0&&Array.from(m.triangles).every(i=>Number.isInteger(i)&&i>=0&&i<m.vertex_count),'mesh topology');
   need(m.weights.length===(m.weighted?m.vertex_count:0),'weight rows');for(const row of m.weights){need(row.count===row.bones.length,'influence count');for(const w of row.bones)need(bones.has(w.bone)&&finite([w.x,w.y,w.weight])&&w.weight>=0,'influence');}
  }
 }
 const known=(slot:string,name:unknown)=>name===null||typeof name==='string'&&owners.has(slot+'\0'+name);
 for(const s of r.slots)need(known(s.name,s.attachment),'missing setup attachment');
 const seen=new Set<string>();need(Array.isArray(a.slots)&&Array.isArray(a.drawOrder),'slot/draw tracks');
 const times=(keys:readonly {time:number}[])=>{need(Array.isArray(keys),'key list');let prev=-Infinity;for(const k of keys){need(k&&Number.isFinite(k.time)&&k.time>=0&&k.time>prev,'key times');prev=k.time;}};
 for(const t of a.slots){
  need(t&&names.has(t.name)&&['color','visible','attachment'].includes(t.channel)&&shape(t,['name','channel','keys']),'unknown slot/channel/track');
  const id=t.name+'\0'+t.channel;need(!seen.has(id),'duplicate slot channel');seen.add(id);times(t.keys);
  for(const k of t.keys){
   if(t.channel==='color')need(shape(k,['time','color','curve'])&&rgba(k.color)&&curve(k.curve),'RGBA/curve');
   else if(t.channel==='visible')need(shape(k,['time','value','curve'])&&typeof k.value==='boolean'&&k.curve==='stepped','visibility key');
   else need(shape(k,['time','name','curve'])&&known(t.name,k.name)&&k.curve==='stepped','attachment key');
  }
 }
 times(a.drawOrder);
 for(const key of a.drawOrder){need(shape(key,['time','offsets'])&&Array.isArray(key.offsets),'draw key');const unique=new Set<string>();
  for(const e of key.offsets){need(e&&typeof e==='object','draw offset object');const i=r.drawOrder.indexOf(e.slot);need(shape(e,['slot','offset'])&&i>=0&&!unique.has(e.slot)&&Number.isInteger(e.offset)&&i+e.offset>=0&&i+e.offset<r.drawOrder.length,'invalid/duplicate draw offset');unique.add(e.slot);}
 }
}
/** Validate detached accepted data, without sampling or mutating source. */
export function validateReplaySlotState(r:RuntimeRigData,s:ReplaySlotState,tick:bigint,clip:string,skin:string):void {
 need(s&&s.kind==='animated-slots/v1'&&s.tick===tick&&s.clip===clip&&s.skin===skin&&skin===r.defaultSkin,'incoherent frame identity');
 need(Array.isArray(s.slots)&&s.slots.length===r.slots.length,'incomplete slots');
 for(let i=0;i<r.slots.length;i++){const v=s.slots[i]!,base=r.slots[i]!;need(v&&v.name===base.name&&typeof v.visible==='boolean'&&rgba(v.color),'invalid slot state');
  if(v.attachment===null)need(v.owner===null,'null owner');else need(typeof v.attachment==='string'&&v.owner===skin&&r.skins[0]!.attachments.some(e=>e.slot===v.name&&e.name===v.attachment),'attachment owner');
 }
 need(Array.isArray(s.drawOrder)&&s.drawOrder.length===r.slots.length&&new Set(s.drawOrder).size===r.slots.length&&Array.from(s.drawOrder).every(n=>r.slots.some(v=>v.name===n)),'incomplete/duplicate draw order');
}
/** One immutable timeline owner, used only in the B6 candidate. */
export class ReplaySlots {
 readonly #rig:RuntimeRigData;readonly #clip:string;
 constructor(rig:RuntimeRigData,clip:string,events?:readonly SkinEvent[],clipping=false){validateAnimatedSlotsRig(rig,clip,events,clipping);this.#rig=structuredClone(rig);this.#clip=clip;}
 sample(tick:bigint):ReplaySlotState {
  const r=this.#rig,a=r.animations[this.#clip]!,time=canonicalTime(tick,a.duration,a.looping),sample=sampleSlotChannels(r,a,time);
  const s:ReplaySlotState={kind:'animated-slots/v1',tick,clip:this.#clip,skin:r.defaultSkin!,slots:sample.slots.map(v=>({name:v.name,color:v.color,visible:v.visible,attachment:v.attachment,owner:v.attachment===null?null:r.defaultSkin})),drawOrder:sample.drawOrder};
  validateReplaySlotState(r,s,tick,this.#clip,r.defaultSkin!);return s;
 }
}
