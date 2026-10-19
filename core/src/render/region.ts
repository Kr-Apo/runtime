import type { Affine, AtlasPage, AtlasRegion, RegionAttachment } from '../index.js';
import { trimStart, trimEnd } from './trim.js';

export interface RegionQuad { positions: Float32Array; uvs: Float32Array; }

/** Intersect bilinear trim coverage with the authored source UV rectangle.
 * Atlas offsets are top-left image pixels; the authored rectangle is Y-up.
 * The returned vertices are Y-down, so the owning Container needs no Y flip.
 */
export function regionQuad(
  a: Pick<RegionAttachment, 'x' | 'y' | 'rotation' | 'scale_x' | 'scale_y' | 'width' | 'height' | 'pivot_x' | 'pivot_y' | 'uv'>,
  r: Pick<AtlasRegion, 'x' | 'y' | 'width' | 'height' | 'offset_x' | 'offset_y' | 'original_width' | 'original_height'>,
  page: Pick<AtlasPage, 'width' | 'height'>,
  world: Affine,
): RegionQuad | undefined {
  const [u0, v0, u1, v1] = a.uv as [number, number, number, number];
  const left = Math.max(u0, trimStart(r.offset_x, r.original_width));
  const right = Math.min(u1, trimEnd(r.offset_x, r.width, r.original_width));
  const top = Math.max(v0, trimStart(r.offset_y, r.original_height));
  const bottom = Math.min(v1, trimEnd(r.offset_y, r.height, r.original_height));
  if (left >= right || top >= bottom) return undefined;
  const positions = new Float32Array(8);
  const uvs = new Float32Array(8);
  const angle = a.rotation * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (const [index, u, v] of [[0, left, top], [1, left, bottom], [2, right, bottom], [3, right, top]] as const) {
    const x = ((u - u0) / (u1 - u0) - a.pivot_x) * a.width * a.scale_x;
    const y = (1 - a.pivot_y - (v - v0) / (v1 - v0)) * a.height * a.scale_y;
    const localX = x * cos - y * sin + a.x;
    const localY = x * sin + y * cos + a.y;
    positions[index * 2] = world.a * localX + world.c * localY + world.tx;
    positions[index * 2 + 1] = -(world.b * localX + world.d * localY + world.ty);
    // Rust samples u * (source_extent - 1). GL normalized UVs address texel
    // centres at (pixel + 0.5) / page_extent, also on the transparent fringe.
    uvs[index * 2] = (r.x + 0.5 + u * (r.original_width - 1) - r.offset_x) / page.width;
    uvs[index * 2 + 1] = (r.y + 0.5 + v * (r.original_height - 1) - r.offset_y) / page.height;
  }
  return { positions, uvs };
}
