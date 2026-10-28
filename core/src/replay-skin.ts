import type { RuntimeRigData } from "./types.js";
import { ReplayError, validateReplayRig } from "./replay-physics.js";
import { MAX_SAMPLE_TICK } from "./replay-animation.js";

export interface SkinEvent { readonly tick:bigint; readonly skin:string }
export interface SkinSelection { readonly skin:string; readonly active:readonly string[] }
/** Internal prevalidated immutable calendar, bound to an owned rig snapshot. */
export class SkinCalendar {
 #events:readonly {tick:bigint;selection:SkinSelection}[];
 constructor(rig:RuntimeRigData,events:readonly SkinEvent[]){
  validateReplayRig(rig);
  if(!events.length||events[0]!.tick!==0n)throw new ReplayError("skin calendar must start at tick zero");
  const names=new Set(rig.skins.map(s=>s.name));
  if(names.size!==rig.skins.length)throw new ReplayError("ambiguous skin identity");
  if(rig.defaultSkin===null)throw new ReplayError("native skin calendar requires default skin");
  // Native Rust excludes the default skin from inactive ownership. Attachment
  // fallback does not imply unioning default constraints into the selected skin.
  const sets=new Map(rig.skins.map(s=>{
   const skipped=new Set(rig.skins.filter(k=>k.name!==rig.defaultSkin&&k.name!==s.name).flatMap(k=>k.constraints));
   for(const c of s.constraints)skipped.delete(c);
   return [s.name,Object.freeze(rig.constraintOrder.filter(c=>!skipped.has(c)))] as const;
  }));
  let previous=-1n;
  this.#events=events.map(e=>{
   if(typeof e.tick!=="bigint"||e.tick<=previous||e.tick>MAX_SAMPLE_TICK)throw new ReplayError("skin events must be strictly ordered within sample horizon");
   previous=e.tick;const active=sets.get(e.skin);
   if(!active)throw new ReplayError("unknown skin");
   return Object.freeze({tick:e.tick,selection:Object.freeze({skin:e.skin,active})});
  });
 }
 at(tick:bigint):SkinSelection {
  if(typeof tick!=="bigint"||tick<0n||tick>MAX_SAMPLE_TICK)throw new ReplayError("skin query outside horizon");
  let low=0,high=this.#events.length;
  while(low<high){const mid=(low+high)>>>1;if(this.#events[mid]!.tick<=tick)low=mid+1;else high=mid;}
  return this.#events[low-1]!.selection;
 }
}
