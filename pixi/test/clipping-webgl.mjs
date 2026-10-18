import {Application,VERSION,Sprite,Texture,Container,Mesh,MeshGeometry} from 'pixi.js';
import {loadPixiRig} from '@ankhimate/pixi-runtime';
import {evaluate,attachmentWorldVertices} from '@ankhimate/runtime';
import {DarkTint} from '../dist/tint.js';
import {geometryErrors} from './clipping-measure.mjs';
import {decodeOraclePng} from './oracle-png.mjs';
const qs=new URL(location.href).searchParams,name=qs.get('name'),skin=qs.get('skin')??'default',animation=qs.get('animation')??'clip',time=Number(qs.get('time')??0),mode=qs.get('mode')??'sample',opaque=qs.get('background')==='opaque',historical=qs.get('historical')==='true';
const result={name,skin,animation,time,mode,opaque,historical,pixi:VERSION,checks:[],failures:[]};
const check=(ok,message,details)=>{result.checks.push({pass:!!ok,message,details});if(!ok)result.failures.push(message);};
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);return r.json();};
const base=`./fixtures/clipping/${name}/`;let app,asset;const instances=[];
try{
 const raw=await json(`${base}skeleton.json`),before=JSON.stringify(raw),ref=await json(`${base}reference.json`),width=ref.width,height=ref.height;
 app=new Application();await app.init({preference:'webgl',width,height,resolution:1,antialias:false,autoStart:false,backgroundColor:opaque?0x28323d:0,backgroundAlpha:opaque?1:0,preserveDrawingBuffer:true});app.stop();document.querySelector('#view').append(app.canvas);
 const gl=app.renderer.gl;check(gl instanceof WebGL2RenderingContext,'hardware WebGL2');const ext=gl.getExtension('WEBGL_debug_renderer_info');result.backend={version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
 const pixels=()=>{const p=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
 const state=()=>Object.fromEntries(['STENCIL_TEST','SCISSOR_TEST','STENCIL_FUNC','STENCIL_REF','STENCIL_VALUE_MASK','STENCIL_WRITEMASK','STENCIL_BACK_FUNC','STENCIL_BACK_REF','STENCIL_BACK_VALUE_MASK','STENCIL_BACK_WRITEMASK','COLOR_WRITEMASK','SCISSOR_BOX'].map(k=>[k,ArrayBuffer.isView(gl.getParameter(gl[k]))?Array.from(gl.getParameter(gl[k])):gl.getParameter(gl[k])]));
 asset=await loadPixiRig(new URL(`${base}skeleton.json`,location.href));const first=asset.createInstance();instances.push(first);app.stage.addChild(first.root);
 let sample,cpu;
 if(historical){sample=ref.samples.find(s=>s.time===time&&s.mode===(name.startsWith('audit-')?'audit':'identity'));const c=sample.config.root;first.root.position.set(c.x,c.y);first.root.scale.set(c.sx,c.sy);first.root.rotation=c.rotation;first.setTime('clip',time);cpu=sample.file;}
 else{first.root.position.set(192,128);first.root.scale.set(2);sample=(mode==='fade'?ref.fades.find(s=>s.skin===skin&&s.elapsed===time):ref.samples.find(s=>s.skin===skin&&s.animation===animation&&s.time===time));
  if(mode==='fade'){const p=first.playback;p.play('clip');p.update(.25);p.crossFade('relax',1);p.update(time);const previousTime=p.time;first.setSkin(skin);check(p.time===previousTime&&p.playing,'skin retains crossfade/time');}
  else{first.setSkin(skin);first.setTime(animation,time);cpu=sample.cpu[opaque?'opaque':'transparent'];}
  const errors=geometryErrors(first,raw,sample.pose,skin);result.geometry=errors;check(errors.position<=.01&&errors.area<=.01&&errors.containment<=.01&&errors.uv<=1e-6,'Rust geometry/UV interpolation and clipped area',errors);
  const pose=mode==='fade'?first.playback.update(0):evaluate(raw,[{animation,time,alpha:1}],{skin});let maskError=0;
  for(const mask of sample.pose.masks){const n=pose.slots.find(s=>s.name===mask.name).attachment,v=attachmentWorldVertices(raw,pose,skin,mask.name,n);check(v.length===mask.vertices.length,'native mask vertex count');v.forEach((p,j)=>maskError=Math.max(maskError,Math.abs(p-mask.vertices[j])));}
  check(maskError<=.01,'transformed native mask perimeter vs Rust',{maskError});result.maskError=maskError;
 }
 const ownMeshes=()=>first.root.children.filter(m=>m.visible);
 check(first.root.children.every(m=>!['mask','mask2'].includes(m.label)),'mask itself creates no visible geometry');
 if(mode==='stress'){
  const p=first.playback,skins=['default','alternate','convex','outside','cover'];
  for(const s of skins)for(const t of [0,.25,.5,.75]){first.setSkin(s);first.setTime('clip',t);app.render();}
  const meshes=[...first.root.children],geometries=new Set(),counts={};const listenerInventory=()=>first.root.eventNames().map(n=>[String(n),first.root.listenerCount(n)]),listenersBefore=listenerInventory(),tickerBefore=app.ticker.count;
  const originals={};for(const type of ['Buffer','Texture','Program'])for(const op of ['create','delete']){const k=op+type;counts[k]=0;originals[k]=gl[k].bind(gl);gl[k]=(...args)=>{counts[k]++;return originals[k](...args);};}
  const draws=gl.drawElements.bind(gl);let drawCalls=0;gl.drawElements=(...a)=>{drawCalls++;return draws(...a);};
  const firstHalf={},secondHalf={};
  for(let n=0;n<600;n++){first.setSkin(skins[n%5]);if(n%40===0)p.play('clip');if(n%40===20)p.crossFade('relax',.15);p.update(1/120);app.render();first.root.children.forEach(m=>geometries.add(m.geometry));if(n===299)Object.assign(firstHalf,counts);}
  for(const k of Object.keys(counts))secondHalf[k]=counts[k]-firstHalf[k];for(const k of Object.keys(originals))gl[k]=originals[k];gl.drawElements=draws;
  const live=[...geometries].filter(g=>g.buffers?.some(b=>!b.destroyed)).length;
  result.resources={renders:600,...counts,firstHalf,secondHalf,drawCalls,meshes:first.root.children.length,liveGeometries:live,topologyReplacements:geometries.size-first.root.children.length};
  check(JSON.stringify(listenerInventory())===JSON.stringify(listenersBefore)&&app.ticker.count===tickerBefore,'mask adds no root/ticker listener',{listenersBefore,listenersAfter:listenerInventory(),tickerBefore,tickerAfter:app.ticker.count});
  check(meshes.length===first.root.children.length&&meshes.every(m=>first.root.children.includes(m)),'600 renders retain per-slot meshes',result.resources);
  check(counts.createTexture===0&&counts.deleteTexture===0&&counts.createProgram===0&&counts.deleteProgram===0,'no mask textures/programs',result.resources);
  check(counts.createBuffer-counts.deleteBuffer<=meshes.length*6&&live<=meshes.length,'topology rebuilds release buffers; live geometry bounded',result.resources);
  first.setSkin(skin);first.setTime(animation,time);
 }
 let actualDrawCalls=0,submissions=[];const original=gl.drawElements.bind(gl);
 const recordDraw=function(mode,count,type,offset){actualDrawCalls++;const program=gl.getParameter(gl.CURRENT_PROGRAM),locs=['aPosition','aUV'].map(n=>gl.getAttribLocation(program,n));
  if(locs.every(l=>l>=0)){const bound=gl.getParameter(gl.ARRAY_BUFFER_BINDING),size=type===gl.UNSIGNED_INT?4:type===gl.UNSIGNED_SHORT?2:1,indices=new Uint8Array(count*size);gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER,offset,indices);const dv=new DataView(indices.buffer);
   const attrs=locs.map(loc=>{gl.bindBuffer(gl.ARRAY_BUFFER,gl.getVertexAttrib(loc,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));const bytes=new Uint8Array(gl.getBufferParameter(gl.ARRAY_BUFFER,gl.BUFFER_SIZE));gl.getBufferSubData(gl.ARRAY_BUFFER,0,bytes);return {data:new DataView(bytes.buffer),stride:gl.getVertexAttrib(loc,gl.VERTEX_ATTRIB_ARRAY_STRIDE)||8,offset:gl.getVertexAttribOffset(loc,gl.VERTEX_ATTRIB_ARRAY_POINTER)};});
   const loc=gl.getUniformLocation(program,'uTransformMatrix'),transform=loc?gl.getUniform(program,loc):null;
   for(let n=0;n<count;n++){const idx=size===4?dv.getUint32(n*4,true):size===2?dv.getUint16(n*2,true):dv.getUint8(n),v=attrs.flatMap(a=>[a.data.getFloat32(a.offset+idx*a.stride,true),a.data.getFloat32(a.offset+idx*a.stride+4,true)]);if(transform){const [x,y]=v;v[0]=transform[0]*x+transform[3]*y+transform[6];v[1]=transform[1]*x+transform[4]*y+transform[7];}submissions.push(v);}gl.bindBuffer(gl.ARRAY_BUFFER,bound);
  }return original(mode,count,type,offset);
 };gl.drawElements=recordDraw;app.render();gl.drawElements=original;

 const visible=ownMeshes(),expectedGPU=visible.flatMap(m=>[...m.geometry.indices].map(i=>{const p=first.root.toGlobal({x:m.geometry.positions[2*i],y:m.geometry.positions[2*i+1]});return[p.x,p.y,m.geometry.uvs[2*i],m.geometry.uvs[2*i+1]];}));
 let gpuPosition=0,gpuUv=0;check(submissions.length===expectedGPU.length,'actual GPU triangle vertex count');for(let i=0;i<Math.min(submissions.length,expectedGPU.length);i++){gpuPosition=Math.max(gpuPosition,...[0,1].map(c=>Math.abs(submissions[i][c]-expectedGPU[i][c])));gpuUv=Math.max(gpuUv,...[2,3].map(c=>Math.abs(submissions[i][c]-expectedGPU[i][c])));}
 check(gpuPosition<=.01&&gpuUv<=1e-6,'real submitted GPU coordinates/UVs',{gpuPosition,gpuUv});result.gpu={submissions,expectedGPU,gpuPosition,gpuUv,drawCalls:actualDrawCalls,visibleMeshes:visible.length,maskDrawCalls:actualDrawCalls-visible.length};
 check(actualDrawCalls===visible.length,'one draw per visible slot, no mask draw pass',{actualDrawCalls,visibleMeshes:visible.length});
 const actual=pixels();
 if(cpu){const response=await fetch(`${base}${cpu}`),oracle=decodeOraclePng(new Uint8Array(await response.arrayBuffer())),expected=oracle.rgba;check(oracle.width===width&&oracle.height===height,'independent CPU PNG dimensions');let flatBad=0,flatCount=0,edgeBad=0,maxFlatRgb=0,maxFlatAlpha=0;const probes=[];
  for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){const i=(y*width+x)*4,g=((height-1-y)*width+x)*4,errors=[0,1,2,3].map(c=>Math.abs((c===3?expected[i+c]:expected[i+c]*expected[i+3]/255)-actual[g+c]));
   const flat=[-width-1,-width,-width+1,-1,1,width-1,width,width+1].every(d=>[0,1,2,3].every(c=>Math.abs(expected[i+c]-expected[i+d*4+c])<=1)),bad=Math.max(...errors.slice(0,3))>2||errors[3]>1;
   if(flat){flatCount++;if(bad){flatBad++;if(probes.length<8)probes.push({x,y,expected:[...expected.slice(i,i+4)],gpu:[...actual.slice(g,g+4)],errors});}maxFlatRgb=Math.max(maxFlatRgb,...errors.slice(0,3));maxFlatAlpha=Math.max(maxFlatAlpha,errors[3]);}else if(bad)edgeBad++;
  }
  result.pixels={flatBad,flatCount,maxFlatRgb,maxFlatAlpha,edgeFraction:edgeBad/(width*height),probes};check(flatBad===0,'unchanged flat RGB <=2/255, alpha <=1/255 bounds',result.pixels);check(edgeBad/(width*height)<=.02,'unchanged edge mismatch <=2% canvas',result.pixels);
 }
 if(mode==='two'||mode==='external'){
  const clippedState=state();first.root.visible=false;const second=asset.createInstance({skin:'alternate'});instances.push(second);second.root.position.set(208,128);second.root.scale.set(2);second.setTime('relax',.5);const secondErrors=geometryErrors(second,raw,ref.samples.find(s=>s.skin==='alternate'&&s.animation==='relax'&&s.time===.5).pose,'alternate');check(secondErrors.position<=.01&&secondErrors.area<=.01&&secondErrors.containment<=.01&&secondErrors.uv<=1e-6,'second instance geometry/UVs independently match Rust',secondErrors);app.stage.addChild(second.root);app.render();const onlyB=pixels(),bState=state();
  second.root.visible=false;first.root.visible=true;app.render();const onlyA=pixels();second.root.visible=true;submissions=[];actualDrawCalls=0;gl.drawElements=recordDraw;app.render();gl.drawElements=original;const overlap=pixels();result.captures={overlap:app.canvas.toDataURL('image/png')};
  const both=[first,second].flatMap(i=>i.root.children.filter(m=>m.visible).flatMap(m=>[...m.geometry.indices].map(j=>{const p=i.root.toGlobal({x:m.geometry.positions[2*j],y:m.geometry.positions[2*j+1]});return [p.x,p.y,m.geometry.uvs[2*j],m.geometry.uvs[2*j+1]];})));let position=0,uv=0;for(let j=0;j<Math.min(both.length,submissions.length);j++){position=Math.max(position,...[0,1].map(k=>Math.abs(both[j][k]-submissions[j][k])));uv=Math.max(uv,...[2,3].map(k=>Math.abs(both[j][k]-submissions[j][k])));}
  check(both.length===submissions.length&&position<=.01&&uv<=1e-6,'both overlapping instances submit the measured vertices/UVs',{vertices:submissions.length,position,uv,actualDrawCalls});result.overlapGPU={vertices:submissions.length,position,uv,actualDrawCalls};let errors=0,worst=0;const compositeProbes=[];
  for(let i=0;i<overlap.length;i++){const a=onlyA[i],b=onlyB[i],alpha=onlyB[i-i%4+3]/255,d=Math.abs(overlap[i]-(b+a*(1-alpha)));worst=Math.max(worst,d);if(d>1){errors++;if(compositeProbes.length<8)compositeProbes.push({i,channel:i%4,actual:overlap[i],expected:b+a*(1-alpha),a,b,alpha,d});}}
  // Flattened RGBA8 rig images are not an exact source-over oracle: actual GL
  // rounds after each slot draw. Keep this diagnostic; use an exact per-draw
  // replay outside both rigs to verify isolation without widening a threshold.
  // Replay the native trim region too: it supplies the new coverage uniforms.
  result.flattenedCompositionDiagnostic={errors,worst,compositeProbes};
  first.root.visible=false;second.root.visible=false;const replay=new Container(),copies=[];app.stage.addChild(replay);
  for(const [instance,pose] of [[first,sample.pose],[second,ref.samples.find(s=>s.skin==='alternate'&&s.animation==='relax'&&s.time===.5).pose]]){const src=instance.root;const group=new Container();group.position.copyFrom(src.position);group.scale.copyFrom(src.scale);group.skew.copyFrom(src.skew);group.rotation=src.rotation;replay.addChild(group);
   for(const view of src.children.filter(m=>m.visible)){const g=view.geometry,m=new Mesh({geometry:new MeshGeometry({positions:new Float32Array(g.positions),uvs:new Float32Array(g.uvs),indices:new Uint32Array(g.indices)}),texture:view.texture});const u=view.shader.resources.tintUniforms.uniforms,effect=new DarkTint(m);const slot=pose.slots.find(s=>s.name===view.label),entry=raw.skins.find(s=>s.name===instance.skinName)?.attachments.find(e=>e.slot===view.label&&e.name===slot.attachment)??raw.skins.find(s=>s.name===raw.defaultSkin).attachments.find(e=>e.slot===view.label&&e.name===slot.attachment),region=raw.atlas.regions.find(r=>r.name===entry.attachment.texture);effect.update(view.texture,[...u.uLight,u.uOpacity],[...u.uDark],region);group.addChild(m);copies.push({m,effect});}}
  app.render();const replayPixels=pixels();let replayBad=0;overlap.forEach((v,j)=>{if(v!==replayPixels[j])replayBad++;});check(replayBad===0,'overlapping rigs equal independent per-draw Pixi replay byte-for-byte',{replayBad});
  for(const {m,effect}of copies){const g=m.geometry;m.destroy();effect.destroy();g.destroy(true);}replay.destroy({children:true});first.root.visible=true;second.root.visible=true;
  const sprite=new Sprite({texture:Texture.WHITE,tint:0x19d94b,width:16,height:16});sprite.position.set(190,120);app.stage.addChild(sprite);app.render();const withSprite=pixels(),afterState=state();result.captures.external=app.canvas.toDataURL('image/png');
  check(JSON.stringify(clippedState)===JSON.stringify(bState)&&JSON.stringify(bState)===JSON.stringify(afterState),'stencil/scissor/color state unchanged', {clippedState,bState,afterState});
  first.root.visible=false;second.root.visible=false;app.render();const spriteOnly=pixels();let spriteBad=0;for(let y=120;y<136;y++)for(let x=190;x<206;x++)for(let c=0;c<4;c++){const i=((height-1-y)*width+x)*4+c;if(withSprite[i]!==spriteOnly[i])spriteBad++;}check(spriteBad===0,'external opaque sprite unchanged by both masks',{spriteBad});
  second.root.visible=true;app.render();const baseline=pixels();first.destroy();app.render();const afterDestroy=pixels();result.captures.afterDestroy=app.canvas.toDataURL('image/png');check(baseline.every((v,i)=>v===afterDestroy[i]),'second rig and external sprite unchanged after destroying first');
  sprite.destroy();second.playback.play('clip');for(let n=0;n<16;n++)second.playback.update(1/60);app.render();check(!second.root.destroyed,'remaining instance continues after destruction');
 }
 check(JSON.stringify(raw)===before,'native input unchanged');const meshes=instances.flatMap(i=>i.root.destroyed?[]:[...i.root.children]),buffers=meshes.flatMap(m=>m.geometry.buffers),shaders=meshes.map(m=>m.shader).filter(Boolean),textures=[...new Set(meshes.map(m=>m.texture))];instances.forEach(i=>i.destroy());check(meshes.every(m=>m.destroyed)&&buffers.every(b=>b.destroyed),'owned meshes/buffers released');check(shaders.every(s=>s.resources===null),'owned shader bindings released');check(textures.every(t=>!t.destroyed),'shared pages survive instance destruction');asset.destroy();asset=null;check(textures.every(t=>t.destroyed),'owned pages released with asset');check(gl.getError()===gl.NO_ERROR,'no GL error');
}catch(error){result.failures.push(error.stack??String(error));}finally{instances.forEach(i=>i.destroy());asset?.destroy();}
result.pass=result.failures.length===0;window.__app=app;window.__result=result;document.querySelector('#result').textContent=JSON.stringify(result,null,2);
