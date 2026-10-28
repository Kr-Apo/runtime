import {ReplayEvents,EVENT_QUEUE_CAPACITY,validateEventRig} from './replay-events.js';
import type {ReplayEvent} from './replay-events.js';
import {ReplayError} from './replay-physics.js';
import {canonicalTime} from './replay-animation.js';
import type {ReplayMixState} from './replay-mixing.js';
import {parseRig} from './rig.js';
import type {RuntimeRigData} from './types.js';

const need=(v:unknown,m:string)=>{if(!v)throw new ReplayError('Crossfade events: '+m);};
/** Admission projections only. Standalone A5, native source and payloads are unchanged. */
export function mixEventSources(source:RuntimeRigData):Map<string,RuntimeRigData>{
 const r=parseRig(structuredClone(source));need(Object.values(r.animations).some(a=>a.events.length),'native event family required');
 const views=new Map<string,RuntimeRigData>();
 for(const[name,a]of Object.entries(r.animations)){
  const view=structuredClone(r);view.animations={[name]:{...structuredClone(a),slots:[],drawOrder:[]}};
  validateEventRig(view,name);views.set(name,view);
 }
 return views;
}
/** Event ownership is incoming intent, independent of A14 discrete visual ownership. */
export function mixingEventOwner(m:ReplayMixState):{clip:string;localTick:bigint;generation:bigint;initial:boolean}{
 const t=m.transition;
 return{clip:t?.status==='active'?t.to:m.activeClip,localTick:t?.status==='active'?t.toTick:m.activeTick,generation:t?.startTick??0n,initial:t?.startTick===m.tick};
}
/** No mutable phase cursor or second queue: accepted mixing supplies both window endpoints. */
export class ReplayMixEvents {
 readonly session:string;readonly #rig:RuntimeRigData;readonly #samplers=new Map<string,ReplayEvents>();
 constructor(r:RuntimeRigData){this.#rig=structuredClone(r);for(const[name,view]of mixEventSources(r))this.#samplers.set(name,new ReplayEvents(view,name));this.session=this.#samplers.values().next().value!.session;}
 candidate(m:ReplayMixState,previous:ReplayMixState,epoch:bigint,queued:readonly ReplayEvent[]):readonly ReplayEvent[]{
  need(m.tick===previous.tick+1n&&queued.length<=EVENT_QUEUE_CAPACITY,'accepted tick/queue domain');
  const owner=mixingEventOwner(m);if(owner.initial)return queued;
  const before=mixingEventOwner(previous);
  need(owner.clip===before.clip&&owner.generation===before.generation&&owner.localTick===before.localTick+1n,'nonconsecutive owned phase');
  const sampler=this.#samplers.get(owner.clip);need(sampler,'unknown owner');
  // A5 owns f32 windows, lap boundaries, stable authored indices, zero exclusion and per-tick limits.
  const batch=sampler!.candidate(owner.localTick,epoch,[]);
  need(queued.length+batch.length<=EVENT_QUEUE_CAPACITY,'queue overflow; drain accepted prefix, then reset');
  if(!batch.length)return queued;
  const a=this.#rig.animations[owner.clip]!,clipTime=canonicalTime(owner.localTick,a.duration,a.looping),mixing=structuredClone(m);
  return[...queued,...batch.map(e=>({...e,session:this.session,tick:m.tick,id:`${this.session}/${epoch}/${m.tick}/${e.lap}/${e.keyIndex}`,clipTick:owner.localTick,clipTime,mixing}))];
 }
}
