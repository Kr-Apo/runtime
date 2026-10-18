import { attachmentWorldVertices, evaluate } from '@ankhimate/runtime';
import type { AtlasRegion, RigPose, RuntimeRigData } from '@ankhimate/runtime';
import { Container, Mesh, MeshGeometry, RendererType, Texture } from 'pixi.js';
import { clipDraw, points, polygonPieces } from './clipping.js';
import { DarkTint } from './tint.js';
import { pageTexture } from './load.js';
import { PixiPlayback } from './playback.js';
import { MeshAtlas, MeshBinding } from './mesh.js';
import type { MeshDraw } from './mesh.js';
import { regionQuad } from './region.js';
import { deformSizes, finite, regionRig, requireThat, skinAttachments, tint } from './validate.js';

export class PixiRigAsset {
  private readonly instances = new Set<PixiRigInstance>();
  private disposed = false;
  private constructor(private readonly rig: RuntimeRigData, private readonly pages: ReadonlyMap<number, Texture>, private readonly ownsPages: boolean) {}

  /** Already loaded full-page textures are borrowed, never destroyed here. */
  static from(source: unknown, pages: ReadonlyMap<number, Texture>): PixiRigAsset {
    const rig = regionRig(source);
    for (const page of rig.atlas!.pages) {
      const texture = pages.get(page.index);
      requireThat(texture && !texture.destroyed && !texture.source.destroyed, `Missing/destroyed atlas page texture ${page.index}`);
      requireThat(texture.source.resolution === 1 && texture.frame.x === 0 && texture.frame.y === 0 && !texture.rotate && !texture.trim
        && texture.width === page.width && texture.height === page.height
        && texture.source.width === page.width && texture.source.height === page.height,
      `Page ${page.index}: expected a full-page texture at resolution 1`);
      requireThat(texture.source.alphaMode !== 'no-premultiply-alpha', `Page ${page.index}: Normal requires premultiplied alpha`);
    }
    return new PixiRigAsset(rig, new Map(pages), false);
  }

  /** Owns decoded page textures; failures clean up every completed page. */
  static async load(jsonUrl: string | URL, options: { signal?: AbortSignal } = {}): Promise<PixiRigAsset> {
    const url = new URL(jsonUrl, globalThis.location?.href);
    requireThat(['http:', 'https:'].includes(url.protocol), 'Use an HTTP(S) server to load native exports');
    const response = await fetch(url, { ...(options.signal ? { signal: options.signal } : {}) });
    requireThat(response.ok, `Runtime JSON failed: HTTP ${response.status} (${url})`);
    const rig = regionRig(await response.json());
    const pending = rig.atlas!.pages.map(async page => {
      const pageUrl = new URL(page.file, url);
      requireThat(['http:', 'https:'].includes(pageUrl.protocol), `Page ${page.index}: unsupported URL scheme`);
      return pageTexture(pageUrl, page, options.signal);
    });
    const results = await Promise.allSettled(pending);
    const failed = results.find(result => result.status === 'rejected');
    if (failed || options.signal?.aborted) {
      for (const result of results) if (result.status === 'fulfilled') result.value.destroy(true);
      throw failed?.status === 'rejected' ? failed.reason : options.signal?.reason;
    }
    const pages = new Map(results.map((result, i) => [i, (result as PromiseFulfilledResult<Texture>).value]));
    return new PixiRigAsset(rig, pages, true);
  }

  createInstance(options: { skin?: string } = {}): PixiRigInstance {
    requireThat(!this.disposed, 'Rig asset is destroyed');
    const skin = options.skin ?? this.rig.defaultSkin!;
    requireThat(this.rig.skins.some(s => s.name === skin), `Unknown skin ${skin}`);
    let instance: PixiRigInstance | undefined;
    instance = new PixiRigInstance(this.rig, this.pages, skin, () => { if (instance) this.instances.delete(instance); });
    this.instances.add(instance);
    return instance;
  }

  /** Active instances must be destroyed first; never invalidate another view. */
  destroy(): void {
    if (this.disposed) return;
    requireThat(this.instances.size === 0, 'Destroy all rig instances before destroying their asset');
    if (this.ownsPages) for (const texture of this.pages.values()) texture.destroy(true);
    this.disposed = true;
  }
}

interface Draw { slot: string; quad: MeshDraw; texture: Texture; region: AtlasRegion; color: readonly [number,number,number,number]; dark?: readonly [number,number,number,number]; }

interface Appearance {
  skin: string;
  attachments: ReturnType<typeof skinAttachments>;
  deformCounts: Map<string, number>;
  bindings: Map<string, MeshBinding>;
  atlasMeshes: Map<string, MeshAtlas>;
}

// Container.destroy(true) must not propagate texture ownership into rig meshes.
// The instance's listener disposes its own meshes and buffers exactly once.
class RigRoot extends Container {
  override destroy(_options?: Parameters<Container['destroy']>[0]): void { super.destroy(false); }
}

export class PixiRigInstance {
  readonly root: Container = new RigRoot();
  private readonly views = new Map<string, Mesh<MeshGeometry>>();
  private readonly appearances = new Map<string, Appearance>();
  private readonly tints = new Map<string, DarkTint>();
  private disposed = false;

  /** Use asset.createInstance; the asset owns instance registration. */
  constructor(private readonly rig: RuntimeRigData, private readonly pages: ReadonlyMap<number, Texture>, private skin: string, release: () => void) {
    this.root.onRender = renderer => requireThat(renderer.type === RendererType.WEBGL, 'Pixi rigs require the qualified WebGL renderer; WebGPU/Canvas are unsupported');
    this.appearance(skin);
    this.root.on('destroyed', () => {
      this.controller?.destroy();
      for (const mesh of this.views.values()) {
        const geometry = mesh.geometry;
        mesh.destroy();
        geometry.destroy(true);
      }
      for (const effect of this.tints.values()) effect.destroy();
      this.tints.clear(); this.views.clear(); this.appearances.clear(); this.disposed = true; release();
    });
    try { this.setPose(evaluate(rig, [], { skin })); }
    catch (error) { this.destroy(); throw error; }
  }

  private controller: PixiPlayback | undefined;
  private displayedPose!: RigPose;

  get playback(): PixiPlayback {
    requireThat(!this.disposed, 'Rig instance is destroyed');
    if (!this.controller) {
      this.controller = new PixiPlayback(this.rig, this.skin, (pose, skin) => { this.applyPose(pose, this.appearance(skin)); this.skin = skin; });
      this.controller.detach(this.displayedPose);
    }
    return this.controller;
  }

  get skinName(): string { return this.skin; }

  /** Dynamic appearance; never restarts playback or cancels a crossfade. */
  setSkin(name: string): this {
    requireThat(!this.disposed, 'Rig instance is destroyed');
    this.playback.setSkin(name);
    return this;
  }

  private appearance(skin: string): Appearance {
    const existing = this.appearances.get(skin);
    if (existing) return existing;
    const attachments = skinAttachments(this.rig, skin), deformCounts = deformSizes(this.rig, skin);
    // The entire rig's FFD contract must remain usable after switching, including
    // later clip/attachment changes. Never truncate, invent or ignore offsets.
    for (const clip of Object.values(this.rig.animations)) for (const track of clip.deform) {
      const size = deformCounts.get(`${track.slot}\0${track.attachment}`);
      requireThat(size !== undefined && track.keys.every(k => k.offsets.length === size),
        `Skin ${skin}: incompatible deform attachment/dimensions for ${track.slot}/${track.attachment}`);
    }
    const setup = evaluate(this.rig), bindings = new Map<string, MeshBinding>(), atlasMeshes = new Map<string, MeshAtlas>();
    for (const [key, e] of attachments) if (e.attachment.type === 'mesh') {
      const a = e.attachment;
      bindings.set(key, new MeshBinding(this.rig, e.slot, e.name, a, setup));
      const region = this.rig.atlas!.regions.find(r => r.name === a.texture)!;
      atlasMeshes.set(`${key}\0${a.texture}`, new MeshAtlas(a, region, this.rig.atlas!.pages[region.page]!));
    }
    const appearance = { skin, attachments, deformCounts, bindings, atlasMeshes };
    this.appearances.set(skin, appearance);
    return appearance;
  }

  /** Direct clip sampling in [0,duration], without events; detaches playback. */
  setTime(animation: string, time: number): RigPose {
    const clip = this.rig.animations[animation];
    requireThat(clip, `Unknown clip ${animation}`);
    finite([time], 'Clip time');
    requireThat(time >= 0 && time <= clip.duration, 'Clip time must lie within [0,duration]');
    const pose = evaluate(this.rig, [{ animation, time, alpha: 1 }], { skin: this.skin });
    this.setPose(pose);
    return pose;
  }

  /** Accepts an existing core pose; never modifies it or the source rig. */
  setPose(pose: RigPose): void {
    this.applyPose(pose);
    this.controller?.detach(pose);
  }

  private applyPose(pose: RigPose, appearance = this.appearance(this.skin)): void {
    requireThat(!this.disposed, 'Rig instance is destroyed');
    requireThat(pose && Array.isArray(pose.bones) && Array.isArray(pose.slots) && Array.isArray(pose.drawOrder)
      && pose.deforms && typeof pose.deforms === 'object' && !Array.isArray(pose.deforms), 'Invalid pose/FFD');
    for (const [key, offsets] of Object.entries(pose.deforms)) {
      requireThat(appearance.deformCounts.has(key) && Array.isArray(offsets) && offsets.length === appearance.deformCounts.get(key), 'Invalid pose deform attachment/dimensions');
      finite(offsets, 'Pose deform offsets');
    }
    const bones = new Map(pose.bones.map(b => [b.name, b]));
    const slots = new Map(pose.slots.map(s => [s.name, s]));
    requireThat(bones.size === this.rig.bones.length && bones.size === pose.bones.length
      && this.rig.bones.every(b => bones.has(b.name)), 'Pose bones do not match rig');
    for (const bone of pose.bones) {
      requireThat(bone.world && typeof bone.world === 'object', `${bone.name}: missing world affine`);
      finite([bone.world.a,bone.world.b,bone.world.c,bone.world.d,bone.world.tx,bone.world.ty], `World transform ${bone.name}`);
    }
    requireThat(slots.size === this.rig.slots.length && slots.size === pose.slots.length
      && this.rig.slots.every(s => slots.has(s.name)), 'Pose slots do not match rig');
    requireThat(pose.drawOrder.length === slots.size && new Set(pose.drawOrder).size === slots.size
      && pose.drawOrder.every(n => slots.has(n)), 'Invalid pose draw order');
    const draws: Draw[] = [];
    let mask: { polygon: ReturnType<typeof points>; pieces: number[][]; end: string | null } | undefined;
    // Prepare and validate the entire pose before modifying the displayed one.
    for (const name of pose.drawOrder) {
      const setup = this.rig.slots.find(s => s.name === name)!;
      const slot = slots.get(name)!;
      const world = bones.get(setup.bone)!.world;
      finite([world.a,world.b,world.c,world.d,world.tx,world.ty], `World transform ${setup.bone}`);
      requireThat(typeof slot.visible === 'boolean', `${name}: invalid visibility`);
      if (slot.dark_color !== undefined) tint(slot.dark_color, `${name}: dark tint`);
      requireThat(Array.isArray(slot.color) && slot.color.length === 4, `${name}: invalid light color`);
      finite(slot.color, `${name}: light color`);
      requireThat(slot.color.every(v => v >= 0 && v <= 1), `${name}: light color outside [0,1] is not qualified`);
      const a = slot.attachment === null ? undefined : appearance.attachments.get(`${name}\0${slot.attachment}`)?.attachment;
      // Rust resolves a clipping introduction before content visibility. A new
      // introduction replaces the active mask; this is not nested intersection.
      if (a?.type === 'clipping') {
        const vertices = attachmentWorldVertices(this.rig, pose, appearance.skin, name, slot.attachment!)!;
        const polygon = points(vertices).map(([x,y]) => [x,-y] as const);
        mask = { polygon, pieces: polygonPieces(polygon, name), end: a.end_slot };
        continue;
      }
      const activeMask = mask;
      // End is inclusive, even when the end slot has no visible content.
      if (mask?.end === name) mask = undefined;
      if (!slot.visible || slot.attachment === null) continue;
      requireThat(a, `${name}: unknown attachment ${slot.attachment}`);
      requireThat(Number.isInteger(slot.sequenceFrame) && slot.sequenceFrame >= 0, `${name}: invalid sequence frame`);
      const textureName = a.sequence ? a.sequence.frames[slot.sequenceFrame] : a.texture;
      const region = this.rig.atlas!.regions.find(r => r.name === textureName);
      requireThat(region, `${name}: missing region/sequence frame ${textureName}`);
      const page = this.rig.atlas!.pages[region.page]!;
      const texture = this.pages.get(region.page)!;
      requireThat(!texture.destroyed && !texture.source.destroyed, `${name}: atlas texture was destroyed by its owner`);
      const key = `${name}\0${slot.attachment}`;
      const regionGeometry = a.type === 'region' ? regionQuad(a, region, page, world) : undefined;
      let quad = a.type === 'region' ? regionGeometry && { ...regionGeometry, indices: new Uint32Array([0,1,2,0,2,3]) }
        : appearance.atlasMeshes.get(`${key}\0${textureName}`)!.draw(appearance.bindings.get(key)!.positions(pose));
      if (quad && activeMask) quad = clipDraw(quad, activeMask.polygon, activeMask.pieces);
      if (quad && quad.indices.length) {
        finite(Array.from(quad.positions), `${name}: rendered vertices`);
        draws.push({ slot: name, quad, texture, region, color: slot.color, ...(slot.dark_color ? { dark: slot.dark_color } : {}) });
      }
    }
    for (const mesh of this.views.values()) mesh.visible = false;
    for (const [index, draw] of draws.entries()) {
      let mesh = this.views.get(draw.slot);
      if (!mesh) {
        mesh = new Mesh({ geometry: new MeshGeometry({ positions: new Float32Array(draw.quad.positions.length), uvs: new Float32Array(draw.quad.uvs.length), indices: new Uint32Array(draw.quad.indices) }), texture: draw.texture });
        mesh.label = draw.slot; mesh.blendMode = 'normal';
        this.root.addChild(mesh); this.views.set(draw.slot, mesh);
      }
      if (mesh.geometry.positions.length !== draw.quad.positions.length || mesh.geometry.indices.length !== draw.quad.indices.length) {
        const previous = mesh.geometry;
        mesh.geometry = new MeshGeometry({ positions: new Float32Array(draw.quad.positions.length), uvs: new Float32Array(draw.quad.uvs.length), indices: new Uint32Array(draw.quad.indices) });
        previous.destroy(true);
      }
      mesh.geometry.positions.set(draw.quad.positions); mesh.geometry.getBuffer('aPosition').update();
      mesh.geometry.uvs.set(draw.quad.uvs); mesh.geometry.getBuffer('aUV').update();
      mesh.geometry.indices.set(draw.quad.indices); mesh.geometry.indexBuffer.update();
      mesh.texture = draw.texture;
      // Even D=0 uses the same equation: Pixi's packed PMA vertex tint would
      // quantize light RGB/alpha a second time before compositing overlaps.
      let effect = this.tints.get(draw.slot);
      if (!effect) { effect = new DarkTint(mesh); this.tints.set(draw.slot, effect); }
      effect.update(draw.texture, draw.color, draw.dark ?? [0,0,0,0], draw.region);
      mesh.tint = 0xffffff; mesh.alpha = 1; mesh.visible = true;
      this.root.setChildIndex(mesh, index);
    }
    this.displayedPose = pose;
  }

  destroy(): void { if (!this.disposed) this.root.destroy(); }
}

export const loadPixiRig = PixiRigAsset.load;
