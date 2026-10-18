import { Application, VERSION } from 'pixi.js';
import { loadPixiRig } from '@ankhimate/pixi-runtime';
const qs=new URL(location.href).searchParams,name=qs.get('name')??'weighted',mode=qs.get('mode')??'clip',index=Number(qs.get('sample')??0),opaque=qs.get('background')==='opaque';
const result={name,mode,index,opaque,pixi:VERSION,checks:[],failures:[]};
const check=(ok,message,details)=>{result.checks.push({pass:!!ok,message,details});if(!ok)result.failures.push(message);};
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);return r.json();};
const image=async url=>{const i=new Image();i.src=url;await i.decode();return i;};
const base=`./fixtures/meshes/${name}/`;let app,asset;const instances=[];
// Independent barycentric reconstruction in authored source UVs, not the adapter's crop routine.
function expectedVertex(u,v,a,positions){let best=Infinity,bestPoint;
 for(let t=0;t<a.triangles.length;t+=3){const ids=a.triangles.slice(t,t+3),p=ids.map(i=>[a.uvs[i*2],a.uvs[i*2+1]]);
  const det=(p[1][1]-p[2][1])*(p[0][0]-p[2][0])+(p[2][0]-p[1][0])*(p[0][1]-p[2][1]);if(Math.abs(det)<1e-12)continue;
  const b0=((p[1][1]-p[2][1])*(u-p[2][0])+(p[2][0]-p[1][0])*(v-p[2][1]))/det,b1=((p[2][1]-p[0][1])*(u-p[2][0])+(p[0][0]-p[2][0])*(v-p[2][1]))/det,b2=1-b0-b1;
  const outside=Math.max(0,-b0,-b1,-b2);if(outside<best){best=outside;bestPoint=[0,1].map(axis=>ids.reduce((sum,id,j)=>sum+positions[id*2+axis]*[b0,b1,b2][j],0));}
 }return best<=1e-5?bestPoint:undefined;
}
try{
 const raw=await json(`${base}skeleton.json`),before=JSON.stringify(raw),ref=await json(`${base}reference.json`);
 const width=mode==='two'?512:256,height=256;
 app=new Application();await app.init({preference:'webgl',width,height,resolution:1,antialias:false,autoStart:false,backgroundColor:opaque?0x28323d:0,backgroundAlpha:opaque?1:0,preserveDrawingBuffer:true});app.stop();document.querySelector('#view').append(app.canvas);
 const gl=app.renderer.gl;check(gl instanceof WebGL2RenderingContext,'actual WebGL2');const ext=gl.getExtension('WEBGL_debug_renderer_info');result.backend={version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
 asset=await loadPixiRig(new URL(`${base}skeleton.json`,location.href));
 const make=x=>{const i=asset.createInstance();instances.push(i);i.root.position.set(x,128);i.root.scale.set(2);app.stage.addChild(i.root);return i;};
 const first=make(128),views=[];const nativeNew=!!ref.editor;
 const sample=(animation,time)=>ref.samples.find(s=>(s.animation??'clip')===animation&&s.time===time&&(s.skin??'default')==='default');
 function use(instance,s,x){const animation=s.animation??'clip';instance.playback.play(animation,{loop:false});instance.playback.update(s.time);views.push({instance,x,pose:s.pose,cpu:s.cpu??`cpu-clear-${s.index}.png`});}
 if(mode==='two'){use(first,sample('clip',.25),128);const second=make(384);use(second,sample('relax',.75),384);check(first.root.children[0].texture===second.root.children[0].texture&&first.root.children[0].geometry!==second.root.children[0].geometry,'shared textures and independent geometries');}
 else if(mode==='fade'){
  first.playback.play('clip');first.playback.update(.25);first.playback.crossFade('relax',1);let t=0;
  for(const s of ref.fades.slice(0,index+1)){first.playback.update(s.elapsed-t);t=s.elapsed;}
  views.push({instance:first,x:128,pose:ref.fades[index].pose});
 }else{
  const s=nativeNew?ref.samples.filter(s=>s.animation===mode)[index]:ref.samples.filter(s=>s.skin==='default')[index];
  if(mode==='topology-cycle')throw Error('unreachable mode');use(first,s,128);
 }
 // Exercise transitions through actual GPU state before the final measured frame.
 if(name==='topology'&&mode==='clip'){
  const s=ref.samples.filter(s=>s.animation==='clip')[index];for(const time of [0,.5,1,.5]){first.setTime('clip',time);app.render();}first.setTime('clip',s.time);
 }
 if(qs.get('stress')==='1'){
  app.render();const meshes=[...first.root.children],geometries=meshes.map(m=>m.geometry),buffers=geometries.flatMap(g=>g.buffers),create=gl.createBuffer.bind(gl);let creates=0;
  gl.createBuffer=function(){creates++;return create();};
  for(let n=0;n<600;n++){first.setTime('clip',(n%4)/4);app.render();}
  gl.createBuffer=create;first.setTime('clip',.5);
  check(meshes.every((m,i)=>first.root.children[i]===m&&m.geometry===geometries[i])&&buffers.every(b=>!b.destroyed),'600 rendered FFD updates reuse meshes/geometries/buffers');
  check(creates===0,'no new GL buffer after warmup across 600 FFD renders',{creates});result.stress={renders:600,newGlBuffers:creates};
 }
 let maxAffine=0,maxVertex=0,uvOutside=0;
 for(const view of views){
  const pose=view.instance.playback.animation?view.instance.playback.update(0):view.instance.setTime('clip',ref.samples.filter(s=>s.animation==='clip')[index].time);
  for(const b of view.pose.bones)for(const [k,v] of Object.entries(b.world))maxAffine=Math.max(maxAffine,Math.abs(pose.bones.find(p=>p.name===b.name).world[k]-v));
  for(const slot of view.pose.slots){const a=raw.skins[0].attachments.find(e=>e.slot===slot.name&&e.name===slot.attachment).attachment;
   const r=raw.atlas.regions.find(r=>r.name===a.texture),page=raw.atlas.pages[r.page],m=view.instance.root.children.find(m=>m.label===slot.name);
   if(!r.offset_x&&!r.offset_y&&r.width===r.original_width&&r.height===r.original_height)check(JSON.stringify([...m.geometry.indices])===JSON.stringify(slot.indices),'real native triangle indices');
   for(let i=0;i<m.geometry.positions.length/2;i++){
    const u=(m.geometry.uvs[i*2]*page.width-r.x-0.5+r.offset_x)/(r.original_width-1),v=(m.geometry.uvs[i*2+1]*page.height-r.y-0.5+r.offset_y)/(r.original_height-1);
    uvOutside=Math.max(uvOutside,Math.max(0,Math.max(0,(r.offset_x-1)/(r.original_width-1))-u,u-Math.min(1,(r.offset_x+r.width)/(r.original_width-1)),Math.max(0,(r.offset_y-1)/(r.original_height-1))-v,v-Math.min(1,(r.offset_y+r.height)/(r.original_height-1))));
    const expected=expectedVertex(u,v,a,slot.positions);check(!!expected,'submitted UV lies on authored triangle');
    if(expected)maxVertex=Math.max(maxVertex,Math.abs(m.geometry.positions[i*2]-expected[0]),Math.abs(m.geometry.positions[i*2+1]+expected[1]));
   }
  }
 }
 check(maxAffine<=.01&&maxVertex<=.01&&uvOutside<=1e-6,'independent Rust affines/vertices and source UVs',{maxAffine,maxVertex,uvOutside});
 const submissions=[],original=gl.drawElements.bind(gl);
 gl.drawElements=function(mode,count,type,offset){const program=gl.getParameter(gl.CURRENT_PROGRAM),locs=['aPosition','aUV'].map(n=>gl.getAttribLocation(program,n));
  if(locs.every(l=>l>=0)){const bound=gl.getParameter(gl.ARRAY_BUFFER_BINDING),size=type===gl.UNSIGNED_INT?4:type===gl.UNSIGNED_SHORT?2:1;
   const indices=new Uint8Array(count*size);gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER,offset,indices);const dv=new DataView(indices.buffer);
   const attrs=locs.map(loc=>{gl.bindBuffer(gl.ARRAY_BUFFER,gl.getVertexAttrib(loc,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));const bytes=new Uint8Array(gl.getBufferParameter(gl.ARRAY_BUFFER,gl.BUFFER_SIZE));gl.getBufferSubData(gl.ARRAY_BUFFER,0,bytes);return {data:new DataView(bytes.buffer),stride:gl.getVertexAttrib(loc,gl.VERTEX_ATTRIB_ARRAY_STRIDE)||8,offset:gl.getVertexAttribOffset(loc,gl.VERTEX_ATTRIB_ARRAY_POINTER)};});
   const loc=gl.getUniformLocation(program,'uTransformMatrix'),matrix=loc?gl.getUniform(program,loc):null;
   for(let n=0;n<count;n++){const idx=size===4?dv.getUint32(n*4,true):size===2?dv.getUint16(n*2,true):dv.getUint8(n);const vertex=attrs.flatMap(a=>[a.data.getFloat32(a.offset+idx*a.stride,true),a.data.getFloat32(a.offset+idx*a.stride+4,true)]);if(matrix){const [x,y]=vertex;vertex[0]=matrix[0]*x+matrix[3]*y+matrix[6];vertex[1]=matrix[1]*x+matrix[4]*y+matrix[7];}submissions.push(vertex);}gl.bindBuffer(gl.ARRAY_BUFFER,bound);
  }return original(mode,count,type,offset);
 };app.render();gl.drawElements=original;
 const expectedGPU=views.flatMap(v=>v.instance.root.children.filter(m=>m.visible).flatMap(m=>[...m.geometry.indices].map(i=>[v.x+2*m.geometry.positions[i*2],128+2*m.geometry.positions[i*2+1],m.geometry.uvs[i*2],m.geometry.uvs[i*2+1]])));
 let gpuPosition=0,gpuUv=0;check(submissions.length===expectedGPU.length&&submissions.length>0,'actual GPU triangle vertex count');
 for(let i=0;i<Math.min(submissions.length,expectedGPU.length);i++){gpuPosition=Math.max(gpuPosition,...[0,1].map(c=>Math.abs(submissions[i][c]-expectedGPU[i][c])));gpuUv=Math.max(gpuUv,...[2,3].map(c=>Math.abs(submissions[i][c]-expectedGPU[i][c])));}
 check(gpuPosition<=.01&&gpuUv<=1e-6,'actual submitted GPU positions/UVs',{gpuPosition,gpuUv});
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(opaque){ctx.fillStyle='#28323d';ctx.fillRect(0,0,width,height);}
 for(const view of views){if(view.cpu)ctx.drawImage(await image(`${base}${view.cpu}`),view.x-128,0);else{
  // Independent affine UV-triangle drawing from Rust vertices, not Pixi geometry.
  for(const slot of view.pose.slots){const a=raw.skins[0].attachments.find(e=>e.slot===slot.name&&e.name===slot.attachment).attachment,r=raw.atlas.regions.find(r=>r.name===a.texture),atlas=await image(`${base}${raw.atlas.pages[r.page].file}`);
   const source=document.createElement('canvas');source.width=r.original_width;source.height=r.original_height;source.getContext('2d').drawImage(atlas,r.x,r.y,r.width,r.height,r.offset_x,r.offset_y,r.width,r.height);
   // Canvas image coordinates address texel centres at pixel+0.5. This
   // crossfade fallback must use the Rust u*(W-1) sampling convention too.
   for(let t=0;t<a.triangles.length;t+=3){const ids=a.triangles.slice(t,t+3),uv=ids.map(i=>[a.uvs[i*2]*(source.width-1)+.5,a.uvs[i*2+1]*(source.height-1)+.5]),p=ids.map(i=>[view.x+2*slot.positions[i*2],128-2*slot.positions[i*2+1]]);
    const ux=uv[1][0]-uv[0][0],uy=uv[1][1]-uv[0][1],vx=uv[2][0]-uv[0][0],vy=uv[2][1]-uv[0][1],det=ux*vy-uy*vx;
    const a0=((p[1][0]-p[0][0])*vy-(p[2][0]-p[0][0])*uy)/det,c0=((p[2][0]-p[0][0])*ux-(p[1][0]-p[0][0])*vx)/det;
    const b0=((p[1][1]-p[0][1])*vy-(p[2][1]-p[0][1])*uy)/det,d0=((p[2][1]-p[0][1])*ux-(p[1][1]-p[0][1])*vx)/det;
    ctx.save();ctx.beginPath();ctx.moveTo(...p[0]);ctx.lineTo(...p[1]);ctx.lineTo(...p[2]);ctx.closePath();ctx.clip();ctx.globalAlpha=parseInt(raw.slots.find(s=>s.name===slot.name).color.slice(6,8),16)/255;
    ctx.setTransform(a0,b0,c0,d0,p[0][0]-a0*uv[0][0]-c0*uv[0][1],p[0][1]-b0*uv[0][0]-d0*uv[0][1]);ctx.drawImage(source,0,0);ctx.restore();
   }
  }
 }}
 const expected=ctx.getImageData(0,0,width,height).data,pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 let flatBad=0,flatCount=0,edgeBad=0,maxFlatRgb=0,maxFlatAlpha=0;
 for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){const i=(y*width+x)*4,g=((height-1-y)*width+x)*4,errors=[0,1,2,3].map(c=>Math.abs((c===3?expected[i+c]:expected[i+c]*expected[i+3]/255)-pixels[g+c]));
  const flat=[-width-1,-width,-width+1,-1,1,width-1,width,width+1].every(d=>[0,1,2,3].every(c=>Math.abs(expected[i+c]-expected[i+d*4+c])<=1)),bad=Math.max(...errors.slice(0,3))>2||errors[3]>1;
  if(flat){flatCount++;if(bad)flatBad++;maxFlatRgb=Math.max(maxFlatRgb,...errors.slice(0,3));maxFlatAlpha=Math.max(maxFlatAlpha,errors[3]);}else if(bad)edgeBad++;
 }
 check(flatBad===0,'flat RGB <=2/255 and alpha <=1/255',{flatBad,flatCount,maxFlatRgb,maxFlatAlpha});check(edgeBad/(width*height)<=.02,'edge mismatch <=2% canvas',{edgeBad,edgeFraction:edgeBad/(width*height)});
 result.gpu={submitted:submissions,expected:expectedGPU,indices:views.flatMap(v=>v.instance.root.children.filter(m=>m.visible).map(m=>({slot:m.label,indices:[...m.geometry.indices],uvs:[...m.geometry.uvs]})))};
 result.measures={maxAffine,maxVertex,uvOutside,gpuPosition,gpuUv,flatBad,maxFlatRgb,maxFlatAlpha,edgeFraction:edgeBad/(width*height)};
 check(JSON.stringify(raw)===before,'native source unchanged');
 const meshes=instances.flatMap(i=>[...i.root.children]),buffers=meshes.flatMap(m=>m.geometry.buffers),textures=[...new Set(meshes.map(m=>m.texture))];for(const i of instances)i.destroy();check(buffers.every(b=>b.destroyed)&&meshes.every(m=>m.destroyed),'instance resources released');check(textures.every(t=>!t.destroyed),'shared pages survive instance destruction');asset.destroy();asset=null;check(textures.every(t=>t.destroyed),'owned pages released');
}catch(error){result.failures.push(error.stack??String(error));}finally{for(const i of instances)i.destroy();asset?.destroy();}
result.pass=result.failures.length===0;window.__app=app;window.__result=result;document.querySelector('#result').textContent=JSON.stringify(result,null,2);
