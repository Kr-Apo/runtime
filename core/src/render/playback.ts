import { RigPlayer } from '../index.js';
import type { RigPose, RuntimeAnimation, RuntimeEvent, RuntimeRigData } from '../index.js';
import { requireThat } from './checks.js';
import type { Ensure } from './checks.js';

export interface PlayOptions { loop?: boolean; }
export type AnimationEventListener = (event: Readonly<RuntimeEvent>) => void;

/** Per-instance transport. Sampling, blending and event intervals belong to RigPlayer. */
export class RigPlayback {
  private readonly rig: RuntimeRigData;
  private player: RigPlayer;
  private running = false;
  private disposed = false;
  private advancing = false;
  private rate = 1;
  private pending: readonly Readonly<RuntimeEvent>[] = [];
  private readonly listeners = new Set<AnimationEventListener>();
  private lastPose: RigPose;

  /** Created by PixiRigInstance.playback; do not construct a second controller. */
  constructor(rig: RuntimeRigData, private skin: string, private readonly render: (pose: RigPose, skin: string) => void, private readonly ensure: Ensure = requireThat, initiallyRunning = false) {
    // Only looping metadata is overridden, locally. Authored tracks stay shared/read-only.
    this.rig = { ...rig, animations: Object.fromEntries(Object.entries(rig.animations).map(([n, a]) => [n, { ...a }])) };
    for (const [name, clip] of Object.entries(rig.animations)) this.defaultLoops.set(name, clip.looping);
    this.player = this.newPlayer();
    this.running = initiallyRunning;
    this.lastPose = this.player.pose();
  }

  /** Low-level core access for legacy adapters; high-level control owns pause/stop. */
  get corePlayer(): RigPlayer { return this.player; }

  private finite(values: readonly unknown[], label: string): void { this.ensure(values.every(v => typeof v === 'number' && Number.isFinite(v)), `${label}: expected finite numbers`); }

  get animation(): string | undefined { return this.player.animation; }
  get time(): number { return this.player.time; }
  get playing(): boolean { return this.running && !this.disposed && this.player.animation !== undefined; }
  get speed(): number { return this.rate; }
  set speed(value: number) {
    this.alive(); this.finite([value], 'Playback speed');
    this.ensure(value > 0, 'Playback speed must be positive'); this.rate = value;
  }
  get events(): readonly Readonly<RuntimeEvent>[] { return this.pending; }

  /** Appearance only: preserve tracks, fade, transport and the pending event batch. */
  setSkin(name: string): this {
    this.alive();
    const previous = this.skin;
    this.player.setSkin(name);
    try {
      // A detached direct pose remains a direct pose, not a jump back to setup.
      const pose = this.player.animation ? this.player.pose() : this.lastPose;
      this.render(pose, name);
      this.skin = name; this.lastPose = pose;
    } catch (error) { this.player.setSkin(previous); throw error; }
    return this;
  }

  play(name: string, options: PlayOptions = {}): this {
    const clip = this.clip(name, options);
    clip.looping = options.loop ?? this.originalLoop(name);
    this.player.play(name); this.running = true; this.pending = [];
    this.display(this.player.pose()); return this;
  }

  crossFade(name: string, duration: number, options: PlayOptions = {}): this {
    const clip = this.clip(name, options);
    this.finite([duration], 'Crossfade duration'); this.ensure(duration >= 0, 'Crossfade duration must be non-negative');
    clip.looping = options.loop ?? this.originalLoop(name);
    this.player.crossFade(name, duration); this.running = true; this.pending = [];
    this.display(this.player.pose()); return this;
  }

  pause(): this { this.alive(); this.running = false; this.pending = []; return this; }
  resume(): this { this.alive(); this.running = this.player.animation !== undefined; this.pending = []; return this; }
  stop(): this {
    this.alive(); this.player = this.newPlayer(); this.running = false; this.pending = [];
    this.display(this.player.pose()); return this;
  }

  update(dtSeconds: number): RigPose {
    this.alive(); this.finite([dtSeconds], 'Playback delta');
    this.ensure(dtSeconds >= 0 && Number.isFinite(dtSeconds * this.rate), 'Playback delta must be non-negative with finite scaled time');
    this.ensure(!this.advancing, 'Recursive playback.update is not allowed');
    const delta = dtSeconds * this.rate;
    if (this.running && this.player.animation) {
      const clip = this.rig.animations[this.player.animation]!;
      // Emitting millions of events cannot be made allocation-free. Refuse before advancing.
      this.ensure(!clip.looping || clip.duration <= 0 || clip.events.length === 0
        || (Math.ceil(delta / clip.duration) + 1) * clip.events.length <= 100_000,
      'Playback update would emit too many events; split the delta');
    }
    this.pending = [];
    if (!this.running) { this.player.events.length = 0; return this.lastPose; }
    this.advancing = true;
    try {
      const pose = this.player.update(delta); this.display(pose);
      this.pending = Object.freeze(this.player.events.map(e => Object.freeze({ ...e })));
      const events = this.pending;
      // Snapshot the batch. Callbacks may pause/play/destroy, but cannot recursively advance.
      for (const event of events) for (const listener of [...this.listeners]) {
        if (this.disposed) return pose;
        if (this.listeners.has(listener)) listener(event);
      }
      return pose;
    } finally { this.advancing = false; }
  }

  onEvent(listener: AnimationEventListener): () => void {
    this.alive(); this.ensure(typeof listener === 'function', 'Event listener must be a function');
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }

  /** A successful direct pose/seek detaches playback; resume then has no clip to resume. */
  detach(pose: RigPose): void {
    this.player = this.newPlayer(); this.running = false; this.pending = []; this.lastPose = pose;
  }

  destroy(): void {
    if (this.disposed) return;
    this.running = false; this.pending = []; this.listeners.clear(); this.disposed = true;
  }

  private readonly defaultLoops = new Map<string, boolean>();
  private originalLoop(name: string): boolean {
    return this.defaultLoops.get(name)!;
  }
  private newPlayer(): RigPlayer { return new RigPlayer(this.rig).setSkin(this.skin); }
  private display(pose: RigPose): void { this.render(pose, this.skin); this.lastPose = pose; }
  private alive(): void { this.ensure(!this.disposed, 'Playback controller is destroyed'); }
  private clip(name: string, options: PlayOptions): RuntimeAnimation {
    this.alive();
    this.ensure(typeof name === 'string' && Object.hasOwn(this.rig.animations, name), `Unknown clip ${String(name)}`);
    this.ensure(options && typeof options === 'object' && !Array.isArray(options)
      && (options.loop === undefined || typeof options.loop === 'boolean'), 'Playback loop must be boolean');
    return this.rig.animations[name]!;
  }
}
