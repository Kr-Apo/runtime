import { clipDraw as draw, polygonPieces as pieces, validateClipping as validate } from '@ankhimate/runtime/render';
import type { ClippingAttachment } from '@ankhimate/runtime';
import type { MeshDraw } from './mesh.js';
import { requireThat } from './validate.js';
export { points } from '@ankhimate/runtime/render';
type Point=readonly [number,number];
export const validateClipping=(a:ClippingAttachment,name:string,slots:Set<string>):void=>validate(a,name,slots,requireThat);
export const polygonPieces=(p:readonly Point[],label='Clipping'):number[][]=>pieces(p,label,requireThat);
export const clipDraw=(d:MeshDraw,p:readonly Point[],ix:readonly number[][]):MeshDraw=>draw(d,p,ix,requireThat);
