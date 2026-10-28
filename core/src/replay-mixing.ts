import {integratedSources,assertIntegratedState,INTEGRATED_LIMITS} from "./replay-integrated.js";
import type {FrozenFfd} from './replay-ffd-mixing.js';
import {ReplayFfdMixer,ffdMixSources,FFD_MIX_LIMITS,sameDeformation} from './replay-ffd-mixing.js';
import type {ReplayDeformation} from './replay-ffd.js';
import {mixEventSources} from './replay-mix-events.js';
import {ReplaySlotMixer,validateSlotMixingRig} from "./replay-slot-mixing.js";
import {validateReplaySlotState} from "./replay-slots.js";
import type {ReplaySlotState} from "./replay-slots.js";
import {parseRig} from "./rig.js";
import {evaluateBoneLocals} from "./evaluate.js";
import {canonicalTime,MAX_SAMPLE_TICK,validateBoneAnimation} from "./replay-animation.js";
import {ReplayError,validateReplayRig} from "./replay-physics.js";
import type {ReplayLocal} from "./replay-physics.js";
import type {RuntimeRigData} from "./types.js";

export interface CrossfadeOptions {readonly crossfade:true;readonly interruptible?:true;readonly animatedSlots?:true;readonly animationEvents?:true;readonly weightedFfd?:true}
export interface FrozenOrigin {readonly kind:"frozen";readonly tick:bigint;readonly command:number;readonly clip:string;readonly clipTick:bigint;readonly clipTime:number}
export interface FrozenPose {readonly origin:FrozenOrigin;readonly locals:readonly ReplayLocal[];readonly slotState?:ReplaySlotState;readonly ffd?:FrozenFfd}
export interface TransitionRequest {readonly to:string;readonly durationTicks:bigint;readonly incomingTick?:bigint}
export interface MixTransition {
 readonly requestedTick:bigint;readonly startTick:bigint;readonly durationTicks:bigint;
 readonly from:string;readonly to:string;readonly fromTick:bigint;readonly toTick:bigint;
 readonly fromTime:number;readonly toTime:number;readonly elapsedTicks:bigint;
 readonly source?:FrozenOrigin;readonly weight:number;readonly status:'active'|'complete';
}
export interface ReplayMixState {
 readonly kind:'crossfade/v1'|'interruptible-crossfade/v1'|'crossfade-slots/v1'|'interruptible-crossfade-slots/v1'|'crossfade-slots-events/v1'|'interruptible-crossfade-slots-events/v1'|'crossfade-ffd/v1'|'interruptible-crossfade-ffd/v1'|'integrated-crossfade/v1'|'interruptible-integrated-crossfade/v1';readonly tick:bigint;readonly activeClip:string;
 readonly activeTick:bigint;readonly activeTime:number;readonly transition:MixTransition|null;
}
export interface ReplayMixSample {readonly locals:readonly ReplayLocal[];readonly mixing:ReplayMixState;readonly slotState?:ReplaySlotState;readonly deformation?:ReplayDeformation}
export interface MixCommand {readonly requestedTick:bigint;readonly startTick:bigint;readonly to:string;readonly durationTicks:bigint;readonly incomingTick:bigint;readonly frozen?:FrozenPose}
export const MIX_LIMITS=Object.freeze({clips:16,bones:256,keysPerChannel:4096,commands:64,durationTicks:7200n});
// Four f32 ulps at pi: deterministic signed tie for native antipodal endpoints.
export const MIX_ANGLE_TIE=2**-20;
const need=(v:unknown,m:string)=>{if(!v)throw new ReplayError('Crossfade: '+m);};
function tick(v:bigint){need(typeof v==='bigint'&&v>=0n&&v<=MAX_SAMPLE_TICK,'tick domain');}
export function shortestMixAngle(delta:number):number {
 let d=delta%(2*Math.PI);
 if(Math.abs(Math.abs(d)-Math.PI)<=MIX_ANGLE_TIE)return Math.sign(d)*Math.PI;
 if(d>Math.PI)d-=2*Math.PI;if(d< -Math.PI)d+=2*Math.PI;return d;
}
export function validateMixLocals(locals:readonly ReplayLocal[],names:readonly string[]):void {
 need(Array.isArray(locals)&&locals.length===names.length,'complete local pose');
 locals.forEach((v,i)=>{need(v?.name===names[i]&&[v.x,v.y,v.rotation,v.scaleX,v.scaleY,v.shearX,v.shearY].every(Number.isFinite),'local identity/finitude');need(v.scaleX>1e-6&&v.scaleY>1e-6&&Math.abs(Math.cos(v.shearY-v.shearX))>1e-6,'unqualified zero/sign/singular scale or shear');});
}
export function mixBoneLocals(a:readonly ReplayLocal[],b:readonly ReplayLocal[],weight:number):ReplayLocal[]{
 need(Number.isFinite(weight)&&weight>=0&&weight<=1,'weight');const names=a.map(v=>v.name);validateMixLocals(a,names);validateMixLocals(b,names);
 const out=a.map((v,i)=>{const w=b[i]!,lerp=(x:number,y:number)=>weight===0?x:weight===1?y:x+(y-x)*weight;return{name:v.name,x:lerp(v.x,w.x),y:lerp(v.y,w.y),rotation:weight===0?v.rotation:weight===1?w.rotation:v.rotation+shortestMixAngle(w.rotation-v.rotation)*weight,scaleX:lerp(v.scaleX,w.scaleX),scaleY:lerp(v.scaleY,w.scaleY),shearX:lerp(v.shearX,w.shearX),shearY:lerp(v.shearY,w.shearY)};});validateMixLocals(out,names);return out;
}
export function validateMixingRig(source:RuntimeRigData,initial:string,animatedSlots=false,animationEvents=false,weightedFfd=false):RuntimeRigData {
 const rig=parseRig(structuredClone(source)),clips=Object.entries(rig.animations);
 need(rig.format_version===2&&rig.skins.length===1&&rig.skins[0]!.name===rig.defaultSkin,'native v2 fixed default skin');
 need(clips.length>=2&&clips.length<=MIX_LIMITS.clips&&rig.bones.length>0&&rig.bones.length<=MIX_LIMITS.bones&&Object.hasOwn(rig.animations,initial),'clip/bone budget or initial clip');validateReplayRig(rig);
 const names=rig.bones.map(v=>v.name);need(new Set(names).size===names.length,'ambiguous bones');
 for(const slot of rig.slots)need(slot.blend==='normal'&&slot.dark_color===undefined,'Normal static slots only');
 for(const e of rig.skins[0]!.attachments){const a=e.attachment;need((a.type==='region'||a.type==='mesh')&&!a.sequence&&!(a.type==='mesh'&&a.linked),'static regions/meshes, no links/clipping/sequences');}
 for(const[name,a]of clips){validateBoneAnimation(rig,a,weightedFfd,animatedSlots,animationEvents);need(Number.isFinite(a.duration)&&Math.fround(a.duration)>0,'positive duration');
  for(const t of a.bones){need(names.includes(t.name),'unknown bone');for(const[channel,keys]of Object.entries(t)){if(channel==='name')continue;need(Array.isArray(keys)&&keys.length<=MIX_LIMITS.keysPerChannel,'channel budget');for(const k of keys as {time:number;value:number}[])need(k.time>=0&&k.time<=Math.fround(a.duration),'key outside clip');}}
  validateMixLocals(evaluateBoneLocals(rig,{animation:name,time:0,alpha:1}),names);
 }
 if(weightedFfd&&animatedSlots&&animationEvents){integratedSources(rig);return rig;}
 need(!weightedFfd||!animatedSlots&&!animationEvents,'FFD mixing excludes slots/events');if(weightedFfd)ffdMixSources(rig);
 need(!animationEvents||animatedSlots,'events require composed slots');if(animatedSlots)validateSlotMixingRig(rig,animationEvents);if(animationEvents)mixEventSources(rig);return rig;
}
/** Fixed-capacity deterministic command journal, no clock or Physics of its own. */
export class ReplayMixPlan {
 readonly #rig:RuntimeRigData;readonly #initial:string;readonly #names:readonly string[];readonly #interruptible:boolean;readonly #slots:ReplaySlotMixer|null;readonly #events:boolean;readonly #ffd:ReplayFfdMixer|null;
 readonly #journal:{requestedTick:bigint;startTick:bigint;to:string;durationTicks:bigint;incomingTick:bigint;frozen?:FrozenPose}[]=Array.from({length:MIX_LIMITS.commands},()=>({requestedTick:0n,startTick:0n,to:'',durationTicks:1n,incomingTick:0n}));
 #count=0;
 constructor(rig:RuntimeRigData,initial:string,interruptible=false,animatedSlots=false,animationEvents=false,weightedFfd=false){need(typeof weightedFfd==='boolean','FFD capability boolean');need(typeof animationEvents==='boolean','event capability boolean');this.#events=animationEvents;need(typeof animatedSlots==='boolean','slot capability boolean');need(typeof interruptible==='boolean','interruptible capability boolean');this.#interruptible=interruptible;this.#rig=validateMixingRig(rig,initial,animatedSlots,animationEvents,weightedFfd);const integrated=weightedFfd&&animatedSlots&&animationEvents?integratedSources(this.#rig):null;this.#ffd=weightedFfd?new ReplayFfdMixer(integrated?.ffd??this.#rig):null;this.#slots=animatedSlots?new ReplaySlotMixer(integrated?.slots??this.#rig,animationEvents):null;this.#initial=initial;this.#names=this.#rig.bones.map(v=>v.name);}
 get commandCount(){return this.#count;}
 commands():MixCommand[]{return this.#journal.slice(0,this.#count).map(v=>structuredClone(v));}
 pending(completed:bigint):MixCommand|null {const v=this.#journal.slice(0,this.#count).find(v=>v.startTick>completed);return v?structuredClone(v):null;}
 request(completed:bigint,request:TransitionRequest):MixCommand {
  const state=this.#admit(completed,request);
  need(state.transition?.status!=='active','transition active or pending; interruption unsupported');
  need(request.to!==state.activeClip,'target is already active');
  return this.#append(completed,request);
 }
 #admit(completed:bigint,request:TransitionRequest):ReplayMixState {
  tick(completed);need(request&&Object.keys(request).every(k=>['to','durationTicks','incomingTick'].includes(k)),'request shape');
  need(typeof request.to==='string'&&Object.hasOwn(this.#rig.animations,request.to),'unknown clip');
  need(typeof request.durationTicks==='bigint'&&request.durationTicks>0n&&request.durationTicks<=MIX_LIMITS.durationTicks,'positive integer duration ticks');
  const incoming=request.incomingTick??0n;tick(incoming);
  need(!this.pending(completed),'transition active or pending; interruption unsupported');need(this.#count<MIX_LIMITS.commands,'journal capacity: explicit reset required');
  tick(completed+1n+request.durationTicks);tick(incoming+request.durationTicks);
  // Commands must be strictly chronological even in the standalone plan API.
  need(this.#count===0||completed>=this.#journal[this.#count-1]!.startTick,'journal chronology');
  return this.stateAt(completed);
 }
 #append(completed:bigint,request:TransitionRequest,frozen?:FrozenPose):MixCommand {
  const v=this.#journal[this.#count]!;
  const staged=structuredClone({requestedTick:completed,startTick:completed+1n,to:request.to,durationTicks:request.durationTicks,incomingTick:request.incomingTick??0n,...(frozen?{frozen}: {})});
  if(this.#ffd)need(JSON.stringify(staged,encodeMix).length<=(this.#ffd&&this.#slots&&this.#events?INTEGRATED_LIMITS.captureUnits:FFD_MIX_LIMITS.captureUnits),'FFD capture serialized budget; request not published');
  const result=structuredClone(staged);Object.assign(v,staged);this.#count++;return result;
 }
 requestInterrupt(completed:bigint,request:TransitionRequest,accepted:ReplayMixSample):MixCommand {
  need(this.#interruptible,'interruptible capability required');const state=this.#admit(completed,request);
  need(state.transition?.status==='active','interruption requires active transition');
  this.validateCandidate(accepted,completed);
  if(this.#slots){
   const shape=(v:object,keys:readonly string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
   need(shape(accepted.slotState!,['kind','tick','clip','skin','slots','drawOrder'])&&accepted.slotState!.slots.every(v=>shape(v,['name','owner','attachment','visible','color']))&&accepted.locals.every(v=>shape(v,['name','x','y','rotation','scaleX','scaleY','shearX','shearY'])),'flat paired capture shape');
  }
  if(this.#ffd)need(accepted.locals.every(v=>Object.keys(v).sort().join(',')==='name,rotation,scaleX,scaleY,shearX,shearY,x,y'),'flat FFD paired local shape');
  // Capture only the actual pre-Physics input; reject even a finite but foreign pose.
  const expected=this.sample(completed);
  need(sameLocals(accepted.locals,expected.locals)&&sameSlotState(accepted.slotState,expected.slotState)&&sameDeformation(accepted.deformation,expected.deformation),'frozen source differs from accepted pose/slot schedule');
  const origin:FrozenOrigin={kind:'frozen',tick:completed,command:this.#count+1,clip:state.activeClip,clipTick:state.activeTick,clipTime:state.activeTime};
  return this.#append(completed,request,{origin,locals:accepted.locals.map(v=>({...v})),...(this.#slots?{slotState:structuredClone(accepted.slotState!)}:{}),...(this.#ffd?{ffd:this.#ffd.capture(accepted.deformation!)}:{})});
 }
 verifyOrigin(accepted:ReplayMixSample):void {
  const c=this.#journal.slice(0,this.#count).find(c=>c.frozen&&c.requestedTick===accepted.mixing.tick);
  if(c?.frozen){if(this.#ffd)this.#ffd.validateFrozen(c.frozen.ffd!);this.validateCandidate(accepted,c.requestedTick);need(sameLocals(c.frozen.locals,accepted.locals)&&sameSlotState(c.frozen.slotState,accepted.slotState)&&sameDeformation(c.frozen.ffd?.deformation,accepted.deformation),'replay frozen origin mismatch');}
 }
 restore(commands:readonly MixCommand[]):void {
  need(this.#count===0&&commands.length<=MIX_LIMITS.commands,'restore requires empty bounded journal');
  const staged=new ReplayMixPlan(this.#rig,this.#initial,this.#interruptible,this.#slots!==null,this.#events,this.#ffd!==null);
  for(const c of commands){need(c.startTick===c.requestedTick+1n,'journal start');
   const request={to:c.to,durationTicks:c.durationTicks,incomingTick:c.incomingTick};
   if(c.frozen){if(this.#ffd&&this.#slots&&this.#events)need(Object.keys(c.frozen).sort().join(',')==='ffd,locals,origin,slotState','flat integrated capture shape');if(this.#ffd)this.#ffd.validateFrozen(c.frozen.ffd!);else need(c.frozen.ffd===undefined,'FFD capture capability required');const offered={locals:c.frozen.locals,mixing:staged.stateAt(c.requestedTick),...(c.frozen.slotState?{slotState:c.frozen.slotState}:{}),...(c.frozen.ffd?{deformation:c.frozen.ffd.deformation}:{})};const next=staged.requestInterrupt(c.requestedTick,request,offered);need(JSON.stringify(next.frozen!.origin,encodeMix)===JSON.stringify(c.frozen.origin,encodeMix),'frozen origin identity');if(this.#ffd)need(JSON.stringify(next.frozen!.ffd,encodeMix)===JSON.stringify(c.frozen.ffd,encodeMix),'frozen FFD origin/admission identity');}
   else staged.request(c.requestedTick,request);
  }
  staged.commands().forEach((v,i)=>Object.assign(this.#journal[i]!,v));this.#count=commands.length;
 }
 #time(name:string,t:bigint){const a=this.#rig.animations[name]!;return canonicalTime(t,a.duration,a.looping);}
 stateAt(t:bigint):ReplayMixState {
  tick(t);const kind=this.#ffd&&this.#slots&&this.#events?(this.#interruptible?'interruptible-integrated-crossfade/v1':'integrated-crossfade/v1'):this.#ffd?(this.#interruptible?'interruptible-crossfade-ffd/v1':'crossfade-ffd/v1'):this.#events?(this.#interruptible?'interruptible-crossfade-slots-events/v1':'crossfade-slots-events/v1'):this.#slots?(this.#interruptible?'interruptible-crossfade-slots/v1':'crossfade-slots/v1'):this.#interruptible?'interruptible-crossfade/v1':'crossfade/v1';let active=this.#initial,anchor=0n,last:MixTransition|null=null;
  for(let i=0;i<this.#count;i++){const c=this.#journal[i]!;if(t<c.startTick)break;
   const elapsed=t-c.startTick<c.durationTicks?t-c.startTick:c.durationTicks,end=c.startTick+elapsed,origin=c.frozen?.origin;
   const from=origin?.clip??active,fromTick=origin?.clipTick??end-anchor,toTick=c.incomingTick+elapsed;
   last={requestedTick:c.requestedTick,startTick:c.startTick,durationTicks:c.durationTicks,from,to:c.to,fromTick,toTick,fromTime:origin?.clipTime??this.#time(from,fromTick),toTime:this.#time(c.to,toTick),elapsedTicks:elapsed,weight:Math.fround(Number(elapsed)/Number(c.durationTicks)),status:elapsed===c.durationTicks?'complete':'active',...(origin?{source:{...origin}}:{})};
   if(elapsed<c.durationTicks){
    if(i+1<this.#count&&this.#journal[i+1]!.startTick<=t)continue;
    const activeTick=origin?.clipTick??t-anchor;
    return{kind,tick:t,activeClip:from,activeTick,activeTime:this.#time(from,activeTick),transition:last};
   }
   active=c.to;anchor=c.startTick-c.incomingTick;
  }
  return{kind,tick:t,activeClip:active,activeTick:t-anchor,activeTime:this.#time(active,t-anchor),transition:last};
 }
 sample(t:bigint):ReplayMixSample {
  const mixing=this.stateAt(t),tr=mixing.transition;
  const a=tr?.status==='active'&&tr.source?this.#journal[tr.source.command-1]!.frozen!.locals:evaluateBoneLocals(this.#rig,{animation:mixing.activeClip,time:mixing.activeTime,alpha:1});
  const locals=tr?.status==='active'?mixBoneLocals(a,evaluateBoneLocals(this.#rig,{animation:tr.to,time:tr.toTime,alpha:1}),tr.weight):a.map(v=>({name:v.name,x:v.x,y:v.y,rotation:v.rotation,scaleX:v.scaleX,scaleY:v.scaleY,shearX:v.shearX,shearY:v.shearY}));
  validateMixLocals(locals,this.#names);return{locals,mixing,...(this.#ffd?{deformation:this.#ffd.sample(mixing,tr?.status==='active'&&tr.source?this.#journal[tr.source.command-1]!.frozen!.ffd:undefined)}:{}),...(this.#slots?{slotState:this.#slots.sample(mixing,tr?.status==='active'&&tr.source?this.#journal[tr.source.command-1]!.frozen!.slotState:undefined)}:{})};
 }
 validateCandidate(sample:ReplayMixSample,t:bigint):void {
  const expected=this.stateAt(t),encode=(v:unknown)=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?'#bigint:'+String(x):x);
  need(sample&&encode(sample.mixing)===encode(expected),'candidate mixing identity/time/progression');validateMixLocals(sample.locals,this.#names);if(this.#ffd)this.#ffd.validate(sample.deformation!,t,expected.activeClip);else need(sample.deformation===undefined,'FFD capability required');if(this.#slots)this.#slots.validate(sample.slotState!,t,expected.activeClip);else need(sample.slotState===undefined,'slot capability required');if(this.#ffd&&this.#slots&&this.#events)assertIntegratedState(sample.slotState!,sample.deformation!);
 }
}

/** B6 packet shape/finite guard. Schedule authority is additionally checked by the plan before input. */
export function assertMixPacket(value:ReplayMixSample,t:bigint,rig:RuntimeRigData):void {
 const composed=value&&isSlotMixKind(value.mixing?.kind),ffd=value&&isFfdMixKind(value.mixing?.kind);need(value&&Object.keys(value).sort().join(',')===(ffd&&composed?'deformation,locals,mixing,slotState':ffd?'deformation,locals,mixing':composed?'locals,mixing,slotState':'locals,mixing'),'packet shape');const m=value.mixing;
 need(m&&(m.kind==='crossfade/v1'||m.kind==='interruptible-crossfade/v1'||isSlotMixKind(m.kind)||isFfdMixKind(m.kind))&&m.tick===t&&typeof m.activeTick==='bigint'&&m.activeTick>=0n&&m.activeTick<=MAX_SAMPLE_TICK&&Object.hasOwn(rig.animations,m.activeClip)&&Number.isFinite(m.activeTime),'packet identity');
 const a=rig.animations[m.activeClip]!;need(m.activeTime===canonicalTime(m.activeTick,a.duration,a.looping),'packet active time');
 if(m.transition){const v=m.transition;need(typeof v.startTick==='bigint'&&typeof v.requestedTick==='bigint'&&v.startTick===v.requestedTick+1n&&v.startTick<=t&&typeof v.durationTicks==='bigint'&&v.durationTicks>0n&&v.durationTicks<=MIX_LIMITS.durationTicks&&typeof v.elapsedTicks==='bigint'&&v.elapsedTicks===(t-v.startTick<v.durationTicks?t-v.startTick:v.durationTicks)&&v.weight===Math.fround(Number(v.elapsedTicks)/Number(v.durationTicks))&&v.status===(v.elapsedTicks===v.durationTicks?'complete':'active')&&Object.hasOwn(rig.animations,v.from)&&Object.hasOwn(rig.animations,v.to)&&(v.from!==v.to||isInterruptibleMixKind(m.kind)&&!!v.source),'packet transition');
  for(const[name,local,time]of [[v.from,v.fromTick,v.fromTime],[v.to,v.toTick,v.toTime]]as const){tick(local);const clip=rig.animations[name]!;need(time===canonicalTime(local,clip.duration,clip.looping),'packet clip time');}
  if(v.source){const x=v.source;need(isInterruptibleMixKind(m.kind)&&x.kind==='frozen'&&x.tick===v.requestedTick&&Number.isInteger(x.command)&&x.command>=1&&x.command<=MIX_LIMITS.commands&&x.clip===v.from&&x.clipTick===v.fromTick&&x.clipTime===v.fromTime,'frozen packet origin');}
  need(m.activeClip===(v.status==='active'?v.from:v.to),'packet active clip');
 }
 if(isIntegratedMixKind(m.kind))assertIntegratedState(value.slotState!,value.deformation!);if(composed)validateReplaySlotState(rig,value.slotState!,t,m.activeClip,rig.defaultSkin!);validateMixLocals(value.locals,rig.bones.map(b=>b.name));
}

function encodeMix(_key:string,value:unknown):unknown{return typeof value==='bigint'?'#bigint:'+String(value):value;}
function sameLocals(a:readonly ReplayLocal[],b:readonly ReplayLocal[]):boolean{return a.length===b.length&&a.every((v,i)=>{const w=b[i]!;return v.name===w.name&&(['x','y','rotation','scaleX','scaleY','shearX','shearY']as const).every(k=>Object.is(v[k],w[k]));});}
function sameSlotState(a:ReplaySlotState|undefined,b:ReplaySlotState|undefined):boolean {
 if(!a||!b)return a===b;
 return a.kind===b.kind&&a.tick===b.tick&&a.clip===b.clip&&a.skin===b.skin&&a.slots.length===b.slots.length&&a.drawOrder.length===b.drawOrder.length&&a.drawOrder.every((v,i)=>v===b.drawOrder[i])&&a.slots.every((v,i)=>{const w=b.slots[i]!;return v.name===w.name&&v.owner===w.owner&&v.attachment===w.attachment&&v.visible===w.visible&&v.color.length===w.color.length&&v.color.every((x,k)=>Object.is(x,w.color[k]));});
}

export function isSlotMixKind(kind:unknown):boolean{return kind==='crossfade-slots/v1'||kind==='interruptible-crossfade-slots/v1'||isEventMixKind(kind);}
export function isInterruptibleMixKind(kind:unknown):boolean{return kind==='interruptible-integrated-crossfade/v1'||kind==='interruptible-crossfade/v1'||kind==='interruptible-crossfade-slots/v1'||kind==='interruptible-crossfade-slots-events/v1'||kind==='interruptible-crossfade-ffd/v1';}

export function isEventMixKind(kind:unknown):boolean{return isIntegratedMixKind(kind)||kind==='crossfade-slots-events/v1'||kind==='interruptible-crossfade-slots-events/v1';}

export function isFfdMixKind(kind:unknown):boolean{return isIntegratedMixKind(kind)||kind==='crossfade-ffd/v1'||kind==='interruptible-crossfade-ffd/v1';}

export function isIntegratedMixKind(kind:unknown):boolean{return kind==='integrated-crossfade/v1'||kind==='interruptible-integrated-crossfade/v1';}
