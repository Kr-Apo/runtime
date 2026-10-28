import {polygonPieces,clipDraw} from '@ankhimate/runtime/render';
const need=(ok,why)=>{if(!ok)throw Error('Replay clipping: '+why);};
/** Frame-local traversal. Only accepted bones/order/selection enter here. No timeline or GL state. */
export class ClippingFrame {
 #active=null;trace=[];timings={maskTransformMs:0,triangulationMs:0,clippingMs:0,clippedVertices:0};
 slot(name,attachment,host){
  if(attachment?.type==='clipping'){
   const t=performance.now(),a=attachment;need(host,'mask host');
   const world=Array.from({length:a.vertex_count},(_,i)=>[host.a*a.vertices[2*i]+host.c*a.vertices[2*i+1]+host.tx,-(host.b*a.vertices[2*i]+host.d*a.vertices[2*i+1]+host.ty)]);
   this.timings.maskTransformMs+=performance.now()-t;const tri=performance.now(),pieces=polygonPieces(world,'accepted mask '+name);this.timings.triangulationMs+=performance.now()-tri;
   this.#active={slot:name,endSlot:a.end_slot,world,pieces};this.trace.push({slot:name,action:'activate',endSlot:a.end_slot,world,pieces});return{introduction:true,mask:null};
  }
  const mask=this.#active;if(mask?.endSlot===name)this.#active=null;
  this.trace.push({slot:name,action:mask?'masked':'unmasked',mask:mask?.slot??null,endInclusive:mask?.endSlot===name});return{introduction:false,mask};
 }
 draw(draw,mask){if(!mask)return draw;
  // At most 6 output vertices / subject triangle / mask triangle. Check BEFORE allocation.
  need(draw.indices.length/3*mask.pieces.length<=32768,'clipped triangle work budget exceeded');
  const t=performance.now(),result=clipDraw(draw,mask.world,mask.pieces);this.timings.clippingMs+=performance.now()-t;this.timings.clippedVertices+=result.positions.length/2;
  need(this.timings.clippedVertices<=196608,'frame clipped vertex budget exceeded');return result;
 }
}
