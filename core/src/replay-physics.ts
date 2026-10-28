import {integratedSources,assertIntegratedEvent} from "./replay-integrated.js";
import {isIntegratedMixKind} from "./replay-mixing.js";
import {ReplayFfdMixer} from "./replay-ffd-mixing.js";
import {assertMixPacket,validateMixingRig,isSlotMixKind,isInterruptibleMixKind,isEventMixKind,isFfdMixKind} from "./replay-mixing.js";
import type {ReplayMixState,ReplayMixSample} from "./replay-mixing.js";
import {linkedFfdSources} from "./replay-linked-ffd.js";
import {ffdCompositionSources} from "./replay-ffd-composition.js";
import {compositionSources} from "./replay-composition.js";
import {ReplayMixEvents} from "./replay-mix-events.js";
import {ReplayEvents,EVENT_QUEUE_CAPACITY} from "./replay-events.js";
import type {ReplayEvent} from "./replay-events.js";
import {ReplaySlots} from "./replay-slots.js";
import {validateReplaySlotState} from "./replay-slots.js";
import type {ReplaySlotState} from "./replay-slots.js";
import {ReplayDeforms} from "./replay-ffd.js";
import type {ReplayDeformation} from "./replay-ffd.js";
import { SkinCalendar } from "./replay-skin.js";
import type { SkinEvent } from "./replay-skin.js";
import { ReplayClock, ClockError } from "./replay-clock.js";
import type { ClockProgress, ScheduledTick } from "./replay-clock.js";
import { evaluate } from "./evaluate.js";
import { parseRig, physicsBone } from "./rig.js";
import { replayPhysicsStep, replayWorlds } from "./constraints.js";
import type { ReplaySpring } from "./constraints.js";
import type { RuntimeRigData, RigPose, RuntimeConstraint } from "./types.js";

declare const contextBrand: unique symbol;
export interface ReplayContext { readonly epoch:bigint; readonly [contextBrand]:true }
export interface ReplayLocal {
  readonly name:string; readonly x:number; readonly y:number; readonly rotation:number;
  readonly scaleX:number; readonly scaleY:number; readonly shearX:number; readonly shearY:number;
}
export interface ReplayRecord extends ReplaySpring { readonly constraint:string; readonly bone:string }
export interface ReplayFrame { readonly tick:bigint; readonly pose:RigPose; readonly records:readonly ReplayRecord[]; readonly deformation?:ReplayDeformation; readonly slotState?:ReplaySlotState; readonly mixing?:ReplayMixState; readonly prePhysics?:readonly ReplayLocal[] }
export type ReplayProvider=(tick:ScheduledTick)=>readonly ReplayLocal[]|ReplayMixSample;
export type ReplayObserver=(frame:ReplayFrame)=>void;
export class ReplayError extends Error {}
type Physics=Extract<RuntimeConstraint,{type:"physics"}>;

/** Explicit, immutable rig snapshot, Physics-only/default-skin B3 surface.
 * Context identity is object identity, never just a numeric epoch or bone ID.
 */
export class ReplayPhysicsInstance {
  #mixing=false;
  #mixFfd:ReplayFfdMixer|null=null;
  #mixSlots=false;
  #mixEvents:ReplayMixEvents|null=null;
  #rig:RuntimeRigData;
  #clock=new ReplayClock();
  #context:ReplayContext;
  #records=new Map<string,ReplaySpring>();
  #active:Physics[];
  #frame:ReplayFrame;
  #faulted=false;
  #busy=false;
  #calendar:SkinCalendar|null;
  #deforms:ReplayDeforms|null;
  #slots:ReplaySlots|null;
  #events:ReplayEvents|null;
  #eventQueue:readonly ReplayEvent[]=[];
  #samplingOptions:({readonly linkedMeshes:true;readonly weightedFfd:true;readonly animatedSlots:true;readonly clip:string}|{readonly weightedFfd:true;readonly animatedSlots:true;readonly clipping:true;readonly clip:string}|{readonly weightedFfd:true;readonly animatedSlots:true;readonly clip:string}|{readonly weightedFfd:true;readonly clip:string}|{readonly animatedSlots:true;readonly clip:string}|{readonly animationEvents:true;readonly clip:string}|{readonly animatedSlots:true;readonly clipping:true;readonly clip:string}|{readonly animatedSlots:true;readonly animationEvents:true;readonly clip:string})|undefined;
  constructor(rig:RuntimeRigData,epoch:bigint,initial:readonly ReplayLocal[],events?:readonly SkinEvent[],ffd?:{readonly linkedMeshes:true;readonly weightedFfd:true;readonly animatedSlots:true;readonly clip:string}|{readonly weightedFfd:true;readonly animatedSlots:true;readonly clipping:true;readonly clip:string}|{readonly weightedFfd:true;readonly animatedSlots:true;readonly clip:string}|{readonly weightedFfd:true;readonly clip:string}|{readonly animatedSlots:true;readonly clip:string}|{readonly animationEvents:true;readonly clip:string}|{readonly animatedSlots:true;readonly clipping:true;readonly clip:string}|{readonly animatedSlots:true;readonly animationEvents:true;readonly clip:string},mixing?:ReplayMixState,initialSlots?:ReplaySlotState,initialDeformation?:ReplayDeformation) {
    if(ffd&&!(Object.keys(ffd).sort().join(",")==="animatedSlots,clip,linkedMeshes,weightedFfd"&&"linkedMeshes"in ffd&&ffd.linkedMeshes===true&&"weightedFfd"in ffd&&ffd.weightedFfd===true&&"animatedSlots"in ffd&&ffd.animatedSlots===true||Object.keys(ffd).sort().join(",")==="animatedSlots,clip,clipping,weightedFfd"&&"animatedSlots"in ffd&&ffd.animatedSlots===true&&"weightedFfd"in ffd&&ffd.weightedFfd===true&&"clipping"in ffd&&ffd.clipping===true||Object.keys(ffd).sort().join(",")==="animatedSlots,clip,weightedFfd"&&"animatedSlots"in ffd&&ffd.animatedSlots===true&&"weightedFfd"in ffd&&ffd.weightedFfd===true||Object.keys(ffd).sort().join(",")==="animatedSlots,clip,clipping"&&"animatedSlots"in ffd&&ffd.animatedSlots===true&&"clipping"in ffd&&ffd.clipping===true||Object.keys(ffd).sort().join(",")==="clip,weightedFfd"&&"weightedFfd"in ffd&&ffd.weightedFfd===true||Object.keys(ffd).sort().join(",")==="animatedSlots,clip"&&"animatedSlots"in ffd&&ffd.animatedSlots===true||Object.keys(ffd).sort().join(",")==="animationEvents,clip"&&"animationEvents"in ffd&&ffd.animationEvents===true||Object.keys(ffd).sort().join(",")==="animatedSlots,animationEvents,clip"&&"animatedSlots"in ffd&&ffd.animatedSlots===true&&"animationEvents"in ffd&&ffd.animationEvents===true))throw new ReplayError("invalid replay channel capability");
    this.#mixing=mixing!==undefined;this.#mixSlots=isSlotMixKind(mixing?.kind);if(!this.#mixSlots&&initialSlots!==undefined)throw new ReplayError('slot mixing capability required');
    if(mixing){if(ffd||events!==undefined)throw new ReplayError("crossfade cannot combine channels/skins");validateMixingRig(rig,mixing.activeClip,this.#mixSlots,isEventMixKind(mixing.kind),isFfdMixKind(mixing.kind));assertMixPacket({locals:initial,mixing,...(isFfdMixKind(mixing.kind)?{deformation:initialDeformation!}:{}),...(this.#mixSlots?{slotState:initialSlots!}:{})},0n,rig);}
    this.#samplingOptions=ffd?{...ffd}:undefined;
    this.#rig=parseRig(structuredClone(rig));
    this.#active=validateReplayRig(this.#rig);if(isFfdMixKind(mixing?.kind))this.#mixFfd=new ReplayFfdMixer(isIntegratedMixKind(mixing?.kind)?integratedSources(this.#rig).ffd:this.#rig);if(!this.#mixFfd&&initialDeformation!==undefined)throw new ReplayError("FFD mixing capability required");if(this.#mixFfd)this.#mixFfd.validate(initialDeformation!,0n,mixing!.activeClip);if(isEventMixKind(mixing?.kind))this.#mixEvents=new ReplayMixEvents(isIntegratedMixKind(mixing?.kind)?integratedSources(this.#rig).events:this.#rig);
    const linked=ffd&&"linkedMeshes"in ffd?linkedFfdSources(this.#rig,ffd.clip,events):null;
    const composed=ffd&&!linked&&"weightedFfd"in ffd&&"animatedSlots"in ffd?ffdCompositionSources(this.#rig,ffd.clip,events,"clipping"in ffd&&ffd.clipping===true):null;
    this.#deforms=ffd&&"weightedFfd"in ffd?new ReplayDeforms(composed?.ffd??this.#rig,ffd.clip,events,!!composed,!!linked):null;
    const composition=ffd&&"animatedSlots"in ffd&&"animationEvents"in ffd?compositionSources(this.#rig,ffd.clip,events):null;
    this.#slots=ffd&&"animatedSlots"in ffd?new ReplaySlots(linked?.slots??composed?.slots??composition?.slots??this.#rig,ffd.clip,events,"clipping"in ffd&&ffd.clipping===true):null;
    this.#events=ffd&&"animationEvents"in ffd?new ReplayEvents(composition?.events??this.#rig,ffd.clip,events):null;
    this.#calendar=events===undefined?null:new SkinCalendar(this.#rig,events);
    if(this.#calendar)this.#active=this.#resolve(this.#calendar.at(0n).active);
    this.#clock.reset(epoch);
    this.#context=Object.freeze({epoch}) as ReplayContext;
    const pose=this.#prepare(initial);
    for(const c of this.#active) {
      const s:ReplaySpring={rotation:0,rotationVelocity:0,x:0,y:0,velocityX:0,velocityY:0,anchorX:0,anchorY:0};
      replayPhysicsStep(this.#rig,pose,c,s,true);this.#records.set(c.name,s);
    }
    const slotState=this.#slotCandidate(pose,0n,initialSlots,mixing?.activeClip);
    this.#frame={tick:0n,pose,...(mixing?{mixing:structuredClone(mixing),...((isInterruptibleMixKind(mixing.kind)||this.#mixSlots||this.#mixFfd)?{prePhysics:structuredClone(initial)}:{})}:{}),...(slotState?{slotState}:{}),records:this.#snapshots(),...(this.#mixFfd?{deformation:structuredClone(initialDeformation!)}:{}),...(this.#deforms?{deformation:this.#deformCandidate(0n,slotState)}:{})};
  }
  skinAt(tick:bigint){return this.#calendar?.at(tick)??null;}
  #resolve(active:readonly string[]):Physics[]{return active.map(n=>this.#rig.constraints.find(c=>c.name===n)! as Physics);}
  get context():ReplayContext {return this.#context;}
  get faulted():boolean {return this.#faulted;}
  clock(){return this.#clock.snapshot();}
  frame():ReplayFrame {return structuredClone(this.#frame);}
  /** Detached numerical audit view, not a state-restoration API. */
  numericalState(){return structuredClone({active:this.#active.map(c=>c.name),records:this.#rig.constraintOrder.filter(n=>this.#records.has(n)).map(n=>({constraint:n,...this.#records.get(n)!}))});}
  reset(rig:RuntimeRigData,epoch:bigint,initial:readonly ReplayLocal[],mixing?:ReplayMixState,initialSlots?:ReplaySlotState,initialDeformation?:ReplayDeformation):void {
    if(this.#busy)throw new ReplayError("busy");
    if(typeof epoch!=="bigint"||epoch<=this.#context.epoch)throw new ClockError("invalid_epoch");
    if(this.#mixing!==(mixing!==undefined))throw new ReplayError("reset must preserve explicit mixing mode");
    const next=new ReplayPhysicsInstance(rig,epoch,initial,undefined,this.#samplingOptions,mixing,initialSlots,initialDeformation);
    this.#mixFfd=next.#mixFfd;this.#mixSlots=next.#mixSlots;this.#mixEvents=next.#mixEvents;this.#rig=next.#rig;this.#clock=next.#clock;this.#context=next.#context;
    this.#records=next.#records;this.#active=next.#active;this.#frame=next.#frame;this.#faulted=false;this.#calendar=next.#calendar;this.#deforms=next.#deforms;this.#slots=next.#slots;this.#events=next.#events;this.#eventQueue=[];this.#samplingOptions=next.#samplingOptions;
  }
  #check(context:ReplayContext):void {
    if(this.#busy)throw new ReplayError("busy");
    if(context!==this.#context)throw new ReplayError("context");
    if(this.#faulted)throw new ReplayError("faulted; reset required");
  }
  requestTick(c:ReplayContext,tick:bigint,input:ReplayProvider,observe:ReplayObserver):ClockProgress {
    return this.requestTime(c,tick,120n,input,observe);
  }
  /** Schedule only: cancel the offered tick before inputs or Physics mutate. */
  queueTime(c:ReplayContext,n:bigint,d:bigint):ClockProgress {
    this.#check(c);return this.#clock.requestTime(c.epoch,n,d,()=>({kind:"cancelled"}));
  }
  requestTime(c:ReplayContext,n:bigint,d:bigint,input:ReplayProvider,observe:ReplayObserver):ClockProgress {
    this.#check(c);this.#busy=true;
    try{return this.#clock.requestTime(c.epoch,n,d,t=>this.#run(t,input,observe));}
    finally{this.#busy=false;}
  }
  pump(c:ReplayContext,budget:number,input:ReplayProvider,observe:ReplayObserver):ClockProgress {
    this.#check(c);this.#busy=true;
    try{return this.#clock.pump(c.epoch,budget,t=>this.#run(t,input,observe));}
    finally{this.#busy=false;}
  }
  #run(tick:ScheduledTick,input:ReplayProvider,observe:ReplayObserver){
    this.#faulted=true;
    try {
      const records=cloneRecords(this.#records);
      let active=this.#active.slice(); // Definitions belong to the immutable rig.
      const offered=input(tick);let mixed:ReplayMixSample|undefined;
      if(this.#mixing){mixed=offered as ReplayMixSample;assertMixPacket(mixed,tick.index,this.#rig);if(mixed.mixing.kind!==this.#frame.mixing?.kind)throw new ReplayError("mixing capability kind changed");}else if(!Array.isArray(offered))throw new ReplayError("mixed packet requires explicit crossfade mode");
      if(this.#mixFfd)this.#mixFfd.validate(mixed!.deformation!,tick.index,mixed!.mixing.activeClip);
      const pose=this.#prepare(mixed?mixed.locals:offered as readonly ReplayLocal[]);
      if(this.#calendar){
        const next=this.#calendar.at(tick.index).active;
        if(next.length!==active.length||next.some((n,i)=>n!==active[i]!.name)){
          for(const n of records.keys())if(!next.includes(n))records.delete(n);
          active=this.#resolve(next);
        }
      }
      for(const c of active){
        if(!records.has(c.name)){
          const s:ReplaySpring={rotation:0,rotationVelocity:0,x:0,y:0,velocityX:0,velocityY:0,anchorX:0,anchorY:0};
          replayPhysicsStep(this.#rig,pose,c,s,true);records.set(c.name,s);
        }
        replayPhysicsStep(this.#rig,pose,c,records.get(c.name)!,false);finitePose(pose);
      }
      const slotState=this.#slotCandidate(pose,tick.index,mixed?.slotState,mixed?.mixing.activeClip);
      const next:ReplayFrame={tick:tick.index,pose,...(mixed?{mixing:structuredClone(mixed.mixing),...((isInterruptibleMixKind(mixed.mixing.kind)||this.#mixSlots||this.#mixFfd)?{prePhysics:structuredClone(mixed.locals)}:{})}:{}),...(slotState?{slotState}:{}),records:this.#snapshots(records,active),...(this.#mixFfd?{deformation:structuredClone(mixed!.deformation!)}:{}),...(this.#deforms?{deformation:this.#deformCandidate(tick.index,slotState)}:{})};
      let eventQueue=this.#mixEvents?this.#mixEvents.candidate(mixed!.mixing,this.#frame.mixing!,tick.epoch,this.#eventQueue):this.#events?.candidate(tick.index,tick.epoch,this.#eventQueue)??this.#eventQueue;
      if(slotState&&eventQueue.length>this.#eventQueue.length)eventQueue=eventQueue.map((e,i)=>i<this.#eventQueue.length?e:{...e,slotState});
      if(isIntegratedMixKind(mixed?.mixing.kind))for(let i=this.#eventQueue.length;i<eventQueue.length;i++)assertIntegratedEvent(eventQueue[i]);
      const complete={kind:"complete" as const};
      observe(structuredClone(next));
      // No callback/await/fallible work between acceptance and B2's clock commit.
      this.#accept(records,active,next,eventQueue);this.#faulted=false;
      return complete;
    }catch(error){return {kind:"failed" as const,error};}
  }
  drainEvents(c:ReplayContext):ReplayEvent[]{this.#eventCheck(c);const out=this.#slots||this.#mixEvents?this.#eventQueue.map(e=>structuredClone(e)):structuredClone(this.#eventQueue) as ReplayEvent[];this.#eventQueue=[];return out;}
  eventStatus(c:ReplayContext){this.#eventCheck(c);return Object.freeze({session:(this.#mixEvents??this.#events)!.session,pending:this.#eventQueue.length,capacity:EVENT_QUEUE_CAPACITY});}
  #eventCheck(c:ReplayContext){if(this.#busy)throw new ReplayError("busy");if(c!==this.#context)throw new ReplayError("context");if(!this.#events&&!this.#mixEvents)throw new ReplayError("events capability required");}
  #deformCandidate(tick:bigint,slots?:ReplaySlotState):ReplayDeformation{const d=this.#deforms!.sample(tick,slots);this.#deforms!.validateCandidate(d,tick,slots);return d;}
  #slotCandidate(pose:RigPose,tick:bigint,offered?:ReplaySlotState,clip?:string):ReplaySlotState|undefined {
    if(this.#mixSlots)validateReplaySlotState(this.#rig,offered!,tick,clip!,this.#rig.defaultSkin!);const state=this.#mixSlots?structuredClone(offered):this.#slots?.sample(tick);if(state){pose.slots=state.slots.map(s=>({name:s.name,attachment:s.attachment,visible:s.visible,color:[...s.color],sequenceFrame:0}));pose.drawOrder=[...state.drawOrder];}return state;
  }
  #accept(records:Map<string,ReplaySpring>,active:Physics[],frame:ReplayFrame,events:readonly ReplayEvent[]=this.#eventQueue):void {
    this.#records=records;this.#active=active;this.#frame=frame;this.#eventQueue=events;
  }
  #snapshots(records=this.#records,active=this.#active):ReplayRecord[]{
    return active.map(c=>({constraint:c.name,bone:physicsBone(c,new Set(this.#rig.bones.map(b=>b.name))),...records.get(c.name)!}));
  }
  #prepare(inputs:readonly ReplayLocal[]):RigPose {
    const pose=evaluate(this.#rig); // Physics-only context; no state passed, no Physics applied.
    const seen=new Set<string>();
    for(const t of inputs){
      const b=pose.bones.find(b=>b.name===t.name);
      if(!b||seen.has(t.name)||![t.x,t.y,t.rotation,t.scaleX,t.scaleY,t.shearX,t.shearY].every(Number.isFinite))throw new ReplayError("invalid input bone/transform");
      seen.add(t.name);
      b.x=t.x;b.y=t.y;b.rotation=t.rotation;b.scaleX=t.scaleX;b.scaleY=t.scaleY;b.shearX=t.shearX;b.shearY=t.shearY;
    }
    replayWorlds(this.#rig,pose);finitePose(pose);return pose;
  }
}
function finitePose(pose:RigPose):void {
  for(const b of pose.bones)if(![b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY,...Object.values(b.world)].every(Number.isFinite))throw new ReplayError("nonfinite pose");
}
export function validateReplayRig(rig:RuntimeRigData):Physics[]{
  if(rig.constraintOrder.length!==rig.constraints.length||new Set(rig.constraintOrder).size!==rig.constraints.length)throw new ReplayError("incomplete/duplicate constraint order");
  const bones=new Set(rig.bones.map(b=>b.name));
  for(const c of rig.constraints){
    if(c.type!=="physics")throw new ReplayError("B3 requires Physics-only constraints");
    physicsBone(c,bones);
    if(![c.mix,c.physics.inertia,c.physics.strength,c.physics.damping,c.physics.mass,c.forces.wind_x,c.forces.wind_y,c.forces.gravity_x,c.forces.gravity_y].every(Number.isFinite)
      ||typeof c.channels.rotate!=="boolean"||typeof c.channels.translate!=="boolean")throw new ReplayError("invalid physics parameters");
  }
  const names=new Set(rig.constraints.map(c=>c.name));
  if(names.size!==rig.constraints.length)throw new ReplayError("duplicate constraint identity");
  if(rig.defaultSkin!==null&&!rig.skins.some(s=>s.name===rig.defaultSkin))throw new ReplayError("missing default skin");
  for(const skin of rig.skins)if(skin.constraints.some(c=>!names.has(c))||skin.bones.some(b=>!bones.has(b)))throw new ReplayError("invalid skin member");
  const owned=new Set(rig.skins.flatMap(s=>s.constraints));
  const active=new Set(rig.skins.find(s=>s.name===rig.defaultSkin)?.constraints??[]);
  return rig.constraintOrder.map(n=>{
    const c=rig.constraints.find(c=>c.name===n);
    if(!c)throw new ReplayError("missing constraint");return c as Physics;
  }).filter(c=>!owned.has(c.name)||active.has(c.name));
}

// Explicit scalar ownership: ReplaySpring currently consists of eight numbers.
// A future mutable/nested field must extend this typed copy and its fault tests.
function cloneRecords(records:ReadonlyMap<string,ReplaySpring>):Map<string,ReplaySpring>{
 return new Map([...records].map(([name,r])=>[name,{rotation:r.rotation,rotationVelocity:r.rotationVelocity,x:r.x,y:r.y,velocityX:r.velocityX,velocityY:r.velocityY,anchorX:r.anchorX,anchorY:r.anchorY}]));
}
