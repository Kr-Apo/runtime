import {validateComposedFfdRig} from '@ankhimate/runtime';
/** E1 native geometry only. No clock, evaluator, Physics, bind inversion or consumer. */
export function requireThat(ok,message){if(!ok)throw Error('Bounded Pixi: '+message);}
export function finite(values,label){requireThat(values.every(v=>typeof v==='number'&&Number.isFinite(v)),label+' must be finite');}
export function weightedPoints(mesh,bones,hostName){
 const byName=new Map(bones.map(b=>[b.name,b.world])),host=byName.get(hostName);requireThat(host,'missing host');
 for(const m of byName.values())finite([m.a,m.b,m.c,m.d,m.tx,m.ty],'world');
 requireThat(Number.isInteger(mesh.vertex_count)&&mesh.vertex_count>0&&mesh.vertices.length===mesh.vertex_count*2,'vertex topology');finite(mesh.vertices,'vertices');
 requireThat(!mesh.weighted||mesh.weights.length===mesh.vertex_count,'weight rows');const world=[],contributions=[];
 const point=(m,x,y)=>[m.a*x+m.c*y+m.tx,m.b*x+m.d*y+m.ty];
 for(let i=0;i<mesh.vertex_count;i++){
  const row=mesh.weighted?mesh.weights[i]:null;requireThat(!row||row.count===row.bones.length,'influence count');let x=0,y=0,total=0;const terms=[];
  for(const b of row?.bones??[]){finite([b.x,b.y,b.weight],'influence');requireThat(b.weight>=0,'negative coefficient');const m=byName.get(b.bone);requireThat(m,'unknown influence bone '+b.bone);const v=point(m,b.x,b.y);x+=v[0]*b.weight;y+=v[1]*b.weight;total+=b.weight;terms.push({bone:b.bone,local:[b.x,b.y],weight:b.weight,world:v,weighted:[v[0]*b.weight,v[1]*b.weight]});}
  finite([x,y,total],'weighted sum');const out=total>0?[x/total,y/total]:point(host,mesh.vertices[i*2],mesh.vertices[i*2+1]);finite(out,'world vertex');world.push(...out);contributions.push({vertex:i,total,fallback:total===0,terms,world:out});
 }
 return {world,contributions};
}
export function validateSource(rig,options){
 const ffd=options?.weightedFfd===true,animated=options?.animatedSlots===true,events=options?.animationEvents===true;
 if(ffd&&animated){requireThat(!events,'FFD+events excluded');validateComposedFfdRig(rig,Object.keys(rig.animations)[0],undefined,options.clipping===true);}else requireThat(!(ffd&&(animated||events)),'combined FFD/slots not qualified');
 requireThat(rig?.format_version===2&&rig.skins?.length===1&&rig.skins[0].name===rig.defaultSkin,'native v2 fixed default skin only');
 requireThat(rig.constraints?.length>0&&rig.constraints.every(c=>c.type==='physics'),'Physics-only approved rig');
 requireThat(Array.isArray(rig.atlas?.pages)&&rig.atlas.pages.length>0,'atlas');const bones=new Set(rig.bones.map(b=>b.name)),slots=new Set(rig.slots.map(s=>s.name));requireThat(bones.size===rig.bones.length&&slots.size===rig.slots.length,'duplicate names');
 requireThat(rig.drawOrder.length===slots.size&&new Set(rig.drawOrder).size===slots.size&&rig.drawOrder.every(s=>slots.has(s)),'draw order');
 for(const [i,p]of rig.atlas.pages.entries())requireThat(p.index===i&&[p.width,p.height].every(n=>Number.isInteger(n)&&n>0),'page dimensions');
 const regions=new Set();for(const r of rig.atlas.regions){const p=rig.atlas.pages[r.page];requireThat(!regions.has(r.name)&&p&&!r.rotated,'region/page');regions.add(r.name);requireThat([r.x,r.y,r.offset_x,r.offset_y].every(n=>Number.isInteger(n)&&n>=0)&&[r.width,r.height,r.original_width,r.original_height].every(n=>Number.isInteger(n)&&n>0),'region dimensions');requireThat(r.x+r.width<=p.width&&r.y+r.height<=p.height&&r.offset_x+r.width<=r.original_width&&r.offset_y+r.height<=r.original_height,'region bounds');}
 for(const s of rig.slots)requireThat(bones.has(s.bone)&&s.blend==='normal'&&s.dark_color===undefined&&/^[0-9a-f]{8}$/i.test(s.color),'slot properties');
 const names=new Set();for(const e of rig.skins[0].attachments){const a=e.attachment,key=e.slot+'\0'+e.name;requireThat(slots.has(e.slot)&&!names.has(key),'attachment identity');names.add(key);if(options?.clipping===true&&a.type==='clipping')continue;requireThat(['region','mesh'].includes(a.type)&&!a.linked&&!a.sequence,'static regions/meshes only');requireThat(!['ffd_keyframes','deform','vertex_animation'].some(k=>Object.hasOwn(a,k)),'embedded deformation');requireThat(regions.has(a.texture),'missing texture');const r=rig.atlas.regions.find(r=>r.name===a.texture);finite([a.source_width,a.source_height],'source dimensions');requireThat(a.source_width>0&&a.source_height>0&&a.source_width===r.original_width&&a.source_height===r.original_height,'source dimensions mismatch');
  if(a.type==='mesh'){
   requireThat(typeof a.weighted==='boolean'&&Number.isInteger(a.vertex_count)&&a.vertex_count>=3&&a.vertices.length===2*a.vertex_count&&a.uvs.length===2*a.vertex_count,'mesh shape');finite([...a.vertices,...a.uvs],'mesh values');requireThat(a.uvs.every(n=>n>=0&&n<=1),'UV bounds');requireThat(a.triangles.length>0&&a.triangles.length%3===0&&a.triangles.every(n=>Number.isInteger(n)&&n>=0&&n<a.vertex_count),'triangles');requireThat(a.weights.length===(a.weighted?a.vertex_count:0),'weight topology');for(const row of a.weights){requireThat(row.count===row.bones.length,'row count');let total=0;for(const w of row.bones){finite([w.x,w.y,w.weight],'bind/weight');requireThat(bones.has(w.bone)&&w.weight>=0,'influence');total+=w.weight;}finite([total],'sum');}
  }else{finite([a.x,a.y,a.rotation,a.scale_x,a.scale_y,a.width,a.height,a.pivot_x,a.pivot_y,...a.uv],'region values');requireThat(a.width>0&&a.height>0&&a.uv.length===4&&a.uv[0]<a.uv[2]&&a.uv[1]<a.uv[3],'region shape');}
 }
 for(const s of rig.slots)requireThat(s.attachment===null||names.has(s.name+'\0'+s.attachment),'setup attachment');
 for(const c of Object.values(rig.animations))for(const k of ['deform','slots','drawOrder','ik','transform','events'].filter(k=>!(ffd&&k==='deform')&&!(animated&&['slots','drawOrder'].includes(k))&&!(events&&k==='events')))requireThat(Array.isArray(c[k])&&c[k].length===0,'unqualified timeline '+k);
 return rig;
}
export function validateFrame(frame,binding,rig){
 requireThat(frame?.sessionId===binding.sessionId&&frame.instanceId===binding.instanceId&&frame.qualificationId===binding.qualificationId,'foreign session');requireThat(frame.admissionState==='ready','unaccepted/faulted state');
 const f=frame.frame;requireThat(f&&f.health==='healthy'&&f.skin===rig.defaultSkin&&f.completed===f.poseTick&&f.completed>=0n&&f.completed<=BigInt(binding.horizon)&&f.requested>=f.completed&&f.requested<=BigInt(binding.horizon)&&f.backlog===f.requested-f.completed,'clock/horizon/skin');
 requireThat(f.bones.length===rig.bones.length&&new Set(f.bones.map(b=>b.name)).size===rig.bones.length&&rig.bones.every(b=>f.bones.some(x=>x.name===b.name)),'bones');
 for(const b of f.bones)finite([b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY,...Object.values(b.world)],'snapshot');for(const r of f.records)finite([r.rotation,r.x,r.y,r.rotationVelocity,r.velocityX,r.velocityY,r.anchorX,r.anchorY],'record');
 if(frame.preview){const p=frame.preview;requireThat(f.state==='seek_preview'&&frame.history==='replay'&&p.tick===BigInt(binding.previewTick)&&p.epoch===f.epoch&&p.skin===rig.defaultSkin&&p.tick>=0n&&p.tick<=BigInt(binding.horizon),'unqualified preview');requireThat(p.bones.length===f.bones.length&&p.bones.every((b,i)=>b.name===f.bones[i].name),'preview bones');for(const b of p.bones)finite([b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY,...Object.values(b.world)],'preview');return {...f,bones:p.bones};}return f;
}
