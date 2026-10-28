import type {TransitionRequest} from "./replay-mixing.js";
import {replayMode} from "./replay-slots.js";
import type {ReplayOptions} from "./replay-slots.js";
import type { SkinEvent } from "./replay-skin.js";
import { ReplayAnimationInstance, canonicalTime, MAX_SAMPLE_TICK } from "./replay-animation.js";
import { ReplayError } from "./replay-physics.js";
import type { ReplayObserver, ReplayFrame } from "./replay-physics.js";
import { rational, MAX_CLOCK_INTEGER } from "./replay-clock.js";
import type { ClockSnapshot, ClockProgress, RationalTime } from "./replay-clock.js";
import type { RuntimeRigData } from "./types.js";

export type TransportState="stopped"|"playing"|"paused"|"seek_preview"|"replaying"|"faulted"|"disposed";
export type PoseKind="pure"|"simulated";
declare const transportBrand:unique symbol;
export interface TransportContext {readonly epoch:bigint;readonly [transportBrand]:true}
export interface TransportSnapshot {
 readonly state:TransportState;readonly clip:string;readonly clock:ClockSnapshot|null;
 readonly position:bigint|null;readonly clipTime:number|null;readonly poseKind:PoseKind|null;
 readonly previewTime:RationalTime|null;readonly resumeState:TransportState|null;
 readonly replayTarget:bigint|null;readonly replayComplete:boolean;
}
/** Experimental opt-in headless transport. No Legacy player or adapter activation. */
export class ReplayTransport {
 #mixing=false;
 #interruptible=false;
 #mixSlots=false;
 #mixEvents=false;
 #mixFfd=false;
 #source:RuntimeRigData|null;
 #instance:ReplayAnimationInstance|null;
 #clip:string;
 #context:TransportContext;
 #state:TransportState="stopped";
 #resumeState:TransportState|null=null;
 #preview:ReplayFrame|null;
 #previewTime:RationalTime|null=null;
 #replayTarget:bigint|null=null;
 #busy=false;
 #skins:readonly SkinEvent[]|undefined;
 #ffd:boolean;
 #slots:boolean;
 #events:boolean;
 #clipping:boolean;
 #linked:boolean;
 constructor(rig:RuntimeRigData,name:string,epoch:bigint,events?:readonly SkinEvent[],options?:ReplayOptions){
  const mode=replayMode(options);this.#mixFfd=(mode==='crossfade-ffd'||mode==='integrated-crossfade');this.#mixEvents=(mode==='crossfade-slots-events'||mode==='integrated-crossfade');this.#mixing=this.#mixFfd||mode==='crossfade'||mode==='crossfade-slots'||this.#mixEvents;this.#mixSlots=mode==='crossfade-slots'||this.#mixEvents;this.#interruptible=this.#mixing&&(options as import('./replay-mixing.js').CrossfadeOptions).interruptible===true;this.#linked=mode==='linked-slots'||mode==='linked-ffd-slots';this.#clipping=mode==='clipping'||mode==='ffd-clipping';this.#ffd=mode==='linked-ffd-slots'||mode==='ffd'||mode==='ffd-slots'||mode==='ffd-clipping';this.#slots=this.#linked||mode==='slots'||mode==='slots-events'||mode==='ffd-slots'||this.#clipping;this.#events=mode==='events'||mode==='slots-events';
  this.#skins=events===undefined?undefined:structuredClone(events);
  this.#source=structuredClone(rig);this.#clip=name;
  this.#instance=new ReplayAnimationInstance(this.#source,name,epoch,this.#skins,this.#mixing?{crossfade:true,...(this.#interruptible?{interruptible:true as const}:{}),...(this.#mixSlots?{animatedSlots:true as const}:{}),...(this.#mixEvents?{animationEvents:true as const}:{}),...(this.#mixFfd?{weightedFfd:true as const}:{})}:this.#linked?{linkedMeshes:true,animatedSlots:true,...(this.#ffd?{weightedFfd:true as const}:{})}:this.#ffd&&this.#slots?(this.#clipping?{weightedFfd:true,animatedSlots:true,clipping:true}:{weightedFfd:true,animatedSlots:true}):this.#clipping?{animatedSlots:true,clipping:true}:this.#slots&&this.#events?{animatedSlots:true,animationEvents:true}:this.#ffd?{weightedFfd:true}:this.#slots?{animatedSlots:true}:this.#events?{animationEvents:true}:undefined);
  this.#context=Object.freeze({epoch})as TransportContext;
  const initial=this.#instance.frame();this.#preview=this.#mixing||this.#slots||this.#events?null:{tick:0n,pose:initial.pose,records:[]};
 }
 static withSkins(rig:RuntimeRigData,name:string,epoch:bigint,events:readonly SkinEvent[]){return new ReplayTransport(rig,name,epoch,events);}
 skinAt(tick:bigint){if(!this.#instance)throw new ReplayError("disposed transport");return this.#instance.skinAt(tick);}
 get context(){return this.#context;}
 #check(c:TransportContext){
  if(this.#busy)throw new ReplayError("busy");
  if(this.#state==="disposed")throw new ReplayError("disposed transport");
  if(c!==this.#context)throw new ReplayError("context");
 }
 #ready(c:TransportContext){this.#check(c);if(this.#state==="faulted")throw new ReplayError("faulted; reset required");}
 #nextEpoch(){if(this.#context.epoch===MAX_CLOCK_INTEGER)throw new ReplayError("epoch overflow");return this.#context.epoch+1n;}
 #fresh(name:string,epoch:bigint){
  if(typeof epoch!=="bigint"||epoch<=this.#context.epoch)throw new ReplayError("epoch must increase");
  return new ReplayTransport(this.#source!,name,epoch,this.#skins,this.#mixing?{crossfade:true,...(this.#interruptible?{interruptible:true as const}:{}),...(this.#mixSlots?{animatedSlots:true as const}:{}),...(this.#mixEvents?{animationEvents:true as const}:{}),...(this.#mixFfd?{weightedFfd:true as const}:{})}:this.#linked?{linkedMeshes:true,animatedSlots:true,...(this.#ffd?{weightedFfd:true as const}:{})}:this.#ffd&&this.#slots?(this.#clipping?{weightedFfd:true,animatedSlots:true,clipping:true}:{weightedFfd:true,animatedSlots:true}):this.#clipping?{animatedSlots:true,clipping:true}:this.#slots&&this.#events?{animatedSlots:true,animationEvents:true}:this.#ffd?{weightedFfd:true}:this.#slots?{animatedSlots:true}:this.#events?{animationEvents:true}:undefined);
 }
 #replace(next:ReplayTransport){
  this.#mixing=next.#mixing;this.#interruptible=next.#interruptible;this.#mixSlots=next.#mixSlots;this.#mixEvents=next.#mixEvents;this.#mixFfd=next.#mixFfd;this.#linked=next.#linked;this.#ffd=next.#ffd;this.#slots=next.#slots;this.#events=next.#events;this.#clipping=next.#clipping;this.#skins=next.#skins;this.#source=next.#source;this.#instance=next.#instance;this.#clip=next.#clip;this.#context=next.#context;
  this.#state=next.#state;this.#resumeState=next.#resumeState;this.#preview=next.#preview;
  this.#previewTime=next.#previewTime;this.#replayTarget=next.#replayTarget;
 }
 drainEvents(c:TransportContext){this.#check(c);return this.#instance!.drainEvents();}
 eventStatus(c:TransportContext){this.#check(c);return this.#instance!.eventStatus();}
 frame():ReplayFrame{
  if(!this.#instance)throw new ReplayError("disposed transport");
  return this.#preview?structuredClone(this.#preview):this.#instance.frame();
 }
 committedFrame():ReplayFrame{if(!this.#instance)throw new ReplayError("disposed transport");return this.#instance.frame();}
 clipTimeAt(tick:bigint):number{if(!this.#source)throw new ReplayError("disposed transport");if(this.#mixing){const frame=this.#instance!.frame();if(tick!==frame.tick)throw new ReplayError('mixing time requires accepted tick');return frame.mixing!.activeTime;}const a=this.#source.animations[this.#clip]!;return canonicalTime(tick,a.duration,a.looping);}
 sampleTick(tick:bigint){if(!this.#instance)throw new ReplayError("disposed transport");return this.#instance.sampleTick(tick);}
 snapshot():TransportSnapshot{
  const clock=this.#instance?.clock()??null,position=this.#preview?.tick??clock?.completed??null;
  const clip=this.#source?.animations[this.#clip],mixing=this.#mixing?this.#instance?.frame().mixing:undefined;
  return Object.freeze({state:this.#state,clip:mixing?.activeClip??this.#clip,clock,position,
   clipTime:position!==null&&clip?this.clipTimeAt(position):null,
   poseKind:position===null?null:this.#preview?"pure":"simulated",previewTime:this.#previewTime,
   resumeState:this.#resumeState,replayTarget:this.#replayTarget,
   replayComplete:this.#replayTarget!==null&&clock?.completed===this.#replayTarget&&clock.backlog===0n});
 }
 play(c:TransportContext,name:string,restart:boolean):void{
  this.#ready(c);
  if(this.#mixing&&name!==this.#clip&&!restart)throw new ReplayError("use requestTransition for clip changes");
  if(typeof restart!=="boolean")throw new ReplayError("play requires an explicit restart boolean");
  if(restart||name!==this.#clip){const next=this.#fresh(name,this.#nextEpoch());next.#state="playing";next.#preview=null;this.#replace(next);return;}
  if(this.#state==="seek_preview")throw new ReplayError("seek requires replayTo or explicit restart at zero");
  if(this.#state==="replaying")throw new ReplayError("replay pending; pump or restart explicitly");
  if(this.#state==="paused"){this.resume(c);return;}
  if(this.#state!=="stopped"&&this.#state!=="playing")throw new ReplayError("cannot play");
  this.#preview=null;this.#state="playing";
 }
 pause(c:TransportContext):void{
  this.#ready(c);if(this.#state==="paused")return;
  if(this.#state!=="playing"&&this.#state!=="replaying")throw new ReplayError("cannot pause");
  this.#resumeState=this.#state;this.#state="paused";
 }
 resume(c:TransportContext):void{
  this.#ready(c);if(this.#state!=="paused")throw new ReplayError("resume requires ordinary/replay pause; seek needs explicit replay");
  this.#state=this.#resumeState!;this.#resumeState=null;
  if(this.#state==="playing")this.#replayTarget=null;
 }
 stop(c:TransportContext):void{this.#ready(c);this.#replace(this.#fresh(this.#clip,this.#nextEpoch()));}
 reset(c:TransportContext,epoch:bigint):void{this.#check(c);this.#replace(this.#fresh(this.#clip,epoch));}
 seekTick(c:TransportContext,tick:bigint):void{this.seekTime(c,tick,120n);}
 seekTime(c:TransportContext,n:bigint,d:bigint):void{
  this.#ready(c);if(this.#mixing)throw new ReplayError("crossfade pure seek preview unsupported; replay from origin");if(this.#events)throw new ReplayError("Replay events: pure seek preview unsupported; replay from origin");if(this.#slots)throw new ReplayError("Animated slots: pure seek preview unsupported; replay from origin");if(this.#ffd)throw new ReplayError("Weighted FFD: pure seek preview unsupported; replay from origin");const [time,tick]=target(n,d),next=this.#fresh(this.#clip,this.#nextEpoch());
  const pose=next.sampleTick(tick);next.#preview={tick,pose,records:[]};next.#previewTime=time;next.#state="seek_preview";this.#replace(next);
 }
 /** Queue from origin only; no tick is executed until an explicit pump. */
 replayTo(c:TransportContext,tick:bigint):void{this.replayToTime(c,tick,120n);}
 replayToTime(c:TransportContext,n:bigint,d:bigint):void{
  this.#ready(c);const [,tick]=target(n,d),next=this.#fresh(this.#clip,this.#nextEpoch());
  if(this.#mixing)next.#instance!.restoreMixingFrom(this.#instance!);
  next.#instance!.queueTime(next.#instance!.context,n,d);next.#preview=null;next.#replayTarget=tick;
  if(tick===0n){next.#state="paused";next.#resumeState="playing";}else next.#state="replaying";
  this.#replace(next);
 }
 #execute(work:()=>ClockProgress):ClockProgress{
  const old=this.#state;this.#busy=true;
  try{
   const p=work();
   if(p.stop.kind==="failed")this.#state="faulted";
   else if(old==="replaying"&&p.state.backlog===0n){this.#state="paused";this.#resumeState="playing";}
   return p;
  }finally{if(this.#instance!.faulted)this.#state="faulted";this.#busy=false;}
 }
 requestTick(c:TransportContext,tick:bigint,observe:ReplayObserver):ClockProgress{return this.requestTime(c,tick,120n,observe);}
 requestTime(c:TransportContext,n:bigint,d:bigint,observe:ReplayObserver):ClockProgress{
  this.#ready(c);if(this.#state!=="playing")throw new ReplayError("request requires playing");
  return this.#execute(()=>this.#instance!.requestTime(this.#instance!.context,n,d,observe));
 }
 pump(c:TransportContext,budget:number,observe:ReplayObserver):ClockProgress{
  this.#ready(c);if(this.#state!=="playing"&&this.#state!=="replaying")throw new ReplayError("pump requires playing or replaying");
  return this.#execute(()=>this.#instance!.pump(this.#instance!.context,budget,observe));
 }
 requestTransition(c:TransportContext,request:TransitionRequest){this.#ready(c);if(!this.#mixing)throw new ReplayError("crossfade capability required");if(!["playing","paused"].includes(this.#state))throw new ReplayError("transition requires ordinary play or pause");this.#busy=true;try{return this.#instance!.requestTransition(this.#interruptible?structuredClone(request):request);}finally{this.#busy=false;}}
 requestInterrupt(c:TransportContext,request:TransitionRequest){this.#ready(c);if(!this.#interruptible)throw new ReplayError("interruptible capability required");if(!["playing","paused"].includes(this.#state))throw new ReplayError("interruption requires ordinary play or pause");this.#busy=true;try{return this.#instance!.requestInterrupt(structuredClone(request));}finally{this.#busy=false;}}
 transitionStatus(c:TransportContext){this.#check(c);return this.#instance!.transitionStatus();}
 crossFade(c:TransportContext,_name:string,_duration:number):never{this.#ready(c);throw new ReplayError("crossfade unsupported in B5A");}
 setSkin(c:TransportContext,_name:string):never{this.#ready(c);throw new ReplayError("skin changes unsupported in B5A");}
 startFromPreview(c:TransportContext):never{this.#ready(c);throw new ReplayError("nonzero rest-start unsupported; use replayTo or restart at zero");}
 dispose(c:TransportContext):void{
  this.#check(c);this.#instance=null;this.#source=null;this.#skins=undefined;this.#preview=null;this.#previewTime=null;this.#replayTarget=null;this.#resumeState=null;this.#state="disposed";
 }
}
function target(n:bigint,d:bigint):[RationalTime,bigint]{
 const result=rational(n,d);if(result[1]>MAX_SAMPLE_TICK)throw new ReplayError("unrepresentable clip time");return result;
}
