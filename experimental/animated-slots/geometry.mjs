import {linkedGeometry,linkedFfdBindings} from "@ankhimate/runtime";
import {validateReplaySlotState} from '@ankhimate/runtime';
import {resolve,selection} from '../../scripts/t840c7c2-q1/projection.mjs';
/** Metadata only, from already committed slots. No timeline/FK/Physics sampling. */
export function slotSelection(rig,frame,clipping=false,linkedMeshes=false,weightedFfd=false){
 const state=frame.slotState;const bindings=linkedMeshes&&weightedFfd?linkedFfdBindings(rig,frame.clip,state):null;validateReplaySlotState(rig,state,frame.completed,frame.clip,frame.skin);
 return{skin:frame.skin,active:clipping?[...rig.constraintOrder]:selection(rig,frame.skin).active,attachments:state.drawOrder.map(name=>{
  const v=state.slots.find(s=>s.name===name),base=rig.slots.find(s=>s.name===name),found=resolve(rig,frame.skin,{...base,attachment:v.attachment});
  if(!found)return{slot:name,name:null,owner:null,type:null,texture:null,page:null,topology:null};
  const resolved=linkedMeshes?linkedGeometry(rig,found.owner,found.entry):null,a=resolved?.attachment??found.entry.attachment,region=rig.atlas.regions.find(r=>r.name===a.texture);
  if(clipping&&a.type==='clipping')return{slot:name,name:v.attachment,owner:found.owner,type:a.type,texture:null,page:null,topology:null};
  return{slot:name,name:v.attachment,owner:found.owner,...(resolved?{geometryOwner:resolved.owner,deformationOwner:bindings?.find(b=>b.slot===name)?.deformOwner??null,...(bindings?{timelineOwner:bindings.find(b=>b.slot===name)?.timelineOwner??null}:{})}:{}),type:a.type,texture:a.texture,page:region.page,topology:a.type==='mesh'?{vertexCount:a.vertex_count,indices:[...a.triangles],weighted:a.weighted,influences:a.weights.map(w=>w.bones.map(b=>b.bone))}:null};
 })};
}
