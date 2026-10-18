import { Application, VERSION } from 'pixi.js';
import { loadPixiRig } from '@ankhimate/pixi-runtime';

const qs=new URL(location.href).searchParams,mode=qs.get('mode')??'rise',index=Number(qs.get('sample')??0);
const result={mode,index,pixi:VERSION,checks:[],failures:[]};
const check=(ok,message,details)=>{result.checks.push({pass:!!ok,message,details});if(!ok)result.failures.push(message);};
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);return r.json();};
const image=async url=>{const i=new Image();i.src=url;await i.decode();return i;};
const base='./fixtures/playback/';
let app,asset;const instances=[];
try{
  const raw=await json(`${base}skeleton.json`),before=JSON.stringify(raw),ref=await json(`${base}reference.json`);
  const width=mode==='two'?512:256,height=256;
  app=new Application();await app.init({preference:'webgl',width,height,resolution:1,antialias:false,autoStart:false,backgroundColor:0,backgroundAlpha:0,preserveDrawingBuffer:true});app.stop();document.querySelector('#view').append(app.canvas);
  const gl=app.renderer.gl;check(gl instanceof WebGL2RenderingContext,'real WebGL2 context');
  const ext=gl.getExtension('WEBGL_debug_renderer_info');result.backend={version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
  asset=await loadPixiRig(new URL(`${base}skeleton.json`,location.href));
  const make=(x=128)=>{const i=asset.createInstance();instances.push(i);i.root.position.set(x,128);i.root.scale.set(2);app.stage.addChild(i.root);return i;};
  const first=make(),events=[];first.playback.onEvent(e=>events.push(e.name));
  const views=[];
  if(mode==='fade'){
    first.playback.play('rise');first.playback.update(.25);events.length=0;first.playback.crossFade('recover',1);
    let t=0;for(const step of ref.fades.slice(0,index+1)){first.playback.update(step.elapsed-t);t=step.elapsed;}
    views.push({instance:first,pose:ref.fades[index].pose,x:128});
    check(!events.includes('impact')&&!events.includes('late'),'crossfade dispatches incoming only',events);
  }else if(mode==='two'){
    const second=make(384);first.playback.play('rise');second.playback.play('recover');second.playback.speed=2;
    first.playback.update(.25);second.playback.update(.25);
    views.push({instance:first,...ref.samples.find(s=>s.animation==='rise'&&s.time===.25),x:128});
    views.push({instance:second,...ref.samples.find(s=>s.animation==='recover'&&s.time===.5),x:384});
    check(first.playback.time===.25&&second.playback.time===.5,'independent clip times and speeds');
    check(first.root.children[0].texture===second.root.children[0].texture&&first.root.children[0].geometry!==second.root.children[0].geometry,'shared atlas, independent GPU geometry');
  }else if(mode==='deterministic'){
    const steps=[.125,.125,.25,0,.5,.75,.5,1,.5],trace=[];
    first.playback.play('rise');for(const dt of steps){first.playback.update(dt);trace.push({time:first.playback.time,events:first.playback.events.map(e=>e.name),positions:[...first.root.children[0].geometry.positions]});}
    const firstEvents=[...events];first.playback.stop();first.playback.play('rise');events.length=0;
    const replay=[];for(const dt of steps){first.playback.update(dt);replay.push({time:first.playback.time,events:first.playback.events.map(e=>e.name),positions:[...first.root.children[0].geometry.positions]});}
    check(JSON.stringify(trace)===JSON.stringify(replay),'deterministic replay of explicit dt sequence');check(JSON.stringify(firstEvents)===JSON.stringify(events),'deterministic event batch replay');
    const total=steps.reduce((a,b)=>a+b,0),time=total%1;
    views.push({instance:first,...ref.samples.find(s=>s.animation==='rise'&&s.time===time),x:128});
  }else if(mode==='loop'||mode==='event'){
    first.playback.play('rise');for(const dt of (mode==='loop'?[1,0,.5]:[.25,.25]))first.playback.update(dt);
    views.push({instance:first,...ref.samples.find(s=>s.animation==='rise'&&s.time===.5),x:128});
    check(JSON.stringify(events)===JSON.stringify(mode==='loop'?['impact','late','end','impact']:['impact']),'event synchronized with rendered pose',events);
    first.playback.pause();first.playback.update(10);check(first.playback.time===.5&&first.playback.events.length===0,'paused update does not advance or dispatch');first.playback.resume();
  }else{
    const s=ref.samples.filter(s=>s.animation===mode)[index];first.playback.play(mode,{loop:false});
    // Actual incremental transport, including exact end, rather than setTime.
    for(let n=0;n<index;n++)first.playback.update(.25);
    views.push({instance:first,...s,x:128});
  }
  result.events=events;
  let maxAffine=0,maxVertex=0;
  for(const view of views){
    // update(0) obtains the already evaluated pose and dispatches no extra event.
    const p=view.instance.playback.update(0);
    for(const b of view.pose.bones)for(const [k,v] of Object.entries(b.world))maxAffine=Math.max(maxAffine,Math.abs(p.bones.find(a=>a.name===b.name).world[k]-v));
    for(const slot of view.pose.slots){const m=view.instance.root.children.find(c=>c.label===slot.name);m.geometry.positions.forEach((v,i)=>maxVertex=Math.max(maxVertex,Math.abs(v-(i%2?-slot.positions[i]:slot.positions[i]))));}
  }
  check(maxAffine<=.01&&maxVertex<=.01,'transport affine/quad matches independent Rust reference',{maxAffine,maxVertex});

  const submitted=[],original=gl.drawElements.bind(gl);
  gl.drawElements=function(mode,count,type,offset){
    const program=gl.getParameter(gl.CURRENT_PROGRAM),locs=['aPosition','aUV'].map(n=>gl.getAttribLocation(program,n));
    if(locs.every(l=>l>=0)){
      const bound=gl.getParameter(gl.ARRAY_BUFFER_BINDING),size=type===gl.UNSIGNED_INT?4:type===gl.UNSIGNED_SHORT?2:1;
      const indices=new Uint8Array(count*size);gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER,offset,indices);const dv=new DataView(indices.buffer);
      const attrs=locs.map(loc=>{gl.bindBuffer(gl.ARRAY_BUFFER,gl.getVertexAttrib(loc,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING));const bytes=new Uint8Array(gl.getBufferParameter(gl.ARRAY_BUFFER,gl.BUFFER_SIZE));gl.getBufferSubData(gl.ARRAY_BUFFER,0,bytes);return {data:new DataView(bytes.buffer),stride:gl.getVertexAttrib(loc,gl.VERTEX_ATTRIB_ARRAY_STRIDE)||8,offset:gl.getVertexAttribOffset(loc,gl.VERTEX_ATTRIB_ARRAY_POINTER)};});
      const loc=gl.getUniformLocation(program,'uTransformMatrix'),matrix=loc?gl.getUniform(program,loc):null;
   for(let n=0;n<count;n++){const idx=size===4?dv.getUint32(n*4,true):size===2?dv.getUint16(n*2,true):dv.getUint8(n);const vertex=attrs.flatMap(a=>[a.data.getFloat32(a.offset+idx*a.stride,true),a.data.getFloat32(a.offset+idx*a.stride+4,true)]);if(matrix){const [x,y]=vertex;vertex[0]=matrix[0]*x+matrix[3]*y+matrix[6];vertex[1]=matrix[1]*x+matrix[4]*y+matrix[7];}submitted.push(vertex);}
      gl.bindBuffer(gl.ARRAY_BUFFER,bound);
    }return original(mode,count,type,offset);
  };
  app.render();gl.drawElements=original;
  const expectedGPU=views.flatMap(v=>v.instance.root.children.filter(m=>m.visible).flatMap(m=>[...m.geometry.indices].map(i=>[v.x+2*m.geometry.positions[i*2],128+2*m.geometry.positions[i*2+1],m.geometry.uvs[i*2],m.geometry.uvs[i*2+1]])));
  let gpuPosition=0,gpuUv=0;
  check(submitted.length===expectedGPU.length&&submitted.length>0,'actual triangle submission count',{actual:submitted.length,expected:expectedGPU.length});
  for(let i=0;i<Math.min(submitted.length,expectedGPU.length);i++){gpuPosition=Math.max(gpuPosition,...[0,1].map(c=>Math.abs(submitted[i][c]-expectedGPU[i][c])));gpuUv=Math.max(gpuUv,...[2,3].map(c=>Math.abs(submitted[i][c]-expectedGPU[i][c])));}
  check(gpuPosition<=.01&&gpuUv<=1e-6,'actual GPU positions/UVs',{gpuPosition,gpuUv});

  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  for(const view of views){if(view.cpu){ctx.drawImage(await image(`${base}${view.cpu}`),view.x-128,0);}else{
    // Crossfade oracle: independently draw the atlas with corners evaluated by Rust.
    const atlas=await image(`${base}atlas.png`),r=raw.atlas.regions[0],p=view.pose.slots[0].positions;
    const points=[0,1,2,3].map(i=>[view.x+2*p[i*2],128-2*p[i*2+1]]);
    ctx.setTransform((points[3][0]-points[0][0])/r.width,(points[3][1]-points[0][1])/r.width,(points[1][0]-points[0][0])/r.height,(points[1][1]-points[0][1])/r.height,...points[0]);
    ctx.drawImage(atlas,r.x,r.y,r.width,r.height,0,0,r.width,r.height);ctx.resetTransform();
  }}
  const expected=ctx.getImageData(0,0,width,height).data,pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let flatBad=0,flatCount=0,edgeBad=0,maxFlatRgb=0,maxFlatAlpha=0;
  for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){
    const i=(y*width+x)*4,g=((height-1-y)*width+x)*4;
    const errors=[0,1,2,3].map(c=>Math.abs((c===3?expected[i+c]:expected[i+c]*expected[i+3]/255)-pixels[g+c]));
    const flat=[-width-1,-width,-width+1,-1,1,width-1,width,width+1].every(d=>[0,1,2,3].every(c=>Math.abs(expected[i+c]-expected[i+d*4+c])<=1));
    const bad=Math.max(...errors.slice(0,3))>2||errors[3]>1;
    if(flat){flatCount++;if(bad)flatBad++;maxFlatRgb=Math.max(maxFlatRgb,...errors.slice(0,3));maxFlatAlpha=Math.max(maxFlatAlpha,errors[3]);}else if(bad)edgeBad++;
  }
  check(flatBad===0,'flat pixels: RGB <=2/255, alpha <=1/255',{flatBad,flatCount,maxFlatRgb,maxFlatAlpha});check(edgeBad/(width*height)<=.02,'edge discrepancies <=2% of canvas',{edgeBad,edgeFraction:edgeBad/(width*height)});
  check(JSON.stringify(raw)===before,'source native export unchanged');
  result.measures={maxAffine,maxVertex,gpuPosition,gpuUv,flatBad,flatCount,maxFlatRgb,maxFlatAlpha,edgeBad,edgeFraction:edgeBad/(width*height)};
  const meshes=instances.flatMap(i=>[...i.root.children]),buffers=meshes.flatMap(m=>m.geometry.buffers),textures=[...new Set(meshes.map(m=>m.texture))];
  for(const i of instances)i.destroy();check(meshes.every(m=>m.destroyed)&&buffers.every(b=>b.destroyed),'all instance resources released');check(textures.every(t=>!t.destroyed),'shared textures survive instances');asset.destroy();asset=null;check(textures.every(t=>t.destroyed),'owned asset pages released');
}catch(error){result.failures.push(error.stack??String(error));}
finally{for(const i of instances)i.destroy();asset?.destroy();}
result.pass=result.failures.length===0;window.__app=app;window.__result=result;document.querySelector('#result').textContent=JSON.stringify(result,null,2);
