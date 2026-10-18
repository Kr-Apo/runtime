import assert from 'node:assert/strict';
import test from 'node:test';
import { regionQuad } from '../dist/region.js';
import { MeshAtlas } from '../dist/mesh.js';

const identity = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const attachment = (uv = [0, 0, 1, 1]) => ({
  x: 0, y: 0, rotation: 0, scale_x: 1, scale_y: 1,
  width: 32, height: 32, pivot_x: .5, pivot_y: .5, uv,
});
const page = { width: 64, height: 64 };
const region = { x: 7, y: 5, width: 32, height: 32, original_width: 32, original_height: 32, offset_x: 0, offset_y: 0 };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-7, `${actual} != ${expected}`);
// Independent CPU source coordinate -> physical atlas texel centre. No adapter helper.
const atlas = (u, extent, origin, offset, size) => (origin + .5 + u * (extent - 1) - offset) / size;

test('region UV endpoints address the first and last CPU texel centres without moving geometry', () => {
  const draw = regionQuad(attachment(), region, page, identity);
  assert.deepEqual([...draw.positions], [-16, -16, -16, 16, 16, 16, 16, -16]);
  [[0, 0], [0, 1], [1, 1], [1, 0]].forEach(([u, v], i) => {
    close(draw.uvs[2*i], atlas(u, 32, 7, 0, 64));
    close(draw.uvs[2*i+1], atlas(v, 32, 5, 0, 64));
  });
});

test('trim filter support maps interpolated UVs to source texel centres', () => {
  const r = { ...region, offset_x: 4, offset_y: 4, width: 24, height: 24 };
  const draw = regionQuad(attachment(), r, page, identity);
  const lo = 3/31, hi = 28/31;
  [[lo, lo], [lo, hi], [hi, hi], [hi, lo]].forEach(([u, v], i) => {
    close(draw.positions[2*i], Math.fround((u-.5)*32));
    close(draw.positions[2*i+1], Math.fround((v-.5)*32));
    close(draw.uvs[2*i], atlas(u, 32, 7, 4, 64));
    close(draw.uvs[2*i+1], atlas(v, 32, 5, 4, 64));
  });
});

test('source UV subrectangles and a different page size preserve the CPU sampling coordinate', () => {
  const draw = regionQuad(attachment([.25, .125, .75, .875]), region, { width: 128, height: 256 }, identity);
  close(draw.uvs[0], atlas(.25, 32, 7, 0, 128));
  close(draw.uvs[1], atlas(.125, 32, 5, 0, 256));
  close(draw.uvs[4], atlas(.75, 32, 7, 0, 128));
  close(draw.uvs[5], atlas(.875, 32, 5, 0, 256));
});

const mesh = {
  vertex_count: 4, vertices: [0, 0, 32, 0, 32, 32, 0, 32],
  uvs: [0, 0, 1, 0, 1, 1, 0, 1], triangles: [0, 1, 2, 0, 2, 3],
};
test('full mesh keeps positions and indices, including intermediate authored UVs', () => {
  const source = { ...mesh, uvs: [0, 0, .5, 0, 1, 1, 0, 1] }, before = JSON.stringify(source);
  const mapping = new MeshAtlas(source, region, page), positions = Float32Array.from(source.vertices), draw = mapping.draw(positions);
  assert.equal(draw.positions, positions);
  assert.deepEqual([...draw.indices], source.triangles);
  for (let i = 0; i < source.vertex_count; i++) {
    close(draw.uvs[2*i], atlas(source.uvs[2*i], 32, 7, 0, 64));
    close(draw.uvs[2*i+1], atlas(source.uvs[2*i+1], 32, 5, 0, 64));
  }
  assert.equal(JSON.stringify(source), before);
});

test('UV crop vertices of a trimmed mesh retain their barycentric geometry', () => {
  const r = { ...region, width: 24, height: 24, offset_x: 4, offset_y: 4 }, before = JSON.stringify(mesh);
  const draw = new MeshAtlas(mesh, r, page).draw(Float32Array.from(mesh.vertices));
  assert.ok(draw.indices.length > 0);
  for (let i = 0; i < draw.positions.length / 2; i++) {
    const x = draw.positions[2*i], y = draw.positions[2*i+1];
    assert.ok(x >= 3/31*32-1e-5 && x <= 28/31*32+1e-5 && y >= 3/31*32-1e-5 && y <= 28/31*32+1e-5);
    close(draw.uvs[2*i], atlas(x / 32, 32, 7, 4, 64));
    close(draw.uvs[2*i+1], atlas(y / 32, 32, 5, 4, 64));
  }
  assert.equal(JSON.stringify(mesh), before);
});

test('one-pixel sources map all UVs to the same texel without a division by zero', () => {
  const r = { ...region, width: 1, height: 1, original_width: 1, original_height: 1 };
  const draws = [regionQuad(attachment(), r, page, identity), new MeshAtlas(mesh, r, page).draw(Float32Array.from(mesh.vertices))];
  for (const draw of draws) for (let i = 0; i < draw.uvs.length / 2; i++) {
    close(draw.uvs[2*i], 7.5 / 64); close(draw.uvs[2*i+1], 5.5 / 64);
  }
});
