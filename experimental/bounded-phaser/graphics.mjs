/** Real Phaser graphics process. No numerical page, session authority or solver. */
import {BoundedPhaserView} from './adapter.mjs';
import {applyDarkTint} from '/phaser/dark-tint.js';

const W=640,H=480,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;document.body.append(canvas);
const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:true,stencil:true,depth:false});
if(!gl)throw Error('Actual WebGL2 required');
const objects={},created={},deleted={},invalidated={},shaders=[];let contextLosses=0,versionReads=0;
for(const kind of ['Buffer','Texture','Framebuffer','Renderbuffer','Program','Shader','Query']) {
    objects[kind]=new Set();created[kind]=deleted[kind]=invalidated[kind]=0;
    const make=gl['create'+kind].bind(gl),drop=gl['delete'+kind].bind(gl);
    gl['create'+kind]=(...a)=>{const x=make(...a);if(x){objects[kind].add(x);created[kind]++;}return x;};
    gl['delete'+kind]=(x,...a)=>{if(objects[kind].delete(x))deleted[kind]++;return drop(x,...a);};
}
canvas.addEventListener('webglcontextlost',()=>{contextLosses++;for(const[k,set]of Object.entries(objects)){invalidated[k]+=set.size;set.clear();}});
const param=gl.getParameter.bind(gl);gl.getParameter=p=>{if(p===gl.VERSION)versionReads++;return param(p);};
const shaderSource=gl.shaderSource.bind(gl);gl.shaderSource=(shader,source)=>{shaders.push(source);return shaderSource(shader,source);};
let game,scene;await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Phaser Scene boot timeout')),20000);
    game=new Phaser.Game({type:Phaser.WEBGL,canvas,context:gl,width:W,height:H,transparent:true,backgroundColor:0,antialias:false,roundPixels:false,banner:false,audio:{noAudio:true},scene:{key:'bounded',create(){scene=this;clearTimeout(timer);resolve();}}});
});
game.loop.stop();
const draw=()=>{if(game.pendingDestroy||!game.renderer)throw Error('Game destroyed');game.renderer.preRender();game.scene.render(game.renderer);game.renderer.postRender();};
const views=new Map(),assets=new Map(),placements=new Map(),nativeTexts=new Map(),bindings=new Map();let serial=0,opaque=false;
const encode=b=>{let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);};
const read=()=>{const b=new Uint8Array(W*H*4),top=new Uint8Array(b.length);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,b);for(let y=0;y<H;y++)top.set(b.subarray(y*W*4,(y+1)*W*4),(H-1-y)*W*4);return top;};
const resources=()=>({created:{...created},deleted:{...deleted},invalidated:{...invalidated},alive:Object.fromEntries(Object.entries(objects).map(([k,s])=>[k,s.size])),contextLosses,contextLost:gl.isContextLost(),versionReads,views:views.size,pages:[...assets].map(([id,a])=>({id,pages:a.pages.size})),sceneCount:game.scene?.scenes.length??0,textureKeys:game.textures?.getTextureKeys()??[],memory:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize,limit:performance.memory.jsHeapSizeLimit}:null});
async function asset(character) {
    if(assets.has(character))return assets.get(character);
    const nativeText=await(await fetch('/exports/'+character+'/skeleton.json')).text(),rig=JSON.parse(nativeText),pages=new Map();
    try {
        for(const p of rig.atlas.pages) {
            const response=await fetch('/exports/'+character+'/'+p.file);if(!response.ok)throw Error('Missing PNG');
            const url=URL.createObjectURL(await response.blob()),image=new Image();
            try {image.src=url;await image.decode();if(image.naturalWidth!==p.width||image.naturalHeight!==p.height)throw Error('PNG dimensions');
                const key='bounded-'+character+'-'+p.index+'-'+serial++,texture=game.textures.addImage(key,image);texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
                pages.set(p.index,{key,texture,source:texture.source[0]});
            }finally{URL.revokeObjectURL(url);}
        }
    }catch(error){for(const p of pages.values())if(game.textures.get(p.key)===p.texture)game.textures.remove(p.key);throw error;}
    nativeTexts.set(character,nativeText);const value={rig,pages};assets.set(character,value);return value;
}
// Qualification-only actual GPU readback. No readback cost inside timed profiles.
let gpuAudit=true,label=null;const uploads=new WeakMap(),attribs=new Map();
const bufferData=gl.bufferData.bind(gl);gl.bufferData=(target,data,...rest)=>{const result=bufferData(target,data,...rest);if(gpuAudit&&target===gl.ARRAY_BUFFER&&ArrayBuffer.isView(data)){const buffer=param(gl.ARRAY_BUFFER_BINDING);uploads.set(buffer,new Uint8Array(data.buffer,data.byteOffset,data.byteLength).slice());}return result;};
const bufferSubData=gl.bufferSubData.bind(gl);gl.bufferSubData=(target,offset,data,...rest)=>{const result=bufferSubData(target,offset,data,...rest);if(gpuAudit&&target===gl.ARRAY_BUFFER&&ArrayBuffer.isView(data)){const buffer=param(gl.ARRAY_BUFFER_BINDING),bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);let old=uploads.get(buffer);if(!old||old.length<offset+bytes.length){const next=new Uint8Array(offset+bytes.length);if(old)next.set(old);old=next;}old.set(bytes,offset);uploads.set(buffer,old);}return result;};
const pointer=gl.vertexAttribPointer.bind(gl);gl.vertexAttribPointer=(i,size,type,normalized,stride,offset)=>{attribs.set(i,{size,type,normalized,stride,offset,buffer: param(gl.ARRAY_BUFFER_BINDING)});return pointer(i,size,type,normalized,stride,offset);};
const drawArrays=gl.drawArrays.bind(gl);
gl.drawArrays=(mode,first,count)=>{
    if(label&&gpuAudit) {
        const program=param(gl.CURRENT_PROGRAM),location=gl.getAttribLocation(program,'inPosition'),uvLocation=gl.getAttribLocation(program,'inTexCoord'),a=attribs.get(location),uv=attribs.get(uvLocation);
        if(!a||!uv||a.buffer!==uv.buffer)throw Error('Unknown Phaser vertex layout');
        const size=(first+count)*a.stride,old=param(gl.COPY_READ_BUFFER_BINDING),bytes=new Uint8Array(size);gl.bindBuffer(gl.COPY_READ_BUFFER,a.buffer);gl.getBufferSubData(gl.COPY_READ_BUFFER,0,bytes);gl.bindBuffer(gl.COPY_READ_BUFFER,old);
        const uploaded=uploads.get(a.buffer);if(!uploaded||bytes.some((x,i)=>x!==uploaded[i]))throw Error('Submitted bytes differ from upload');
        const data=new DataView(bytes.buffer),positions=[],uvs=[];
        for(let i=first;i<first+count;i++){positions.push(data.getFloat32(i*a.stride+a.offset,true),data.getFloat32(i*a.stride+a.offset+4,true));uvs.push(data.getFloat32(i*uv.stride+uv.offset,true),data.getFloat32(i*uv.stride+uv.offset+4,true));}
        label.bank.submitted.push({slot:label.slot,mode,first,count,stride:a.stride,positionOffset:a.offset,uvOffset:uv.offset,positions,uvs,uploadedBytesEqual:true,actualGPUReadback:true});
    }
    return drawArrays(mode,first,count);
};
const audit={begin(item){label=item;},end(){label=null;}};
const pose=(root,p)=>root.setPosition(p.x,p.y).setScale(p.scaleX,p.scaleY).setRotation(p.rotation);
async function control(frames) {
    const owned=[],surfaces=[...views.values()].map(v=>[v.surface,v.surface.visible]);surfaces.forEach(([s])=>s.setVisible(false));
    try {
        for(const item of frames) {
            const a=await asset(item.character),parent=scene.make.container({add:false}),root=scene.make.container({add:false}),target=scene.make.renderTexture({width:W,height:H,add:false}).setOrigin(0);
            parent.add(root);pose(parent,item.placement.parent);pose(root,item.placement);
            for(const d of item.reference.draws) {
                const mesh=scene.make.mesh({key:a.pages.get(d.page).key,vertices:[...d.positions],uvs:[...d.uvs],indicies:[...d.indices],add:false});mesh.hideCCW=false;mesh.ignoreDirtyCache=true;mesh.setOrtho(mesh.width,mesh.height);
                for(let j=0;j<mesh.vertices.length;j++){const v=mesh.vertices[j],i=d.indices[j];v.x=d.positions[i*2];v.y=-d.positions[i*2+1];v.setUVs(d.uvs[i*2],d.uvs[i*2+1]);}
                for(const face of mesh.faces)face.transformCoordinatesLocal(mesh.projectionMatrix,mesh.width,mesh.height,0);
                applyDarkTint(scene,mesh,d.color,[0,0,0,0],d.region,a.rig.atlas.pages[d.page]);root.add(mesh);
            }
            target.clear();target.draw(parent);const surface=scene.add.image(0,0,target.texture).setOrigin(0);owned.push({parent,target,surface});
        }
        draw();return encode(read());
    }finally{owned.forEach(o=>{o.surface.destroy();o.parent.destroy(true);o.target.destroy();});surfaces.forEach(([s,visible])=>s.setVisible(visible));draw();}
}
const debug=gl.getExtension('WEBGL_debug_renderer_info'),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2'),lose=gl.getExtension('WEBGL_lose_context');
globalThis.C7C1={
    async create({character,binding,placement,module}) {
        const a=await asset(character),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nativeTexts.get(character))))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==binding.nativeSHA256)throw Error('Native byte binding');
        const Class=module?(await import(module)).BoundedPhaserView:BoundedPhaserView,id='view-'+serial++,view=new Class({native:a.rig,pages:a.pages,binding,scene,width:W,height:H,audit});views.set(id,view);placements.set(id,structuredClone(placement));bindings.set(id,{binding,character});return id;
    },
    present({id,snapshot,placement}){const v=views.get(id);if(!v)throw Error('Unknown view');const p=placement??placements.get(id),result=v.present(snapshot,p);if(placement)placements.set(id,structuredClone(p));draw();return result;},
    inspect(id){const v=views.get(id);return{view:v.inspect(),buffers:v.readBuffers(),resources:v.resources(),placement:structuredClone(placements.get(id))};},
    capture(){draw();return encode(read());},control,resources,
    background(value){opaque=value;const color=opaque?'#28323d':'rgba(0,0,0,0)';scene.cameras.main.setBackgroundColor(color);draw();},
    identity(){return{phaser:Phaser.VERSION,webGL2:gl instanceof WebGL2RenderingContext,version:param(gl.VERSION),glsl:param(gl.SHADING_LANGUAGE_VERSION),vendor:debug?param(debug.UNMASKED_VENDOR_WEBGL):null,renderer:debug?param(debug.UNMASKED_RENDERER_WEBGL):null,attributes:gl.getContextAttributes(),timerQuery:!!timer,width:W,height:H,contextLost:gl.isContextLost(),filter:'LINEAR; no mipmaps',batch:'Phaser SinglePipeline, triangle expansion, stride28'};},
    shaders(){return[...new Set(shaders)];},surfaceContract(){return{hasNumericFacade:typeof globalThis.N6!=='undefined',viewMethods:Object.getOwnPropertyNames(BoundedPhaserView.prototype),hasConsumer:!!this.consumer};},
    destroy(id){const v=views.get(id),before=v.resources();v.destroy();v.destroy();views.delete(id);placements.delete(id);bindings.delete(id);draw();return{before,after:v.resources(),resources:resources()};},
    camera({scrollX,scrollY}){if(!Number.isFinite(scrollX)||!Number.isFinite(scrollY))throw Error('Invalid camera');scene.cameras.main.setScroll(scrollX,scrollY);draw();return{scrollX:scene.cameras.main.scrollX,scrollY:scene.cameras.main.scrollY,matrix:{...scene.cameras.main.matrix}};},
    useScene(key){if(!game.scene.keys[key]){game.scene.add(key,{create(){}},true);game.scene.update(performance.now(),0);}scene=game.scene.getScene(key);return{active:scene.sys.isActive(),key:scene.sys.settings.key,resources:resources()};},
    stopScene(key){game.scene.stop(key);return resources();},
    sourceFault({id,kind}){const meta=bindings.get(id),a=assets.get(meta.character),native=structuredClone(a.rig),mesh=native.skins[0].attachments.find(e=>e.attachment.type==='mesh').attachment,before=resources();let error;
        if(kind==='influence')mesh.weights[0].bones[0].bone='missing-bone';if(kind==='weight')mesh.weights[0].bones[0].weight=-1;if(kind==='uv')mesh.uvs[0]=2;if(kind==='triangle')mesh.triangles[0]=999999;
        let v;try{v=new BoundedPhaserView({native,pages:a.pages,binding:meta.binding,scene,width:W,height:H,audit});}catch(e){error=String(e);}finally{v?.destroy();}return{error,before,after:resources()};},
    resourceFault({id,kind,snapshot}){const meta=bindings.get(id),a=assets.get(meta.character),item=a.pages.values().next().value,image=item.source.image,view=views.get(id),before=view.inspect(),pixels=encode(read());
        game.textures.remove(item.key);if(kind==='replace')game.textures.addImage(item.key,image);let error;try{view.present(snapshot,placements.get(id));}catch(e){error=String(e);}draw();return{error,before,after:view.inspect(),pixelsBefore:pixels,pixelsAfter:encode(read())};},
    reentrant({id,snapshot}){const view=views.get(id),previous=gl.drawArrays;let refused=null;gl.drawArrays=(...args)=>{try{view.present(snapshot,placements.get(id));}catch(e){refused=String(e);}return previous(...args);};try{view.present(snapshot,placements.get(id));draw();}finally{gl.drawArrays=previous;}return{refused,last:view.inspect().last};},
    async mutation({snapshot}){snapshot.frame.bones[0].world.tx+=500;if(snapshot.frame.records[0])snapshot.frame.records[0].x=Infinity;return{mutated:true};},
    async profile({ids,snapshotById,rounds}){const rows=[];gpuAudit=false;try{for(let i=0;i<rounds;i++){const q=timer?gl.createQuery():null;if(q)gl.beginQuery(timer.TIME_ELAPSED_EXT,q);const start=performance.now(),times=[];for(const id of ids)times.push(views.get(id).present(snapshotById[id],placements.get(id)));draw();const cpuMs=performance.now()-start;if(q)gl.endQuery(timer.TIME_ELAPSED_EXT);let gpuNs=null,disjoint=null;if(q){for(let n=0;n<200&&!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE);n++)await new Promise(r=>setTimeout(r,1));disjoint=param(timer.GPU_DISJOINT_EXT);if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&!disjoint)gpuNs=gl.getQueryParameter(q,gl.QUERY_RESULT);gl.deleteQuery(q);}rows.push({cpuMs,gpuNs,disjoint,times});}return rows;}finally{gpuAudit=true;}},
    async fault({id,kind,snapshot}){const v=views.get(id),before=v.inspect(),pixels=encode(read());let error;const proto=Phaser.Textures.DynamicTexture.prototype,original=proto.draw;if(kind==='submission')proto.draw=function(...args){const result=original.apply(this,args);throw Error('After actual back-target draw');};try{if(kind==='texture'){const a=[...assets.values()][0];game.textures.remove(a.pages.values().next().value.key);}if(kind==='snapshot')snapshot.frame.bones[0].world.tx=Infinity;if(kind==='record')snapshot.frame.records[0].velocityX=NaN;if(kind==='foreign')snapshot.sessionId='foreign';if(kind==='context'){lose.loseContext();await new Promise(r=>setTimeout(r,40));}v.present(snapshot,placements.get(id));}catch(e){error=String(e);}finally{proto.draw=original;}if(kind!=='context')draw();let after;try{after=v.inspect();}catch(e){after={unavailable:String(e)};}return{kind,error,before,after,pixelsBefore:pixels,pixelsAfter:kind==='context'?null:encode(read())};},
    async restore(){if(!lose)return{restored:false};await new Promise(r=>setTimeout(r,1000));lose.restoreContext();for(let i=0;i<200&&(gl.isContextLost()||game.renderer.contextLost);i++)await new Promise(r=>setTimeout(r,10));await new Promise(r=>setTimeout(r,100));return{restored:!gl.isContextLost()&&!game.renderer.contextLost,resources:resources()};},
    async dispose(){for(const id of[...views.keys()])this.destroy(id);for(const a of assets.values())for(const item of a.pages.values())if(game.textures.exists(item.key)&&game.textures.get(item.key)===item.texture)game.textures.remove(item.key);assets.clear();const before=resources();game.destroy(true);game.step(performance.now(),0);return{before,after:resources()};}
};
