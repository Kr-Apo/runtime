/** Experimental graphics-only view: consumes detached N6 frames, never creates/evaluates a rig. */
import {Container,Mesh,MeshGeometry,RenderTexture,Sprite,Texture} from 'pixi.js';
import {regionQuad} from '/core/render/region.js';
import {MeshAtlas} from '/core/render/mesh.js';
import {DarkTint} from '/pixi/tint.js';
import {weightedPoints,validateSource,validateFrame,finite,requireThat} from './geometry.mjs';
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
export class BoundedPixiView {
 #rig;#pages;#binding;#renderer;#banks;#front=-1;#disposed=false;#busy=false;#last=null;#atlases=new Map();#prepared=null;
 #counts={geometriesCreated:0,geometriesDestroyed:0,meshesCreated:0,meshesDestroyed:0,presentations:0};
 constructor({native,pages,binding,renderer,width,height}){
  requireThat(renderer.gl instanceof WebGL2RenderingContext,'real WebGL2 required');this.#rig=freeze(validateSource(structuredClone(native)));this.#binding=freeze(structuredClone(binding));this.#renderer=renderer;this.#pages=new Map(pages);
  requireThat(typeof binding.sessionId==='string'&&binding.sessionId&&Number.isSafeInteger(binding.horizon),'N6 binding');
  this.#textures();this.surface=new Sprite(Texture.EMPTY);this.surface.visible=false;
  this.#banks=[0,1].map(()=>({scene:new Container(),root:new Container(),parent:new Container(),meshes:new Map(),effects:new Map(),target:RenderTexture.create({width,height,resolution:1,antialias:false})}));
  for(const b of this.#banks){b.scene.addChild(b.parent);b.parent.addChild(b.root);}
  for(const e of this.#rig.skins[0].attachments)if(e.attachment.type==='mesh'){const a=e.attachment,r=this.#rig.atlas.regions.find(r=>r.name===a.texture);this.#atlases.set(e.slot+'\0'+e.name,new MeshAtlas(a,r,this.#rig.atlas.pages[r.page]));}
 }
 #ready(){requireThat(!this.#disposed,'destroyed view');requireThat(!this.#busy,'reentrant graphics');requireThat(!this.#renderer.gl.isContextLost(),'context lost');}
 #textures(){for(const p of this.#rig.atlas.pages){const t=this.#pages.get(p.index);requireThat(t&&!t.destroyed&&!t.source.destroyed&&t.width===p.width&&t.height===p.height&&t.source.width===p.width&&t.source.height===p.height&&t.frame.x===0&&t.frame.y===0&&!t.rotate&&!t.trim&&t.source.resolution===1&&t.source.alphaMode!=='no-premultiply-alpha','missing/destroyed/invalid page '+p.index);}}
 #prepare(snapshot){
  const f=validateFrame(snapshot,this.#binding,this.#rig);requireThat(f.clip===this.#binding.clip&&snapshot.history===this.#binding.history,'clip/history binding');
  const timings={weightedCalcMs:0,unweightedCalcMs:0,regionCalcMs:0,atlasProjectionMs:0};const draws=[],skin=this.#rig.skins[0],byBone=new Map(f.bones.map(b=>[b.name,b.world]));
  for(const name of this.#rig.drawOrder){const s=this.#rig.slots.find(s=>s.name===name);if(s.attachment===null)continue;const e=skin.attachments.find(e=>e.slot===name&&e.name===s.attachment),a=e.attachment,r=this.#rig.atlas.regions.find(r=>r.name===a.texture),page=this.#rig.atlas.pages[r.page];let draw,raw=null;
   if(a.type==='mesh'){const t=performance.now();raw=weightedPoints(a,f.bones,s.bone);timings[a.weighted?'weightedCalcMs':'unweightedCalcMs']+=performance.now()-t;const projected=performance.now(),positions=Float32Array.from(raw.world,(v,i)=>i%2?-v:v);draw=this.#atlases.get(e.slot+'\0'+e.name).draw(positions);timings.atlasProjectionMs+=performance.now()-projected;}else{const t=performance.now(),q=regionQuad(a,r,page,byBone.get(s.bone));if(q)draw={...q,indices:new Uint32Array([0,1,2,0,2,3])};timings.regionCalcMs+=performance.now()-t;}
   if(draw){finite([...draw.positions,...draw.uvs],'prepared buffers');requireThat(draw.positions.length===draw.uvs.length&&draw.indices.length%3===0&&[...draw.indices].every(i=>i<draw.positions.length/2),'prepared topology');draws.push({slot:name,texture:a.texture,page:r.page,region:r,draw,raw,color:[0,2,4,6].map(i=>parseInt(s.color.slice(i,i+2),16)/255)});}
  }Object.defineProperty(draws,'timings',{value:timings});return draws;
 }
 #fill(bank,draws,placement){
  for(const d of draws){finite([...d.draw.positions,...d.draw.uvs],'buffer before upload');requireThat([...d.draw.indices].every(i=>Number.isInteger(i)&&i>=0&&i<d.draw.positions.length/2),'buffer indices');}
  finite([placement.x,placement.y,placement.scaleX,placement.scaleY,placement.rotation,...Object.values(placement.parent)],'placement');
  bank.root.position.set(placement.x,placement.y);bank.root.scale.set(placement.scaleX,placement.scaleY);bank.root.rotation=placement.rotation;
  const p=placement.parent;bank.parent.position.set(p.x,p.y);bank.parent.scale.set(p.scaleX,p.scaleY);bank.parent.rotation=p.rotation;
  for(const m of bank.meshes.values())m.visible=false;
  draws.forEach((d,i)=>{let m=bank.meshes.get(d.slot);if(!m){m=new Mesh({geometry:new MeshGeometry({positions:new Float32Array(d.draw.positions.length),uvs:new Float32Array(d.draw.uvs.length),indices:new Uint32Array(d.draw.indices)}),texture:this.#pages.get(d.page)});m.label=d.slot;m.blendMode='normal';bank.root.addChild(m);bank.meshes.set(d.slot,m);bank.effects.set(d.slot,new DarkTint(m));this.#counts.meshesCreated++;this.#counts.geometriesCreated++;}
   requireThat(m.geometry.positions.length===d.draw.positions.length&&m.geometry.indices.length===d.draw.indices.length,'unexpected static topology change');m.geometry.positions.set(d.draw.positions);m.geometry.uvs.set(d.draw.uvs);m.geometry.indices.set(d.draw.indices);m.geometry.getBuffer('aPosition').update();m.geometry.getBuffer('aUV').update();m.geometry.indexBuffer.update();m.texture=this.#pages.get(d.page);bank.effects.get(d.slot).update(m.texture,d.color,[0,0,0,0],d.region);m.visible=true;bank.root.setChildIndex(m,i);
  });
 }
 present(snapshot,placement){
  this.#ready();this.#busy=true;const start=performance.now();
  try{this.#textures();const preparedStart=performance.now(),draws=this.#prepare(structuredClone(snapshot)),preparedMs=performance.now()-preparedStart;// R2_TEST_PREPARED_BOUNDARY: test copies only, no injection option in normal view.
   const back=this.#front===0?1:0,bank=this.#banks[back],fillStart=performance.now();this.#fill(bank,draws,placement);const fillMs=performance.now()-fillStart;
   const gl=this.#renderer.gl;requireThat(gl.getError()===gl.NO_ERROR,'preexisting GL error');const gpuStart=performance.now();this.#renderer.render({container:bank.scene,target:bank.target,clear:true,clearColor:[0,0,0,0]});requireThat(!gl.isContextLost()&&gl.getError()===gl.NO_ERROR,'GPU preparation failed');const submissionMs=performance.now()-gpuStart;
   this.surface.texture=bank.target;this.surface.visible=true;this.#front=back;this.#prepared=draws;this.#last=structuredClone(snapshot);this.#counts.presentations++;
   return {...draws.timings,preparedMs,fillMs,submissionMs,totalMs:performance.now()-start,draws:draws.length,completed:String(snapshot.frame.completed),nativeWeightedVertices:draws.reduce((s,d)=>s+(d.raw?.world.length??0)/2,0)};
  }finally{this.#busy=false;}
 }
 inspect(){this.#ready();return {last:structuredClone(this.#last),front:this.#front,counts:{...this.#counts},draws:(this.#prepared??[]).map(d=>({slot:d.slot,page:d.page,texture:d.texture,positions:[...d.draw.positions],uvs:[...d.draw.uvs],indices:[...d.draw.indices],raw:structuredClone(d.raw)}))};}
 readBuffers(){this.#ready();requireThat(this.#front>=0,'no presented frame');const gl=this.#renderer.gl,uid=this.#renderer.uid;
  const read=b=>{const g=b._gpuData[uid];requireThat(g&&gl.isBuffer(g.buffer),'actual GPU buffer missing');const old=gl.getParameter(gl.COPY_READ_BUFFER_BINDING),a=new b.data.constructor(b.data.length);gl.bindBuffer(gl.COPY_READ_BUFFER,g.buffer);gl.getBufferSubData(gl.COPY_READ_BUFFER,0,a);gl.bindBuffer(gl.COPY_READ_BUFFER,old);return [...a];};
  const bank=this.#banks[this.#front];return [...bank.meshes].filter(([,m])=>m.visible).map(([slot,m])=>({slot,positionBufferUID:m.geometry.getBuffer('aPosition').uid,uvBufferUID:m.geometry.getBuffer('aUV').uid,indexBufferUID:m.geometry.indexBuffer.uid,positions:read(m.geometry.getBuffer('aPosition')),uvs:read(m.geometry.getBuffer('aUV')),indices:read(m.geometry.indexBuffer),pageSourceUID:m.texture.source.uid,worldTransform:{a:bank.root.worldTransform.a,b:bank.root.worldTransform.b,c:bank.root.worldTransform.c,d:bank.root.worldTransform.d,tx:bank.root.worldTransform.tx,ty:bank.root.worldTransform.ty}}));
 }
 resources(){return {disposed:this.#disposed,...this.#counts,meshBanks:this.#banks?.map(b=>b.meshes.size)??[],borrowedPages:this.#pages?.size??0,targets:this.#disposed?0:2};}
 destroy(){if(this.#disposed)return;requireThat(!this.#busy,'busy destruction');for(const b of this.#banks){for(const effect of b.effects.values())effect.destroy();for(const m of b.meshes.values()){const g=m.geometry;m.destroy();g.destroy(true);this.#counts.meshesDestroyed++;this.#counts.geometriesDestroyed++;}b.meshes.clear();b.effects.clear();b.scene.destroy({children:true});b.target.destroy(true);}this.surface.destroy(false);this.#atlases.clear();this.#prepared=null;this.#last=null;this.#disposed=true;}
}
