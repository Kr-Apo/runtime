import type { ClippingAttachment } from '@ankhimate/runtime';
import type { MeshDraw } from './mesh.js';
import { finite, requireThat } from './validate.js';

type Point = readonly [number, number];
type Vertex = readonly [number, number, number, number];
const cross = (a: readonly number[], b: readonly number[], c: readonly number[]) => (b[0]!-a[0]!)*(c[1]!-a[1]!)-(b[1]!-a[1]!)*(c[0]!-a[0]!);
const area = (p: readonly Point[]) => p.reduce((sum,a,i) => { const b=p[(i+1)%p.length]!; return sum+a[0]*b[1]-b[0]*a[1]; },0);
const onSegment = (a: Point,b: Point,p: Point) => cross(a,b,p)===0 && p[0]>=Math.min(a[0],b[0]) && p[0]<=Math.max(a[0],b[0]) && p[1]>=Math.min(a[1],b[1]) && p[1]<=Math.max(a[1],b[1]);
function intersects(a: Point,b: Point,c: Point,d: Point): boolean {
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  return ((x<0&&y>0||x>0&&y<0)&&(z<0&&w>0||z>0&&w<0)) || onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}

/** Native simple perimeter only. Invalid masks fail before any visible mutation. */
export function validateClipping(a: ClippingAttachment, name: string, slots: Set<string>): void {
  requireThat(Object.keys(a).every(k => ['type','vertices','vertex_count','end_slot'].includes(k)), `${name}: unsupported clipping fields (no holes, nesting, weights or FFD)`);
  requireThat(Number.isInteger(a.vertex_count) && a.vertex_count>=3 && Array.isArray(a.vertices) && a.vertices.length===a.vertex_count*2, `${name}: invalid clipping dimensions`);
  finite(a.vertices, `${name}: clipping vertices`);
  requireThat(a.end_slot===null || typeof a.end_slot==='string' && slots.has(a.end_slot), `${name}: unresolved clipping end slot`);
  polygonPieces(points(a.vertices), name);
}
export function points(flat: ArrayLike<number>): Point[] { return Array.from({length:flat.length/2},(_,i) => [flat[i*2]!,flat[i*2+1]!] as const); }

/** Ear clipping follows Rust core::clipping, with strict malformed-input refusal. */
export function polygonPieces(p: readonly Point[], label='Clipping'): number[][] {
  requireThat(p.length>=3 && p.every(v=>v.every(Number.isFinite)) && Number.isFinite(area(p)) && area(p)!==0, `${label}: degenerate clipping polygon`);
  const seen=new Set<string>();
  for(let i=0;i<p.length;i++) {
    const a=p[i]!,b=p[(i+1)%p.length]!,c=p[(i+2)%p.length]!,key=`${a[0]},${a[1]}`;
    requireThat(!seen.has(key) && cross(a,b,c)!==0, `${label}: repeated/collinear clipping points`); seen.add(key);
    for(let j=i+1;j<p.length;j++) if(j!==i+1 && !(i===0&&j===p.length-1))
      requireThat(!intersects(a,b,p[j]!,p[(j+1)%p.length]!), `${label}: non-simple clipping polygon`);
  }
  const remaining=p.map((_,i)=>i);if(area(p)<0)remaining.reverse();const pieces:number[][]=[];
  while(remaining.length>3) {
    let removed=false;
    for(let i=0;i<remaining.length;i++) {
      const a=remaining[(i+remaining.length-1)%remaining.length]!,b=remaining[i]!,c=remaining[(i+1)%remaining.length]!;
      if(cross(p[a]!,p[b]!,p[c]!)<=0)continue;
      if(remaining.some(v=>v!==a&&v!==b&&v!==c&&cross(p[a]!,p[b]!,p[v]!)>=0&&cross(p[b]!,p[c]!,p[v]!)>=0&&cross(p[c]!,p[a]!,p[v]!)>=0))continue;
      pieces.push([a,b,c]);remaining.splice(i,1);removed=true;break;
    }
    requireThat(removed, `${label}: cannot triangulate clipping polygon`);
  }
  pieces.push(remaining);return pieces;
}

/** Geometry-only mask: no stencil, scissor, private textures or extra draw passes. */
export function clipDraw(draw: MeshDraw, polygon: readonly Point[], pieces: readonly number[][]): MeshDraw {
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  const vertex=(i:number):Vertex=>[draw.positions[2*i]!,draw.positions[2*i+1]!,draw.uvs[2*i]!,draw.uvs[2*i+1]!];
  for(let t=0;t<draw.indices.length;t+=3)for(const piece of pieces) {
    const clip=piece.map(i=>polygon[i]!);if(cross(clip[0]!,clip[1]!,clip[2]!)<0)[clip[1],clip[2]]=[clip[2]!,clip[1]!];
    let ring:Vertex[]=[vertex(draw.indices[t]!),vertex(draw.indices[t+1]!),vertex(draw.indices[t+2]!)];
    for(let e=0;e<3&&ring.length;e++) {
      const a=clip[e]!,b=clip[(e+1)%3]!,input=ring;ring=[];
      for(let i=0;i<input.length;i++) {
        const current=input[i]!,previous=input[(i+input.length-1)%input.length]!,ci=cross(a,b,current)>=0,pi=cross(a,b,previous)>=0;
        if(ci!==pi) {
          const denominator=(b[0]-a[0])*(current[1]-previous[1])-(b[1]-a[1])*(current[0]-previous[0]);
          // Same parallel-segment guard as Rust core::clipping, not a raster tolerance.
          const f=Math.abs(denominator)<1e-9?1:Math.max(0,Math.min(1,((b[0]-a[0])*(a[1]-previous[1])-(b[1]-a[1])*(a[0]-previous[0]))/denominator));
          ring.push(previous.map((v,k)=>v+(current[k]!-v)*f) as unknown as Vertex);
        }
        if(ci)ring.push(current);
      }
    }
    if(ring.length<3)continue;
    const base=positions.length/2;
    for(const v of ring){positions.push(v[0],v[1]);uvs.push(v[2],v[3]);}
    for(let i=1;i<ring.length-1;i++)indices.push(base,base+i,base+i+1);
  }
  finite(positions,'Clipped positions');finite(uvs,'Clipped UVs');
  return {positions:new Float32Array(positions),uvs:new Float32Array(uvs),indices:new Uint32Array(indices)};
}
