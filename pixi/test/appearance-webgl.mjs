import { Application, VERSION, Mesh, MeshGeometry, Texture } from 'pixi.js';
import { loadPixiRig } from '@ankhimate/pixi-runtime';
import { evaluate, parseRig, RigPlayer } from '@ankhimate/runtime';
import {decodeOraclePng} from './oracle-png.mjs';
import { DarkTint } from '../dist/tint.js';
import { regionQuad } from '../dist/region.js';
const qs=new URL(location.href).searchParams,name=qs.get('name')??'skins',skin=qs.get('skin')??'default',animation=qs.get('animation')??'clip',time=Number(qs.get('time')??0),mode=qs.get('mode')??'sample',opaque=qs.get('background')==='opaque';
const result={name,skin,animation,time,mode,opaque,pixi:VERSION,checks:[],failures:[]};
const check=(ok,message,details)=>{result.checks.push({pass:!!ok,message,details});if(!ok)result.failures.push(message);};
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);return r.json();};
const image=async url=>{const i=new Image();i.src=url;await i.decode();return i;};
const base=`./fixtures/appearance/${name}/`;let app,asset;const instances=[],borrowed=[],probeViews=[];
const attachment=(raw,skin,slot,name)=>raw.skins.find(s=>s.name===skin)?.attachments.find(e=>e.slot===slot&&e.name===name)?.attachment??raw.skins.find(s=>s.name===raw.defaultSkin).attachments.find(e=>e.slot===slot&&e.name===name)?.attachment;
function expectedVertex(u,v,a,positions){let best=Infinity,bestPoint;
 for(let t=0;t<a.triangles.length;t+=3){const ids=a.triangles.slice(t,t+3),p=ids.map(i=>[a.uvs[i*2],a.uvs[i*2+1]]);
  const det=(p[1][1]-p[2][1])*(p[0][0]-p[2][0])+(p[2][0]-p[1][0])*(p[0][1]-p[2][1]);if(Math.abs(det)<1e-12)continue;
  const b0=((p[1][1]-p[2][1])*(u-p[2][0])+(p[2][0]-p[1][0])*(v-p[2][1]))/det,b1=((p[2][1]-p[0][1])*(u-p[2][0])+(p[0][0]-p[2][0])*(v-p[2][1]))/det,b2=1-b0-b1;
  const outside=Math.max(0,-b0,-b1,-b2);if(outside<best){best=outside;bestPoint=[0,1].map(axis=>ids.reduce((sum,id,j)=>sum+positions[id*2+axis]*[b0,b1,b2][j],0));}
 }return best<=1e-5?bestPoint:undefined;
}
try {
 const raw=await json(`${base}skeleton.json`),before=JSON.stringify(raw),ref=await json(`${base}reference.json`),rig=parseRig(raw),width=mode==='two'?768:384,height=256;
 app=new Application();await app.init({preference:'webgl',width,height,resolution:1,antialias:false,autoStart:false,backgroundColor:opaque?0x28323d:0,backgroundAlpha:opaque?1:0,preserveDrawingBuffer:true});app.stop();document.querySelector('#view').append(app.canvas);
 const gl=app.renderer.gl;if(qs.get('dither')==='off')gl.disable(gl.DITHER);result.dither=gl.isEnabled(gl.DITHER);check(gl instanceof WebGL2RenderingContext,'actual WebGL2');const ext=gl.getExtension('WEBGL_debug_renderer_info');result.backend={version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
 const views=[];
 if(mode==='blend-probe') {
  // Control experiment only: raw native data, direct Pixi modes, outside the capability gate.
  // Never used by the adapter or advertised as supported.
  const textures=await Promise.all(raw.atlas.pages.map(async p=>{const t=Texture.from(await image(`${base}${p.file}`));t.source.alphaMode='premultiply-alpha-on-upload';borrowed.push(t);return t;}));
  const pose=evaluate(rig,[{animation,time,alpha:1}],{skin});
  for(const slot of pose.drawOrder.map(n=>pose.slots.find(s=>s.name===n))){if(!slot.visible||!slot.attachment)continue;const setup=rig.slots.find(s=>s.name===slot.name),a=attachment(raw,skin,slot.name,slot.attachment),r=raw.atlas.regions.find(r=>r.name===a.texture),p=raw.atlas.pages[r.page],q=regionQuad(a,r,p,pose.bones.find(b=>b.name===setup.bone).world);const m=new Mesh({geometry:new MeshGeometry({positions:q.positions,uvs:q.uvs,indices:new Uint32Array([0,1,2,0,2,3])}),texture:textures[r.page]});m.label=slot.name;m.position.set(192,128);m.scale.set(2);const effect=new DarkTint(m);effect.update(textures[r.page],slot.color,[0,0,0,0]);probeViews.push({m,effect});m.tint=0xffffff;m.alpha=1;m.blendMode=({additive:'add',normal:'normal',multiply:'multiply',screen:'screen'})[setup.blend];app.stage.addChild(m);}
  views.push({pose,skin,x:192,cpu:ref.samples.find(s=>s.skin===skin&&s.animation===animation&&s.time===time).cpu[opaque?'opaque':'transparent']});
 } else {
  asset=await loadPixiRig(new URL(`${base}skeleton.json`,location.href));
  const make=(selected,x)=>{const i=asset.createInstance({skin:selected});instances.push(i);i.root.position.set(x,128);i.root.scale.set(2);app.stage.addChild(i.root);return i;};
  const first=make(mode==='direct'?skin:'default',192),p=first.playback,callbackEvents=[];if(mode==='callback')p.onEvent(e=>{callbackEvents.push(e.name);first.setSkin(skin);});
  if(mode==='fade'){
   p.play('clip');p.update(.25);p.crossFade('relax',1);p.update(time);const t=p.time,events=p.events;first.setSkin(skin);check(p.time===t&&p.events===events&&p.playing,'skin keeps active fade/time/event batch');const pose=p.update(0),oracle=ref.fades.find(s=>s.skin===skin&&s.elapsed===time).pose;views.push({instance:first,pose,oracle,skin,x:192});
  }else{
   p.play(animation,{loop:false});p.update(time);first.setSkin(skin);views.push({instance:first,pose:p.update(0),oracle:ref.samples.find(s=>s.skin===skin&&s.animation===animation&&s.time===time).pose,skin,x:192,cpu:ref.samples.find(s=>s.skin===skin&&s.animation===animation&&s.time===time).cpu[opaque?'opaque':'transparent']});
  }
  if(mode==='callback')check(JSON.stringify(callbackEvents)===JSON.stringify(['quarter'])&&p.events.length===0,'skin change from event callback emits once; subsequent zero update clears only the batch',{callbackEvents});
  if(mode==='pose-isolation'){const pose=structuredClone(views[0].pose);first.setPose(pose);for(const slot of pose.slots){slot.color.fill(NaN);slot.dark_color?.fill(NaN);}}
  if(mode==='two') {const second=make('alternate',576),secondAnimation='relax',secondTime=.75;second.setTime(secondAnimation,secondTime);views.push({instance:second,pose:evaluate(rig,[{animation:secondAnimation,time:secondTime,alpha:1}],{skin:'alternate'}),oracle:ref.samples.find(s=>s.skin==='alternate'&&s.animation===secondAnimation&&s.time===secondTime).pose,skin:'alternate',x:576,cpu:ref.samples.find(s=>s.skin==='alternate'&&s.animation===secondAnimation&&s.time===secondTime).cpu[opaque?'opaque':'transparent']});}
  if(mode==='stress'){
   const geometries=new Set(),buffers=new Set(),meshes=[...first.root.children],programs=new Set(),textures=new Set();
   // Warm up both texture pages and shader paths before counting.
   const skins=name==='skins'?['default','alternate','triangle','quad']:['default','alternate'];
   const topologySignatures=new Set();for(const s of skins){first.setSkin(s);app.render();topologySignatures.add(first.root.children.map(m=>[m.geometry.positions.length,m.geometry.indices.length].join("/")).join(','));}first.setSkin(skin);app.render();
   const originalCreateBuffer=gl.createBuffer.bind(gl),originalDeleteBuffer=gl.deleteBuffer.bind(gl),originalCreateTexture=gl.createTexture.bind(gl),originalDeleteTexture=gl.deleteTexture.bind(gl),originalCreateProgram=gl.createProgram.bind(gl),originalDeleteProgram=gl.deleteProgram.bind(gl);
   let createBuffer=0,deleteBuffer=0,createTexture=0,deleteTexture=0,createProgram=0,deleteProgram=0;
   gl.createBuffer=()=>{createBuffer++;return originalCreateBuffer();};gl.deleteBuffer=b=>{deleteBuffer++;return originalDeleteBuffer(b);};gl.createTexture=()=>{createTexture++;return originalCreateTexture();};gl.deleteTexture=t=>{deleteTexture++;return originalDeleteTexture(t);};gl.createProgram=()=>{createProgram++;return originalCreateProgram();};gl.deleteProgram=p=>{deleteProgram++;return originalDeleteProgram(p);};
   for(let n=0;n<600;n++){first.setSkin(skins[n%skins.length]);p.update(1/120);app.render();for(const m of first.root.children){geometries.add(m.geometry);m.geometry.buffers.forEach(b=>buffers.add(b));if(m.shader)programs.add(m.shader);textures.add(m.texture);}}
   const aliveGeometries=[...geometries].filter(g=>g.buffers?.some(b=>!b.destroyed)).length;
   result.resources={renders:600,createBuffer,deleteBuffer,createTexture,deleteTexture,createProgram,deleteProgram,aliveGeometries,meshCount:first.root.children.length,shaderCount:programs.size,textureCount:textures.size};
   check(first.root.children.length===meshes.length&&meshes.every(m=>first.root.children.includes(m)),'600 skin changes retain per-slot Mesh objects',result.resources);
   check(createTexture===0&&deleteTexture===0&&createProgram===0&&deleteProgram===0,'no texture/program churn after warmup',result.resources);
   check((name==='skins'||topologySignatures.size>1)?createBuffer-deleteBuffer<=meshes.length*3:createBuffer===0,'bounded live GPU buffers across topology/FFD changes',result.resources);
   check(aliveGeometries<=meshes.length,'old topology buffers destroyed',result.resources);
   // Re-establish the exact reference sample after stress, not a timing-dependent screenshot.
   first.setTime(animation,time);first.setSkin(skin);views[0].pose=evaluate(rig,[{animation,time,alpha:1}],{skin});
  }
  let maxAffine=0,maxVertex=0,uvOutside=0;
  for(const view of views) {
   for(const b of view.oracle.bones)for(const [k,v] of Object.entries(b.world))maxAffine=Math.max(maxAffine,Math.abs(view.pose.bones.find(p=>p.name===b.name).world[k]-v));
   for(const slot of view.oracle.slots){const a=attachment(raw,view.skin,slot.name,slot.attachment),r=raw.atlas.regions.find(r=>r.name===a.texture),page=raw.atlas.pages[r.page],m=view.instance.root.children.find(m=>m.label===slot.name);check(m?.visible,'Rust visible attachment submitted');if(!m?.visible)continue;
    for(let j=0;j<m.geometry.positions.length/2;j++){const u=(m.geometry.uvs[j*2]*page.width-r.x-0.5+r.offset_x)/(r.original_width-1),v=(m.geometry.uvs[j*2+1]*page.height-r.y-0.5+r.offset_y)/(r.original_height-1);
     uvOutside=Math.max(uvOutside,Math.max(0,Math.max(0,(r.offset_x-1)/(r.original_width-1))-u,u-Math.min(1,(r.offset_x+r.width)/(r.original_width-1)),Math.max(0,(r.offset_y-1)/(r.original_height-1))-v,v-Math.min(1,(r.offset_y+r.height)/(r.original_height-1))));
     const expected=a.type==='mesh'?expectedVertex(u,v,a,slot.positions):[0,1].map(axis=>(1-u)*(1-v)*slot.positions[axis]+(1-u)*v*slot.positions[2+axis]+u*v*slot.positions[4+axis]+u*(1-v)*slot.positions[6+axis]);check(!!expected,'UV lies within authored triangles');if(expected)maxVertex=Math.max(maxVertex,Math.abs(m.geometry.positions[j*2]-expected[0]),Math.abs(m.geometry.positions[j*2+1]+expected[1]));
    }
    check(m.texture.source.width===page.width&&m.texture.source.height===page.height,'atlas page dimensions');
   }
   check(JSON.stringify(view.instance.root.children.filter(m=>m.visible).map(m=>m.label))===JSON.stringify(view.oracle.slots.map(s=>s.name)),'Rust draw order and hidden attachments');
  }
  check(maxAffine<=.01&&maxVertex<=.01&&uvOutside<=1e-6,'Rust pose, vertices and UVs',{maxAffine,maxVertex,uvOutside});result.geometry={maxAffine,maxVertex,uvOutside};
 }
 const submissions=[],original=gl.drawElements.bind(gl);
 gl.drawElements=function(mode,count,type,offset){const program=gl.getParameter(gl.CURRENT_PROGRAM),locs=['aPosition','aUV'].map(n=>gl.getAttribLocation(program,n));
  if(locs.every(l=>l>=0)){const bound=gl.getParameter(gl.ARRAY_BUFFER_BINDING),size=type===gl.UNSIGNED_INT?4:type===gl.UNSIGNED_SHORT?2:1,indices=new Uint8Array(count*size);gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER,offset,indices);const dv=new DataView(indices.buffer);
   const attrs=locs.map(loc=>{gl.bindBuffer(gl.ARRAY_BUFFER,gl.getVertexAttrib(loc,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));const bytes=new Uint8Array(gl.getBufferParameter(gl.ARRAY_BUFFER,gl.BUFFER_SIZE));gl.getBufferSubData(gl.ARRAY_BUFFER,0,bytes);return {data:new DataView(bytes.buffer),stride:gl.getVertexAttrib(loc,gl.VERTEX_ATTRIB_ARRAY_STRIDE)||8,offset:gl.getVertexAttribOffset(loc,gl.VERTEX_ATTRIB_ARRAY_POINTER)};});
   const loc=gl.getUniformLocation(program,'uTransformMatrix'),transform=loc?gl.getUniform(program,loc):null;
   for(let n=0;n<count;n++){const idx=size===4?dv.getUint32(n*4,true):size===2?dv.getUint16(n*2,true):dv.getUint8(n),v=attrs.flatMap(a=>[a.data.getFloat32(a.offset+idx*a.stride,true),a.data.getFloat32(a.offset+idx*a.stride+4,true)]);if(transform){const [x,y]=v;v[0]=transform[0]*x+transform[3]*y+transform[6];v[1]=transform[1]*x+transform[4]*y+transform[7];}submissions.push(v);}gl.bindBuffer(gl.ARRAY_BUFFER,bound);
  }return original(mode,count,type,offset);
 };app.render();gl.drawElements=original;
 if(mode!=='blend-probe'){
  const expectedGPU=views.flatMap(v=>v.instance.root.children.filter(m=>m.visible&&m.alpha>0).flatMap(m=>[...m.geometry.indices].map(i=>[v.x+2*m.geometry.positions[i*2],128+2*m.geometry.positions[i*2+1],m.geometry.uvs[i*2],m.geometry.uvs[i*2+1]])));
  let gpuPosition=0,gpuUv=0;check(submissions.length===expectedGPU.length&&submissions.length>0,'actual GPU triangle vertex count');for(let i=0;i<Math.min(submissions.length,expectedGPU.length);i++){gpuPosition=Math.max(gpuPosition,...[0,1].map(c=>Math.abs(submissions[i][c]-expectedGPU[i][c])));gpuUv=Math.max(gpuUv,...[2,3].map(c=>Math.abs(submissions[i][c]-expectedGPU[i][c])));}
  check(gpuPosition<=.01&&gpuUv<=1e-6,'actual GPU submitted coordinates and UVs',{gpuPosition,gpuUv});result.gpu={submissions,expectedGPU,gpuPosition,gpuUv};
 }
 if(views.every(v=>v.cpu)){
 // Decode exact CPU bytes, not Canvas2D's quantized PMA->straight round trip.
 const expected=new Uint8Array(width*height*4);
 for(const v of views){const response=await fetch(`${base}${v.cpu}`);if(!response.ok)throw Error('Missing CPU oracle');const cpu=decodeOraclePng(new Uint8Array(await response.arrayBuffer()));check(cpu.width===384&&cpu.height===height,'independent oracle dimensions');for(let y=0;y<height;y++)expected.set(cpu.rgba.subarray(y*384*4,(y+1)*384*4),(y*width+v.x-192)*4);}
 const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 let flatBad=0,flatCount=0,edgeBad=0,maxFlatRgb=0,maxFlatAlpha=0;const probes=[];
 for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){const i=(y*width+x)*4,g=((height-1-y)*width+x)*4,errors=[0,1,2,3].map(c=>Math.abs((c===3?expected[i+c]:expected[i+c]*expected[i+3]/255)-pixels[g+c]));
  const flat=[-width-1,-width,-width+1,-1,1,width-1,width,width+1].every(d=>[0,1,2,3].every(c=>Math.abs(expected[i+c]-expected[i+d*4+c])<=1)),bad=Math.max(...errors.slice(0,3))>2||errors[3]>1;
  if(flat){flatCount++;if(bad){flatBad++;if(probes.length<12)probes.push({x,y,expected:[...expected.slice(i,i+4)],gpu:[...pixels.slice(g,g+4)],errors});}maxFlatRgb=Math.max(maxFlatRgb,...errors.slice(0,3));maxFlatAlpha=Math.max(maxFlatAlpha,errors[3]);}else if(bad)edgeBad++;
 }
 result.pixels={oracle:"Exact Rust PNG RGBA8 decoded directly; floating RGB * alpha / 255, no added rounding",flatBad,flatCount,maxFlatRgb,maxFlatAlpha,edgeFraction:edgeBad/(width*height),probes};
 if(mode==='blend-probe'){result.blendComparison={matchesByteBounds:flatBad===0,opaqueAddControl:name==='blend_additive'&&opaque};
  // Opaque Add has the same RGB equation: rounding may agree or differ slightly.
  // The transparent Add control must diverge in alpha; there is no opaque-only API.
  if(!(name==='blend_additive'&&opaque))check(flatBad>0,'control proves a native-Pixi/Rust discrepancy; full blend profile remains refused',result.pixels);}
 else{check(flatBad===0,'flat RGB <=2/255 and alpha <=1/255',result.pixels);check(edgeBad/(width*height)<=.02,'edge mismatch <=2% canvas',result.pixels);}
 }
 check(JSON.stringify(raw)===before,'native JSON not mutated');
 if(mode==='two'){const [a,b]=instances;const sa=a.root.children.find(m=>m.shader)?.shader,sb=b.root.children.find(m=>m.shader)?.shader;if(sa&&sb)check(sa!==sb&&sa.resources.tintUniforms!==sb.resources.tintUniforms,'separate tint uniforms');const old=[...b.root.children].map(m=>[...m.geometry.positions]);const beforeB=new Uint8Array(384*height*4);gl.readPixels(384,0,384,height,gl.RGBA,gl.UNSIGNED_BYTE,beforeB);a.destroy();app.render();const afterB=new Uint8Array(beforeB.length);gl.readPixels(384,0,384,height,gl.RGBA,gl.UNSIGNED_BYTE,afterB);check(beforeB.every((v,j)=>v===afterB[j]),'second instance WebGL pixels unchanged after first is destroyed');check(!b.root.destroyed&&JSON.stringify(old)===JSON.stringify(b.root.children.map(m=>[...m.geometry.positions])),'destroying first instance preserves second');}
 const meshes=instances.flatMap(i=>[...i.root.children]),buffers=meshes.flatMap(m=>m.geometry.buffers),shaders=meshes.filter(m=>m.shader).map(m=>m.shader),textures=[...new Set(meshes.map(m=>m.texture))];instances.forEach(i=>i.destroy());check(buffers.every(b=>b.destroyed)&&meshes.every(m=>m.destroyed),'owned geometry/buffers released');check(shaders.every(s=>s.resources===null),'owned tint shaders released');check(textures.every(t=>!t.destroyed),'shared texture pages survive instance destruction');asset?.destroy();asset=null;check(textures.every(t=>t.destroyed),'owned atlas pages released');
}catch(error){result.failures.push(error.stack??String(error));}finally{instances.forEach(i=>i.destroy());asset?.destroy();for(const {m,effect}of probeViews){const g=m.geometry;m.destroy();effect.destroy();g.destroy(true);}borrowed.forEach(t=>t.destroy(true));}
result.pass=result.failures.length===0;window.__app=app;window.__result=result;document.querySelector('#result').textContent=JSON.stringify(result,null,2);
