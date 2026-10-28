import {ReplayMixPlan} from "./replay-mixing.js";
import type {TransitionRequest,MixCommand} from "./replay-mixing.js";
import {validateLinkedFfdRig} from "./replay-linked-ffd.js";
import {linkedMeshSources} from "./replay-linked.js";
import {validateComposedFfdRig} from './replay-ffd-composition.js';
import {validateSlotsEventsRig} from "./replay-composition.js";
import {validateEventRig} from './replay-events.js';
import {validateWeightedFfdRig} from './replay-ffd.js';
import {replayMode,validateAnimatedSlotsRig} from "./replay-slots.js";
import type {ReplayOptions} from "./replay-slots.js";
import type { SkinEvent } from "./replay-skin.js";
import { evaluate, evaluateBoneLocals } from "./evaluate.js";
import { animationOf, parseRig } from "./rig.js";
import { ReplayPhysicsInstance, ReplayError, validateReplayRig } from "./replay-physics.js";
import type { ReplayContext, ReplayObserver } from "./replay-physics.js";
import type { RuntimeRigData, RuntimeAnimation, RigPose } from "./types.js";

export const MAX_SAMPLE_TICK = (1n << 23n) - 1n;
export function canonicalTime(tick:bigint,duration:number,looping:boolean):number {
  if(typeof tick!=="bigint"||tick<0n||tick>MAX_SAMPLE_TICK||!Number.isFinite(duration)||duration<0||!Number.isFinite(Math.fround(duration)))throw new ReplayError("unrepresentable clip time");
  // Duration is serialized with f32's shortest decimal (e.g. 0.83), whereas
  // key times carry full f32 values. Recover the author's actual duration.
  duration=Math.fround(duration);
  const time=Number(tick)/120;
  return Math.fround(duration===0?0:looping?time%duration:Math.min(time,duration));
}
/** Opt-in one-clip snapshot, bound to its own B3 instance. No player activation. */
export class ReplayAnimationInstance {
  #mixer:ReplayMixPlan|null=null;
  #interruptible=false;
  #mixSlots=false;
  #mixEvents=false;
  #mixFfd=false;
  #rig:RuntimeRigData;
  #clip:RuntimeAnimation;
  #name:string;
  #physics:ReplayPhysicsInstance;
  #ffd:boolean;
  #slots:boolean;
  #events:boolean;
 #clipping:boolean;
 #linked:boolean;
  constructor(rig:RuntimeRigData,name:string,epoch:bigint,events?:readonly SkinEvent[],options?:ReplayOptions){
    this.#rig=parseRig(structuredClone(rig));this.#name=name;
    this.#clip=animationOf(this.#rig,name);const mode=replayMode(options);this.#mixFfd=(mode==='crossfade-ffd'||mode==='integrated-crossfade');if(this.#mixFfd||mode==='crossfade'||mode==='crossfade-slots'||(mode==='crossfade-slots-events'||mode==='integrated-crossfade')){this.#mixEvents=(mode==='crossfade-slots-events'||mode==='integrated-crossfade');this.#mixSlots=mode==='crossfade-slots'||this.#mixEvents;
      if(events!==undefined&&!(events.length===1&&events[0]!.tick===0n&&events[0]!.skin===this.#rig.defaultSkin))throw new ReplayError("crossfade fixed skin only");
      this.#interruptible=(options as import('./replay-mixing.js').CrossfadeOptions).interruptible===true;this.#mixer=new ReplayMixPlan(this.#rig,name,this.#interruptible,this.#mixSlots,this.#mixEvents,this.#mixFfd);const initial=this.#mixer.sample(0n);this.#mixer.validateCandidate(initial,0n);
      this.#linked=this.#clipping=this.#ffd=this.#slots=this.#events=false;
      this.#physics=new ReplayPhysicsInstance(this.#rig,epoch,initial.locals,undefined,undefined,initial.mixing,initial.slotState,initial.deformation);return;
    }this.#linked=mode==='linked-slots'||mode==='linked-ffd-slots';this.#clipping=mode==='clipping'||mode==='ffd-clipping';this.#ffd=mode==='linked-ffd-slots'||mode==='ffd'||mode==='ffd-slots'||mode==='ffd-clipping';this.#slots=this.#linked||mode==='slots'||mode==='slots-events'||mode==='ffd-slots'||this.#clipping;this.#events=mode==='events'||mode==='slots-events';
    if(this.#linked&&!this.#ffd)this.#rig=linkedMeshSources(this.#rig,name,events);
    if(this.#linked&&this.#ffd)validateLinkedFfdRig(this.#rig,name,events);else if(this.#ffd&&this.#slots)validateComposedFfdRig(this.#rig,name,events,this.#clipping);else{if(this.#ffd)validateWeightedFfdRig(this.#rig,name,events);if(this.#slots&&this.#events)validateSlotsEventsRig(this.#rig,name,events);else{if(this.#slots)validateAnimatedSlotsRig(this.#rig,name,events,this.#clipping);if(this.#events)validateEventRig(this.#rig,name,events);}}validateReplayRig(this.#rig);validateBoneAnimation(this.#rig,this.#clip,this.#ffd,this.#slots,this.#events);
    this.#physics=new ReplayPhysicsInstance(this.#rig,epoch,this.#inputs(0n) as readonly import("./replay-physics.js").ReplayLocal[],events,this.#linked&&this.#ffd?{linkedMeshes:true,weightedFfd:true,animatedSlots:true,clip:name}:this.#ffd&&this.#slots?(this.#clipping?{weightedFfd:true,animatedSlots:true,clipping:true,clip:name}:{weightedFfd:true,animatedSlots:true,clip:name}):this.#clipping?{animatedSlots:true,clipping:true,clip:name}:this.#slots&&this.#events?{animatedSlots:true,animationEvents:true,clip:name}:this.#ffd?{weightedFfd:true,clip:name}:this.#slots?{animatedSlots:true,clip:name}:this.#events?{animationEvents:true,clip:name}:undefined);
  }
  skinAt(tick:bigint){return this.#physics.skinAt(tick);}
  get context(){return this.#physics.context;}
  get faulted(){return this.#physics.faulted;}
  clock(){return this.#physics.clock();}
  frame(){return this.#physics.frame();}
  drainEvents(){return this.#physics.drainEvents(this.#physics.context);}
  eventStatus(){return this.#physics.eventStatus(this.#physics.context);}
  sampleTick(tick:bigint):RigPose {
    if(this.#mixer)throw new ReplayError("crossfade requires replay from origin");
    if(this.#events)throw new ReplayError("Replay events: pure pose preview unsupported; replay from origin");
    if(this.#slots)throw new ReplayError("Animated slots: pure pose sampling unsupported; consume the accepted frame");
    const p=evaluate(this.#rig,[{animation:this.#name,time:canonicalTime(tick,this.#clip.duration,this.#clip.looping),alpha:1}],this.skinAt(tick)?{skin:this.skinAt(tick)!.skin}:{});
    for(const b of p.bones)if(![b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY,...Object.values(b.world)].every(Number.isFinite))throw new ReplayError("nonfinite sampled pose");
    return p;
  }
  requestTransition(request:TransitionRequest){if(this.#busy)throw new ReplayError("busy");if(!this.#mixer)throw new ReplayError("crossfade capability required");const c=this.clock();if(c.backlog!==0n)throw new ReplayError("transition requires drained backlog");return this.#mixer.request(c.completed,request);}
  requestInterrupt(request:TransitionRequest){
    if(this.#busy)throw new ReplayError("busy");if(!this.#interruptible||!this.#mixer)throw new ReplayError("interruptible capability required");
    if(this.#physics.faulted)throw new ReplayError("faulted; reset required");this.#busy=true;
    try{const snapshot=structuredClone(request),c=this.clock();if(c.backlog!==0n)throw new ReplayError("interruption requires drained backlog");
      const f=this.frame();return this.#mixer.requestInterrupt(c.completed,snapshot,{locals:f.prePhysics!,mixing:f.mixing!,...(this.#mixSlots?{slotState:f.slotState!}:{}),...(this.#mixFfd?{deformation:f.deformation!}:{})});
    }finally{this.#busy=false;}
  }
  transitionStatus(){if(!this.#mixer)throw new ReplayError("crossfade capability required");return{accepted:this.frame().mixing!,pending:this.#mixer.pending(this.clock().completed),commands:this.#mixer.commandCount,capacity:64};}
  restoreMixingFrom(other:ReplayAnimationInstance){if(!this.#mixer||!other.#mixer||this.#busy)throw new ReplayError("crossfade replay capability required");this.#mixer.restore(other.#mixer.commands());}
  #inputs(tick:bigint){if(this.#mixer){if(this.#interruptible){const f=this.frame();this.#mixer.verifyOrigin({locals:f.prePhysics!,mixing:f.mixing!,...(this.#mixSlots?{slotState:f.slotState!}:{}),...(this.#mixFfd?{deformation:f.deformation!}:{})});}const packet=this.#mixer.sample(tick);this.#mixer.validateCandidate(packet,tick);return packet;}return evaluateBoneLocals(this.#rig,{animation:this.#name,time:canonicalTime(tick,this.#clip.duration,this.#clip.looping),alpha:1}).map(({world,...local})=>local);}
  reset(rig:RuntimeRigData,name:string,epoch:bigint):void {
    if(epoch<=this.clock().epoch)throw new ReplayError("epoch must increase");
    // B3 busy/context guards still own application; no callback may swap it.
    if(this.#busy)throw new ReplayError("busy");
    const next=new ReplayAnimationInstance(rig,name,epoch,undefined,this.#mixer?{crossfade:true,...(this.#interruptible?{interruptible:true as const}:{}),...(this.#mixSlots?{animatedSlots:true as const}:{}),...(this.#mixEvents?{animationEvents:true as const}:{}),...(this.#mixFfd?{weightedFfd:true as const}:{})}:this.#linked?{linkedMeshes:true,animatedSlots:true,...(this.#ffd?{weightedFfd:true as const}:{})}:this.#ffd&&this.#slots?(this.#clipping?{weightedFfd:true,animatedSlots:true,clipping:true}:{weightedFfd:true,animatedSlots:true}):this.#clipping?{animatedSlots:true,clipping:true}:this.#slots&&this.#events?{animatedSlots:true,animationEvents:true}:this.#ffd?{weightedFfd:true}:this.#slots?{animatedSlots:true}:this.#events?{animationEvents:true}:undefined);
    this.#rig=next.#rig;this.#clip=next.#clip;this.#name=next.#name;this.#physics=next.#physics;this.#mixer=next.#mixer;this.#interruptible=next.#interruptible;this.#mixSlots=next.#mixSlots;this.#mixEvents=next.#mixEvents;this.#mixFfd=next.#mixFfd;
  }
  #busy=false;
  requestTick(c:ReplayContext,tick:bigint,observe:ReplayObserver){return this.requestTime(c,tick,120n,observe);}
  /** Schedule an exact target without sampling or numerical advancement. */
  queueTime(c:ReplayContext,n:bigint,d:bigint){
    if(this.#busy)throw new ReplayError("busy");
    if(typeof n==="bigint"&&typeof d==="bigint"&&d>0n&&n*120n/d>MAX_SAMPLE_TICK)throw new ReplayError("unrepresentable clip time");
    return this.#physics.queueTime(c,n,d);
  }
  requestTime(c:ReplayContext,n:bigint,d:bigint,observe:ReplayObserver){
    if(typeof n==="bigint"&&typeof d==="bigint"&&d>0n&&n*120n/d>MAX_SAMPLE_TICK)throw new ReplayError("unrepresentable clip time");
    if(this.#busy)throw new ReplayError("busy");this.#busy=true;
    try{return this.#physics.requestTime(c,n,d,t=>this.#inputs(t.index),observe);}finally{this.#busy=false;}
  }
  pump(c:ReplayContext,budget:number,observe:ReplayObserver){
    if(this.#busy)throw new ReplayError("busy");this.#busy=true;
    try{return this.#physics.pump(c,budget,t=>this.#inputs(t.index),observe);}finally{this.#busy=false;}
  }
}
export function validateBoneAnimation(rig:RuntimeRigData,clip:RuntimeAnimation,ffd=false,slots=false,events=false):void {
  if(rig.format_version!==2)throw new ReplayError("B4 sampling requires native v2; legacy readers unchanged");
  canonicalTime(0n,clip.duration,clip.looping);
  for(const skin of rig.skins)for(const {attachment} of skin.attachments){
    if((attachment.type==="region"||attachment.type==="mesh")&&attachment.sequence)throw new ReplayError("B4 does not sample attachment sequences");
  }
  if(typeof clip.looping!=="boolean")throw new ReplayError("invalid looping policy");
  for(const [key,value]of Object.entries(clip)){
    if(["duration","looping","bones"].includes(key)||ffd&&key==="deform"||slots&&["slots","drawOrder"].includes(key)||events&&key==="events")continue;
    if(!["slots","drawOrder","events","deform","ik","transform"].includes(key)||!Array.isArray(value)||value.length)throw new ReplayError(`B4 unsupported clip channel ${key}`);
  }
  const seen=new Set<string>();
  for(const track of clip.bones){
    if(seen.has(track.name))throw new ReplayError("duplicate bone track");seen.add(track.name);
    for(const [key,value]of Object.entries(track)){
      if(key==="name")continue;
      if(!["rotate","translate_x","translate_y","scale_x","scale_y","shear_x","shear_y"].includes(key)||!Array.isArray(value))throw new ReplayError("unsupported bone channel");
      let previous=-Infinity;
      for(const k of value){
        if(!Number.isFinite(k.time)||k.time<=previous||!Number.isFinite(k.value))throw new ReplayError("invalid/same-time keys");previous=k.time;
        if(k.curve!=="linear"&&k.curve!=="stepped"&&(!k.curve||k.curve.type!=="bezier"||!Array.isArray(k.curve.handles)||k.curve.handles.length!==4||!k.curve.handles.every(Number.isFinite)||k.curve.handles[0]<0||k.curve.handles[0]>1||k.curve.handles[2]<0||k.curve.handles[2]>1))throw new ReplayError("invalid curve");
      }
    }
  }
}
