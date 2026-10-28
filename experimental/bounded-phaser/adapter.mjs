/** Graphics-only Phaser view. Numeric authority belongs exclusively to the N6 host. */
import { weightedPoints, validateSource, validateFrame, finite, requireThat } from '/r2/geometry.mjs';
import { MeshAtlas } from '/core/render/mesh.js';
import { regionQuad } from '/core/render/region.js';
import { applyDarkTint } from '/phaser/dark-tint.js';
import { replayWebGL2 } from '/phaser/replay-load.js';

const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const pose = (root,p) => { root.setPosition(p.x,p.y); root.setScale(p.scaleX,p.scaleY); root.setRotation(p.rotation); };
let serial = 0;

export class BoundedPhaserView {
    #scene; #game; #rig; #binding; #pages; #banks; #front = -1; #last = null;
    #prepared = null; #disposed = false; #busy = false; #atlases = new Map();
    #counts = { meshesCreated:0, meshesDestroyed:0, presentations:0 };
    #shutdown;
    #surfaceSubmitted=[];

    constructor({native,pages,binding,scene,width,height,audit}) {
        replayWebGL2(scene.sys.game);
        this.#scene = scene; this.#game = scene.sys.game;
        this.#rig = freeze(validateSource(structuredClone(native)));
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
        for (const e of this.#rig.skins[0].attachments) if (e.attachment.type === 'mesh') {
            const a=e.attachment, region=this.#rig.atlas.regions.find(r=>r.name===a.texture);
            this.#atlases.set(e.slot+'\0'+e.name,new MeshAtlas(a,region,this.#rig.atlas.pages[region.page]));
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
        const f=validateFrame(snapshot,this.#binding,this.#rig);
        requireThat(f.clip===this.#binding.clip && snapshot.history===this.#binding.history,'clip/history binding');
        const timings={weightedCalcMs:0,unweightedCalcMs:0,regionCalcMs:0,atlasProjectionMs:0}, draws=[];
        for(const name of this.#rig.drawOrder) {
            const slot=this.#rig.slots.find(s=>s.name===name); if(slot.attachment===null)continue;
            const e=this.#rig.skins[0].attachments.find(e=>e.slot===name && e.name===slot.attachment), a=e.attachment;
            const region=this.#rig.atlas.regions.find(r=>r.name===a.texture), page=this.#rig.atlas.pages[region.page];
            let draw,raw=null; const start=performance.now();
            if(a.type==='mesh') {
                raw=weightedPoints(a,f.bones,slot.bone);
                timings[a.weighted?'weightedCalcMs':'unweightedCalcMs']+=performance.now()-start;
                const t=performance.now(); draw=this.#atlases.get(e.slot+'\0'+e.name).draw(Float32Array.from(raw.world,(v,i)=>i%2?-v:v)); timings.atlasProjectionMs+=performance.now()-t;
            } else {
                const q=regionQuad(a,region,page,f.bones.find(b=>b.name===slot.bone).world);
                if(q)draw={...q,indices:new Uint32Array([0,1,2,0,2,3])}; timings.regionCalcMs+=performance.now()-start;
            }
            if(draw) {
                finite([...draw.positions,...draw.uvs],'prepared geometry');
                requireThat(draw.positions.length===draw.uvs.length && draw.indices.length%3===0 && [...draw.indices].every(i=>Number.isInteger(i)&&i>=0&&i<draw.positions.length/2),'prepared topology');
                draws.push({slot:name,page:region.page,texture:a.texture,region,draw,raw,color:[0,2,4,6].map(i=>parseInt(slot.color.slice(i,i+2),16)/255)});
            }
        }
        Object.defineProperty(draws,'timings',{value:timings}); return draws;
    }
    #fill(bank,draws,placement) {
        finite([placement.x,placement.y,placement.scaleX,placement.scaleY,placement.rotation,...Object.values(placement.parent)],'placement');
        for(const d of draws) { finite([...d.draw.positions,...d.draw.uvs],'buffer before upload'); requireThat([...d.draw.indices].every(i=>Number.isInteger(i)&&i>=0&&i<d.draw.positions.length/2),'buffer indices'); }
        pose(bank.root,placement); pose(bank.parent,placement.parent);
        for(const m of bank.meshes.values())m.setVisible(false);
        draws.forEach((d,index)=>{
            let mesh=bank.meshes.get(d.slot); const item=this.#pages.get(d.page);
            if(!mesh) {
                mesh=this.#scene.make.mesh({x:0,y:0,key:item.key,vertices:[...d.draw.positions],uvs:[...d.draw.uvs],indicies:[...d.draw.indices],containsZ:false,add:false});
                mesh.hideCCW=false;mesh.ignoreDirtyCache=true;bank.root.add(mesh);bank.meshes.set(d.slot,mesh);this.#counts.meshesCreated++;
                const render=mesh.renderWebGL;
                mesh.renderWebGL=(renderer,object,camera,parent)=>{
                    renderer.pipelines.flush();
                    const label={slot:d.slot,bank,mesh}; bank.audit?.begin(label);
                    try { render.call(mesh,renderer,object,camera,parent); renderer.pipelines.flush(); }
                    finally { bank.audit?.end(label); }
                };
            }
            requireThat(mesh.vertices.length===d.draw.indices.length,'static mesh topology changed');
            mesh.setTexture(item.key);mesh.setVisible(true);mesh.setBlendMode(Phaser.BlendModes.NORMAL);mesh.setOrtho(mesh.width,mesh.height);
            applyDarkTint(this.#scene,mesh,d.color,[0,0,0,0],d.region,this.#rig.atlas.pages[d.page]);
            for(let j=0;j<mesh.vertices.length;j++) {
                const v=mesh.vertices[j],i=d.draw.indices[j];v.x=d.draw.positions[i*2];v.y=-d.draw.positions[i*2+1];v.color=0xffffff;v.alpha=1;v.setUVs(d.draw.uvs[i*2],d.draw.uvs[i*2+1]);
            }
            for(const face of mesh.faces)face.transformCoordinatesLocal(mesh.projectionMatrix,mesh.width,mesh.height,0);
            bank.root.moveTo(mesh,index);
        });
    }
    present(snapshot,placement) {
        this.#ready();this.#busy=true;const start=performance.now();
        try {
            this.#textures();const prepareStart=performance.now(),draws=this.#prepare(structuredClone(snapshot)),preparedMs=performance.now()-prepareStart;
            // C7C1_TEST_PREPARED_BOUNDARY: explicit test copy only, no native injection option.
            const back=this.#front===0?1:0,bank=this.#banks[back],fillStart=performance.now();this.#fill(bank,draws,placement);const fillMs=performance.now()-fillStart;
            const gl=this.#game.renderer.gl;requireThat(gl.getError()===gl.NO_ERROR,'preexisting GL error');bank.submitted=[];
            const submitStart=performance.now();bank.target.clear();bank.target.draw(bank.parent);
            requireThat(!gl.isContextLost()&&gl.getError()===gl.NO_ERROR,'GPU preparation failed');const submissionMs=performance.now()-submitStart;
            this.surface.setTexture(bank.target.texture).setVisible(true);this.#front=back;this.#prepared=draws;this.#last=structuredClone(snapshot);this.#counts.presentations++;
            return {...draws.timings,preparedMs,fillMs,submissionMs,totalMs:performance.now()-start,draws:draws.length,completed:String(snapshot.frame.completed)};
        } finally {this.#busy=false;}
    }
    inspect() {
        this.#ready();return{last:structuredClone(this.#last),front:this.#front,counts:{...this.#counts},surfaceSubmitted:structuredClone(this.#surfaceSubmitted),draws:(this.#prepared??[]).map(d=>({slot:d.slot,page:d.page,texture:d.texture,positions:[...d.draw.positions],uvs:[...d.draw.uvs],indices:[...d.draw.indices],raw:structuredClone(d.raw)}))};
    }
    readBuffers() {
        this.#ready();requireThat(this.#front>=0,'no presented frame');const bank=this.#banks[this.#front];
        const m=bank.root.getWorldTransformMatrix(),matrix={a:m.a,b:m.b,c:m.c,d:m.d,tx:m.e,ty:m.f};
        return this.#prepared.map(d=>{const mesh=bank.meshes.get(d.slot);return{slot:d.slot,pageSourceUID:this.#pages.get(d.page).key,positions:[...d.draw.positions],uvs:[...d.draw.uvs],indices:[...d.draw.indices],worldTransform:matrix,
            positionBufferUID:mesh.name||(mesh.name='c7c1-mutable-'+serial++),uvBufferUID:mesh.name+'-uv',indexBufferUID:mesh.name+'-faces',
            expandedVertices:mesh.vertices.map(v=>({x:v.x,y:v.y,vx:v.vx,vy:v.vy,tx:v.tx,ty:v.ty,u:v.u,v:v.v,tu:v.tu,tv:v.tv})),
            submitted:structuredClone(bank.submitted.filter(s=>s.slot===d.slot)),bufferOwnership:'Logical mesh/Face/Vertex identity; actual shared driver batch buffer is separately read in submitted'};});
    }
    resources(){return{disposed:this.#disposed,...this.#counts,meshBanks:this.#banks.map(b=>b.meshes.size),borrowedPages:this.#pages.size,targets:this.#disposed?0:2};}
    destroy(){if(this.#disposed)return;requireThat(!this.#busy,'busy destruction');this.#scene.events.off('shutdown',this.#shutdown);this.#scene.events.off('destroy',this.#shutdown);for(const b of this.#banks){for(const m of b.meshes.values()){m.destroy();this.#counts.meshesDestroyed++;}b.meshes.clear();b.parent.destroy(true);b.target.destroy();}this.surface.destroy();this.#prepared=null;this.#last=null;this.#atlases.clear();this.#disposed=true;}
}
