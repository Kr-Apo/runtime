import {evaluate,integratedSources,ffdMixSources,validateWeightedFfdRig,validateComposedFfdRig,linkedFfdSources,assertLinkedDeformation} from '@ankhimate/runtime';
import {weightedPoints,requireThat as need,finite} from '../bounded-pixi/geometry.mjs';
/** No key sampling or Physics. Cache immutable author-to-influence vector binds. */
export class DeformGeometry {
 #linked=null;#rig;#meshes=new Map();
 constructor(rig,composed=false,clipping=false,linked=false,mixing=false){
  rig=structuredClone(rig);if(mixing&&composed)rig=integratedSources(rig).ffd;const mixed=mixing?ffdMixSources(rig):null;if(mixed){}else if(linked)this.#linked=linkedFfdSources(rig,Object.keys(rig.animations)[0]);else(composed?validateComposedFfdRig:validateWeightedFfdRig)(rig,Object.keys(rig.animations)[0],undefined,clipping);this.#rig=rig;const setup=evaluate(rig);
  for(const e of rig.skins[0].attachments){const resolved=this.#linked?this.#linked.slots.skins[0].attachments.find(v=>v.slot===e.slot&&v.name===e.name):null,a=resolved?.attachment??e.attachment;if(a.type!=='mesh'||!a.weighted||mixed&&(e.slot!==mixed.target.slot||e.name!==mixed.target.attachment)||!linked&&rig.slots.find(s=>s.name===e.slot)?.attachment!==e.name||composed&&!mixing&&!rig.animations[Object.keys(rig.animations)[0]].deform.some(t=>t.slot===e.slot&&t.attachment===e.name))continue;
   const geometrySlot=linked&&e.attachment.linked?e.attachment.linked.slot:e.slot;const host=setup.bones.find(b=>b.name===rig.slots.find(s=>s.name===geometrySlot).bone).world;
   const binds=a.weights.map(row=>row.bones.map(w=>{const b=setup.bones.find(b=>b.name===w.bone).world,det=b.a*b.d-b.b*b.c;need(Math.abs(det)>=1e-12,'FFD singular bind');return[(b.d*host.a-b.c*host.b)/det,(b.a*host.b-b.b*host.a)/det,(b.d*host.c-b.c*host.d)/det,(b.a*host.d-b.b*host.c)/det];}));
   const deformOwner=linked&&e.attachment.linked?.inherit_deform?{slot:e.attachment.linked.slot,attachment:e.attachment.linked.attachment}:{slot:e.slot,attachment:e.name};
   this.#meshes.set(e.slot+'\0'+e.name,{owner:deformOwner,source:a,pose:{...a,weights:a.weights.map(r=>({...r,bones:r.bones.map(w=>({...w}))}))},binds});
  }
 }
 owns(slot,name){return this.#meshes.has(slot+'\0'+name);}
 validate(frame){if(this.#linked){assertLinkedDeformation(this.#linked,frame.deformation,frame.slotState,frame.completed);need(frame.completed===frame.poseTick,'FFD pose tick');return;}const d=frame.deformation;need(d?.kind==='weighted-ffd/v1'&&d.tick===frame.completed&&d.tick===frame.poseTick&&d.clip===frame.clip&&d.skin===frame.skin&&d.skin===this.#rig.defaultSkin,'incoherent FFD frame');
  need(Array.isArray(d.entries)&&d.entries.length===this.#meshes.size,'FFD owners');const seen=new Set();
  for(const e of d.entries){const key=e.slot+'\0'+e.attachment,m=this.#meshes.get(key);need(m&&e.owner===d.skin&&!seen.has(key),'FFD owner');seen.add(key);need(Array.isArray(e.offsets)&&e.offsets.length===2*m.source.weights.reduce((n,r)=>n+r.bones.length,0),'FFD dimensions');finite(e.offsets,'FFD offsets');}
 }
 points(slot,name,bones,host,frame){this.validate(frame);const m=this.#meshes.get(slot+'\0'+name);need(m,'FFD missing mesh');const offsets=frame.deformation.entries.find(e=>e.slot===m.owner.slot&&e.attachment===m.owner.attachment).offsets;let cursor=0;
  m.pose.weights.forEach((row,i)=>row.bones.forEach((w,j)=>{const base=m.source.weights[i].bones[j],[a,b,c,d]=m.binds[i][j],x=offsets[cursor++],y=offsets[cursor++];w.x=base.x+a*x+c*y;w.y=base.y+b*x+d*y;}));
  return weightedPoints(m.pose,bones,host);
 }
}
