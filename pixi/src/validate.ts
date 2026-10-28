import { parseRig } from '@ankhimate/runtime';
import { evaluate } from '@ankhimate/runtime';
import { validateClipping } from './clipping.js';
import type { ClippingAttachment, MeshAttachment, RegionAttachment, RuntimeRigData } from '@ankhimate/runtime';

export class PixiRigError extends Error {
  constructor(message: string) { super(message); this.name = 'PixiRigError'; }
}

export function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PixiRigError(message);
}

export function finite(values: readonly unknown[], label: string): void {
  requireThat(values.every(v => typeof v === 'number' && Number.isFinite(v)), `${label}: expected finite numbers`);
}

/** Adapter capability gate; does not change the shared v1/v2 reader. */
export function regionRig(source: unknown): RuntimeRigData {
  const rig = nativeSource(source);
  requireThat(Array.isArray(rig.constraints) && rig.constraints.length === 0,
    'Constraints are not qualified in Pixi b.1 (including physics and paths)');
  requireThat(Array.isArray(rig.constraintOrder) && rig.constraintOrder.length === 0, 'Unexpected constraint order');
  return graphicsRig(rig);
}

/** Native structural read; renderer and simulation capabilities are separate. */
export function nativeSource(source: unknown): RuntimeRigData {
  let rig: RuntimeRigData;
  try { rig = parseRig(structuredClone(typeof source === 'string' ? JSON.parse(source) : source)); }
  catch (error) { throw new PixiRigError(`Invalid native runtime JSON: ${String(error)}`); }
  requireThat(rig.format_version === 2, 'Pixi b.1 requires native format_version 2; the core v1 reader is unchanged');
  return rig;
}

/** Renderer properties only. Callers must separately validate all solver/clip capabilities. */
export function graphicsRig(rig: RuntimeRigData): RuntimeRigData {
  requireThat(rig.atlas && Array.isArray(rig.atlas.pages) && Array.isArray(rig.atlas.regions), 'Missing embedded atlas');
  requireThat(rig.atlas.pages.length > 0, 'Atlas has no pages');
  const names = new Set<string>();
  for (const [i, page] of rig.atlas.pages.entries()) {
    requireThat(page.index === i, `Atlas page ${i}: index must match its array position`);
    requireThat(typeof page.file === 'string' && page.file.length > 0, `Atlas page ${i}: missing filename`);
    requireThat([page.width, page.height].every(v => Number.isInteger(v) && v > 0), `Atlas page ${i}: invalid dimensions`);
  }
  for (const r of rig.atlas.regions) {
    requireThat(typeof r.name === 'string' && !names.has(r.name), 'Atlas region names must be unique'); names.add(r.name);
    const p = rig.atlas.pages[r.page];
    requireThat(Number.isInteger(r.page) && p, `${r.name}: missing atlas page ${r.page}`);
    requireThat(r.rotated === false, `${r.name}: rotated atlas regions are not qualified in Pixi b.1`);
    requireThat([r.x,r.y,r.offset_x,r.offset_y].every(v => Number.isInteger(v) && v >= 0)
      && [r.width,r.height,r.original_width,r.original_height].every(v => Number.isInteger(v) && v > 0), `${r.name}: invalid atlas rectangle`);
    requireThat(r.x + r.width <= p.width && r.y + r.height <= p.height
      && r.offset_x + r.width <= r.original_width && r.offset_y + r.height <= r.original_height, `${r.name}: atlas rectangle outside page/source`);
  }
  for (const b of rig.bones) {
    finite([b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY,b.length], `Bone ${b.name}`);
    requireThat([b.inheritRotation,b.inheritScale,b.inheritReflect].every(v => typeof v === 'boolean'), `Bone ${b.name}: invalid inheritance flags`);
  }
  const slotNames = new Set(rig.slots.map(s => s.name));
  for (const slot of rig.slots) {
    requireThat(slot.blend === 'normal', `Slot ${slot.name}: blend ${slot.blend} is unsupported; Normal only`);
    if (slot.dark_color !== undefined) tint(slot.dark_color, `Slot ${slot.name}: dark tint`);
  }
  requireThat(Array.isArray(rig.drawOrder) && rig.drawOrder.length === slotNames.size
    && new Set(rig.drawOrder).size === slotNames.size && rig.drawOrder.every(n => slotNames.has(n)), 'Invalid setup draw order');
  requireThat(rig.skins.some(s => s.name === rig.defaultSkin), 'Missing default skin');
  const skinNames = new Set<string>();
  for (const skin of rig.skins) {
    requireThat(typeof skin.name === 'string' && !skinNames.has(skin.name) && Array.isArray(skin.attachments), 'Invalid/duplicate skin'); skinNames.add(skin.name);
    const entries = new Set<string>();
    for (const e of skin.attachments) {
      requireThat(slotNames.has(e.slot) && typeof e.name === 'string', `Skin ${skin.name}: invalid slot/attachment reference`);
      const key = `${e.slot}\0${e.name}`;
      requireThat(!entries.has(key), `Skin ${skin.name}: duplicate attachment ${e.name}`); entries.add(key);
      const a = e.attachment;
      requireThat(a?.type === 'region' || a?.type === 'mesh' || a?.type === 'clipping', `Attachment ${e.name}: ${a?.type ?? 'unknown'} unsupported (no linked meshes)`);
      if (a.type === 'clipping') { validateClipping(a, e.name, slotNames); continue; }
      if (a.type === 'region') validateRegion(a, e.name);
      else validateMesh(a, e.name, new Set(rig.bones.map(b => b.name)));
      const textures = a.sequence ? a.sequence.frames : [a.texture];
      requireThat(textures.length > 0, `${e.name}: empty region sequence`);
      if (a.sequence) {
        finite([a.sequence.fps, a.sequence.setup_index], `${e.name}: sequence`);
        requireThat(a.sequence.fps >= 0 && Number.isInteger(a.sequence.setup_index)
          && a.sequence.setup_index >= 0 && a.sequence.setup_index < textures.length, `${e.name}: invalid sequence setup`);
        requireThat(['hold','once','loop','ping_pong','once_reverse','loop_reverse','ping_pong_reverse'].includes(a.sequence.mode), `${e.name}: unknown sequence mode`);
      }
      for (const texture of [a.texture, ...textures]) {
        const r = rig.atlas.regions.find(r => r.name === texture);
        requireThat(r, `${e.name}: missing atlas region ${texture}`);
        if (a.type === 'region') requireThat(r.original_width === a.source_width && r.original_height === a.source_height, `${e.name}: source dimensions disagree with atlas ${texture}`);
      }
    }
  }
  const sizes = new Map<string, Set<number>>();
  for (const skin of rig.skins) for (const [key, size] of deformSizes(rig, skin.name)) {
    if (!sizes.has(key)) sizes.set(key, new Set());
    sizes.get(key)!.add(size);
  }
  const setup = evaluate(rig);
  for (const skin of rig.skins) for (const e of skin.attachments) if (e.attachment.type === 'mesh') {
    for (const w of e.attachment.weights) for (const b of w.bones) {
      const world = setup.bones.find(p => p.name === b.bone)!.world;
      requireThat(Math.abs(world.a*world.d-world.b*world.c) >= 1e-12, `${e.name}: singular influence setup ${b.bone}`);
    }
  }
  for (const [name, animation] of Object.entries(rig.animations)) {
    for (const channel of ['ik','transform'] as const) {
      requireThat(Array.isArray(animation[channel]) && animation[channel].length === 0,
        `Clip ${name}: ${channel} is outside the Pixi b.1 contract`);
    }
    requireThat(Array.isArray(animation.bones) && Array.isArray(animation.slots) && Array.isArray(animation.drawOrder), `Clip ${name}: invalid timelines`);
    requireThat(Array.isArray(animation.deform), `Clip ${name}: invalid deform timelines`);
    for (const track of animation.deform) {
      const size = sizes.get(`${track.slot}\0${track.attachment}`);
      requireThat(size !== undefined && Array.isArray(track.keys), `Clip ${name}: deform targets missing/non-mesh attachment`);
      let previous = -Infinity;
      for (const key of track.keys) {
        finite([key.time], `Clip ${name}: deform time`);
        requireThat(key.time >= previous, `Clip ${name}: deform times must be sorted`); previous = key.time;
        requireThat(Array.isArray(key.offsets) && size.has(key.offsets.length), `Clip ${name}: deform dimensions must match an authored mesh`);
        finite(key.offsets, `Clip ${name}: deform offsets`);
        if (key.curve !== 'linear' && key.curve !== 'stepped') {
          requireThat(key.curve?.type === 'bezier' && Array.isArray(key.curve.handles) && key.curve.handles.length === 4, `Clip ${name}: invalid deform curve`);
          finite(key.curve.handles, `Clip ${name}: deform handles`);
          requireThat([key.curve.handles[0],key.curve.handles[2]].every(v => v >= 0 && v <= 1), `Clip ${name}: invalid deform Bezier X`);
        }
      }
    }
    requireThat(typeof animation.looping === 'boolean', `Clip ${name}: invalid looping flag`);
    requireThat(Array.isArray(animation.events), `Clip ${name}: invalid events`);
    for (const event of animation.events) {
      requireThat(event && typeof event.name === 'string', `Clip ${name}: events require a name`);
      finite([event.time], `Clip ${name}: events time`);
      requireThat(event.time >= 0 && event.time <= animation.duration, `Clip ${name}: events time outside duration`);
      for (const key of ['int','float','volume','balance'] as const) {
        if (event[key] !== undefined) finite([event[key]], `Clip ${name}: events ${key}`);
      }
      requireThat(event.int === undefined || Number.isInteger(event.int), `Clip ${name}: events int must be integer`);
      requireThat((event.string === undefined || typeof event.string === 'string')
        && (event.audio == null || typeof event.audio === 'string'), `Clip ${name}: invalid events payload`);
    }
  }
  return rig;
}

/** Resolve one appearance with the same default fallback as the core. */
export function skinAttachments(rig: RuntimeRigData, skin: string) {
  requireThat(rig.skins.some(s => s.name === skin), `Unknown skin ${skin}`);
  const entries = new Map<string, { slot: string; name: string; attachment: RegionAttachment | MeshAttachment | ClippingAttachment }>();
  for (const name of [rig.defaultSkin, skin]) for (const entry of rig.skins.find(s => s.name === name)!.attachments) {
    entries.set(`${entry.slot}\0${entry.name}`, { ...entry, attachment: entry.attachment as RegionAttachment | MeshAttachment | ClippingAttachment });
  }
  return entries;
}

export function deformSizes(rig: RuntimeRigData, skin = rig.defaultSkin!): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const [key, e] of skinAttachments(rig, skin)) if (e.attachment.type === 'mesh') {
    const a = e.attachment;
    sizes.set(key, 2 * (a.weighted ? a.weights.reduce((sum,w) => sum+w.bones.length,0) : a.vertex_count));
  }
  return sizes;
}

export function tint(value: unknown, label: string): asserts value is [number,number,number,number] {
  requireThat(Array.isArray(value) && value.length === 4, `${label}: expected RGBA`);
  finite(value, label);
  requireThat(value.every(v => v >= 0 && v <= 1), `${label}: components outside [0,1] are not qualified`);
}

function validateMesh(a: MeshAttachment, name: string, bones: Set<string>): void {
  requireThat(a.linked === null, `${name}: linked meshes are not qualified`);
  requireThat(a.sequence === null, `${name}: mesh image sequences are not qualified in b.3`);
  requireThat(Number.isInteger(a.vertex_count) && a.vertex_count >= 3
    && Array.isArray(a.vertices) && a.vertices.length === a.vertex_count*2
    && Array.isArray(a.uvs) && a.uvs.length === a.vertices.length, `${name}: invalid mesh topology/dimensions`);
  finite(a.vertices, `${name}: mesh vertices`); finite(a.uvs, `${name}: mesh UVs`);
  requireThat(a.uvs.every(v => v >= 0 && v <= 1), `${name}: mesh UVs outside source`);
  requireThat(Array.isArray(a.triangles) && a.triangles.length > 0 && a.triangles.length%3 === 0
    && a.triangles.every(i => Number.isInteger(i) && i >= 0 && i < a.vertex_count), `${name}: invalid triangle indices`);
  for (let i=0;i<a.triangles.length;i+=3) requireThat(new Set(a.triangles.slice(i,i+3)).size === 3, `${name}: repeated triangle index`);
  requireThat(typeof a.weighted === 'boolean' && Array.isArray(a.weights)
    && (a.weighted ? a.weights.length === a.vertex_count : a.weights.length === 0), `${name}: invalid weights topology`);
  for (const w of a.weights) {
    requireThat(w && Array.isArray(w.bones) && w.count === w.bones.length, `${name}: invalid influence count`);
    let total = 0;
    for (const b of w.bones) {
      requireThat(b && bones.has(b.bone), `${name}: missing influence bone`);
      finite([b.x,b.y,b.weight], `${name}: influence`); requireThat(b.weight >= 0, `${name}: negative weight`); total += b.weight;
    }
    requireThat(Number.isFinite(total) && (!w.bones.length || total > 0), `${name}: invalid total weight`);
  }
}

function validateRegion(a: RegionAttachment, name: string): void {
  finite([a.x,a.y,a.rotation,a.scale_x,a.scale_y,a.width,a.height,a.source_width,a.source_height,a.pivot_x,a.pivot_y], name);
  requireThat(a.width > 0 && a.height > 0 && a.source_width > 0 && a.source_height > 0, `${name}: invalid source/attachment dimensions`);
  requireThat(Array.isArray(a.uv) && a.uv.length === 4, `${name}: invalid UV rectangle`);
  finite(a.uv, `${name}: UV`);
  const [u0,v0,u1,v1] = a.uv as [number,number,number,number];
  requireThat(0 <= u0 && u0 < u1 && u1 <= 1 && 0 <= v0 && v0 < v1 && v1 <= 1,
    `${name}: reversed, repeated or out-of-source UV rectangles are unsupported in b.1`);
}
