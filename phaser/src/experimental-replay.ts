import type Phaser from 'phaser';
import { evaluate, findAttachment, ReplayConsumerBridge, parseRig } from '@ankhimate/runtime';
import type { ConsumerFrame, ConsumerPreview, RigPose, RuntimeRigData, SkinEvent } from '@ankhimate/runtime';
import { createReplayPhaserView } from './phaser.js';
import type { PhaserPresentation } from './phaser.js';
import { replayPage, replayWebGL2 } from './replay-load.js';
import { phaserSource, requireThat } from './validate.js';
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type ReplayPhaserPresentation =
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
export interface ReplayVisualSkinOptions { readonly visualSkins: true }
export interface ReplayPhaserInstanceOptions { clip: string; epoch?: bigint; skinEvents?: readonly SkinEvent[] }
function visualMode(options?: ReplayVisualSkinOptions): boolean {
  requireThat(options === undefined || options && Object.keys(options).length === 1 && options.visualSkins === true, 'Expected explicit visualSkins:true opt-in');
  return options !== undefined;
}
export function validateExperimentalReplayPhaserSource(source: unknown, options?: ReplayVisualSkinOptions): RuntimeRigData {
  const visual = visualMode(options);
  const native = parseRig(structuredClone(typeof source === 'string' ? JSON.parse(source) : source));
  requireThat(native.format_version === 2 && native.defaultSkin !== null, 'Expected native v2 with an explicit default skin');
  const rig = phaserSource(native);
  requireThat(rig.format_version === 2, 'Experimental Replay Phaser requires native v2');
  requireThat(rig.constraints.length > 0 && rig.constraints.every(c => c.type === 'physics'), 'Experimental Replay Phaser requires Physics-only constraints');
  requireThat(visual || rig.skins.length === 1 && rig.skins[0]!.name === rig.defaultSkin, 'Experimental Replay Phaser requires one fixed default skin');
  const bones = new Set(rig.bones.map(b => b.name)), constraints = new Set(rig.constraints.map(c => c.name));
  requireThat(rig.skins.some(s => s.name === rig.defaultSkin), 'Expected native default skin');
  for (const skin of rig.skins) {
    requireThat(new Set(skin.constraints).size === skin.constraints.length && skin.constraints.every(n => constraints.has(n)), 'Experimental Replay Phaser: invalid skin constraint references');
    requireThat(new Set(skin.bones).size === skin.bones.length && skin.bones.every(n => bones.has(n)), 'Experimental Replay Phaser: invalid skin bone references');
  }
  for (const slot of rig.slots) {
    requireThat(bones.has(slot.bone), `Experimental Replay Phaser: ${slot.name} has an unknown bone`);
    requireThat(/^[0-9a-f]{8}$/i.test(slot.color), `Experimental Replay Phaser: ${slot.name} requires native RGBA color`);
    requireThat(slot.attachment === null || (visual ? rig.skins : [rig.skins[0]!]).some(s => s.attachments.some(e => e.slot === slot.name && e.name === slot.attachment)), `Experimental Replay Phaser: ${slot.name} has an unknown attachment`);
    requireThat(slot.blend === 'normal', `Experimental Replay Phaser: ${slot.name} requires Normal blend`);
    requireThat(slot.dark_color === undefined, `Experimental Replay Phaser: ${slot.name} dark tint is not qualified`);
  }
  for (const skin of rig.skins) for (const entry of skin.attachments) {
    requireThat(entry.attachment.type === 'region', `Experimental Replay Phaser: ${entry.slot}/${entry.name} requires static regions (no mesh/FFD/clipping)`);
    requireThat(!entry.attachment.sequence, 'Experimental Replay Phaser: attachment sequences are not qualified');
  }
  requireThat(Object.keys(rig.animations).length > 0, 'Experimental Replay Phaser requires a clip');
  // Every channel/reference remains present for B3/B4 validation. No unused clip is hidden.
  for (const [name, clip] of Object.entries(rig.animations)) {
    requireThat(clip.duration > 0 && clip.bones.length > 0, `Experimental Replay Phaser: ${name} requires a nonempty bone clip`);
    for (const skin of visual ? rig.skins : [rig.skins[0]!]) {
      const owner = new ReplayConsumerBridge(rig, name, 1n, visual ? [{ tick: 0n, skin: skin.name }] : undefined);
      owner.dispose(owner.context);
    }
  }
  requireThat(rig.format_version === 2, 'Experimental Replay Phaser requires native v2');
  requireThat(rig.atlas!.regions.every(r => !r.rotated), 'Rotated atlas regions are not qualified');
  return rig;
}


let nextAsset = 0;
export class ExperimentalReplayPhaserAsset {
  readonly #instances = new Set<ExperimentalReplayPhaserInstance>();
  readonly #textures = new Map<string, Phaser.Textures.Texture>();
  readonly #game: Phaser.Game;
  readonly #sources = new Map<string, Phaser.Textures.TextureSource>();
  #disposed = false;
  #gameStop = () => { for (const instance of [...this.#instances]) instance.dispose(); this.destroy(); };
  private constructor(game: Phaser.Game, private readonly rig: RuntimeRigData, private readonly keys: readonly string[], private readonly owned: boolean, private readonly visualSkins = false) {
    this.#game = game;
    if (visualSkins) freeze(rig);
    for (const key of keys) {
      const texture = game.textures.get(key); this.#textures.set(key, texture);
      if (visualSkins) this.#sources.set(key, texture.source[0]!);
    }
    this.#validateResources(); game.events.once('destroy', this.#gameStop);
  }
  #validateResources = () => {
    requireThat(!this.#disposed, 'Replay asset is destroyed'); replayWebGL2(this.#game);
    for (const page of this.rig.atlas!.pages) {
      const key = this.keys[page.index], expected = key && this.#textures.get(key);
      requireThat(key && expected && this.#game.textures.exists(key) && this.#game.textures.get(key) === expected, `Atlas page ${page.index}: texture removed/replaced`);
      const src = expected.source[0];
      requireThat(!this.visualSkins || src === this.#sources.get(key), `Atlas page ${page.index}: texture source replaced`);
      requireThat(src && src.width === page.width && src.height === page.height && src.glTexture?.pma, `Atlas page ${page.index}: expected full premultiplied texture`);
    }
  };
  static from(game: Phaser.Game, source: unknown, options: { pageTextureKeys: readonly string[]; visualSkins?: true }): ExperimentalReplayPhaserAsset {
    const rig = validateExperimentalReplayPhaserSource(source, options?.visualSkins ? { visualSkins: true } : undefined); replayWebGL2(game);
    requireThat(options && Object.keys(options).every(k => k === 'pageTextureKeys' || k === 'visualSkins') && (options.visualSkins === undefined || options.visualSkins === true) && Array.isArray(options.pageTextureKeys)
      && options.pageTextureKeys.length === rig.atlas!.pages.length && options.pageTextureKeys.every(k => typeof k === 'string' && game.textures.exists(k))
      && new Set(options.pageTextureKeys).size === options.pageTextureKeys.length, 'Expected one distinct borrowed texture key per page');
    return new ExperimentalReplayPhaserAsset(game, rig, [...options.pageTextureKeys], false, options.visualSkins === true);
  }
  static async load(game: Phaser.Game, jsonUrl: string | URL, options: { signal?: AbortSignal; visualSkins?: true } = {}): Promise<ExperimentalReplayPhaserAsset> {
    requireThat(options.visualSkins === undefined || options.visualSkins === true, 'Expected explicit visualSkins:true opt-in');
    replayWebGL2(game);
    const url = new URL(jsonUrl, globalThis.location?.href);
    requireThat(['http:', 'https:'].includes(url.protocol), 'Use HTTP(S) for native exports');
    const lifetime = new AbortController(), stop = () => lifetime.abort(new Error('Game destroyed during load'));
    const signal = options.signal ? AbortSignal.any([options.signal, lifetime.signal]) : lifetime.signal;
    game.events.once('destroy', stop);
    const installed = new Map<string, Phaser.Textures.Texture>(); let images: HTMLImageElement[] = [];
    try {
      signal.throwIfAborted(); const response = await fetch(url, { signal }); requireThat(response.ok, `Runtime JSON: HTTP ${response.status}`);
      const rig = validateExperimentalReplayPhaserSource(await response.json(), options.visualSkins ? { visualSkins: true } : undefined); signal.throwIfAborted();
      const results = await Promise.allSettled(rig.atlas!.pages.map(p => replayPage(new URL(p.file,url),p,signal)));
      images = results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
      const failed = results.find(r => r.status === 'rejected'); if (failed?.status === 'rejected') throw failed.reason;
      signal.throwIfAborted(); replayWebGL2(game); const prefix = `__ankhimate_replay_${++nextAsset}_`, keys: string[] = [];
      for (const [index,image] of images.entries()) {
        const key = prefix + index; requireThat(!game.textures.exists(key), 'Texture key collision');
        let texture: Phaser.Textures.Texture | null;
        try { texture = game.textures.addImage(key,image); }
        finally {
          // TextureManager emits callbacks after insertion. Track our image even if
          // one throws before addImage returns; never claim an external replacement.
          if (game.textures.exists(key)) {
            const created = game.textures.get(key);
            if (created.source[0]?.image === image) installed.set(key,created);
          }
        }
        requireThat(texture && installed.get(key) === texture, `Cannot install atlas page ${index}`); keys.push(key); signal.throwIfAborted();
      }
      return new ExperimentalReplayPhaserAsset(game,rig,keys,true,options.visualSkins === true);
    } catch (error) {
      for (const [key,texture] of installed) if (game.textures.exists(key) && game.textures.get(key) === texture) game.textures.remove(key);
      for (const image of images) image.src = '';
      throw error;
    } finally { game.events.off('destroy',stop); }
  }
  get source(): RuntimeRigData { requireThat(!this.#disposed, 'Replay asset destroyed'); return structuredClone(this.rig); }
  get resources() { return Object.freeze({ instances: this.#instances.size, textures: this.#textures.size, disposed: this.#disposed }); }
  createInstance(scene: Phaser.Scene, options: ReplayPhaserInstanceOptions): ExperimentalReplayPhaserInstance {
    this.#validateResources();
    requireThat(scene?.sys?.game === this.#game && scene.sys.settings.active && scene.add && scene.events, 'Expected a live Scene from the asset Game');
    requireThat(options && typeof options === 'object' && !Array.isArray(options) && Object.keys(options).every(k => k === 'clip' || k === 'epoch' || this.visualSkins && k === 'skinEvents'), 'Options accept clip/epoch and opt-in skinEvents only; no direct skin/layers/crossfade');
    requireThat(!this.visualSkins || Array.isArray(options.skinEvents) && options.skinEvents.every(e => e && typeof e === 'object' && Object.keys(e).every(k => k === 'tick' || k === 'skin')), 'Visual skins require an explicit canonical skinEvents calendar');
    requireThat(typeof options.clip === 'string' && Object.hasOwn(this.rig.animations,options.clip), 'Unknown Replay clip');
    let instance: ExperimentalReplayPhaserInstance;
    instance = new ExperimentalReplayPhaserInstance(construct,scene,this.rig,this.keys,options.clip,options.epoch ?? 1n,() => this.#instances.delete(instance),this.#validateResources,this.visualSkins,options.skinEvents);
    this.#instances.add(instance); return instance;
  }
  destroy(): void {
    if (this.#disposed) return;
    requireThat(!this.#instances.size, 'Dispose all Replay instances before asset destruction');
    this.#game.events.off('destroy',this.#gameStop);
    if (this.owned) for (const [key,texture] of this.#textures) if (this.#game.textures.exists(key) && this.#game.textures.get(key) === texture) this.#game.textures.remove(key);
    this.#textures.clear(); this.#sources.clear(); this.#disposed = true;
  }
}

/** One real ReplayConsumer and one existing Phaser view. No renderer-side solver or host clock. */
export class ExperimentalReplayPhaserInstance {
  readonly #consumer: ReplayConsumerBridge;
  readonly root: Phaser.GameObjects.Container;
  readonly #view: PhaserPresentation;
  #events!: Phaser.Events.EventEmitter;
  #stop = () => this.dispose();
  #validateResources!: () => void;
  readonly #layout: RigPose;
  readonly #layouts = new Map<string, RigPose>();
  readonly #rig: RuntimeRigData;
  readonly #visualSkins: boolean;
  #presentationDirty = false;
  #disposed = false;
  #applying = false;
  #prepared = new WeakMap<ReplayPhaserPresentation, RigPose>();
  #simulated: ReplayPhaserPresentation | undefined;
  #preview: ReplayPhaserPresentation | undefined;
  #displayed: ReplayPhaserPresentation | null = null;
  #counts = { captures: 0, previewCaptures: 0, poseTransfers: 0, submissions: 0, guardedReads: 0, cacheHits: 0 };

  /** @internal Only validated assets possess the runtime construction token. */
  constructor(token: typeof construct, scene: Phaser.Scene, rig: RuntimeRigData, keys: readonly string[], clip: string, epoch: bigint, release: () => void, validateResources: () => void, visualSkins = false, events?: readonly SkinEvent[]) {
    requireThat(token === construct, 'Create Replay instances through a validated asset');
    this.#rig = rig; this.#visualSkins = visualSkins;
    this.#consumer = new ReplayConsumerBridge(rig, clip, epoch, events);
    let view: PhaserPresentation | undefined;
    try {
      this.#layout = evaluate(rig); // Pure setup FK, no EvaluationState/Legacy Physics.
      validateResources(); this.#validateResources = validateResources;
      this.#view = view = createReplayPhaserView(scene, rig, keys, visualSkins ? this.consumer.currentFrame().skin : undefined);
      this.root = this.#view.root;
      this.#events = scene.events;
      this.#events.once('shutdown', this.#stop); this.#events.once('destroy', this.#stop);
      this.root.once('destroy', () => {
        this.#events.off('shutdown', this.#stop); this.#events.off('destroy', this.#stop);
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
  #ready() { requireThat(!this.#disposed, 'Replay instance is disposed'); }
  get displayed(): ReplayPhaserPresentation | null { return this.#displayed; }
  /** Last successful presentation, including explicitly labeled pure previews. */
  get visualSkin(): string | null { return this.#displayed?.snapshot.skin ?? null; }
  get metrics() { return Object.freeze({ ...this.#counts }); }

  #prepare(kind: 'simulated' | 'pure-preview', snapshot: ConsumerFrame | ConsumerPreview): ReplayPhaserPresentation {
    const frame = freeze(snapshot);
    const presentation = Object.freeze({ kind, snapshot: frame }) as ReplayPhaserPresentation;
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
  capture(): ReplayPhaserPresentation & { readonly kind: 'simulated' } {
    this.#ready(); const status = this.consumer.transportStatus(), c = status.clock;
    requireThat(c, 'Replay consumer is disposed');
    const cached = this.#simulated;
    if (cached?.kind === 'simulated' && cached.snapshot.context === this.consumer.context && cached.snapshot.completed === c.completed
      && cached.snapshot.requested === c.requested && cached.snapshot.backlog === c.backlog && cached.snapshot.state === status.state) {
      this.#counts.cacheHits++; return cached;
    }
    this.#counts.captures++;
    const prepared = this.#prepare('simulated', this.consumer.currentFrame()) as ReplayPhaserPresentation & { readonly kind: 'simulated' };
    this.#simulated = prepared; return prepared;
  }
  capturePreview(): (ReplayPhaserPresentation & { readonly kind: 'pure-preview' }) | null {
    this.#ready(); if (this.consumer.transportStatus().state !== 'seek_preview') return null;
    const cached = this.#preview;
    if (cached?.kind === 'pure-preview' && cached.snapshot.context === this.consumer.context && cached.snapshot.tick === this.consumer.transportStatus().position) { this.#counts.cacheHits++; return cached; }
    const frame = this.consumer.previewFrame(); requireThat(frame, 'No pure seek preview'); this.#counts.previewCaptures++;
    const prepared = this.#prepare('pure-preview', frame) as ReplayPhaserPresentation & { readonly kind: 'pure-preview' };
    this.#preview = prepared; return prepared;
  }
  present(prepared: ReplayPhaserPresentation = this.capture()): ReplayPhaserPresentation { return this.#apply(prepared, 'simulated'); }
  presentPreview(prepared: ReplayPhaserPresentation | null = this.capturePreview()): ReplayPhaserPresentation {
    requireThat(prepared, 'No pure seek preview'); return this.#apply(prepared, 'pure-preview');
  }
  #apply(prepared: ReplayPhaserPresentation, kind: 'simulated' | 'pure-preview'): ReplayPhaserPresentation {
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
      this.#counts.guardedReads++; this.consumer.present(() => { this.#validateResources(); this.#view.setPose(pose, this.#visualSkins ? prepared.snapshot.skin : undefined); });
      this.#counts.submissions++; this.#displayed = prepared; this.#presentationDirty = false; return prepared;
    } catch (error) {
      if (this.#visualSkins) this.#presentationDirty = true;
      throw error;
    } finally { this.#applying = false; }
  }
  dispose(): void { if (!this.#disposed) { requireThat(!this.#applying, 'Cannot dispose during presentation'); this.#view.destroy(); } }
}
