import { Application, VERSION, TextureSource } from 'pixi.js';
import { evaluate } from '@ankhimate/runtime';
import { loadPixiRig } from '@ankhimate/pixi-runtime';

const query=new URL(location.href).searchParams;
const name=query.get('case')??'tagged', sampleIndex=Number(query.get('sample')??0);
const skin=query.get('skin')??'default', transparent=query.get('background')==='transparent';
const result={name,skin,sampleIndex,transparent,pixi:VERSION,failures:[],checks:[]};
const check=(ok,message,details)=>{ result.checks.push({pass:!!ok,message,details}); if(!ok)result.failures.push(message); };
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);return r.json();};
const image=async url=>{const i=new Image();i.src=url;await i.decode();return i;};
let app,asset,instance;

try {
  if(name==='fail-page'||name==='abort') {
    // The runner faults an actual HTTP page response; the native JSON is intact.
    let destroys=0;
    const original=TextureSource.prototype.destroy;
    TextureSource.prototype.destroy=function(){destroys++;return original.call(this);};
    let error;
    try {
      const controller=new AbortController();
      if(name==='abort') controller.abort(new Error('intentional abort'));
      asset=await loadPixiRig(new URL('./fixtures/multipage/skeleton.json',location.href),{signal:controller.signal});
    } catch(e){error=String(e);}
    finally { TextureSource.prototype.destroy=original; }
    check(name==='abort'?error?.includes('intentional abort'):error?.includes('HTTP 404'),'load failure is explicit',error);
    check(name==='abort'?destroys===0:destroys===1,'all completed owned pages released after failed load',{destroys});
  } else {
    const base=`./fixtures/${name}/`, raw=await json(`${base}skeleton.json`), before=JSON.stringify(raw);
    let reference,sample,animation,time,width,height,origin,scale;
    if(name==='tagged') {
      reference=await json(`${base}cpu-reference.json`);sample=reference.samples[sampleIndex];
      ({width,height,origin,scale}=reference);animation=reference.animation;time=sample.time;
    } else if(name==='multipage') {
      reference=await json(`${base}reference.json`);sample=reference.samples.filter(s=>s.skin===skin)[sampleIndex];
      ({width,height,origin,scale}=reference);animation='clip';time=sample.time;
    } else {
      reference=await json(`${base}rust-poses.json`);sample=reference.poses[[0,1,2,3,6][sampleIndex]];
      width=height=512; origin=[256,256];scale=.7;animation='frappe_sol';time=sample.time;
    }
    result.time=time;
    const background=transparent?[0,0,0,0]:[40,50,61,255];
    app=new Application();
    await app.init({preference:'webgl',width,height,resolution:1,antialias:false,autoStart:false,
      backgroundColor:transparent?0:0x28323d,backgroundAlpha:background[3]/255,preserveDrawingBuffer:true});
    app.stop();document.querySelector('#view').append(app.canvas);
    const gl=app.renderer.gl;
    check(!!gl && gl instanceof WebGL2RenderingContext,'actual WebGL2 context');
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    result.backend={version:gl.getParameter(gl.VERSION),vendor:gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
    asset=await loadPixiRig(new URL(`${base}skeleton.json`,location.href));
    instance=asset.createInstance({skin});app.stage.addChild(instance.root);
    instance.root.position.set(...origin);instance.root.scale.set(scale);
    let pose=instance.setTime(animation,time);
    const expectedCanvas=document.createElement('canvas'); expectedCanvas.width=width;expectedCanvas.height=height;
    const ctx=expectedCanvas.getContext('2d',{willReadFrequently:true});
    if(!transparent){ctx.fillStyle='#28323d';ctx.fillRect(0,0,width,height);}
    let maxAffine=0, maxVertex=0;
    for(const b of sample.bones) {
      const w=pose.bones.find(p=>p.name===b.name).world;
      const expected=Array.isArray(b.world)?b.world:Object.values(b.world);
      Object.values(w).forEach((v,i)=>maxAffine=Math.max(maxAffine,Math.abs(v-expected[i])));
    }
    check(maxAffine<=.01,'bone world matrices match independent Rust oracle',maxAffine);
    if(name==='trim') {
      const entry=raw.skins.find(s=>s.name===skin).attachments.find(e=>e.attachment.texture==='coiffe_royale_test');
      check(!!entry,'authentic alternative skin contains the cropped region');
      // A supplied pose isolates one region. No native JSON or original project is patched.
      pose=structuredClone(pose);for(const slot of pose.slots) slot.visible=slot.name===entry.slot;
      instance.setPose(pose);
      const a=entry.attachment, source=await image(`${base}coiffe_royale_test.png`);
      const bname=raw.slots.find(s=>s.name===entry.slot).bone;
      const values=sample.bones.find(b=>b.name===bname).world;
      const [wa,wb,wc,wd,wx,wy]=values;
      // Independent Canvas2D oracle draws the full, untrimmed original PNG.
      // It does not call regionQuad or derive geometry from the cropped atlas.
      const co=Math.cos(a.rotation*Math.PI/180),si=Math.sin(a.rotation*Math.PI/180);
      const w=a.width*a.scale_x,h=a.height*a.scale_y;
      const la=co*w/source.width,lb=si*w/source.width,lc=si*h/source.height,ld=-co*h/source.height;
      const lx=a.x-co*a.pivot_x*w-si*(1-a.pivot_y)*h;
      const ly=a.y-si*a.pivot_x*w+co*(1-a.pivot_y)*h;
      ctx.setTransform(scale*(wa*la+wc*lb),-scale*(wb*la+wd*lb),scale*(wa*lc+wc*ld),-scale*(wb*lc+wd*ld),origin[0]+scale*(wa*lx+wc*ly+wx),origin[1]-scale*(wb*lx+wd*ly+wy));
      ctx.drawImage(source,0,0);ctx.resetTransform();
      result.trim={source:[source.width,source.height],region:raw.atlas.regions.find(r=>r.name===a.texture)};
    } else {
      ctx.drawImage(await image(`${base}${name==='tagged'?`cpu-${sampleIndex}.png`:sample.file}`),0,0);
      const slots=name==='tagged'?sample.slots:[{name:raw.slots[0].name,positions:sample.positions}];
      for(const slot of slots) {
        const mesh=instance.root.children.find(m=>m.label===slot.name);
        Array.from(mesh.geometry.positions).forEach((v,i)=>maxVertex=Math.max(maxVertex,Math.abs(v-(i%2?-slot.positions[i]:slot.positions[i]))));
      }
      check(maxVertex<=.01,'region vertices match independent Rust oracle',maxVertex);
      if(name==='tagged')check(instance.root.children.filter(m=>m.visible).map(m=>m.label).join('|')===sample.slots.map(s=>s.name).join('|'),'authored draw order');
    }

    // Inspect the actual interleaved GPU buffers at drawElements, not only JS meshes.
    const submissions=[];
    const drawElements=gl.drawElements.bind(gl);
    gl.drawElements=function(mode,count,type,offset){
      const program=gl.getParameter(gl.CURRENT_PROGRAM);
      const pos=gl.getAttribLocation(program,'aPosition'),uv=gl.getAttribLocation(program,'aUV');
      if(pos>=0&&uv>=0) {
        const bound=gl.getParameter(gl.ARRAY_BUFFER_BINDING);
        const idxBytes=type===gl.UNSIGNED_INT?4:type===gl.UNSIGNED_SHORT?2:1;
        const indices=new Uint8Array(count*idxBytes);gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER,offset,indices);
        const dv=new DataView(indices.buffer),out=[];
        const attributes=[pos,uv].map(loc=>{
          const buffer=gl.getVertexAttrib(loc,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
          gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
          const data=new Uint8Array(gl.getBufferParameter(gl.ARRAY_BUFFER,gl.BUFFER_SIZE));gl.getBufferSubData(gl.ARRAY_BUFFER,0,data);
          return {data:new DataView(data.buffer),stride:gl.getVertexAttrib(loc,gl.VERTEX_ATTRIB_ARRAY_STRIDE)||8,offset:gl.getVertexAttribOffset(loc,gl.VERTEX_ATTRIB_ARRAY_POINTER)};
        });
        const loc=gl.getUniformLocation(program,'uTransformMatrix'),matrix=loc?gl.getUniform(program,loc):null;
        for(let i=0;i<count;i++) {
          const index=idxBytes===4?dv.getUint32(i*4,true):idxBytes===2?dv.getUint16(i*2,true):dv.getUint8(i);
          const vertex=attributes.flatMap(a=>[a.data.getFloat32(a.offset+index*a.stride,true),a.data.getFloat32(a.offset+index*a.stride+4,true)]);if(matrix){const [x,y]=vertex;vertex[0]=matrix[0]*x+matrix[3]*y+matrix[6];vertex[1]=matrix[1]*x+matrix[4]*y+matrix[7];}out.push(vertex);
        }
        submissions.push(out);gl.bindBuffer(gl.ARRAY_BUFFER,bound);
      }
      return drawElements(mode,count,type,offset);
    };
    app.render();gl.drawElements=drawElements;
    const expectedGPU=instance.root.children.filter(m=>m.visible).flatMap(m=>Array.from(m.geometry.indices).map(i=>[
      origin[0]+scale*m.geometry.positions[i*2],origin[1]+scale*m.geometry.positions[i*2+1],m.geometry.uvs[i*2],m.geometry.uvs[i*2+1]]));
    const submitted=submissions.flat();let gpuPosition=0,gpuUv=0;
    check(submitted.length===expectedGPU.length&&submitted.length>0,'actual GPU triangle vertex count',{actual:submitted.length,expected:expectedGPU.length});
    for(let i=0;i<Math.min(submitted.length,expectedGPU.length);i++) {
      gpuPosition=Math.max(gpuPosition,...[0,1].map(c=>Math.abs(submitted[i][c]-expectedGPU[i][c])));
      gpuUv=Math.max(gpuUv,...[2,3].map(c=>Math.abs(submitted[i][c]-expectedGPU[i][c])));
    }
    check(gpuPosition<=.01&&gpuUv<=1e-6,'GPU submitted positions and UVs',{gpuPosition,gpuUv});
    const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const expected=ctx.getImageData(0,0,width,height).data;
    let flatBad=0,edgeBad=0,flatCount=0,maxFlatRgb=0,maxFlatAlpha=0;
    const rgbLimit=name==='tagged'?8:2,alphaLimit=1;
    for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++) {
      const i=(y*width+x)*4,g=((height-1-y)*width+x)*4;
      const errors=[0,1,2,3].map(c=>Math.abs((c===3?expected[i+c]:expected[i+c]*expected[i+3]/255)-pixels[g+c]));
      const flat=[-width-1,-width,-width+1,-1,1,width-1,width,width+1].every(d=>[0,1,2,3].every(c=>Math.abs(expected[i+c]-expected[i+d*4+c])<=1));
      const bad=Math.max(...errors.slice(0,3))>rgbLimit||errors[3]>alphaLimit;
      if(flat){flatCount++;if(bad)flatBad++;maxFlatRgb=Math.max(maxFlatRgb,...errors.slice(0,3));maxFlatAlpha=Math.max(maxFlatAlpha,errors[3]);}
      else if(bad)edgeBad++;
    }
    const flatFraction=flatBad/Math.max(1,flatCount),edgeFraction=edgeBad/(width*height);
    check(name==='tagged'?flatFraction<=.005:flatBad===0,'flat interiors within predefined RGB/alpha thresholds',{rgbLimit,alphaLimit,flatCount,flatBad,maxFlatRgb,maxFlatAlpha});
    check(edgeFraction<=.02,'edge mismatch <=2% of canvas',{edgeBad,edgeFraction});
    result.measures={maxAffine,maxVertex:name==='trim'?null:maxVertex,gpuPosition,gpuUv,flatBad,flatCount,maxFlatRgb,maxFlatAlpha,edgeBad,edgeFraction};
    check(JSON.stringify(raw)===before,'native source rig unchanged');

    // Two independent instances reuse page textures; one may be destroyed safely.
    const second=asset.createInstance({skin});second.setTime(animation,0);
    const snapshot=second.root.children.map(m=>Array.from(m.geometry.positions));
    const meshes=[...instance.root.children],buffers=meshes.flatMap(m=>m.geometry.buffers);
    for(let i=0;i<64;i++) instance.setTime(animation,time);
    check(second.root.children.every((m,i)=>JSON.stringify(Array.from(m.geometry.positions))===JSON.stringify(snapshot[i])),'second instance pose independent');
    instance.destroy();instance=null;
    check(meshes.every(m=>m.destroyed)&&buffers.every(b=>b.destroyed),'instance meshes and buffers explicitly released');
    check(second.root.children.every(m=>!m.texture.destroyed&&!m.texture.source.destroyed),'shared pages survive instance destruction');
    const textures=[...new Set(second.root.children.map(m=>m.texture))];
    second.destroy();asset.destroy();asset=null;
    check(textures.every(t=>t.destroyed),'owned asset textures released');
    result.completed=true;
  }
}catch(error){result.failures.push(error.stack??String(error));}
finally {instance?.destroy();asset?.destroy();}
result.pass=result.failures.length===0;
window.__app=app;window.__result=result;
document.querySelector('#result').textContent=JSON.stringify(result,null,2);
