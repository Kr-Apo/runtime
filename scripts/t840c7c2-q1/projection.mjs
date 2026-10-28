/** Pure native selection/geometry projection. No clock, consumer, Physics or renderer. */
const need=(ok,why)=>{if(!ok)throw Error('Q1 '+why);};
const finite=values=>need(values.every(v=>typeof v==='number'&&Number.isFinite(v)),'nonfinite native number');
export function schedule(events,rig,H) {
 need(Array.isArray(events)&&events.length>0&&events[0]?.tick===0,'calendar must start at tick0');
 const names=new Set(rig.skins.map(s=>s.name));need(names.size===rig.skins.length,'ambiguous skins');let previous=-1;
 for(const e of events){need(e&&Object.keys(e).sort().join(',')==='skin,tick'&&Number.isSafeInteger(e.tick)&&e.tick>=0&&e.tick<=H&&e.tick>previous,'ordered unique calendar in exact horizon');need(typeof e.skin==='string'&&names.has(e.skin),'unknown skin');previous=e.tick;}
 return events;
}
export function skinAt(events,tick){need(Number.isSafeInteger(tick)&&tick>=0,'tick');let lo=0,hi=events.length;while(lo<hi){const mid=(lo+hi)>>>1;if(events[mid].tick<=tick)lo=mid+1;else hi=mid;}need(lo>0,'missing origin');return events[lo-1].skin;}
export function sourceScope(rig) {
 need(rig.format_version===2&&Array.isArray(rig.skins)&&rig.skins.some(s=>s.name===rig.defaultSkin),'native E1 v2/default');
 const bones=new Set(rig.bones.map(b=>b.name)),slots=new Set(rig.slots.map(s=>s.name)),constraints=new Set(rig.constraints.map(c=>c.name));
 need(bones.size===rig.bones.length&&slots.size===rig.slots.length&&constraints.size===rig.constraints.length,'ambiguous identities');
 need(rig.constraints.length>0&&rig.constraints.every(c=>c.type==='physics'),'Physics-only');
 need(rig.constraintOrder.length===constraints.size&&new Set(rig.constraintOrder).size===constraints.size&&rig.constraintOrder.every(n=>constraints.has(n)),'constraint order');
 need(rig.drawOrder.length===slots.size&&new Set(rig.drawOrder).size===slots.size&&rig.drawOrder.every(n=>slots.has(n)),'slot order');
 for(const s of rig.skins){need(s.bones.every(n=>bones.has(n))&&s.constraints.every(n=>constraints.has(n))&&new Set(s.constraints).size===s.constraints.length,'skin membership');const entries=new Set();for(const e of s.attachments){const a=e.attachment,key=e.slot+'\0'+e.name;need(slots.has(e.slot)&&!entries.has(key),'attachment identity');entries.add(key);need(['region','mesh'].includes(a.type)&&!a.sequence&&!a.linked,'region/mesh only, no sequence/link');const region=rig.atlas?.regions.find(r=>r.name===a.texture);need(region&&rig.atlas.pages[region.page],'texture/page');if(a.type==='mesh'){need(!a.deform&&!a.ffd_keyframes&&!a.vertex_animation,'no FFD');need(Number.isInteger(a.vertex_count)&&a.vertex_count>=3&&a.vertices.length===2*a.vertex_count&&a.uvs.length===2*a.vertex_count,'mesh vertices/UV');finite([...a.vertices,...a.uvs]);need(a.triangles.length>0&&a.triangles.length%3===0&&a.triangles.every(i=>Number.isInteger(i)&&i>=0&&i<a.vertex_count),'mesh indices');need(a.weights.length===(a.weighted?a.vertex_count:0),'weight rows');for(const w of a.weights){need(w.count===w.bones.length,'influence count');for(const b of w.bones){finite([b.x,b.y,b.weight]);need(b.weight>=0&&bones.has(b.bone),'influence/bind');}}}}}
 for(const s of rig.slots)need(bones.has(s.bone)&&(s.attachment===null||rig.skins.some(k=>k.attachments.some(e=>e.slot===s.name&&e.name===s.attachment))),'slot/attachment reference');
 for(const clip of Object.values(rig.animations))for(const key of ['deform','slots','drawOrder','ik','transform','events'])need(Array.isArray(clip[key])&&clip[key].length===0,'unsupported timeline '+key);
 return rig;
}
export function resolve(rig,skin,slot) {
 const selected=rig.skins.find(s=>s.name===skin),base=rig.skins.find(s=>s.name===rig.defaultSkin);need(selected&&base,'skin');
 if(slot.attachment===null)return null;
 for(const s of selected===base?[selected]:[selected,base]){const e=s.attachments.find(e=>e.slot===slot.name&&e.name===slot.attachment);if(e)return{owner:s.name,entry:e};}return null;
}
export function selection(rig,skin) {
 const selected=rig.skins.find(s=>s.name===skin);need(selected,'selected skin');const excluded=new Set(rig.skins.filter(s=>s.name!==rig.defaultSkin&&s.name!==skin).flatMap(s=>s.constraints));for(const c of selected.constraints)excluded.delete(c);
 return{skin,active:rig.constraintOrder.filter(c=>!excluded.has(c)),attachments:rig.drawOrder.map(name=>{const slot=rig.slots.find(s=>s.name===name),found=resolve(rig,skin,slot);if(!found)return{slot:name,name:slot.attachment,owner:null,type:null,texture:null,page:null,topology:null};const a=found.entry.attachment,region=rig.atlas.regions.find(r=>r.name===a.texture);return{slot:name,name:slot.attachment,owner:found.owner,type:a.type,texture:a.texture,page:region.page,topology:a.type==='mesh'?{vertexCount:a.vertex_count,indices:[...a.triangles],weighted:a.weighted,influences:a.weights.map(w=>w.bones.map(b=>b.bone))}:null};})};
}
export function numeric(rig,tick,skin,bones,records) {
 const sel=selection(rig,skin),meshes=[];
 for(const meta of sel.attachments){if(meta.type!=='mesh')continue;const slot=rig.slots.find(s=>s.name===meta.slot),a=resolve(rig,skin,slot).entry.attachment,host=bones.find(b=>b.name===slot.bone).world;
  meshes.push({slot:slot.name,vertices:Array.from({length:a.vertex_count},(_,i)=>{let x=0,y=0,total=0;const influences=(a.weights[i]?.bones??[]).map(w=>{const m=bones.find(b=>b.name===w.bone).world,position=[m.a*w.x+m.c*w.y+m.tx,m.b*w.x+m.d*w.y+m.ty];x+=position[0]*w.weight;y+=position[1]*w.weight;total+=w.weight;return{bone:w.bone,position};});return{position:total>0?[x/total,y/total]:[host.a*a.vertices[2*i]+host.c*a.vertices[2*i+1]+host.tx,host.b*a.vertices[2*i]+host.d*a.vertices[2*i+1]+host.ty],influences};})});
 }
 return{tick,selection:sel,bones:bones.map(b=>{const x=b.rotation+b.shearX,y=b.rotation+Math.PI/2+b.shearY,m=b.world,length=rig.bones.find(x=>x.name===b.name).length;return{name:b.name,local:[b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY],matrix:[Math.cos(x)*b.scaleX,Math.sin(x)*b.scaleX,Math.cos(y)*b.scaleY,Math.sin(y)*b.scaleY,b.x,b.y],world:[m.a,m.b,m.c,m.d,m.tx,m.ty],tip:[m.tx+m.a*length,m.ty+m.b*length]};}),records:records.map(r=>({constraint:r.constraint,bone:r.bone,values:[r.rotation,r.x,r.y,r.rotationVelocity,r.velocityX,r.velocityY,r.anchorX,r.anchorY]})),meshes};
}
export function meta(frame){return{epoch:String(frame.epoch),requested:String(frame.requested),completed:String(frame.completed),backlog:String(frame.backlog),poseTick:Number(frame.poseTick),poseTime:[String(frame.poseTime.numerator),String(frame.poseTime.denominator)],clipTime:frame.clipTime,state:frame.state,health:frame.health,skin:frame.skin,targetReached:frame.targetReached};}
