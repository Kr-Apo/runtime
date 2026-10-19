// Headless doubles for the public Scene/Mesh API, backed by real Phaser 3.90
// GenerateVerts, Face, Vertex, Frame and matrix implementations. No DOM or GL.
import EventEmitter from 'eventemitter3';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const generate=require('phaser/src/geom/mesh/GenerateVerts.js');
const Frame=require('phaser/src/textures/Frame.js');
const Matrix=require('phaser/src/gameobjects/components/TransformMatrix.js');
const Matrix4=require('phaser/src/math/Matrix4.js');
export class MockPipeline {
 constructor(config={}){this.config=config;this.uniforms={};this.flushes=0;}
 flush(){this.flushes++;return this;}
 set3f(k,...v){this.uniforms[k]=v;return this;}set4f(k,...v){this.uniforms[k]=v;return this;}set2f(k,...v){this.uniforms[k]=v;return this;}set1f(k,v){this.uniforms[k]=v;return this;}
}
class Root extends EventEmitter {
 constructor(scene){super();this.scene=scene;this.list=[];this.depth=0;this.parentContainer=null;this.scrollFactorX=this.scrollFactorY=1;this.scaleX=this.scaleY=1;this.x=this.y=this.rotation=0;this.destroyed=false;}
 add(child){this.list.push(child);child.parentContainer=this;return this;}
 sort(key){this.list.sort((a,b)=>a[key]-b[key]);return this;}
 setPosition(x,y){this.x=x;this.y=y;return this;}setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this;}
 getWorldTransformMatrix(){const local=new Matrix();local.applyITRS(this.x,this.y,this.rotation,this.scaleX,this.scaleY);if(!this.parentContainer)return local;const parent=this.parentContainer.getWorldTransformMatrix();parent.multiply(local);return parent;}
 destroy(children){if(this.destroyed)return;this.emit('destroy');if(children)for(const c of [...this.list])c.destroy();this.list=[];this.destroyed=true;this.scene.liveRoots--;this.removeAllListeners();}
}
class Mesh extends EventEmitter {
 constructor(scene,texture,frame,positions,uvs,indices){super();this.scene=scene;this.width=640;this.height=480;this.dirtyCache=new Array(12).fill(0);this.visible=true;this.alpha=1;this.pipelineData={};this.pipeline=scene.defaultPipeline;this.faces=[];this.vertices=[];this.destroyed=false;this.depth=0;this.projectionMatrix=new Matrix4();this.setTexture(texture,frame);this.addVertices(positions,uvs,indices);}
 setTexture(key,name){this.texture=this.scene.textures.get(key);this.frame=this.texture.get(name);return this;}
 setVisible(v){this.visible=v;return this;}setDepth(v){this.depth=v;return this;}setBlendMode(v){this.blendMode=v;return this;}
 setOrtho(x=this.width,y=this.height){this.projectionMatrix.ortho(-x,x,-y,y,-1000,1000);return this;}
 setPipelineData(k,v){this.pipelineData[k]=v;return this;}setPipeline(p){this.pipeline=p;return this;}resetPipeline(){this.pipeline=this.scene.defaultPipeline;return this;}
 setMask(m){this.mask=m;return this;}clearMask(){this.mask=null;return this;}
 clear(){for(const f of this.faces)f.destroy();this.faces=[];this.vertices=[];this.scene.clears++;return this;}
 addVertices(p,uv,ix,containsZ=false){const g=generate(Array.from(p),Array.from(uv),Array.from(ix),containsZ);this.vertices.push(...g.vertices);this.faces.push(...g.faces);return this;}
 getFaceCount(){return this.faces.length;}
 destroy(){if(this.destroyed)return;this.clear();this.destroyed=true;this.emit('destroy');this.scene.liveMeshes--;if(this.parentContainer)this.parentContainer.list=this.parentContainer.list.filter(v=>v!==this);this.removeAllListeners();}
 projected(){this.vertices.forEach(v=>v.transformCoordinatesLocal(this.projectionMatrix,this.width,this.height,0));return this.vertices.flatMap(v=>[v.vx,v.vy]);}
}
class Graphics {
 constructor(scene){this.scene=scene;this.points=[];this.visible=false;this.destroyed=false;}
 setVisible(v){this.visible=v;return this;}clear(){this.points=[];return this;}setScrollFactor(x,y){this.scrollFactorX=x;this.scrollFactorY=y;return this;}
 fillStyle(){return this;}beginPath(){return this;}moveTo(x,y){this.points.push(x,y);return this;}lineTo(x,y){this.points.push(x,y);return this;}closePath(){return this;}fillPath(){return this;}
 createGeometryMask(){const m={geometryMask:this,destroyed:false,destroy(){if(this.destroyed)return;this.destroyed=true;this.geometryMask.scene.liveMasks--;}};this.scene.liveMasks++;return m;}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.scene.liveGraphics--;}
}
class Texture {
 constructor(key,page){this.key=key;this.source=[{width:page.width,height:page.height,glTexture:{pma:true}}];this.frames=new Map();this.add('__BASE',0,0,0,page.width,page.height);}
 has(name){return this.frames.has(name);}get(name='__BASE'){return this.frames.get(name??'__BASE')??this.frames.get('__BASE');}
 add(name,source,x,y,w,h){if(this.frames.has(name))return null;const frame=new Frame(this,name,source,x,y,w,h);this.frames.set(name,frame);return frame;}
 remove(name){return this.frames.delete(name);}
}
export function mockScene(rig){
 const scene={liveMeshes:0,liveRoots:0,liveMasks:0,liveGraphics:0,clears:0,events:new EventEmitter(),textures:{data:new Map(),exists(key){return this.data.has(key);},get(key){return this.data.get(key);},getFrame(key,name){return this.get(key)?.get(name);}}};
 const pipes=new Map();scene.defaultPipeline=new MockPipeline();pipes.set('SinglePipeline',scene.defaultPipeline);
 scene.sys={game:{renderer:{gl:{},width:640,height:480,pipelines:{get:n=>pipes.get(n),has:n=>pipes.has(n),add(n,p){pipes.set(n,p);return p;}}}},renderer:{width:640,height:480}};
 scene.pipelineCount=()=>pipes.size;
 scene.add={container(){scene.liveRoots++;return new Root(scene);},mesh(_x,_y,key,frame,p,uv,ix){scene.liveMeshes++;return new Mesh(scene,key,frame,p,uv,ix);}};
 scene.make={graphics(){scene.liveGraphics++;return new Graphics(scene);}};
 for(const page of rig.atlas.pages)scene.textures.data.set(`page-${page.index}`,new Texture(`page-${page.index}`,page));
 scene.pageTextureKeys=rig.atlas.pages.map(p=>`page-${p.index}`);
 return scene;
}
