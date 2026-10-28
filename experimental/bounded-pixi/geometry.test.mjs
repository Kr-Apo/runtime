import test from 'node:test';import assert from 'node:assert/strict';
import {weightedPoints,validateSource,validateFrame} from './geometry.mjs';
const bones=[{name:'a',world:{a:1,b:0,c:0,d:1,tx:10,ty:0}},{name:'b',world:{a:0,b:1,c:-1,d:0,tx:0,ty:20}}];
const mesh=rows=>({type:'mesh',weighted:true,vertex_count:rows.length,vertices:rows.flatMap(()=>[3,4]),weights:rows.map(bones=>({count:bones.length,bones}))});
const a={bone:'a',x:2,y:3,weight:1},b={bone:'b',x:2,y:3,weight:3};
test('multi-bone native locals and non-unit totals are normalized at evaluation only',()=>{const m=mesh([[a,b]]),before=structuredClone(m),r=weightedPoints(m,bones,'a');assert.deepEqual(r.world,[.75,17.25]);assert.deepEqual(m,before);assert.equal(r.contributions[0].total,4);});
test('empty and all-zero rows use native host, not world zero',()=>{assert.deepEqual(weightedPoints(mesh([[],[{...a,weight:0}]]),bones,'a').world,[13,4,13,4]);});
test('small positive weights and duplicate / over-four terms are not pruned',()=>{const row=Array.from({length:7},()=>({...a,weight:1e-20}));const out=weightedPoints(mesh([row]),bones,'a').world;assert(Math.abs(out[0]-12)<1e-12&&Math.abs(out[1]-3)<1e-12);});
for(const [label,change]of [['negative',m=>m.weights[0].bones[0].weight=-1],['nonfinite',m=>m.weights[0].bones[0].x=Infinity],['unknown bone',m=>m.weights[0].bones[0].bone='missing'],['row count',m=>m.weights[0].count++],['missing row',m=>m.weights=[]]])test('invalid influence refuses '+label,()=>{const m=mesh([[a]]);change(m);assert.throws(()=>weightedPoints(m,bones,'a'));});
test('invalid world is refused before geometry is returned',()=>{const x=structuredClone(bones);x[0].world.tx=NaN;assert.throws(()=>weightedPoints(mesh([[a]]),x,'a'));});
test('unweighted vertices remain host-local, with one Y conversion outside kernel',()=>{const m={...mesh([[]]),weighted:false,weights:[]};assert.deepEqual(weightedPoints(m,bones,'a').world,[13,4]);});

if(process.argv[2]){
 const {readFileSync}=await import('node:fs'),{join}=await import('node:path');const cfg=JSON.parse(readFileSync(process.argv[2])),rig=JSON.parse(readFileSync(join(cfg.exports,'mixed/skeleton.json')));
 test('real E1 Mixed validates without changing native input',()=>{const before=JSON.stringify(rig);assert.equal(validateSource(rig),rig);assert.equal(JSON.stringify(rig),before);});
 for(const [label,change]of [
  ['v1',r=>r.format_version=1],['skin',r=>r.skins.push(structuredClone(r.skins[0]))],['constraint',r=>r.constraints[0].type='path'],['blend',r=>r.slots[0].blend='screen'],['dark tint',r=>r.slots[0].dark_color='ff0000ff'],['deform',r=>r.animations.march.deform.push({})],['clip events',r=>r.animations.march.events.push({})],['clipping',r=>r.skins[0].attachments[0].attachment.type='clipping'],['linked',r=>r.skins[0].attachments.find(e=>e.attachment.type==='mesh').attachment.linked={skin:'default',slot:'x',attachment:'x'}],['UV',r=>r.skins[0].attachments.find(e=>e.attachment.type==='mesh').attachment.uvs[0]=2],['triangle',r=>r.skins[0].attachments.find(e=>e.attachment.type==='mesh').attachment.triangles[0]=10000],['missing texture',r=>r.skins[0].attachments[0].attachment.texture='unknown'],['atlas bounds',r=>r.atlas.regions[0].x=1e9],['source dimensions',r=>r.skins[0].attachments[0].attachment.source_width=-1]
 ])test('source preflight refuses '+label,()=>{const r=structuredClone(rig);change(r);assert.throws(()=>validateSource(r));});
}
