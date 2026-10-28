import type Phaser from 'phaser';
import { evaluate } from '@ankhimate/runtime';
import type { Affine, AtlasRegion, MeshAttachment, RegionAttachment, RigPose, RuntimeAttachment, RuntimeRigData } from '@ankhimate/runtime';
import { MeshAtlas, MeshBinding, RigPlayback, points, polygonPieces, regionQuad } from '@ankhimate/runtime/render';
import type { MeshDraw } from '@ankhimate/runtime/render';
import { applyDarkTint } from './dark-tint.js';
import { finite, phaserSource, requireThat, validateMesh, validatePose } from './validate.js';
export interface PhaserRigOptions {
    pageTextureKeys: readonly string[];
    skin?: string;
}
const replayPresentation = Symbol('validated Replay presentation');
export interface PhaserPresentation { readonly root: Phaser.GameObjects.Container; setPose(pose: RigPose, skin?: string): void; destroy(): void; }
/** Internal factory, not a package export. */
export function createReplayPhaserView(scene: Phaser.Scene, rig: RuntimeRigData, pageTextureKeys: readonly string[], skin?: string): PhaserPresentation {
    return PhaserRig.replayView(replayPresentation, scene, rig, pageTextureKeys, skin);
}
interface MeshView {
    object: Phaser.GameObjects.Mesh;
    attachmentKey: string;
    indices: number[];
}
interface ClipView {
    graphics: Phaser.GameObjects.Graphics;
    mask: Phaser.Display.Masks.GeometryMask;
    vertices: number[];
}
interface Appearance {
    skin: string;
    attachments: Map<string, RuntimeAttachment>;
    bindings: Map<string, MeshBinding>;
    atlases: Map<string, MeshAtlas>;
    deforms: Map<string, number>;
}
interface Draw {
    slot: string;
    key: string;
    textureKey: string;
    region: AtlasRegion;
    geometry: MeshDraw;
    color: readonly [
        number,
        number,
        number,
        number
    ];
    dark: readonly [
        number,
        number,
        number,
        number
    ] | undefined;
    mask: string | undefined;
    order: number;
}
/** Projects the shared core and pure render geometry into Phaser 3 WebGL Meshes. */
export class PhaserRig {
    readonly root: Phaser.GameObjects.Container;
    readonly playback!: RigPlayback;
    readonly unsupported: readonly string[];
    private readonly views = new Map<string, MeshView>();
    private readonly clips = new Map<string, ClipView>();
    private readonly appearances = new Map<string, Appearance>();
    private readonly regions: Map<string, AtlasRegion>;
    private readonly rig: RuntimeRigData;
    private readonly pageTextureKeys: readonly string[];
    private readonly setupPose: RigPose;
    private skin: string;
    private disposed = false;
    private listening = false;
    constructor(private readonly scene: Phaser.Scene, source: RuntimeRigData, options: PhaserRigOptions, mode?: typeof replayPresentation, deferReplayPose = false) {
        requireThat(scene?.sys?.game?.renderer && 'gl' in scene.sys.game.renderer, "PhaserRig requires Phaser's WebGL renderer");
        this.rig = phaserSource(source);
        this.pageTextureKeys = [...options.pageTextureKeys];
        this.regions = new Map(this.rig.atlas!.regions.map(r => [r.name, r]));
        this.skin = options.skin ?? this.rig.defaultSkin!;
        this.setupPose = evaluate(this.rig);
        this.appearance(this.skin);
        this.validateTextures();
        this.validateFrames();
        const warnings = new Set<string>();
        for (const c of this.rig.constraints)
            warnings.add(`${c.type} constraints: outside Pixi parity contract; legacy core path only; physics integration is not Rust-qualified`);
        for (const s of this.rig.slots)
            if (s.blend !== 'normal')
                warnings.add(`${s.blend} composition: legacy Phaser path, not qualified Pixi parity`);
        for (const r of this.regions.values())
            if (r.rotated)
                warnings.add('Rotated atlas: legacy Phaser path, not qualified by Pixi');
        for (const s of this.rig.skins)
            for (const e of s.attachments) {
                if (e.attachment.type === 'mesh' && e.attachment.linked)
                    warnings.add('One-level linked meshes: legacy Phaser path, not qualified by Pixi');
                if (!['region', 'mesh', 'clipping'].includes(e.attachment.type))
                    warnings.add(`${e.attachment.type} attachments: query data, no visible draw`);
            }
        this.unsupported = Object.freeze([...warnings]);
        this.root = scene.add.container(0, 0);
        this.root.once('destroy', this.release, this);
        try {
            this.installAtlasFrames();
            if (mode === replayPresentation) { if (!deferReplayPose) this.apply(this.setupPose); return; }
            // Initially running preserves legacy player.play(...); update(ms) use. No clip means not playing.
            this.playback = new RigPlayback(this.rig, this.skin, (pose, skin) => this.apply(pose, this.appearance(skin)), requireThat, true);
            this.apply(this.player.pose());
        }
        catch (error) {
            this.root.destroy(true);
            throw error;
        }
    }
    /** @internal Runtime token is held only by the internal factory. */
    static replayView(token: typeof replayPresentation, scene: Phaser.Scene, rig: RuntimeRigData, keys: readonly string[], skin?: string): PhaserPresentation {
        requireThat(token === replayPresentation, 'Use the validated experimental asset');
        const view = new PhaserRig(scene, rig, { pageTextureKeys: keys, ...(skin === undefined ? {} : { skin }) }, token, skin !== undefined);
        return { root: view.root, setPose: (pose, skin) => {
            view.apply(pose, skin === undefined ? undefined : view.appearance(skin));
            // Scene preUpdate precedes prerender. Project the newly committed geometry now,
            // with the public Face API, without playback or Physics. These adapter-owned
            // meshes use identity 3D model/view and the existing orthographic projection;
            // application placement belongs to the public 2D root Container.
            for (const { object } of view.views.values())
                for (const face of object.faces)
                    face.transformCoordinatesLocal(object.projectionMatrix, object.width, object.height, 0);
        }, destroy: () => view.destroy() };
    }
    get player() { return this.playback.corePlayer; }
    get skinName(): string { return this.skin; }
    play(animation: string, restart = true): this {
        this.alive();
        if (!restart && this.player.animation === animation) {
            this.apply(this.player.pose());
            this.playback.resume();
        } else this.playback.play(animation);
        return this;
    }
    crossFade(animation: string, durationSeconds: number): this { this.playback.crossFade(animation, durationSeconds); return this; }
    setSkin(name: string): this { this.alive(); this.playback.setSkin(name); return this; }
    /** Direct sampling includes the duration endpoint, emits no events and detaches playback. */
    setTime(animation: string, time: number): RigPose {
        this.alive();
        const clip = this.rig.animations[animation];
        requireThat(clip, `Unknown clip ${animation}`);
        finite([time], 'Clip time');
        requireThat(time >= 0 && time <= clip.duration, 'Clip time must lie within [0,duration]');
        const pose = evaluate(this.rig, [{ animation, time, alpha: 1 }], { skin: this.skin });
        this.setPose(pose);
        return pose;
    }
    setPose(pose: RigPose): void { this.alive(); this.apply(pose); this.playback.detach(pose); }
    /** Legacy Phaser delta remains milliseconds. playback.update uses seconds. */
    update(deltaMilliseconds: number): RigPose { return this.playback.update(deltaMilliseconds / 1000); }
    destroy(): void {
        if (!this.disposed)
            this.root.destroy(true);
    }
    private alive(): void { requireThat(!this.disposed, 'Phaser rig is destroyed'); }
    private validateTextures(): void {
        for (const p of this.rig.atlas!.pages) {
            const key = this.pageTextureKeys[p.index];
            requireThat(key && this.scene.textures.exists(key), `Missing atlas texture for page ${p.index}`);
            const t = this.scene.textures.get(key), source = t.source[0];
            requireThat(source && source.width === p.width && source.height === p.height && source.glTexture?.pma, `Atlas page ${p.index}: expected full-size premultiplied texture ${p.width}x${p.height}`);
        }
    }
    private validateFrames(): void {
        for (const r of this.regions.values()) {
            const texture = this.scene.textures.get(this.pageTextureKeys[r.page]!);
            if (!texture.has(r.name))
                continue;
            const f = texture.get(r.name);
            requireThat(f.sourceIndex === 0 && f.cutX === r.x && f.cutY === r.y && f.cutWidth === r.width && f.cutHeight === r.height && f.rotated === r.rotated && f.realWidth === r.original_width && f.realHeight === r.original_height && f.x === r.offset_x && f.y === r.offset_y, `Atlas frame collision: ${r.name}; use distinct pageTextureKeys for different atlas data`);
        }
    }
    private installAtlasFrames(): void {
        for (const r of this.regions.values()) {
            const texture = this.scene.textures.get(this.pageTextureKeys[r.page]!);
            if (texture.has(r.name))
                continue;
            const f = texture.add(r.name, 0, r.x, r.y, r.width, r.height);
            requireThat(f, `Cannot install atlas frame ${r.name}`);
            f.rotated = r.rotated;
            if (r.rotated)
                f.updateUVsInverted();
            if (r.width !== r.original_width || r.height !== r.original_height)
                f.setTrim(r.original_width, r.original_height, r.offset_x, r.offset_y, r.width, r.height);
        }
    }
    private appearance(skin: string): Appearance {
        const cached = this.appearances.get(skin);
        if (cached)
            return cached;
        const selected = this.rig.skins.find(s => s.name === skin);
        requireThat(selected, `Unknown skin ${skin}`);
        const fallback = this.rig.skins.find(s => s.name === this.rig.defaultSkin), attachments = new Map<string, RuntimeAttachment>(), owners = new Map<string, {
            slot: string;
            name: string;
        }>();
        for (const s of [fallback, selected])
            if (s)
                for (const e of s.attachments) {
                    let a = e.attachment;
                    if (a.type === 'mesh' && a.linked) {
                        const link = a.linked, origin = this.rig.skins.find(s => s.name === link.skin) ?? fallback, source = origin?.attachments.find(e => e.slot === link.slot && e.name === link.attachment)?.attachment;
                        requireThat(source?.type === 'mesh' && !source.linked, `${e.name}: missing, cyclic or chained linked mesh (unsupported)`);
                        a = { ...source, texture: a.texture || source.texture, sequence: a.sequence ?? source.sequence, linked: a.linked };
                    }
                    attachments.set(`${e.slot}\0${e.name}`, a);
                    owners.set(`${e.slot}\0${e.name}`, { slot: e.slot, name: e.name });
                }
        const bindings = new Map<string, MeshBinding>(), atlases = new Map<string, MeshAtlas>(), deforms = new Map<string, number>();
        for (const [key, a] of attachments) {
            if (a.type !== 'mesh')
                continue;
            validateMesh(a, key, this.rig);
            const { slot, name } = owners.get(key)!;
            const deformKey = a.linked?.inherit_deform ? `${a.linked.slot}\0${a.linked.attachment}` : key;
            bindings.set(key, new MeshBinding(this.rig, slot, name, a, this.setupPose ?? evaluate(this.rig), deformKey));
            deforms.set(key, 2 * (a.weighted ? a.weights.reduce((sum, w) => sum + w.bones.length, 0) : a.vertex_count));
            for (const texture of [a.texture, ...(a.sequence?.frames ?? [])]) {
                const r = this.regions.get(texture);
                requireThat(r, `${key}: missing atlas region ${texture}`);
                if (!r.rotated)
                    atlases.set(`${key}\0${texture}`, new MeshAtlas(a, r, this.rig.atlas!.pages[r.page]!));
            }
        }
        for (const clip of Object.values(this.rig.animations))
            for (const track of clip.deform) {
                const count = deforms.get(`${track.slot}\0${track.attachment}`);
                requireThat(count !== undefined && track.keys.every(k => k.offsets.length === count), `Skin ${skin}: incompatible deform attachment/dimensions`);
            }
        const result = { skin, attachments, bindings, atlases, deforms };
        this.appearances.set(skin, result);
        return result;
    }
    private geometry(a: RegionAttachment | MeshAttachment, key: string, texture: string, region: AtlasRegion, pose: RigPose, appearance: Appearance, host: string): MeshDraw | undefined {
        if (a.type === 'mesh') {
            const positions = appearance.bindings.get(key)!.positions(pose);
            if (!region.rotated)
                return appearance.atlases.get(`${key}\0${texture}`)!.draw(positions);
            return { positions, uvs: this.legacyRotatedUvs(region, a.uvs), indices: Uint32Array.from(a.triangles) };
        }
        const world = pose.bones.find(b => b.name === host)!.world;
        if (!region.rotated) {
            const quad = regionQuad(a, region, this.rig.atlas!.pages[region.page]!, world);
            return quad && { ...quad, indices: new Uint32Array([0, 1, 2, 0, 2, 3]) };
        }
        const positions = Float32Array.from(transformPositions(regionCorners(a), world), (v, i) => i % 2 ? -v : v);
        return { positions, uvs: this.legacyRotatedUvs(region, attachmentUvs(a)), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) };
    }
    private legacyRotatedUvs(r: AtlasRegion, local: readonly number[]): Float32Array {
        const page = this.rig.atlas!.pages[r.page]!;
        return Float32Array.from(local.map((_, i) => i % 2 ? (r.y + local[i - 1]! * r.width) / page.height : (r.x + (1 - local[i + 1]!) * r.height) / page.width));
    }
    private apply(pose: RigPose, appearance = this.appearance(this.skin)): void {
        this.alive();
        validatePose(this.rig, pose, appearance.deforms);
        this.validateTextures();
        const slots = new Map(pose.slots.map(s => [s.name, s])), draws: Draw[] = [], clipUpdates = new Map<string, number[]>();
        let mask: string | undefined, end: string | null | undefined;
        // Prepare the whole pose first. Invalid input cannot change a displayed mask or mesh.
        for (const [order, name] of pose.drawOrder.entries()) {
            const slot = slots.get(name)!, setup = this.rig.slots.find(s => s.name === name)!, key = `${name}\0${slot.attachment}`, a = slot.attachment === null ? undefined : appearance.attachments.get(key);
            if (a?.type === 'clipping') {
                const world = pose.bones.find(b => b.name === setup.bone)!.world, vertices = transformPositions(a.vertices, world);
                polygonPieces(points(vertices), name, requireThat);
                clipUpdates.set(name, vertices);
                mask = name;
                end = a.end_slot;
                continue;
            }
            const activeMask = mask;
            if (end === name) {
                mask = undefined;
                end = undefined;
            }
            if (!slot.visible || slot.attachment === null)
                continue;
            requireThat(a, `${name}: unknown attachment ${slot.attachment}`);
            if (a.type !== 'region' && a.type !== 'mesh')
                continue;
            requireThat(Number.isInteger(slot.sequenceFrame) && slot.sequenceFrame >= 0, `${name}: invalid sequence frame`);
            const texture = a.sequence ? a.sequence.frames[slot.sequenceFrame] : a.texture, region = texture === undefined ? undefined : this.regions.get(texture);
            requireThat(region, `${name}: missing region/sequence frame ${texture}`);
            const geometry = this.geometry(a, key, texture!, region, pose, appearance, setup.bone);
            if (!geometry || !geometry.indices.length)
                continue;
            finite(Array.from(geometry.positions), `${name}: rendered vertices`);
            finite(Array.from(geometry.uvs), `${name}: rendered UVs`);
            draws.push({ slot: name, key, textureKey: this.pageTextureKeys[region.page]!, region, geometry, color: slot.color, dark: slot.dark_color, mask: activeMask, order });
        }
        for (const [name, vertices] of clipUpdates)
            this.ensureClip(name).vertices = vertices;
        const active = new Set<string>();
        for (const d of draws) {
            const view = this.ensureView(d.slot, d.key, d.textureKey, d.region.name, d.geometry);
            active.add(d.slot);
            const mesh = view.object;
            mesh.setVisible(true).setDepth(d.order).setBlendMode(blendMode(this.rig.slots.find(s => s.name === d.slot)!.blend)).setTexture(d.textureKey, d.region.name);
            applyDarkTint(this.scene, mesh, d.color, d.dark, d.region, this.rig.atlas!.pages[d.region.page]!);
            mesh.setOrtho(mesh.width, mesh.height);
            if (d.mask)
                mesh.setMask(this.clips.get(d.mask)!.mask);
            else
                mesh.clearMask(false);
            for (let i = 0; i < mesh.vertices.length; i++) {
                const source = view.indices[i]!, v = mesh.vertices[i]!;
                v.x = d.geometry.positions[source * 2]!;
                v.y = -d.geometry.positions[source * 2 + 1]!;
                v.color = 0xffffff;
                v.alpha = 1;
                v.setUVs(d.geometry.uvs[source * 2]!, d.geometry.uvs[source * 2 + 1]!);
            }
        }
        for (const [slot, view] of this.views)
            if (!active.has(slot))
                view.object.setVisible(false);
        this.root.sort('depth');
        this.skin = appearance.skin;
    }
    private ensureView(slot: string, key: string, texture: string, frame: string, g: MeshDraw): MeshView {
        let view = this.views.get(slot);
        if (!view) {
            const object = this.scene.add.mesh(0, 0, texture, frame, Array.from(g.positions), Array.from(g.uvs), Array.from(g.indices), false);
            object.hideCCW = false;
            object.ignoreDirtyCache = true;
            this.root.add(object);
            view = { object, attachmentKey: key, indices: Array.from(g.indices) };
            this.views.set(slot, view);
        }
        else {
            if (view.indices.length !== g.indices.length) {
                view.object.clear();
                view.object.addVertices(Array.from(g.positions), Array.from(g.uvs), Array.from(g.indices), false);
                view.indices = Array.from(g.indices);
            }
            else
                for (let i = 0; i < view.indices.length; i++)
                    view.indices[i] = g.indices[i]!;
            view.attachmentKey = key;
        }
        return view;
    }
    private ensureClip(slot: string): ClipView {
        const current = this.clips.get(slot);
        if (current)
            return current;
        if (!this.listening) {
            this.scene.events.on('prerender', this.syncClips, this);
            this.listening = true;
        }
        const graphics = this.scene.make.graphics({}, false);
        graphics.setVisible(false);
        const clip = { graphics, mask: graphics.createGeometryMask(), vertices: [] as number[] };
        this.clips.set(slot, clip);
        return clip;
    }
    private syncClips(): void {
        const matrix = this.root.getWorldTransformMatrix();
        let x = 1, y = 1;
        for (let p: Phaser.GameObjects.Container | null = this.root; p; p = p.parentContainer) {
            x *= p.scrollFactorX;
            y *= p.scrollFactorY;
        }
        for (const { graphics, vertices } of this.clips.values()) {
            graphics.clear().setScrollFactor(x, y).fillStyle(0xffffff).beginPath();
            for (let i = 0; i < vertices.length; i += 2) {
                const x = matrix.getX(vertices[i]!, -vertices[i + 1]!), y = matrix.getY(vertices[i]!, -vertices[i + 1]!);
                if (i === 0)
                    graphics.moveTo(x, y);
                else
                    graphics.lineTo(x, y);
            }
            graphics.closePath().fillPath();
        }
    }
    private release(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        this.playback?.destroy();
        if (this.listening)
            this.scene.events.off('prerender', this.syncClips, this);
        for (const v of this.views.values())
            v.object.clearMask(false);
        for (const { graphics, mask } of this.clips.values()) {
            mask.destroy();
            graphics.destroy();
        }
        this.views.clear();
        this.clips.clear();
        this.appearances.clear();
    }
}
function regionCorners(a: RegionAttachment): number[] {
    const left = -a.pivot_x * a.width * a.scale_x, right = (1 - a.pivot_x) * a.width * a.scale_x, bottom = -a.pivot_y * a.height * a.scale_y, top = (1 - a.pivot_y) * a.height * a.scale_y;
    const rotation = a.rotation * Math.PI / 180, sin = Math.sin(rotation), cos = Math.cos(rotation);
    const p = (x: number, y: number) => [x * cos - y * sin + a.x, x * sin + y * cos + a.y];
    return [...p(left, top), ...p(left, bottom), ...p(right, bottom), ...p(right, top)];
}
function attachmentUvs(a: RegionAttachment): number[] { const [u0, v0, u1, v1] = a.uv; return [u0!, v0!, u0!, v1!, u1!, v1!, u1!, v0!]; }
function transformPositions(vertices: number[], world: Affine): number[] {
    const result: number[] = [];
    for (let i = 0; i < vertices.length; i += 2)
        result.push(...transformPoint(world, vertices[i]!, vertices[i + 1]!));
    return result;
}
function transformPoint(m: Affine, x: number, y: number): [
    number,
    number
] { return [m.a * x + m.c * y + m.tx, m.b * x + m.d * y + m.ty]; }
function blendMode(mode: string): string { return ({ normal: "NORMAL", additive: "ADD", multiply: "MULTIPLY", screen: "SCREEN" } as Record<string, string>)[mode] ?? "NORMAL"; }
