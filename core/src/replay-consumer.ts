import type {ReplayMixState,TransitionRequest} from "./replay-mixing.js";
import type {ReplayOptions,ReplaySlotState} from "./replay-slots.js";
import type {ReplayDeformation} from './replay-ffd.js';
import {ReplayTransport} from "./replay-transport.js";
import type {TransportContext,TransportState} from "./replay-transport.js";
import {ReplayError} from "./replay-physics.js";
import type {ReplayObserver,ReplayRecord,ReplayLocal} from "./replay-physics.js";
import type {SkinEvent} from "./replay-skin.js";
import type {RuntimeRigData,BonePose} from "./types.js";
import type {RationalTime} from "./replay-clock.js";

export interface ConsumerFrame {
 readonly context:TransportContext;readonly epoch:bigint;readonly clip:string;
 readonly requested:bigint;readonly completed:bigint;readonly backlog:bigint;readonly poseTick:bigint;
 readonly poseTime:RationalTime;readonly clipTime:number;readonly skin:string;
 readonly state:TransportState;readonly health:"healthy"|"faulted";readonly targetReached:boolean;
 readonly prePhysics?:readonly ReplayLocal[];readonly mixing?:ReplayMixState;readonly bones:readonly BonePose[];readonly records:readonly ReplayRecord[];readonly deformation?:ReplayDeformation;readonly slotState?:ReplaySlotState;
}
export interface ConsumerPreview {
 readonly context:TransportContext;readonly epoch:bigint;readonly tick:bigint;
 readonly poseTime:RationalTime;readonly clipTime:number;readonly skin:string;readonly bones:readonly BonePose[];
}
function time(tick:bigint):RationalTime{
 let a=tick,b=120n;while(b){[a,b]=[b,a%b];}return Object.freeze({numerator:tick/a,denominator:120n/a});
}
/** Explicit bone-only consumer. Owns one transport, no host/physical clock. */
export class ReplayConsumerBridge {
 #transport:ReplayTransport;
 #default:string;
 #presenting=false;
 constructor(rig:RuntimeRigData,name:string,epoch:bigint,events?:readonly SkinEvent[],options?:ReplayOptions){
  this.#transport=new ReplayTransport(rig,name,epoch,events,options);
  if(rig.defaultSkin===null)throw new ReplayError("consumer requires native default skin");
  this.#default=rig.defaultSkin;
 }
 get context(){return this.#transport.context;}
 transportStatus(){return this.#transport.snapshot();}
 drainEvents(c:TransportContext){this.#ready();return this.#transport.drainEvents(c);}
 eventStatus(c:TransportContext){this.#ready();return this.#transport.eventStatus(c);}
 #skin(tick:bigint){return this.#transport.skinAt(tick)?.skin??this.#default;}
 currentFrame():ConsumerFrame{
  const s=this.#transport.snapshot(),f=this.#transport.committedFrame(),c=s.clock!;
  if(f.tick!==c.completed)throw new ReplayError("incoherent committed frame");
  const health=s.state==="faulted"?"faulted":"healthy";
  return Object.freeze({context:this.context,epoch:c.epoch,clip:s.clip,requested:c.requested,completed:c.completed,backlog:c.backlog,
   poseTick:f.tick,poseTime:time(f.tick),clipTime:this.#transport.clipTimeAt(f.tick),skin:this.#skin(f.tick),state:s.state,health,
   targetReached:c.backlog===0n&&health==="healthy",...(f.mixing?{mixing:f.mixing}:{}),...(f.prePhysics?{prePhysics:f.prePhysics}:{}),bones:f.pose.bones,records:f.records,...(f.deformation?{deformation:f.deformation}:{}),...(f.slotState?{slotState:f.slotState}:{})});
 }
 previewFrame():ConsumerPreview|null{
  const s=this.#transport.snapshot();if(s.state!=="seek_preview"){this.#transport.committedFrame();return null;}
  const f=this.#transport.frame();return Object.freeze({context:this.context,epoch:this.context.epoch,tick:f.tick,poseTime:time(f.tick),clipTime:this.#transport.clipTimeAt(f.tick),skin:this.#skin(f.tick),bones:f.pose.bones});
 }
 /** Detached published snapshot. Presentation failure has no simulation side effects. */
 present(consumer:(frame:ConsumerFrame)=>void):void{
  if(this.#presenting)throw new ReplayError("recursive presentation");
  const frame=this.currentFrame();this.#presenting=true;try{consumer(frame);}finally{this.#presenting=false;}
 }
 #ready(){if(this.#presenting)throw new ReplayError("mutation during presentation");}
 play(c:TransportContext,name:string,restart:boolean){this.#ready();this.#transport.play(c,name,restart);}
 pause(c:TransportContext){this.#ready();this.#transport.pause(c);}
 resume(c:TransportContext){this.#ready();this.#transport.resume(c);}
 stop(c:TransportContext){this.#ready();this.#transport.stop(c);}
 reset(c:TransportContext,epoch:bigint){this.#ready();this.#transport.reset(c,epoch);}
 seekTick(c:TransportContext,tick:bigint){this.#ready();this.#transport.seekTick(c,tick);}
 seekTime(c:TransportContext,n:bigint,d:bigint){this.#ready();this.#transport.seekTime(c,n,d);}
 replayFromOrigin(c:TransportContext,tick:bigint){this.#ready();this.#transport.replayTo(c,tick);}
 requestTransition(c:TransportContext,request:TransitionRequest){this.#ready();return this.#transport.requestTransition(c,request);}
 requestInterrupt(c:TransportContext,request:TransitionRequest){this.#ready();return this.#transport.requestInterrupt(c,request);}
 transitionStatus(c:TransportContext){this.#ready();return this.#transport.transitionStatus(c);}
 /** Optional precommit audit is inherited diagnostic work, NOT presentation. */
 requestTick(c:TransportContext,tick:bigint,audit:ReplayObserver=()=>{}){this.#ready();return this.#transport.requestTick(c,tick,audit);}
 requestTime(c:TransportContext,n:bigint,d:bigint,audit:ReplayObserver=()=>{}){this.#ready();return this.#transport.requestTime(c,n,d,audit);}
 pump(c:TransportContext,budget:number,audit:ReplayObserver=()=>{}){this.#ready();return this.#transport.pump(c,budget,audit);}
 dispose(c:TransportContext){this.#ready();this.#transport.dispose(c);this.#default="";}
}
