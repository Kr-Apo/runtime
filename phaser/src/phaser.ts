import type Phaser from "phaser";
import { evaluate, RigPlayer } from "@ankhimate/runtime";
import type { Affine, MeshAttachment, RegionAttachment, RigPose, RuntimeAttachment, RuntimeRigData, RuntimeSkin } from "@ankhimate/runtime";
import { applyDarkTint } from "./dark-tint.js";

export interface PhaserRigOptions { pageTextureKeys: readonly string[]; skin?: string; }
interface MeshView { object: Phaser.GameObjects.Mesh; attachmentKey: string; indices: number[]; }
interface ClipView { graphics: Phaser.GameObjects.Graphics; mask: Phaser.Display.Masks.GeometryMask; vertices: number[]; }

/** WebGL rendering and playback for an Ankhimate runtime export. */
export class PhaserRig {
  readonly player: RigPlayer;
  readonly root: Phaser.GameObjects.Container;
  readonly unsupported: readonly string[] = [];
  private readonly scene: Phaser.Scene;
  private readonly views = new Map<string, MeshView>();
  private readonly clips = new Map<string, ClipView>();
  private readonly attachments = new Map<string, RuntimeAttachment>();
  private readonly regions = new Map<string, { page: number }>();
  private readonly pageTextureKeys: readonly string[];
  private readonly setupPose: RigPose;
  private skinName: string;

  constructor(scene: Phaser.Scene, rig: RuntimeRigData, options: PhaserRigOptions) {
    if (!("gl" in scene.sys.game.renderer)) throw new Error("PhaserRig requires Phaser's WebGL renderer");
    this.scene = scene;
    this.player = new RigPlayer(rig);
    this.root = scene.add.container(0, 0);
    this.pageTextureKeys = options.pageTextureKeys;
    this.skinName = options.skin ?? rig.defaultSkin ?? rig.skins[0]?.name ?? "";
    if (this.skinName) this.player.setSkin(this.skinName);
    this.setupPose = evaluate(rig, [], { skin: this.skinName });
    this.installAtlasFrames(rig);
    this.selectSkin(this.skinName);
    this.apply(this.player.pose());
  }

  play(animation: string, restart = true): this { this.player.play(animation, restart); this.apply(this.player.pose()); return this; }
  crossFade(animation: string, durationSeconds: number): this { this.player.crossFade(animation, durationSeconds); return this; }
  setSkin(name: string): this {
    if (!this.player.rig.skins.some((skin) => skin.name === name)) throw new Error(`unknown skin ${JSON.stringify(name)}`);
    this.skinName = name; this.player.setSkin(name); this.selectSkin(name); this.apply(this.player.pose()); return this;
  }
  update(deltaMilliseconds: number): RigPose { const pose = this.player.update(deltaMilliseconds / 1000); this.apply(pose); return pose; }
  destroy(): void { this.root.destroy(true); this.views.clear(); this.clips.clear(); }

  private installAtlasFrames(rig: RuntimeRigData): void {
    if (!rig.atlas) return;
    for (const region of rig.atlas.regions) {
      const textureKey = this.pageTextureKeys[region.page];
      if (!textureKey) throw new Error(`missing pageTextureKeys[${region.page}] for ${region.name}`);
      const texture = this.scene.textures.get(textureKey);
      const frame = texture.has(region.name) ? texture.get(region.name)
        : texture.add(region.name, 0, region.x, region.y, region.width, region.height)!;
      frame.rotated = region.rotated;
      if (region.rotated) frame.updateUVsInverted();
      if (region.width !== region.original_width || region.height !== region.original_height) frame.setTrim(region.original_width, region.original_height, region.offset_x, region.offset_y, region.width, region.height);
      this.regions.set(region.name, { page: region.page });
    }
  }

  private selectSkin(name: string): void {
    this.attachments.clear();
    const skins = this.inheritedSkins(name);
    for (const skin of skins) for (const entry of skin.attachments) this.attachments.set(`${entry.slot}\0${entry.name}`, this.resolveLinked(entry.attachment, skins));
  }

  private inheritedSkins(name: string): RuntimeSkin[] {
    const selected = this.player.rig.skins.find((skin) => skin.name === name);
    const fallback = this.player.rig.skins.find((skin) => skin.name === this.player.rig.defaultSkin);
    return fallback && fallback !== selected ? [fallback, ...(selected ? [selected] : [])] : selected ? [selected] : [];
  }

  private resolveLinked(attachment: RuntimeAttachment, skins: RuntimeSkin[]): RuntimeAttachment {
    if (attachment.type !== "mesh" || !attachment.linked) return attachment;
    const link = attachment.linked;
    const sourceSkin = this.player.rig.skins.find((skin) => skin.name === link.skin) ?? skins[0];
    const source = sourceSkin?.attachments.find((entry) => entry.slot === link.slot && entry.name === link.attachment)?.attachment;
    if (source?.type !== "mesh") return attachment;
    return { ...source, texture: attachment.texture || source.texture, sequence: attachment.sequence ?? source.sequence, linked: attachment.linked };
  }

  private apply(pose: RigPose): void {
    const slots = new Map(pose.slots.map((slot) => [slot.name, slot]));
    const setupSlots = new Map(this.player.rig.slots.map((slot) => [slot.name, slot]));
    const active = new Set<string>();
    let currentMask: Phaser.Display.Masks.GeometryMask | undefined;
    let clipEnd: string | null | undefined;
    for (let order = 0; order < pose.drawOrder.length; order += 1) {
      const slotName = pose.drawOrder[order]!; const slot = slots.get(slotName); const setup = setupSlots.get(slotName);
      // The end slot is still clipped if drawn, but every skip path must close
      // the group before processing the following slot (matching Rust).
      const slotMask = currentMask;
      if (clipEnd === slotName) { currentMask = undefined; clipEnd = undefined; }
      if (!slot || !setup || !slot.visible || !slot.attachment) continue;
      const attachmentKey = `${slotName}\0${slot.attachment}`; const attachment = this.attachments.get(attachmentKey);
      if (attachment?.type === "clipping") {
        const host = pose.bones.find((bone) => bone.name === setup.bone)?.world;
        if (host) {
          const clip = this.ensureClip(slotName);
          clip.vertices = transformPositions(attachment.vertices, host);
          currentMask = clip.mask; clipEnd = attachment.end_slot;
        }
        continue;
      }
      if (!attachment || (attachment.type !== "region" && attachment.type !== "mesh")) continue;
      const textureName = sequenceTexture(attachment, slot.sequenceFrame); const region = this.regions.get(textureName);
      const textureKey = region ? this.pageTextureKeys[region.page] : undefined; if (!textureKey) continue;
      const geometry = this.geometry(attachment, slotName, slot.attachment, setup.bone, pose);
      const atlasUvs = this.atlasUvs(textureKey, textureName, geometry.uvs);
      const view = this.ensureView(slotName, attachmentKey, textureKey, textureName, atlasUvs, geometry.indices);
      active.add(slotName);
      view.object.setVisible(true).setDepth(order).setBlendMode(blendMode(setup.blend)).setTexture(textureKey, textureName);
      applyDarkTint(this.scene, view.object, slot.color, slot.dark_color);
      view.object.setOrtho(view.object.width, view.object.height);
      if (slotMask) view.object.setMask(slotMask); else view.object.clearMask(false);
      const tint = rgbTint(slot.color);
      for (let index = 0; index < view.object.vertices.length; index += 1) {
        const sourceIndex = view.indices[index]!; const vertex = view.object.vertices[index]!;
        // Mesh vertices are Y-up: Phaser's Vertex projection converts to screen
        // Y-down. Unlike 2D Graphics, they must not be negated here as well.
        vertex.x = geometry.positions[sourceIndex * 2]!; vertex.y = geometry.positions[sourceIndex * 2 + 1]!; vertex.color = tint; vertex.alpha = slot.color[3];
        // Phaser submits translated tu/tv, which setUVs updates along with u/v.
        vertex.setUVs(atlasUvs[sourceIndex * 2]!, atlasUvs[sourceIndex * 2 + 1]!);
      }
      (view.object as Phaser.GameObjects.Mesh & { dirtyCache: number[] }).dirtyCache[9] = -1;
    }
    for (const [slot, view] of this.views) if (!active.has(slot)) view.object.setVisible(false);
    // Container children do not participate in the Scene's automatic depth sort.
    this.root.sort("depth");
  }

  private atlasUvs(textureKey: string, frameName: string, local: number[]): number[] {
    const frame = this.scene.textures.getFrame(textureKey, frameName);
    const width = frame.source.width; const height = frame.source.height; const result: number[] = [];
    for (let index = 0; index < local.length; index += 2) {
      const u = local[index]!; const v = local[index + 1]!;
      if (frame.rotated) result.push((frame.cutX + (1 - v) * frame.cutHeight) / width, (frame.cutY + u * frame.cutWidth) / height);
      else result.push((frame.cutX + u * frame.cutWidth) / width, (frame.cutY + v * frame.cutHeight) / height);
    }
    return result;
  }

  private ensureClip(slot: string): ClipView {
    const existing = this.clips.get(slot); if (existing) return existing;
    if (this.clips.size === 0) {
      this.scene.events.on("prerender", this.syncClips, this);
      this.root.once("destroy", this.releaseClips, this);
    }
    // GeometryMask renders Graphics without its parent Container matrix.
    const graphics = this.scene.make.graphics({}, false); graphics.setVisible(false);
    const view = { graphics, mask: graphics.createGeometryMask(), vertices: [] }; this.clips.set(slot, view); return view;
  }

  private syncClips(): void {
    // Run after game updates, so public root/ancestor transform changes made
    // after rig.update also take effect. Phaser still applies each camera.
    const matrix = this.root.getWorldTransformMatrix();
    let scrollX = 1; let scrollY = 1;
    for (let parent: Phaser.GameObjects.Container | null = this.root; parent; parent = parent.parentContainer) {
      scrollX *= parent.scrollFactorX; scrollY *= parent.scrollFactorY;
    }
    for (const { graphics, vertices } of this.clips.values()) {
      graphics.clear().setScrollFactor(scrollX, scrollY).fillStyle(0xffffff).beginPath();
      for (let i = 0; i < vertices.length; i += 2) {
        const x = matrix.getX(vertices[i]!, -vertices[i + 1]!); const y = matrix.getY(vertices[i]!, -vertices[i + 1]!);
        if (i === 0) graphics.moveTo(x, y); else graphics.lineTo(x, y);
      }
      graphics.closePath().fillPath();
    }
  }

  private releaseClips(): void {
    this.scene.events.off("prerender", this.syncClips, this);
    for (const view of this.views.values()) view.object.clearMask(false);
    for (const { graphics, mask } of this.clips.values()) { mask.destroy(); graphics.destroy(); }
    this.views.clear();
    this.clips.clear();
  }

  private ensureView(slot: string, attachmentKey: string, textureKey: string, frame: string, uvs: number[], indices: number[]): MeshView {
    let view = this.views.get(slot);
    if (view && (view.attachmentKey !== attachmentKey || view.indices.length !== indices.length)) { view.object.destroy(); this.views.delete(slot); view = undefined; }
    if (view) return view;
    const positions = new Array(uvs.length).fill(0);
    const object = this.scene.add.mesh(0, 0, textureKey, frame, positions, uvs, indices, false);
    object.setOrtho(object.width, object.height); object.hideCCW = false; this.root.add(object);
    view = { object, attachmentKey, indices: [...indices] }; this.views.set(slot, view); return view;
  }

  private geometry(attachment: RegionAttachment | MeshAttachment, slot: string, attachmentName: string, hostBone: string, pose: RigPose): { positions: number[]; uvs: number[]; indices: number[] } {
    if (attachment.type === "region") {
      const world = pose.bones.find((bone) => bone.name === hostBone)!.world;
      return { positions: transformPositions(regionCorners(attachment), world), uvs: attachmentUvs(attachment), indices: [0, 1, 2, 0, 2, 3] };
    }
    const deformSlot = attachment.linked?.inherit_deform ? attachment.linked.slot : slot;
    const deformName = attachment.linked?.inherit_deform ? attachment.linked.attachment : attachmentName;
    const deform = pose.deforms[`${deformSlot}\0${deformName}`] ?? []; const host = pose.bones.find((bone) => bone.name === hostBone)!.world;
    const setupHost = this.setupPose.bones.find((bone) => bone.name === hostBone)!.world; const positions: number[] = []; let influenceOffset = 0;
    for (let vertex = 0; vertex < attachment.vertex_count; vertex += 1) {
      const weights = attachment.weights[vertex]?.bones ?? [];
      if (!attachment.weighted || weights.length === 0) {
        positions.push(...transformPoint(host, attachment.vertices[vertex * 2]! + (deform[vertex * 2] ?? 0), attachment.vertices[vertex * 2 + 1]! + (deform[vertex * 2 + 1] ?? 0)));
      } else {
        let x = 0; let y = 0; let total = 0;
        for (let influence = 0; influence < weights.length; influence += 1) {
          const weight = weights[influence]!; const world = pose.bones.find((bone) => bone.name === weight.bone)?.world; const setupWorld = this.setupPose.bones.find((bone) => bone.name === weight.bone)?.world;
          if (!world || !setupWorld) continue;
          const offsetX = deform[(influenceOffset + influence) * 2] ?? 0; const offsetY = deform[(influenceOffset + influence) * 2 + 1] ?? 0;
          const localOffset = transformVector(invert(setupWorld), ...transformVector(setupHost, offsetX, offsetY)); const placed = transformPoint(world, weight.x + localOffset[0], weight.y + localOffset[1]);
          x += placed[0] * weight.weight; y += placed[1] * weight.weight; total += weight.weight;
        }
        positions.push(total > 0 ? x / total : 0, total > 0 ? y / total : 0); influenceOffset += weights.length;
      }
    }
    return { positions, uvs: [...attachment.uvs], indices: [...attachment.triangles] };
  }
}

function regionCorners(a: RegionAttachment): number[] {
  const left=-a.pivot_x*a.width*a.scale_x,right=(1-a.pivot_x)*a.width*a.scale_x,bottom=-a.pivot_y*a.height*a.scale_y,top=(1-a.pivot_y)*a.height*a.scale_y;
  const rotation=a.rotation*Math.PI/180,sin=Math.sin(rotation),cos=Math.cos(rotation);const p=(x:number,y:number)=>[x*cos-y*sin+a.x,x*sin+y*cos+a.y];
  return [...p(left,top),...p(left,bottom),...p(right,bottom),...p(right,top)];
}
function attachmentUvs(a: RegionAttachment): number[] { const [u0,v0,u1,v1]=a.uv;return[u0!,v0!,u0!,v1!,u1!,v1!,u1!,v0!]; }
function transformPositions(vertices:number[],world:Affine):number[]{const result:number[]=[];for(let i=0;i<vertices.length;i+=2)result.push(...transformPoint(world,vertices[i]!,vertices[i+1]!));return result;}
function transformPoint(m:Affine,x:number,y:number):[number,number]{return[m.a*x+m.c*y+m.tx,m.b*x+m.d*y+m.ty];}
function transformVector(m:Affine,x:number,y:number):[number,number]{return[m.a*x+m.c*y,m.b*x+m.d*y];}
function invert(m:Affine):Affine{const det=m.a*m.d-m.b*m.c;if(Math.abs(det)<1e-12)return{a:1,b:0,c:0,d:1,tx:0,ty:0};const k=1/det,a=m.d*k,b=-m.b*k,c=-m.c*k,d=m.a*k;return{a,b,c,d,tx:-(a*m.tx+c*m.ty),ty:-(b*m.tx+d*m.ty)};}
function sequenceTexture(a:RegionAttachment|MeshAttachment,frame:number):string{return a.sequence?.frames[frame]??a.texture;}
function blendMode(mode:string):string{return({normal:"NORMAL",additive:"ADD",multiply:"MULTIPLY",screen:"SCREEN"}as Record<string,string>)[mode]??"NORMAL";}
function rgbTint(color:readonly[number,number,number,number]):number{const b=(v:number)=>Math.max(0,Math.min(255,Math.round(v*255)));return(b(color[0])<<16)|(b(color[1])<<8)|b(color[2]);}
