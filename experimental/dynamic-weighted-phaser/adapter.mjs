import {linkedGeometry} from "@ankhimate/runtime";
import {ClippingFrame} from '../replay-clipping/geometry.mjs';
import {DeformGeometry} from '../weighted-ffd/geometry.mjs';
import{resolve}from'../../scripts/t840c7c2-q1/projection.mjs';
/** Graphics-only Phaser view. Numeric authority belongs exclusively to the N6 host. */
import { weightedPoints, validateSource, validateFrame, finite, requireThat } from '/dynamic-weighted-pixi/geometry.mjs';
import { MeshAtlas } from '/core/render/mesh.js';
import { regionQuad } from '/core/render/region.js';
import { applyDarkTint } from '/phaser/dark-tint.js';
import { replayWebGL2 } from '/phaser/replay-load.js';

const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const pose = (root,p) => { root.setPosition(p.x,p.y); root.setScale(p.scaleX,p.scaleY); root.setRotation(p.rotation); };
let serial = 0;

export class BoundedPhaserView {
    #interruptible=false;#mixing=false;#mixEvents=false;#ffd=false;#linked=false;#clipping=false;#slotMode=false;#deform=null; #accepted=null; #scene; #game; #rig; #binding; #pages; #banks; #front = -1; #last = null;
    #prepared = null; #disposed = false; #busy = false; #atlases = new Map();
    #counts = { meshesCreated:0, meshesDestroyed:0, presentations:0 };
    #shutdown;
    #surfaceSubmitted=[];

    constructor({native,pages,binding,scene,width,height,audit,weightedFfd=false,animatedSlots=false,animationEvents=false,clipping=false,linkedMeshes=false,crossfade=false,interruptible=false,acceptedFrame}) {
        requireThat(typeof interruptible==='boolean'&&(!interruptible||crossfade),'interruptible requires crossfade');requireThat(typeof crossfade==='boolean'&&(!crossfade||!linkedMeshes&&!clipping&&(!weightedFfd||!animatedSlots&&!animationEvents||animatedSlots&&animationEvents)&&(!animationEvents||animatedSlots)),'explicit crossfade-only graphics');this.#mixing=crossfade;this.#mixEvents=animationEvents;this.#interruptible=interruptible;requireThat(typeof linkedMeshes==='boolean'&&(!linkedMeshes||animatedSlots&&!animationEvents&&!clipping),'linked+slots only, optional FFD');this.#linked=linkedMeshes;this.#ffd=weightedFfd;requireThat((!(weightedFfd&&animationEvents)||crossfade&&animatedSlots),'combined events/FFD excluded');requireThat(typeof clipping==='boolean'&&(!clipping||animatedSlots&&!animationEvents),'explicit clipping+slots only');this.#clipping=clipping;this.#slotMode=animatedSlots;replayWebGL2(scene.sys.game);
        this.#scene = scene; this.#game = scene.sys.game;
        this.#rig = freeze(validateSource(structuredClone(native),crossfade?{crossfade:true,...(interruptible?{interruptible:true}:{}),...(animatedSlots?{animatedSlots:true}:{}),...(animationEvents?{animationEvents:true}:{}),...(weightedFfd?{weightedFfd:true}:{})}:linkedMeshes?{linkedMeshes:true,animatedSlots:true,...(weightedFfd?{weightedFfd:true}:{})}:weightedFfd&&animatedSlots?{weightedFfd:true,animatedSlots:true,...(clipping?{clipping:true}:{})}:clipping?{animatedSlots:true,clipping:true}:animatedSlots&&animationEvents?{animatedSlots:true,animationEvents:true}:weightedFfd?{weightedFfd:true}:animatedSlots?{animatedSlots:true}:animationEvents?{animationEvents:true}:undefined));
        if(crossfade||animatedSlots||animationEvents){requireThat(typeof acceptedFrame==='function','slot accepted-frame authority required');this.#accepted=acceptedFrame;}
        if(weightedFfd){requireThat(typeof acceptedFrame==='function','FFD accepted-frame authority required');this.#accepted=acceptedFrame;this.#deform=new DeformGeometry(this.#rig,weightedFfd&&animatedSlots&&!linkedMeshes,clipping,linkedMeshes,crossfade);}
        this.#binding = freeze(structuredClone(binding)); this.#pages = new Map(pages);
        this.#textures();
        this.surface = scene.add.image(0,0,'__WHITE').setOrigin(0).setVisible(false);
        const surfaceRender=this.surface.renderWebGL;
        this.surface.renderWebGL=(renderer,object,camera,parent)=>{renderer.pipelines.flush();this.#surfaceSubmitted.length=0;audit?.begin({slot:'__surface',bank:{submitted:this.#surfaceSubmitted}});try{surfaceRender.call(this.surface,renderer,object,camera,parent);renderer.pipelines.flush();}finally{audit?.end();}};
        this.#banks = [0,1].map(() => {
            const target = scene.make.renderTexture({x:0,y:0,width,height,add:false}).setOrigin(0);
            const parent = scene.make.container({x:0,y:0,add:false});
            const root = scene.make.container({x:0,y:0,add:false}); parent.add(root);
            return { target, parent, root, meshes:new Map(), audit, submitted:[] };
        });
        for(const skin of this.#rig.skins)for (const e of skin.attachments) if (e.attachment.type === 'mesh') {
            const a=this.#linked?linkedGeometry(this.#rig,skin.name,e).attachment:e.attachment, region=this.#rig.atlas.regions.find(r=>r.name===a.texture);
            this.#atlases.set(skin.name+'\0'+e.slot+'\0'+e.name,new MeshAtlas(a,region,this.#rig.atlas.pages[region.page]));
        }
        this.#shutdown=()=>this.destroy();
        scene.events.once('shutdown',this.#shutdown); scene.events.once('destroy',this.#shutdown);
    }
    #ready() {
        requireThat(!this.#disposed && this.#scene.sys.isActive(),'destroyed/inactive Scene or view');
        requireThat(!this.#busy,'reentrant presentation'); replayWebGL2(this.#game);
    }
    #textures() {
        const manager=this.#game.textures;
        for (const p of this.#rig.atlas.pages) {
            const item=this.#pages.get(p.index), t=item?.texture, source=t?.source?.[0];
            requireThat(item && manager.exists(item.key) && manager.get(item.key)===t && source===item.source && source.width===p.width && source.height===p.height && source.glTexture?.pma,'missing/replaced/destroyed atlas page '+p.index);
        }
    }
    #prepare(snapshot) {
        if(this.#accepted)this.#accepted(snapshot.frame);
        const validationStart=performance.now();const f=validateFrame(snapshot,this.#binding,this.#rig,this.#mixing?{crossfade:true,...(this.#interruptible?{interruptible:true}:{}),...(this.#slotMode?{animatedSlots:true}:{}),...(this.#mixEvents?{animationEvents:true}:{}),...(this.#ffd?{weightedFfd:true}:{})}:this.#slotMode?{animatedSlots:true,clipping:this.#clipping,linkedMeshes:this.#linked,weightedFfd:this.#ffd}:undefined);
        requireThat((this.#mixing?f.mixing?.activeClip===f.clip&&Object.hasOwn(this.#rig.animations,f.clip):f.clip===this.#binding.clip)&&snapshot.history===this.#binding.history,'clip/history binding');
        if(this.#deform)this.#deform.validate(f);const clipping=this.#clipping?new ClippingFrame():null;const timings={selectionValidationMs:performance.now()-validationStart,attachmentResolutionMs:0,weightedCalcMs:0,unweightedCalcMs:0,regionCalcMs:0,atlasProjectionMs:0}, draws=[];
        for(const name of (this.#slotMode?f.slotState.drawOrder:this.#rig.drawOrder)) {
            const resolveStart=performance.now(),base=this.#rig.slots.find(s=>s.name===name),state=this.#slotMode?f.slotState.slots.find(s=>s.name===name):null,slot=state?{...base,attachment:state.attachment}:base;const found=resolve(this.#rig,f.skin,slot),maskState=clipping?.slot(name,found?.entry.attachment,f.bones.find(b=>b.name===slot.bone)?.world);timings.attachmentResolutionMs+=performance.now()-resolveStart;if(maskState?.introduction||state&&!state.visible||!found)continue;
            const e=found.entry,key=found.owner+'\0'+name+'\0'+e.name,a=this.#linked?linkedGeometry(this.#rig,found.owner,e).attachment:e.attachment;
            const region=this.#rig.atlas.regions.find(r=>r.name===a.texture), page=this.#rig.atlas.pages[region.page];
            let draw,raw=null; const start=performance.now();
            if(a.type==='mesh') {
                raw=this.#deform?.owns(name,e.name)?this.#deform.points(name,e.name,f.bones,slot.bone,f):weightedPoints(a,f.bones,slot.bone);
                timings[a.weighted?'weightedCalcMs':'unweightedCalcMs']+=performance.now()-start;
                const t=performance.now(); draw=this.#atlases.get(key).draw(Float32Array.from(raw.world,(v,i)=>i%2?-v:v)); timings.atlasProjectionMs+=performance.now()-t;
            } else {
                const q=regionQuad(a,region,page,f.bones.find(b=>b.name===slot.bone).world);
                if(q)draw={...q,indices:new Uint32Array([0,1,2,0,2,3])}; timings.regionCalcMs+=performance.now()-start;
            }
            if(draw&&clipping)draw=clipping.draw(draw,maskState.mask);
            if(draw&&(!clipping||draw.indices.length)) {
                finite([...draw.positions,...draw.uvs],'prepared geometry');
                requireThat(draw.positions.length===draw.uvs.length && draw.indices.length%3===0 && [...draw.indices].every(i=>Number.isInteger(i)&&i>=0&&i<draw.positions.length/2),'prepared topology');
                draws.push({key,owner:found.owner,attachment:e.name,type:a.type,slot:name,page:region.page,texture:a.texture,region,draw,raw,color:state?[...state.color]:[0,2,4,6].map(i=>parseInt(slot.color.slice(i,i+2),16)/255)});
            }
        }
        if(clipping){Object.assign(timings,clipping.timings);Object.defineProperty(draws,'masks',{value:clipping.trace});}Object.defineProperty(draws,'timings',{value:timings}); return draws;
    }
    #fill(bank,draws,placement) {
        finite([placement.x,placement.y,placement.scaleX,placement.scaleY,placement.rotation,...Object.values(placement.parent)],'placement');
        for(const d of draws) { finite([...d.draw.positions,...d.draw.uvs],'buffer before upload'); requireThat([...d.draw.indices].every(i=>Number.isInteger(i)&&i>=0&&i<d.draw.positions.length/2),'buffer indices'); }
        const fillProfile={meshLookupMs:0,meshCreationMs:0,textureUVUpdateMs:0,faceProjectionMs:0};pose(bank.root,placement); pose(bank.parent,placement.parent);
        for(const m of bank.meshes.values())m.setVisible(false);
        draws.forEach((d,index)=>{
            const lookupStart=performance.now();let mesh=bank.meshes.get(d.key);fillProfile.meshLookupMs+=performance.now()-lookupStart; const item=this.#pages.get(d.page);
            if(!mesh) {const creationStart=performance.now();
                mesh=this.#scene.make.mesh({x:0,y:0,key:item.key,vertices:[...d.draw.positions],uvs:[...d.draw.uvs],indicies:[...d.draw.indices],containsZ:false,add:false});
                mesh.hideCCW=false;mesh.ignoreDirtyCache=true;bank.root.add(mesh);bank.meshes.set(d.key,mesh);mesh.name='g2-mutable-'+serial++;this.#counts.meshesCreated++;
                const render=mesh.renderWebGL;
                mesh.renderWebGL=(renderer,object,camera,parent)=>{
                    renderer.pipelines.flush();
                    const label={sessionId:this.#binding.sessionId,instanceId:this.#binding.instanceId,meshIdentity:mesh.name,slot:d.slot,owner:d.owner,attachment:d.attachment,key:d.key,page:d.page,bank,mesh}; bank.audit?.begin(label);
                    try { render.call(mesh,renderer,object,camera,parent); renderer.pipelines.flush(); }
                    finally { bank.audit?.end(label); }
                };fillProfile.meshCreationMs+=performance.now()-creationStart;
            }
            if(this.#clipping&&mesh.vertices.length!==d.draw.indices.length){mesh.clear();mesh.addVertices([...d.draw.positions],[...d.draw.uvs],[...d.draw.indices],false);}
            requireThat(mesh.vertices.length===d.draw.indices.length,'static mesh topology changed');
            const updateStart=performance.now();mesh.setTexture(item.key);mesh.setVisible(true);mesh.setBlendMode(Phaser.BlendModes.NORMAL);mesh.setOrtho(mesh.width,mesh.height);
            applyDarkTint(this.#scene,mesh,d.color,[0,0,0,0],d.region,this.#rig.atlas.pages[d.page]);
            for(let j=0;j<mesh.vertices.length;j++) {
                const v=mesh.vertices[j],i=d.draw.indices[j];v.x=d.draw.positions[i*2];v.y=-d.draw.positions[i*2+1];v.color=0xffffff;v.alpha=1;v.setUVs(d.draw.uvs[i*2],d.draw.uvs[i*2+1]);
            }
            fillProfile.textureUVUpdateMs+=performance.now()-updateStart;const projectionStart=performance.now();for(const face of mesh.faces)face.transformCoordinatesLocal(mesh.projectionMatrix,mesh.width,mesh.height,0);
            fillProfile.faceProjectionMs+=performance.now()-projectionStart;bank.root.moveTo(mesh,index);
        });return fillProfile;
    }
    present(snapshot,placement) {
        this.#ready();this.#busy=true;const start=performance.now();
        try {
            if(this.#last){requireThat(snapshot.cursor>=this.#last.cursor,'stale presentation cursor');if(snapshot.cursor===this.#last.cursor)requireThat(JSON.stringify({...snapshot,preview:undefined},(_,v)=>typeof v==='bigint'?String(v):v)===JSON.stringify({...this.#last,preview:undefined},(_,v)=>typeof v==='bigint'?String(v):v),'changed same-cursor snapshot');}this.#textures();const prepareStart=performance.now(),draws=this.#prepare(structuredClone(snapshot)),preparedMs=performance.now()-prepareStart;
            // G2_TEST_PREPARED_BOUNDARY: explicit test copy only, no native injection option.
            const back=this.#front===0?1:0,bank=this.#banks[back],fillStart=performance.now();const fillProfile=this.#fill(bank,draws,placement);const fillMs=performance.now()-fillStart;
            const gl=this.#game.renderer.gl;requireThat(gl.getError()===gl.NO_ERROR,'preexisting GL error');bank.submitted=[];
            const submitStart=performance.now();bank.target.clear();bank.target.draw(bank.parent);
            requireThat(!gl.isContextLost()&&gl.getError()===gl.NO_ERROR,'GPU preparation failed');const submissionMs=performance.now()-submitStart;
            this.surface.setTexture(bank.target.texture).setVisible(true);this.#front=back;this.#prepared=draws;this.#last=structuredClone(snapshot);this.#counts.presentations++;
            return {...draws.timings,...fillProfile,preparedMs,fillMs,submissionMs,totalMs:performance.now()-start,draws:draws.length,completed:String(snapshot.frame.completed)};
        } finally {this.#busy=false;}
    }
    inspect() {
        this.#ready();return{last:structuredClone(this.#last),front:this.#front,counts:{...this.#counts},...(this.#clipping?{masks:structuredClone(this.#prepared?.masks??[])}:{}),surfaceSubmitted:structuredClone(this.#surfaceSubmitted),draws:(this.#prepared??[]).map(d=>({... (this.#slotMode?{color:[...d.color]}:{}),key:d.key,owner:d.owner,attachment:d.attachment,type:d.type,slot:d.slot,page:d.page,texture:d.texture,positions:[...d.draw.positions],uvs:[...d.draw.uvs],indices:[...d.draw.indices],raw:structuredClone(d.raw)}))};
    }
    readBuffers() {
        this.#ready();requireThat(this.#front>=0,'no presented frame');const bank=this.#banks[this.#front];
        const m=bank.root.getWorldTransformMatrix(),matrix={a:m.a,b:m.b,c:m.c,d:m.d,tx:m.e,ty:m.f};
        return this.#prepared.map(d=>{const mesh=bank.meshes.get(d.key);return{key:d.key,owner:d.owner,attachment:d.attachment,type:d.type,slot:d.slot,pageGLId:bank.audit?.id(this.#pages.get(d.page).source.glTexture.webGLTexture),pageSourceUID:this.#pages.get(d.page).key,positions:[...d.draw.positions],uvs:[...d.draw.uvs],indices:[...d.draw.indices],worldTransform:matrix,
            positionBufferUID:mesh.name||(mesh.name='c7c1-mutable-'+serial++),uvBufferUID:mesh.name+'-uv',indexBufferUID:mesh.name+'-faces',
            expandedVertices:mesh.vertices.map(v=>({x:v.x,y:v.y,vx:v.vx,vy:v.vy,tx:v.tx,ty:v.ty,u:v.u,v:v.v,tu:v.tu,tv:v.tv})),
            submitted:structuredClone(bank.submitted.filter(s=>s.slot===d.slot)),bufferOwnership:'Logical mesh/Face/Vertex identity; actual shared driver batch buffer is separately read in submitted'};});
    }
    resources(){return{disposed:this.#disposed,...this.#counts,meshBanks:this.#banks.map(b=>b.meshes.size),cachedFaces:this.#banks.reduce((n,b)=>n+[...b.meshes.values()].reduce((s,m)=>s+m.faces.length,0),0),cachedVertices:this.#banks.reduce((n,b)=>n+[...b.meshes.values()].reduce((s,m)=>s+m.vertices.length,0),0),borrowedPages:this.#pages.size,targets:this.#disposed?0:2};}
    destroy(){if(this.#disposed)return;requireThat(!this.#busy,'busy destruction');this.#scene.events.off('shutdown',this.#shutdown);this.#scene.events.off('destroy',this.#shutdown);for(const b of this.#banks){for(const m of b.meshes.values()){m.destroy();this.#counts.meshesDestroyed++;}b.meshes.clear();b.parent.destroy(true);b.target.destroy();}this.surface.destroy();this.#prepared=null;this.#last=null;this.#atlases.clear();this.#disposed=true;}
}
