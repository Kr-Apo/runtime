import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Texture, TextureSource } from 'pixi.js';
import { evaluate } from '@ankhimate/runtime';
import { PixiRigAsset, PixiRigError } from '../dist/index.js';
import { regionQuad } from '../dist/region.js';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}/skeleton.json`, import.meta.url), 'utf8'));

test('b.1 renders an authentic native v2 using the existing core', async () => {
  const { PixiRigAsset } = await import('../dist/index.js');
  assert.equal(typeof PixiRigAsset.from, 'function');
  assert.equal(fixture('tagged').format_version, 2);
});

const pagesFor = rig => new Map(rig.atlas.pages.map(p => [p.index, new Texture({ source: new TextureSource({ width: p.width, height: p.height, alphaMode: 'premultiplied-alpha' }) })]));
const release = pages => { for (const t of pages.values()) t.destroy(true); };
const assetFor = (rig, run) => {
  const pages = pagesFor(rig);
  const asset = PixiRigAsset.from(rig, pages);
  try { run(asset, pages); } finally { asset.destroy(); release(pages); }
};
const near = (actual, expected, eps = .01) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((v,i) => assert.ok(Math.abs(v-expected[i]) <= eps, `${i}: ${v} vs ${expected[i]}`));
};

test('real native poses and region vertices match independent Rust oracles at four times', () => {
  const raw = fixture('tagged');
  const before = JSON.stringify(raw);
  const ref = JSON.parse(readFileSync(new URL('./fixtures/tagged/cpu-reference.json', import.meta.url)));
  assetFor(raw, asset => {
    const instance = asset.createInstance();
    try {
      for (const sample of ref.samples) {
        const pose = instance.setTime(ref.animation, sample.time);
        for (const b of sample.bones) near(Object.values(pose.bones.find(v=>v.name===b.name).world), Object.values(b.world));
        for (const slot of sample.slots) {
          const mesh = instance.root.children.find(c=>c.label===slot.name);
          const expected = slot.positions.map((v,i)=>i%2 ? -v : v);
          near(Array.from(mesh.geometry.positions), expected);
          assert.equal(pose.slots.find(s=>s.name===slot.name).color[3], slot.color[3]);
        }
      }
    } finally { instance.destroy(); }
  });
  assert.equal(JSON.stringify(raw), before);
});

test('two instances, times and returned poses never mutate each other or the source rig', () => {
  const raw = fixture('tagged'), before = JSON.stringify(raw);
  assetFor(raw, (asset,pages) => {
    const a = asset.createInstance(), b = asset.createInstance();
    try {
      a.setTime('animation_1', .25); b.setTime('animation_1', .75);
      assert.notEqual(a.root.children[0].geometry, b.root.children[0].geometry);
      assert.equal(a.root.children[0].texture, b.root.children[0].texture);
      const beforeB = Array.from(b.root.children[0].geometry.positions);
      const returned = a.setTime('animation_1', .5); returned.bones[0].world.tx = 9000;
      assert.deepEqual(Array.from(b.root.children[0].geometry.positions), beforeB);
      assert.throws(()=>asset.destroy(), /instances/);
      a.destroy(); assert.equal([...pages.values()][0].destroyed, false);
      b.setTime('animation_1', .25);
    } finally { a.destroy(); b.destroy(); }
  });
  assert.equal(JSON.stringify(raw), before);
});

test('buffers are reused for repeated updates and explicitly destroyed without borrowed textures', () => {
  assetFor(fixture('tagged'), (asset,pages) => {
    const instance = asset.createInstance();
    const meshes = [...instance.root.children];
    const geometries = meshes.map(m=>m.geometry);
    const buffers = geometries.flatMap(g=>g.buffers);
    for (let i=0;i<200;i++) instance.setTime('animation_1', (i%4)/4);
    assert.equal(instance.root.children.length, meshes.length);
    geometries.forEach((g,i)=>assert.equal(meshes[i].geometry,g));
    instance.root.destroy(true); // also safe through public Container lifecycle
    instance.destroy();
    assert.ok(meshes.every(m=>m.destroyed));
    assert.ok(buffers.every(b=>b.destroyed));
    assert.ok([...pages.values()].every(t=>!t.destroyed && !t.source.destroyed));
    assert.throws(()=>instance.setTime('animation_1',0), /destroyed/);
  });
});

test('draw order, visibility and null attachment follow a provided core pose', () => {
  const raw = fixture('tagged');
  assetFor(raw, asset => {
    const instance=asset.createInstance();
    try {
      const pose=evaluate(raw); pose.drawOrder.reverse();
      instance.setPose(pose);
      assert.deepEqual(instance.root.children.map(c=>c.label), pose.drawOrder.filter(n=>pose.slots.find(s=>s.name===n).attachment));
      const first = pose.slots.find(s=>s.attachment); first.visible=false;
      instance.setPose(pose); assert.equal(instance.root.children.find(c=>c.label===first.name).visible,false);
      first.visible=true; first.attachment=null; instance.setPose(pose);
      assert.equal(instance.root.children.find(c=>c.label===first.name).visible,false);
    } finally { instance.destroy(); }
  });
});

test('invalid pose and clip time leave the complete displayed state unchanged', () => {
  const raw = fixture('tagged');
  assetFor(raw, asset => {
    const instance=asset.createInstance();
    const state = () => instance.root.children.map(m=>({label:m.label,visible:m.visible,positions:Array.from(m.geometry.positions),uvs:Array.from(m.geometry.uvs)}));
    try {
      const before = state();
      for (const corrupt of [p=>p.bones[0].world.tx=NaN,p=>p.drawOrder.push(p.drawOrder[0]),p=>p.slots.find(s=>s.attachment).attachment='missing',p=>p.deforms={bad:[1,2]},p=>p.slots[0].dark_color=[0,0,0,2]]) {
        const pose=evaluate(raw); corrupt(pose);
        assert.throws(()=>instance.setPose(pose), PixiRigError);
        assert.deepEqual(state(),before);
      }
      for (const t of [NaN,Infinity,-1,999]) assert.throws(()=>instance.setTime('animation_1',t),PixiRigError);
      assert.throws(()=>instance.setTime('missing',0),/Unknown clip/);
      assert.deepEqual(state(),before);
    } finally { instance.destroy(); }
  });
});

test('native multipage regions match their default Rust reference without patching JSON', () => {
  const raw=fixture('multipage');
  const ref=JSON.parse(readFileSync(new URL('./fixtures/multipage/reference.json',import.meta.url)));
  assetFor(raw, (asset,pages) => {
    const instance=asset.createInstance();
    try {
      for (const s of ref.samples.filter(s=>s.skin==='default')) {
        instance.setTime('clip',s.time);
        const mesh=instance.root.children.find(c=>c.visible);
        near(Array.from(mesh.geometry.positions),s.positions.map((v,i)=>i%2?-v:v));
        const region=raw.atlas.regions.find(r=>r.name===s.texture);
        assert.equal(mesh.texture,pages.get(region.page));
      }
    } finally { instance.destroy(); }
  });
});

test('the authentic cropped source is present, decoded layout differs from the source size', () => {
  const raw=fixture('trim'), before=JSON.stringify(raw);
  const r=raw.atlas.regions.find(r=>r.name==='coiffe_royale_test');
  assert.deepEqual([r.original_width,r.original_height,r.offset_x,r.offset_y,r.width,r.height], [480,440,12,15,457,406]);
  assetFor(raw, asset=> {
    const instance=asset.createInstance({skin:'royal'});
    instance.setTime('frappe_sol',46/30); instance.destroy();
  });
  assert.equal(JSON.stringify(raw),before);
});

test('hierarchy and shear use core world transforms with a hand-solved affine oracle', () => {
  // Synthetic API-only fixture, not presented as a native exporter output.
  const raw=fixture('multipage');
  raw.bones=[
    {...raw.bones[0],name:'root',parent:-1,x:10,y:20,rotation:90,scaleX:2,scaleY:3,shearX:0,shearY:0},
    {...raw.bones[1],name:'host',parent:0,x:4,y:5,rotation:0,scaleX:1,scaleY:1,shearX:0,shearY:45},
  ];
  raw.animations={};
  raw.slots.forEach(s=>s.bone='host');
  for(const skin of raw.skins) for(const e of skin.attachments) Object.assign(e.attachment,{width:4,height:2,pivot_x:.25,pivot_y:.75,x:1,y:2,rotation:0,scale_x:1,scale_y:1});
  assetFor(raw, asset=>{
    const instance=asset.createInstance();
    try {
      const pose=evaluate(raw);
      near(Object.values(pose.bones[1].world),[0,2,-3/Math.sqrt(2),-Math.sqrt(2),-5,28]);
      near(Array.from(instance.root.children[0].geometry.positions),[-10.30330086,-24.46446609,-6.06066017,-27.29289322,-6.06066017,-35.29289322,-10.30330086,-32.46446609]);
    } finally { instance.destroy(); }
  });
});

test('region local rotation, reflected scale and world axes have independent analytic expectations',()=>{
  const a={x:7,y:-3,rotation:90,scale_x:-1,scale_y:1,width:4,height:2,pivot_x:.25,pivot_y:.75,uv:[0,0,1,1]};
  const r={x:0,y:0,width:4,height:2,offset_x:0,offset_y:0,original_width:4,original_height:2};
  const q=regionQuad(a,r,{width:4,height:2},{a:1,b:0,c:0,d:1,tx:0,ty:0});
  near(Array.from(q.positions),[6.5,2,8.5,2,8.5,6,6.5,6]);
});

test('a UV subrectangle outside the visible crop is transparent rather than stretched',()=>{
  const a={x:0,y:0,rotation:0,scale_x:1,scale_y:1,width:100,height:100,pivot_x:.5,pivot_y:.5,uv:[0,0,.1,.1]};
  const r={x:0,y:0,width:20,height:20,offset_x:40,offset_y:40,original_width:100,original_height:100};
  assert.equal(regionQuad(a,r,{width:32,height:32},{a:1,b:0,c:0,d:1,tx:0,ty:0}),undefined);
});

const unsupported = [
  ['v1',r=>r.format_version=1,/format_version 2/],
  ['invalid mesh',r=>r.skins[0].attachments[0].attachment.type='mesh',/linked meshes|mesh topology/],
  ['clipping',r=>r.skins[0].attachments[0].attachment.type='clipping',/clipping/],
  ['invalid dark tint',r=>r.slots[0].dark_color=[0,0,0,2],/dark tint/],
  ['Additive',r=>r.slots[0].blend='additive',/Normal only/],
  // Reach the adapter capability gate with a valid core Physics reference.
  // Malformed references are rejected earlier by parseRig (T839 core tests).
  ['physics',r=>r.constraints=[{type:'physics',name:'sway',target:r.bones[0].name,bones:[],mix:1,
    physics:{inertia:.5,strength:40,damping:.5,mass:1},
    forces:{wind_x:0,wind_y:0,gravity_x:0,gravity_y:0},channels:{rotate:true,translate:false}}],/Constraints/],
  ['paths',r=>r.constraints=[{type:'path'}],/Constraints/],
  ['FFD',r=>Object.values(r.animations)[0].deform=[{}],/deform/],
  ['invalid events',r=>Object.values(r.animations)[0].events=[{time:NaN,name:'hit'}],/events/],
  ['rotated atlas',r=>r.atlas.regions[0].rotated=true,/rotated atlas/],
  ['invalid crop',r=>r.atlas.regions[0].offset_x=99999,/outside page\/source/],
  ['missing region',r=>r.skins[0].attachments[0].attachment.texture='absent',/missing atlas region/],
  ['nonfinite setup',r=>r.bones[0].rotation=Infinity,/finite/],
];
for (const [name,change,pattern] of unsupported) test(`capability gate refuses ${name} before rendering`,()=>{
  const r=fixture('multipage'); change(r);
  assert.throws(()=>PixiRigAsset.from(r,new Map()),pattern);
});

test('missing or cropped borrowed textures are refused, failed initial pose does not hide its diagnostic',()=>{
  const r=fixture('multipage');
  assert.throws(()=>PixiRigAsset.from(r,new Map()),/Missing\/destroyed atlas page texture/);
  const pages=pagesFor(r);
  try {
    const bad=structuredClone(r); bad.slots[0].attachment='unknown';
    const asset=PixiRigAsset.from(bad,pages);
    assert.throws(()=>asset.createInstance(),/unknown attachment/);
    asset.destroy();
    assert.throws(()=>asset.createInstance(),/destroyed/);
    pages.get(0).frame.width--;
    assert.throws(()=>PixiRigAsset.from(r,pages),/full-page texture/);
  } finally { release(pages); }
});

test('trim uses the original source size rather than stretching the cropped atlas', async () => {
  const { regionQuad } = await import('../dist/region.js');
  // Independent hand-computed crop: source100x80, visible(20,10,30,40).
  // Authored rectangle200x160 with pivot(.25,.75), offset(7,-3).
  const region = { x: 2, y: 4, width: 30, height: 40, offset_x: 20, offset_y: 10, original_width: 100, original_height: 80, rotated: false };
  const attachment = { x: 7, y: -3, rotation: 0, scale_x: 1, scale_y: 1, width: 200, height: 160, pivot_x: .25, pivot_y: .75, uv: [0, 0, 1, 1] };
  const q = regionQuad(attachment, region, { width: 64, height: 64 }, { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
  // Derived support reaches x=[19,50], y=[9,50] in source texels.
  const left=19/99*200-43, right=50/99*200-43;
  const top=9/79*160-37, bottom=50/79*160-37;
  const positions=[left,top,left,bottom,right,bottom,right,top];
  q.positions.forEach((v,i)=>assert.ok(Math.abs(v-positions[i])<=1e-5));
  const expected = [1.5/64,3.5/64,1.5/64,44.5/64,32.5/64,44.5/64,32.5/64,3.5/64];
  Array.from(q.uvs).forEach((v, i) => assert.ok(Math.abs(v - expected[i]) <= 1e-7));
});
