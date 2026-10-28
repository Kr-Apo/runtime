import type {ReplayMixState} from './replay-mixing.js';
import type {ReplaySlotState} from "./replay-slots.js";
import {ReplayError} from './replay-physics.js';
import {validateAnimatedSlotsRig} from './replay-slots.js';
import type {SkinEvent} from './replay-skin.js';
import type {RuntimeRigData,RuntimeEvent} from './types.js';
export interface AnimationEventOptions {readonly animationEvents:true}
export const EVENT_QUEUE_CAPACITY=1024;
export interface ReplayEvent {readonly session:string;readonly epoch:bigint;readonly clip:string;readonly tick:bigint;readonly lap:bigint;readonly keyIndex:number;readonly ordinal:number;readonly id:string;readonly event:Readonly<RuntimeEvent>;readonly slotState?:ReplaySlotState;readonly clipTick?:bigint;readonly clipTime?:number;readonly mixing?:ReplayMixState}
const need=(v:unknown,m:string)=>{if(!v)throw new ReplayError('Replay events: '+m);};
let serial=0n;
export function validateEventRig(r:RuntimeRigData,name:string,skins?:readonly SkinEvent[]):void {
 const a=r.animations[name];need(a,'unknown clip');if(!a)throw new ReplayError('unknown clip');
 need(Math.fround(a.duration)>0&&Number.isFinite(Math.fround(a.duration)),'positive native f32 duration');
 need(a.slots.length===0&&a.drawOrder.length===0,'slot channels not composed');
 // Reuse the A4 static fixed-skin structural domain, opening only separately validated events.
 const view=structuredClone(r);view.animations[name]!.events=[];validateAnimatedSlotsRig(view,name,skins);
 need(Array.isArray(a.events)&&a.events.length<=4096,'event key capacity');
 for(const e of a.events){
  need(e&&typeof e==='object'&&Object.keys(e).every(k=>['time','name','int','float','string','audio','volume','balance'].includes(k)),'event shape');
  need(Number.isFinite(e.time)&&e.time>=0&&Math.fround(e.time)<=Math.fround(a.duration)&&Number.isFinite(Math.fround(e.time)),'event time');
  need(typeof e.name==='string'&&e.name.length>0&&e.name.length<=1024,'event name');
  for(const k of ['string','audio'] as const)need(e[k]===undefined||typeof e[k]==='string'&&e[k]!.length<=1024,'text payload '+k);
  need(e.int===undefined||Number.isInteger(e.int)&&e.int>=-2147483648&&e.int<=2147483647,'i32 payload');
  for(const k of ['float','volume','balance'] as const)need(e[k]===undefined||Number.isFinite(e[k])&&Number.isFinite(Math.fround(e[k]!)),'finite payload '+k);
  need(e.volume===undefined||e.volume>=0,'volume');need(e.balance===undefined||e.balance>=-1&&e.balance<=1,'balance');
 }
}
/** Exact duration fraction, so repeated host updates never accumulate event time. */
function fraction(value:number):[bigint,bigint]{const b=new DataView(new ArrayBuffer(4));b.setFloat32(0,value);const bits=b.getUint32(0),e=(bits>>>23)&255,m=BigInt((bits&0x7fffff)+(e?0x800000:0)),power=e?e-150:-149;return power>=0?[m<<BigInt(power),1n]:[m,1n<<BigInt(-power)];}
export class ReplayEvents {
 readonly session='replay-events-'+serial++;readonly #clip:string;readonly #duration:number;readonly #loop:boolean;readonly #keys:readonly {event:RuntimeEvent;index:number}[];readonly #n:bigint;readonly #d:bigint;
 constructor(r:RuntimeRigData,name:string,skins?:readonly SkinEvent[]){validateEventRig(r,name,skins);const a=structuredClone(r.animations[name]!);this.#clip=name;this.#duration=Math.fround(a.duration);this.#loop=a.looping;this.#keys=a.events.map((event,index)=>({event,index})).sort((a,b)=>Math.fround(a.event.time)-Math.fround(b.event.time));[this.#n,this.#d]=fraction(this.#duration);}
 candidate(tick:bigint,epoch:bigint,queued:readonly ReplayEvent[]):readonly ReplayEvent[]{
  need(typeof tick==='bigint'&&tick>0n,'positive candidate tick');const out:ReplayEvent[]=[];
  const collect=(lo:number,hi:number,lap:bigint)=>{for(const k of this.#keys){const t=Math.fround(k.event.time);if(t>lo&&t<=hi){need(queued.length+out.length<EVENT_QUEUE_CAPACITY,'queue overflow; drain accepted prefix, then reset');const ordinal=out.length;out.push({session:this.session,epoch,clip:this.#clip,tick,lap,keyIndex:k.index,ordinal,id:`${this.session}/${epoch}/${tick}/${lap}/${k.index}`,event:structuredClone(k.event)});}}};
  if(!this.#keys.some(k=>k.event.time>0))return queued;
  if(!this.#loop)collect(Math.fround(Math.min(Number(tick-1n)/120,this.#duration)),Math.fround(Math.min(Number(tick)/120,this.#duration)),0n);
  else{
   const den=120n*this.#n,prev=(tick-1n)*this.#d,next=tick*this.#d,first=prev/den,last=next/den;
   need(last-first<=BigInt(EVENT_QUEUE_CAPACITY+1),'per-tick event capacity');
   const lo=Math.fround(Number(prev%den)/Number(120n*this.#d)),hi=Math.fround(Number(next%den)/Number(120n*this.#d));
   if(first===last)collect(lo,hi,first);else{collect(lo,this.#duration,first);for(let lap=first+1n;lap<last;lap++)collect(0,this.#duration,lap);collect(0,hi,last);}
  }
  return out.length?[...queued,...out]:queued;
 }
}
