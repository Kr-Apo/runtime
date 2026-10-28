import { evaluate, findAttachment, ReplayConsumerBridge } from '@ankhimate/runtime';
import type { ConsumerFrame, ConsumerPreview, RigPose, RuntimeRigData, SkinEvent } from '@ankhimate/runtime';
import { RendererType } from 'pixi.js';
import type { Container, Texture, WebGLRenderer } from 'pixi.js';
import { pageTexture } from './load.js';
import { PixiRigInstance, createReplayPixiView, validatePageTextures } from './rig.js';
import type { ReplayPixiView } from './rig.js';
import { graphicsRig, nativeSource, requireThat } from './validate.js';

export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type ReplayPixiPresentation =
  | { readonly kind: 'simulated'; readonly snapshot: DeepReadonly<ConsumerFrame> }
  | { readonly kind: 'pure-preview'; readonly snapshot: DeepReadonly<ConsumerPreview> };
const construct = Symbol('validated experimental replay asset');
function freeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

/** Explicit renderer + ReplayV1 validation on ORIGINAL data, never a stripped projection. */
export interface ReplayVisualSkinOptions { readonly visualSkins: true; readonly staticMeshes?: never }
/** Fixed native geometry only; deliberately incompatible with the C6A skin calendar. */
export interface ReplayStaticMeshOptions { readonly staticMeshes: true; readonly visualSkins?: never }
export type ReplayPixiAssetOptions = ReplayVisualSkinOptions | ReplayStaticMeshOptions;
export interface ReplayPixiInstanceOptions { clip: string; epoch?: bigint; skinEvents?: readonly SkinEvent[] }
function visualMode(options?: ReplayPixiAssetOptions): boolean {
  requireThat(options === undefined || options && Object.keys(options).length === 1 && (options.visualSkins === true || options.staticMeshes === true), 'Expected exactly one explicit visualSkins:true or staticMeshes:true opt-in');
  return options?.visualSkins === true;
}
export function validateExperimentalReplayPixiSource(source: unknown, options?: ReplayPixiAssetOptions): RuntimeRigData {
  const visual = visualMode(options), meshes = options?.staticMeshes === true;
  const rig = nativeSource(source);
  requireThat(rig.constraints.length > 0 && rig.constraints.every(c => c.type === 'physics'), 'Experimental Replay Pixi requires Physics-only constraints');
  requireThat(visual || rig.skins.length === 1 && rig.skins[0]!.name === rig.defaultSkin, 'Experimental Replay Pixi requires one fixed default skin');
  requireThat(rig.defaultSkin !== null && rig.skins.some(s => s.name === rig.defaultSkin), 'Expected native default skin');
  const bones = new Set(rig.bones.map(b => b.name)), constraints = new Set(rig.constraints.map(c => c.name));
  for (const skin of rig.skins) {
    requireThat(new Set(skin.constraints).size === skin.constraints.length && skin.constraints.every(n => constraints.has(n)), 'Experimental Replay Pixi: invalid skin constraint references');
    requireThat(new Set(skin.bones).size === skin.bones.length && skin.bones.every(n => bones.has(n)), 'Experimental Replay Pixi: invalid skin bone references');
  }
  for (const slot of rig.slots) {
    requireThat(bones.has(slot.bone), `Experimental Replay Pixi: ${slot.name} has an unknown bone`);
    requireThat(/^[0-9a-f]{8}$/i.test(slot.color), `Experimental Replay Pixi: ${slot.name} requires native RGBA color`);
    requireThat(slot.attachment === null || (visual ? rig.skins : [rig.skins[0]!]).some(s => s.attachments.some(e => e.slot === slot.name && e.name === slot.attachment)), `Experimental Replay Pixi: ${slot.name} has an unknown attachment`);
    requireThat(slot.blend === 'normal', `Experimental Replay Pixi: ${slot.name} requires Normal blend`);
    requireThat(slot.dark_color === undefined, `Experimental Replay Pixi: ${slot.name} dark tint is not qualified`);
  }
  for (const skin of rig.skins) for (const entry of skin.attachments) {
    const attachment = entry.attachment;
    requireThat(attachment.type === 'region' || meshes && attachment.type === 'mesh', `Experimental Replay Pixi: ${entry.slot}/${entry.name} requires static regions unless staticMeshes:true (no weighted/FFD/clipping)`);
    if (attachment.type === 'mesh') {
      requireThat(attachment.weighted === false && Array.isArray(attachment.weights) && attachment.weights.length === 0, `Experimental Replay Pixi: ${entry.slot}/${entry.name} requires an unweighted mesh`);
      requireThat(!['ffd_keyframes', 'deform', 'vertex_animation'].some(key => Object.hasOwn(attachment, key)), `Experimental Replay Pixi: embedded vertex animation is not qualified`);
      requireThat(attachment.linked === null, `Experimental Replay Pixi: ${entry.slot}/${entry.name} linked meshes are not qualified`);
    }
    requireThat(!attachment.sequence, 'Experimental Replay Pixi: attachment sequences are not qualified');
  }
  requireThat(Object.keys(rig.animations).length > 0, 'Experimental Replay Pixi requires a clip');
  // Every channel/reference remains present for B3/B4 validation. No unused clip is hidden.
  for (const [name, clip] of Object.entries(rig.animations)) {
    requireThat(clip.duration > 0 && clip.bones.length > 0, `Experimental Replay Pixi: ${name} requires a nonempty bone clip`);
    for (const skin of visual ? rig.skins : [rig.skins[0]!]) {
      const owner = new ReplayConsumerBridge(rig, name, 1n, visual ? [{ tick: 0n, skin: skin.name }] : undefined);
      owner.dispose(owner.context);
    }
  }
  return graphicsRig(rig);
}

export class ExperimentalReplayPixiAsset {
  readonly #instances = new Set<ExperimentalReplayPixiInstance>();
  #disposed = false;
  readonly #visualSkins: boolean;
  readonly #staticMeshes: boolean;
  readonly #expectedPages = new Map<number, { texture: Texture; source: Texture['source'] }>();
  private constructor(private readonly rig: RuntimeRigData, private readonly pages: Map<number, Texture>, private readonly ownsPages: boolean, visualSkins = false, staticMeshes = false) {
    this.#visualSkins = visualSkins; this.#staticMeshes = staticMeshes;
    if (visualSkins || staticMeshes) {
      freeze(rig);
      for (const [index, texture] of pages) this.#expectedPages.set(index, { texture, source: texture.source });
    }
  }
  #validateResources = () => {
    if (!this.#visualSkins && !this.#staticMeshes) return;
    requireThat(!this.#disposed, 'Replay asset is destroyed');
    for (const [index, expected] of this.#expectedPages) requireThat(this.pages.get(index) === expected.texture && expected.texture.source === expected.source, `Page ${index}: texture/source replaced`);
    validatePageTextures(this.rig, this.pages);
  };

  /** Borrowed pages: asset destruction never destroys caller-owned textures. */
  static from(source: unknown, pages: ReadonlyMap<number, Texture>, options?: ReplayPixiAssetOptions): ExperimentalReplayPixiAsset {
    const rig = validateExperimentalReplayPixiSource(source, options);
    validatePageTextures(rig, pages);
    return new ExperimentalReplayPixiAsset(rig, new Map(pages), false, visualMode(options), options?.staticMeshes === true);
  }

  /** Own decoded pages; ordinary failures/cancellation release every completed page. */
  static async load(jsonUrl: string | URL, options: { signal?: AbortSignal; visualSkins?: true; staticMeshes?: true } = {}): Promise<ExperimentalReplayPixiAsset> {
    requireThat(!(options.staticMeshes !== undefined && options.visualSkins !== undefined), 'staticMeshes and visualSkins are mutually exclusive');
    const mode: ReplayPixiAssetOptions | undefined = options.staticMeshes !== undefined ? { staticMeshes: options.staticMeshes }
      : options.visualSkins !== undefined ? { visualSkins: options.visualSkins } : undefined;
    visualMode(mode);
    const url = new URL(jsonUrl, globalThis.location?.href);
    requireThat(['http:', 'https:'].includes(url.protocol), 'Use an HTTP(S) server to load native exports');
    options.signal?.throwIfAborted();
    const response = await fetch(url, { ...(options.signal ? { signal: options.signal } : {}) });
    requireThat(response.ok, `Runtime JSON failed: HTTP ${response.status} (${url})`);
    const rig = validateExperimentalReplayPixiSource(await response.json(), mode);
    options.signal?.throwIfAborted();
    const results = await Promise.allSettled(rig.atlas!.pages.map(async page => {
      const pageUrl = new URL(page.file, url);
      requireThat(['http:', 'https:'].includes(pageUrl.protocol), `Page ${page.index}: unsupported URL scheme`);
      return pageTexture(pageUrl, page, options.signal);
    }));
    const failed = results.find(r => r.status === 'rejected');
    if (failed || options.signal?.aborted) {
      for (const r of results) if (r.status === 'fulfilled') r.value.destroy(true);
      throw failed?.status === 'rejected' ? failed.reason : options.signal?.reason;
    }
    const pages = new Map(results.map((r, i) => [i, (r as PromiseFulfilledResult<Texture>).value]));
    return new ExperimentalReplayPixiAsset(rig, pages, true, options.visualSkins === true, options.staticMeshes === true);
  }

  /** Detached inspection; the asset's native rig is never exposed mutably. */
  get source(): RuntimeRigData { requireThat(!this.#disposed, 'Replay asset is destroyed'); return structuredClone(this.rig); }
  get resources() { return Object.freeze({ instances: this.#instances.size, textures: this.pages.size, disposed: this.#disposed }); }
  createInstance(options: ReplayPixiInstanceOptions): ExperimentalReplayPixiInstance {
    requireThat(!this.#disposed, 'Replay asset is destroyed');
    requireThat(options && typeof options === 'object' && !Array.isArray(options)
      && Object.keys(options).every(key => key === 'clip' || key === 'epoch' || this.#visualSkins && key === 'skinEvents'), 'Experimental Replay Pixi options accept clip/epoch and opt-in skinEvents only; skin/layers/crossfade are not qualified');
    requireThat(!this.#visualSkins || Array.isArray(options.skinEvents) && options.skinEvents.every(e => e && typeof e === 'object' && Object.keys(e).every(k => k === 'tick' || k === 'skin')), 'Visual skins require an explicit canonical skinEvents calendar');
    this.#validateResources();
    requireThat(typeof options.clip === 'string' && Object.hasOwn(this.rig.animations, options.clip), 'Unknown Replay clip');
    let instance: ExperimentalReplayPixiInstance;
    instance = new ExperimentalReplayPixiInstance(construct, this.rig, this.pages, options.clip, options.epoch ?? 1n, () => this.#instances.delete(instance), this.#visualSkins, options.skinEvents, this.#validateResources, this.#staticMeshes);
    this.#instances.add(instance);
    return instance;
  }
  destroy(): void {
    if (this.#disposed) return;
    requireThat(this.#instances.size === 0, 'Dispose all Replay instances before destroying their asset');
    if (this.ownsPages) for (const texture of this.#visualSkins || this.#staticMeshes ? [...this.#expectedPages.values()].map(p => p.texture) : this.pages.values()) texture.destroy(true);
    this.pages.clear(); this.#expectedPages.clear(); this.#disposed = true;
  }
}

/** One real ReplayConsumer and one existing Pixi view. No renderer-side solver or host clock. */
export class ExperimentalReplayPixiInstance {
  readonly #consumer: ReplayConsumerBridge;
  readonly root: Container;
  readonly #view: ReplayPixiView;
  readonly #layout: RigPose;
  readonly #layouts = new Map<string, RigPose>();
  readonly #rig: RuntimeRigData;
  readonly #visualSkins: boolean;
  readonly #validateResources: () => void;
  readonly #staticMeshes: boolean;
  #meshRenderer: WebGLRenderer | undefined;
  #presentationDirty = false;
  #disposed = false;
  #applying = false;
  #prepared = new WeakMap<ReplayPixiPresentation, RigPose>();
  #simulated: ReplayPixiPresentation | undefined;
  #preview: ReplayPixiPresentation | undefined;
  #displayed: ReplayPixiPresentation | null = null;
  #counts = { captures: 0, previewCaptures: 0, poseTransfers: 0, submissions: 0, guardedReads: 0, cacheHits: 0 };

  /** @internal Only validated assets possess the runtime construction token. */
  constructor(token: typeof construct, rig: RuntimeRigData, pages: ReadonlyMap<number, Texture>, clip: string, epoch: bigint, release: () => void, visualSkins = false, events?: readonly SkinEvent[], validateResources = () => {}, staticMeshes = false) {
    requireThat(token === construct, 'Create Replay instances through a validated asset');
    this.#rig = rig; this.#visualSkins = visualSkins; this.#staticMeshes = staticMeshes; this.#validateResources = validateResources;
    this.#consumer = new ReplayConsumerBridge(rig, clip, epoch, events);
    let view: ReplayPixiView | undefined;
    try {
      this.#layout = evaluate(rig); // Pure setup FK, no EvaluationState/Legacy Physics.
      this.#view = view = visualSkins || staticMeshes ? createReplayPixiView(rig, pages, this.consumer.currentFrame().skin) : new PixiRigInstance(rig, pages, rig.defaultSkin!, () => {});
      this.root = this.#view.root;
      const rendererGate = this.root.onRender;
      this.root.onRender = renderer => {
        rendererGate?.(renderer);
        this.#validateResources();
        requireThat(renderer.type === RendererType.WEBGL && (renderer as WebGLRenderer).context?.webGLVersion === 2, 'Experimental Replay Pixi requires WebGL2');
        if (staticMeshes) {
          requireThat(!(renderer as WebGLRenderer).gl.isContextLost(), 'Static Replay mesh WebGL2 context is lost');
          this.#meshRenderer = renderer as WebGLRenderer;
        }
      };
      this.root.once('destroyed', () => {
        this.#disposed = true; this.#displayed = null; this.#simulated = undefined; this.#preview = undefined; this.#prepared = new WeakMap(); this.#layouts.clear();
        try { if (this.consumer.transportStatus().state !== 'disposed') this.consumer.dispose(this.consumer.context); }
        finally { release(); }
      });
      this.present();
    } catch (error) {
      if (this.consumer.transportStatus().state !== 'disposed') this.consumer.dispose(this.consumer.context);
      view?.destroy();
      throw error;
    }
  }
  get consumer(): ReplayConsumerBridge { return this.#consumer; }
  #ready() {
    requireThat(!this.#disposed, 'Replay instance is disposed');
    requireThat(!this.#staticMeshes || !this.#meshRenderer?.gl.isContextLost(), 'Static Replay mesh WebGL2 context is lost');
  }
  get displayed(): ReplayPixiPresentation | null { return this.#displayed; }
  /** Last successful presentation, including explicitly labeled pure previews. */
  get visualSkin(): string | null { return this.#displayed?.snapshot.skin ?? null; }
  get metrics() { return Object.freeze({ ...this.#counts }); }

  #prepare(kind: 'simulated' | 'pure-preview', snapshot: ConsumerFrame | ConsumerPreview): ReplayPixiPresentation {
    const frame = freeze(snapshot);
    const presentation = Object.freeze({ kind, snapshot: frame }) as ReplayPixiPresentation;
    // setPose is read-only. Frames are already detached, then deeply frozen here.
    let layout = this.#layout;
    if (this.#visualSkins) {
      const existing = this.#layouts.get(snapshot.skin);
      layout = existing ?? { ...this.#layout, slots: this.#layout.slots.map(slot => ({ ...slot, attachment: slot.attachment !== null && !findAttachment(this.#rig, snapshot.skin, slot.name, slot.attachment) ? null : slot.attachment })) };
      if (!existing) this.#layouts.set(snapshot.skin, layout);
    }
    const pose: RigPose = { bones: snapshot.bones as RigPose['bones'], slots: layout.slots, drawOrder: layout.drawOrder, deforms: {} };
    this.#prepared.set(presentation, pose); this.#counts.poseTransfers++;
    return presentation;
  }
  capture(): ReplayPixiPresentation & { readonly kind: 'simulated' } {
    this.#ready(); const status = this.consumer.transportStatus(), c = status.clock;
    requireThat(c, 'Replay consumer is disposed');
    const cached = this.#simulated;
    if (cached?.kind === 'simulated' && cached.snapshot.context === this.consumer.context && cached.snapshot.completed === c.completed
      && cached.snapshot.requested === c.requested && cached.snapshot.backlog === c.backlog && cached.snapshot.state === status.state) {
      this.#counts.cacheHits++; return cached;
    }
    this.#counts.captures++;
    const prepared = this.#prepare('simulated', this.consumer.currentFrame()) as ReplayPixiPresentation & { readonly kind: 'simulated' };
    this.#simulated = prepared; return prepared;
  }
  capturePreview(): (ReplayPixiPresentation & { readonly kind: 'pure-preview' }) | null {
    this.#ready(); if (this.consumer.transportStatus().state !== 'seek_preview') return null;
    const cached = this.#preview;
    if (cached?.kind === 'pure-preview' && cached.snapshot.context === this.consumer.context) { this.#counts.cacheHits++; return cached; }
    const frame = this.consumer.previewFrame(); requireThat(frame, 'No pure seek preview'); this.#counts.previewCaptures++;
    const prepared = this.#prepare('pure-preview', frame) as ReplayPixiPresentation & { readonly kind: 'pure-preview' };
    this.#preview = prepared; return prepared;
  }
  present(prepared: ReplayPixiPresentation = this.capture()): ReplayPixiPresentation { return this.#apply(prepared, 'simulated'); }
  presentPreview(prepared: ReplayPixiPresentation | null = this.capturePreview()): ReplayPixiPresentation {
    requireThat(prepared, 'No pure seek preview'); return this.#apply(prepared, 'pure-preview');
  }
  #apply(prepared: ReplayPixiPresentation, kind: 'simulated' | 'pure-preview'): ReplayPixiPresentation {
    this.#ready(); requireThat(!this.#applying, 'Recursive Replay presentation');
    const pose = this.#prepared.get(prepared), status = this.consumer.transportStatus();
    requireThat(pose && prepared.kind === kind && prepared.snapshot.context === this.consumer.context, 'Foreign, forged, wrong-kind or stale-epoch presentation');
    if (prepared.kind === 'simulated') requireThat(prepared.snapshot.poseTick === status.clock?.completed && prepared.snapshot.requested === status.clock.requested && prepared.snapshot.backlog === status.clock.backlog && prepared.snapshot.state === status.state, 'Stale completed presentation');
    else requireThat(status.state === 'seek_preview' && prepared.snapshot.tick === status.position, 'Stale pure preview');
    this.#validateResources();
    if (prepared === this.#displayed && !this.#presentationDirty) { this.#counts.cacheHits++; return prepared; }
    this.#applying = true;
    try {
      // Preserve the existing consumer mutation/reentrance guard; its extra detached read is counted.
      this.#counts.guardedReads++; this.consumer.present(() => { this.#validateResources(); this.#view.setPose(pose, prepared.snapshot.skin); });
      this.#counts.submissions++; this.#displayed = prepared; this.#presentationDirty = false; return prepared;
    } catch (error) {
      if (this.#visualSkins || this.#staticMeshes) this.#presentationDirty = true;
      throw error;
    } finally { this.#applying = false; }
  }
  dispose(): void { if (!this.#disposed) { requireThat(!this.#applying, 'Cannot dispose during presentation'); this.#view.destroy(); } }
}
