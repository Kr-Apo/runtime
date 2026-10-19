import { attachmentWorldVertices } from '../index.js';
import type { AtlasPage, AtlasRegion, MeshAttachment, RigPose, RuntimeRigData } from '../index.js';
import { requireThat } from './checks.js';
import { trimStart, trimEnd } from './trim.js';

export interface MeshDraw { positions: Float32Array; uvs: Float32Array; indices: Uint32Array; }

/** Adapt evaluated FFD into the existing core skinning API, never sample keys here. */
export class MeshBinding {
  private readonly local: MeshAttachment;
  private readonly boundRig: RuntimeRigData;
  private readonly offsets: Array<Array<readonly [number, number, number, number]>>;

  constructor(rig: RuntimeRigData, private readonly slot: string, private readonly name: string,
    private readonly source: MeshAttachment, setup: RigPose, private readonly deformKey = `${slot}\0${name}`) {
    this.local = { ...source, vertices: [...source.vertices], weights: source.weights.map(w => ({ count: w.count, bones: w.bones.map(b => ({ ...b })) })) };
    // A private one-attachment view for the public core geometry API. Source data stays untouched.
    this.boundRig = { ...rig, defaultSkin: '__mesh', skins: [{ name: '__mesh', bones: [], constraints: [], attachments: [{ slot, name, attachment: this.local }] }] };
    const host = setup.bones.find(b => b.name === rig.slots.find(s => s.name === slot)!.bone)!.world;
    this.offsets = source.weights.map(w => w.bones.map(b => {
      const bone = setup.bones.find(p => p.name === b.bone)!.world;
      const det = bone.a * bone.d - bone.b * bone.c;
      requireThat(Math.abs(det) >= 1e-12, `${slot}/${name}: singular influence setup ${b.bone}`);
      // Inverse influence bind × setup host, for vectors only (no translation).
      return [(bone.d * host.a - bone.c * host.b) / det, (bone.a * host.b - bone.b * host.a) / det,
        (bone.d * host.c - bone.c * host.d) / det, (bone.a * host.d - bone.b * host.c) / det] as const;
    }));
  }

  positions(pose: RigPose): Float32Array {
    const deform = pose.deforms[this.deformKey];
    let cursor = 0;
    for (let vertex = 0; vertex < this.source.vertex_count; vertex++) {
      // Weighted FFD is packed per influence. A rigid vertex in a partially
      // weighted mesh owns no packed offset; it stays in its host-bone frame.
      for (const axis of [0, 1]) this.local.vertices[vertex * 2 + axis] = this.source.vertices[vertex * 2 + axis]!
        + (!this.source.weighted ? deform?.[vertex * 2 + axis] ?? 0 : 0);
      const weights = this.local.weights[vertex]?.bones ?? [];
      for (let influence = 0; influence < weights.length; influence++) {
        const base = this.source.weights[vertex]!.bones[influence]!, out = weights[influence]!;
        const [a,b,c,d] = this.offsets[vertex]![influence]!;
        const x = deform?.[cursor * 2] ?? 0, y = deform?.[cursor * 2 + 1] ?? 0;
        out.x = base.x + a * x + c * y; out.y = base.y + b * x + d * y; cursor++;
      }
    }
    const world = attachmentWorldVertices(this.boundRig, pose, '__mesh', this.slot, this.name);
    return Float32Array.from(world, (v, i) => i % 2 ? -v : v);
  }
}

interface CropVertex { uv: readonly [number, number]; weights: number[]; }

/** Static bilinear coverage crop inside each author triangle. Interpolate existing world vertices. */
export class MeshAtlas {
  private readonly vertices: CropVertex[] = [];
  readonly indices: Uint32Array;
  readonly uvs: Float32Array;
  private readonly full: boolean;

  constructor(mesh: MeshAttachment, r: AtlasRegion, page: AtlasPage) {
    this.full = r.offset_x === 0 && r.offset_y === 0 && r.width === r.original_width && r.height === r.original_height;
    const source = Array.from({ length: mesh.vertex_count }, (_, i): CropVertex => ({ uv: [mesh.uvs[i*2]!,mesh.uvs[i*2+1]!], weights: [i,1] }));
    const indices: number[] = [];
    if (this.full) { this.vertices = source; for (const i of mesh.triangles) indices.push(i); }
    else for (let t = 0; t < mesh.triangles.length; t += 3) {
      let polygon = mesh.triangles.slice(t,t+3).map(i => source[i]!);
      for (const [axis, boundary, sign] of [[0,trimStart(r.offset_x,r.original_width),1],[0,trimEnd(r.offset_x,r.width,r.original_width),-1],
        [1,trimStart(r.offset_y,r.original_height),1],[1,trimEnd(r.offset_y,r.height,r.original_height),-1]] as const) {
        const clipped: CropVertex[] = [];
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i]!, b = polygon[(i+1)%polygon.length]!;
          const insideA = (a.uv[axis]-boundary)*sign >= 0, insideB = (b.uv[axis]-boundary)*sign >= 0;
          if (insideA) clipped.push(a);
          if (insideA !== insideB) {
            const fraction = (boundary-a.uv[axis])/(b.uv[axis]-a.uv[axis]);
            const weights = new Map<number,number>();
            for (const [node, alpha] of [[a,1-fraction],[b,fraction]] as const) for (let n=0;n<node.weights.length;n+=2) {
              const index=node.weights[n]!; weights.set(index,(weights.get(index)??0)+node.weights[n+1]!*alpha);
            }
            clipped.push({ uv: [a.uv[0]+(b.uv[0]-a.uv[0])*fraction,a.uv[1]+(b.uv[1]-a.uv[1])*fraction], weights: [...weights].flat() });
          }
        }
        polygon = clipped;
      }
      const start = this.vertices.length; this.vertices.push(...polygon);
      for (let i=1;i<polygon.length-1;i++) indices.push(start,start+i,start+i+1);
    }
    this.indices = Uint32Array.from(indices);
    // Match CPU source texel centres after barycentric coverage clipping.
    // Native indices/UVs/vertices are untouched; only this derived draw grows.
    this.uvs = Float32Array.from(this.vertices.flatMap(v => [(r.x+0.5+v.uv[0]*(r.original_width-1)-r.offset_x)/page.width,
      (r.y+0.5+v.uv[1]*(r.original_height-1)-r.offset_y)/page.height]));
  }

  draw(source: Float32Array): MeshDraw | undefined {
    if (!this.indices.length) return undefined;
    const positions = this.full ? source : Float32Array.from(this.vertices.flatMap(v => {
      let x=0,y=0; for(let i=0;i<v.weights.length;i+=2){const index=v.weights[i]!*2,weight=v.weights[i+1]!;x+=source[index]!*weight;y+=source[index+1]!*weight;}return [x,y];
    }));
    return { positions, uvs: this.uvs, indices: this.indices };
  }
}
