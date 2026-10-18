import assert from 'node:assert/strict';
import test from 'node:test';
import { regionQuad } from '../dist/region.js';
import { MeshAtlas } from '../dist/mesh.js';

const identity = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const page = { width: 64, height: 64 };
const attachment = { x: 0, y: 0, rotation: 0, scale_x: 1, scale_y: 1,
  width: 32, height: 32, pivot_x: .5, pivot_y: .5, uv: [0, 0, 1, 1] };
const region = { x: 7, y: 5, width: 24, height: 24, original_width: 32, original_height: 32, offset_x: 4, offset_y: 4 };
const close = (a, b) => assert.ok(Math.abs(a-b) < 1e-5, `${a} != ${b}`);

// The first nonzero retained texel contributes from one CPU source texel
// before it, up to one texel beyond the last. Source coordinates use W-1.
for (const [name, changes] of [
  ['four sides', {}], ['left', { offset_y: 0, height: 32, width: 28 }],
  ['right', { offset_x: 0, offset_y: 0, width: 28, height: 32 }],
  ['top', { offset_x: 0, width: 32, height: 28 }],
  ['bottom', { offset_x: 0, offset_y: 0, width: 32, height: 28 }],
  ['single retained texel', { width: 1, height: 1 }],
]) test(`bilinear coverage includes transparent fringe: ${name}`, () => {
  const r = { ...region, ...changes }, before = JSON.stringify(r);
  const draw = regionQuad(attachment, r, page, identity);
  const expected = [Math.max(0, (r.offset_x-1)/31), Math.max(0, (r.offset_y-1)/31),
    Math.min(1, (r.offset_x+r.width)/31), Math.min(1, (r.offset_y+r.height)/31)];
  const vertices = [[expected[0],expected[1]], [expected[0],expected[3]], [expected[2],expected[3]], [expected[2],expected[1]]];
  vertices.forEach(([u,v],i) => {
    close(draw.positions[i*2], (u-.5)*32); close(draw.positions[i*2+1], (v-.5)*32);
    close(draw.uvs[i*2], (7.5+u*31-r.offset_x)/64);
    close(draw.uvs[i*2+1], (5.5+v*31-r.offset_y)/64);
  });
  assert.equal(JSON.stringify(r), before);
});

test('fringe coverage stays within the authored source rectangle with pivot, rotation and bone transform', () => {
  const a = { ...attachment, x: 2, y: -3, rotation: 90, scale_x: -2, scale_y: .5, pivot_x: .2, pivot_y: .75, uv: [.1,.1,.7,.7] };
  const world = { a: 0, b: 1, c: -1, d: 0, tx: 10, ty: -4 };
  const q = regionQuad(a, region, page, world), sourceUV = [[.1,.1],[.1,.7],[.7,.7],[.7,.1]];
  sourceUV.forEach(([u,v],i) => {
    const x = ((u-.1)/.6-.2)*32*-2, y = (.25-(v-.1)/.6)*32*.5;
    const lx = -y+2, ly = x-3;
    close(q.positions[2*i], -ly+10); close(q.positions[2*i+1], -(lx-4));
  });
});

test('mesh fringe uses barycentric author geometry, preserves native data and does not widen interior triangles', () => {
  const mesh = { vertex_count: 3, vertices: [0,0,32,0,0,32], uvs: [0,0,1,0,0,1], triangles: [0,1,2] };
  const before = JSON.stringify(mesh), q = new MeshAtlas(mesh, region, page).draw(Float32Array.from(mesh.vertices));
  let min = Infinity;
  for (let i=0;i<q.positions.length;i+=2) {
    const x=q.positions[i], y=q.positions[i+1];
    min=Math.min(min,x,y); assert.ok(x+y <= 32+1e-5);
    close(q.uvs[i], (7.5+x/32*31-4)/64); close(q.uvs[i+1], (5.5+y/32*31-4)/64);
  }
  close(min,3/31*32); assert.equal(JSON.stringify(mesh),before);
  const interior={...mesh,uvs:[.3,.3,.6,.3,.3,.6]};
  assert.deepEqual([...new MeshAtlas(interior,region,page).draw(Float32Array.from(mesh.vertices)).positions],mesh.vertices);
});
