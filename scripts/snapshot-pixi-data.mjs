// CPU-side buffers only. Never creates an Application, renderer, browser or GL context.
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Texture,TextureSource} from 'pixi.js';
import {PixiRigAsset} from '../pixi/dist/index.js';
const base=fileURLToPath(new URL('../pixi/test/fixtures/',import.meta.url));
function* walk(dir){for(const e of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){const p=resolve(dir,e.name);if(e.isDirectory())yield*walk(p);else if(e.name==='skeleton.json')yield p;}}
const results=[];
for(const p of walk(base)){
 const raw=JSON.parse(readFileSync(p,'utf8')),name=relative(base,p).replaceAll('\\','/'),pages=new Map(raw.atlas.pages.map(p=>[p.index,new Texture({source:new TextureSource({width:p.width,height:p.height,alphaMode:'premultiplied-alpha'})})]));let asset;
 try{asset=PixiRigAsset.from(raw,pages);
 for(const skin of raw.skins)for(const [clip,a]of Object.entries(raw.animations)){let i;
  try{i=asset.createInstance({skin:skin.name});for(const t of [...new Set([0,.25,.5,.75,a.duration])].filter(t=>t<=a.duration)){
   try{const pose=i.setTime(clip,t);results.push({name,skin:skin.name,clip,t,pose,views:i.root.children.map(m=>({name:m.label,visible:m.visible,p:[...m.geometry.positions],uv:[...m.geometry.uvs],ix:[...m.geometry.indices],page:[...pages].find(([,t])=>t===m.texture)?.[0],alpha:m.alpha,tint:m.tint})),effects:[...i.tints].map(([slot,e])=>({slot,light:[...e.light],dark:[...e.dark],trim:[...e.trim],pageSize:[...e.pageSize],trimEnabled:e.trimEnabled}))});}
   catch(e){results.push({name,skin:skin.name,clip,t,error:{name:e.name,message:e.message}});}
  }}catch(e){results.push({name,skin:skin.name,clip,error:{name:e.name,message:e.message}});}finally{i?.destroy();}
 }
 }catch(e){results.push({name,error:{name:e.name,message:e.message}});}finally{asset?.destroy();pages.forEach(t=>t.destroy(true));}
}
writeFileSync(process.argv[2]??'test-results/pixi-data.json',JSON.stringify(results));
console.log(`${results.length} deterministic Pixi data snapshots; ${results.filter(r=>r.error).length} explicit refusals; no rendering`);
