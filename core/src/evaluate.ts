import type {
  Affine,
  AnimationLayer,
  BonePose,
  Curve,
  EvaluationState,
  RigPose,
  RuntimeRigData,
  ScalarKey,
  SlotPose,
  VectorKey,
} from "./types.js";
import { animationOf } from "./rig.js";
import { applyConstraints, type ConstraintOverrides } from "./constraints.js";

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

function wrap(angle: number): number {
  angle = ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return angle <= -Math.PI ? angle + TAU : angle;
}

function bezierAxis(t: number, p1: number, p2: number): number {
  const inv = 1 - t;
  return 3 * inv * inv * t * p1 + 3 * inv * t * t * p2 + t * t * t;
}

function bezierEase(target: number, handles: readonly [number, number, number, number]): number {
  const [x1, y1, x2, y2] = handles;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 20; i += 1) {
    const mid = (low + high) / 2;
    if (bezierAxis(mid, x1, x2) < target) low = mid;
    else high = mid;
  }
  return bezierAxis((low + high) / 2, y1, y2);
}

function ease(fraction: number, curve: Curve): number {
  if (curve === "linear") return fraction;
  if (curve === "stepped") return 0;
  return bezierEase(fraction, curve.handles);
}

function span<T extends { time: number; curve?: Curve }>(keys: readonly T[], time: number): [T, T, number] | undefined {
  const first = keys[0];
  if (!first) return undefined;
  if (keys.length === 1 || time <= first.time) return [first, first, 0];
  const last = keys[keys.length - 1]!;
  if (time >= last.time) return [last, last, 0];
  let low = 0;
  let high = keys.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >>> 1;
    if (keys[mid]!.time <= time) low = mid;
    else high = mid;
  }
  const from = keys[low]!;
  const to = keys[high]!;
  const raw = to.time > from.time ? (time - from.time) / (to.time - from.time) : 1;
  return [from, to, ease(raw, from.curve ?? "linear")];
}

function scalar(keys: readonly ScalarKey[], time: number, angle = false): number | undefined {
  const located = span(keys, time);
  if (!located) return undefined;
  const [from, to, t] = located;
  if (from === to) return from.value;
  let delta = to.value - from.value;
  if (angle) {
    // Rust's signed shortest arc keeps both exact half-turn directions.
    delta %= 360;
    if (delta > 180) delta -= 360;
    else if (delta < -180) delta += 360;
  }
  return from.value + delta * t;
}

function vector(keys: readonly VectorKey[], time: number): readonly [number, number] | undefined {
  const located = span(keys, time);
  if (!located) return undefined;
  const [from, to, t] = located;
  return [from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t];
}

function numbers<T extends { time: number; curve: Curve }>(keys: readonly T[], time: number, read: (key: T) => readonly number[]): number[] | undefined {
  const located = span(keys, time);
  if (!located) return undefined;
  const [from, to, t] = located;
  const a = read(from); const b = read(to); const length = Math.max(a.length, b.length);
  return Array.from({ length }, (_, index) => (a[index] ?? 0) + ((b[index] ?? 0) - (a[index] ?? 0)) * t);
}

function compose(pose: Omit<BonePose, "name" | "world">): Affine {
  const xAngle = pose.rotation + pose.shearX;
  const yAngle = pose.rotation + Math.PI / 2 + pose.shearY;
  return {
    a: Math.cos(xAngle) * pose.scaleX,
    b: Math.sin(xAngle) * pose.scaleX,
    c: Math.cos(yAngle) * pose.scaleY,
    d: Math.sin(yAngle) * pose.scaleY,
    tx: pose.x,
    ty: pose.y,
  };
}

export function multiply(left: Affine, right: Affine): Affine {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    tx: left.a * right.tx + left.c * right.ty + left.tx,
    ty: left.b * right.tx + left.d * right.ty + left.ty,
  };
}

function decompose(matrix: Affine): { rotation: number; scaleX: number; scaleY: number; shearY: number } {
  const rotation = Math.atan2(matrix.b, matrix.a);
  const scaleX = Math.hypot(matrix.a, matrix.b);
  const det = matrix.a * matrix.d - matrix.b * matrix.c;
  const scaleY = Math.hypot(matrix.c, matrix.d) * (det < 0 ? -1 : 1);
  const yAngle = scaleY < 0 ? Math.atan2(-matrix.d, -matrix.c) : Math.atan2(matrix.d, matrix.c);
  return { rotation, scaleX, scaleY, shearY: wrap(yAngle - rotation - Math.PI / 2) };
}

function childWorld(parent: Affine, local: Omit<BonePose, "name" | "world">, bone: RuntimeRigData["bones"][number]): Affine {
  const localMatrix = compose(local);
  if (bone.inheritRotation && bone.inheritScale && bone.inheritReflect) {
    return multiply(parent, localMatrix);
  }
  const originX = parent.a * local.x + parent.c * local.y + parent.tx;
  const originY = parent.b * local.x + parent.d * local.y + parent.ty;
  const inherited = decompose(parent);
  let inheritedScaleY = bone.inheritScale ? inherited.scaleY : 1;
  if (!bone.inheritReflect && inheritedScaleY < 0) inheritedScaleY *= -1;
  const effective = compose({
    x: 0,
    y: 0,
    rotation: bone.inheritRotation ? inherited.rotation : 0,
    scaleX: bone.inheritScale ? inherited.scaleX : 1,
    scaleY: inheritedScaleY,
    shearX: 0,
    shearY: bone.inheritScale ? inherited.shearY : 0,
  });
  const world = multiply(effective, localMatrix);
  world.tx = originX;
  world.ty = originY;
  return world;
}

function color(hex: string): [number, number, number, number] {
  const normalized = hex.length === 6 ? `${hex}ff` : hex;
  if (!/^[0-9a-fA-F]{8}$/.test(normalized)) return [1, 1, 1, 1];
  return [0, 2, 4, 6].map((at) => Number.parseInt(normalized.slice(at, at + 2), 16) / 255) as [number, number, number, number];
}

function stepped<T extends { time: number }>(keys: readonly T[], time: number): T | undefined {
  const first = keys[0];
  if (!first || time < first.time) return undefined;
  let answer: T = first;
  for (const key of keys) {
    if (key.time > time) break;
    answer = key;
  }
  return answer;
}

export interface EvaluateOptions {
  state?: EvaluationState;
  deltaSeconds?: number;
  skin?: string;
}

export function createEvaluationState(): EvaluationState {
  return { physics: new Map() };
}

export function evaluate(rig: RuntimeRigData, layers: readonly AnimationLayer[] = [], options: EvaluateOptions = {}): RigPose {
  const bones = setupBones(rig);
  const slots: SlotPose[] = rig.slots.map((slot) => ({
    name: slot.name,
    attachment: slot.attachment,
    visible: true,
    color: color(slot.color),
    ...(slot.dark_color === undefined ? {} : { dark_color: [...slot.dark_color] as [number, number, number, number] }),
    sequenceFrame: 0,
  }));
  let drawOrder = [...rig.drawOrder];
  const boneIndex = new Map(bones.map((bone, index) => [bone.name, index]));
  const slotIndex = new Map(slots.map((slot, index) => [slot.name, index]));
  const attachmentWinners = new Map<number, number>();
  const visibleWinners = new Map<number, number>();
  let drawOrderWeight = -1;
  const deforms: Record<string, number[]> = {};
  const overrides: ConstraintOverrides = { ik: new Map(), transform: new Map() };

  for (const layer of layers) {
    if (layer.alpha <= 0) continue;
    const animation = animationOf(rig, layer.animation);
    applyBoneTracks(rig, animation, layer, bones, boneIndex);
    for (const track of animation.slots) {
      const index = slotIndex.get(track.name);
      if (index === undefined) continue;
      const key = stepped(track.keys, layer.time);
      if (!key) continue;
      const slot = slots[index]!;
      if (track.channel === "attachment" && layer.alpha >= (attachmentWinners.get(index) ?? -1)) {
        slot.attachment = key.name ?? null;
        attachmentWinners.set(index, layer.alpha);
      } else if (track.channel === "visible" && layer.alpha >= (visibleWinners.get(index) ?? -1)) {
        slot.visible = key.value ?? true;
        visibleWinners.set(index, layer.alpha);
      } else if (track.channel === "color" && key.color) {
        const keys = track.keys.map(item => ({ ...item, curve: item.curve ?? ("stepped" as const) }));
        const sampled = numbers(keys, layer.time, item => item.color ?? key.color!);
        if (sampled) slot.color = slot.color.map((component, i) => component + (sampled[i]! - component) * layer.alpha) as [number, number, number, number];
      }
    }
    for (const track of animation.deform) {
      // Match v2 bone sampling at Rust's f32 stepped boundaries; keep v1 timing.
      const time = rig.format_version === 2 ? Math.fround(layer.time) : layer.time;
      const sampled = numbers(track.keys, time, (key) => key.offsets);
      if (!sampled) continue;
      const key = `${track.slot}\0${track.attachment}`;
      const current = deforms[key];
      if (!current) deforms[key] = sampled.map((value) => value * layer.alpha);
      else for (let index = 0; index < sampled.length; index += 1) current[index] = (current[index] ?? 0) + (sampled[index]! - (current[index] ?? 0)) * layer.alpha;
    }
    for (const track of animation.ik) {
      const sampled = scalar(track.keys, layer.time);
      if (sampled === undefined) continue;
      const current = overrides.ik.get(track.constraint) ?? {};
      if (track.channel === "mix") current.mix = (current.mix ?? constraintSetup(rig, track.constraint, "mix")) + (sampled - (current.mix ?? constraintSetup(rig, track.constraint, "mix"))) * layer.alpha;
      else if (track.channel === "softness") current.softness = (current.softness ?? constraintSetup(rig, track.constraint, "softness")) + (sampled - (current.softness ?? constraintSetup(rig, track.constraint, "softness"))) * layer.alpha;
      else current.bend = sampled;
      overrides.ik.set(track.constraint, current);
    }
    for (const track of animation.transform) {
      const sampled = numbers(track.keys, layer.time, (key) => [key.rotate, key.translate_x, key.translate_y, key.scale_x, key.scale_y, key.shear_x, key.shear_y]);
      if (!sampled) continue;
      const setup = rig.constraints.find((constraint) => constraint.name === track.constraint && constraint.type === "transform");
      if (!setup || setup.type !== "transform") continue;
      const current = overrides.transform.get(track.constraint) ?? setup.mixes;
      const names = ["rotate", "translate_x", "translate_y", "scale_x", "scale_y", "shear_x", "shear_y"] as const;
      const next = { ...current };
      names.forEach((name, index) => { next[name] += (sampled[index]! - next[name]) * layer.alpha; });
      overrides.transform.set(track.constraint, next);
    }
    const drawKey = stepped(animation.drawOrder, layer.time);
    if (drawKey && layer.alpha >= drawOrderWeight) {
      drawOrder = applyDrawOrder(rig.drawOrder, drawKey.offsets);
      drawOrderWeight = layer.alpha;
    }
  }

  for (let index = 0; index < bones.length; index += 1) {
    const pose = bones[index]!;
    const local = compose(pose);
    const source = rig.bones[index]!;
    pose.world = source.parent === -1 ? local : childWorld(bones[source.parent]!.world, pose, source);
  }
  const pose: RigPose = { bones, slots, drawOrder, deforms };
  applyConstraints(rig, pose, overrides, options.state, options.deltaSeconds ?? 0, options.skin ?? rig.defaultSkin ?? undefined);
  const dominant = [...layers].filter((layer) => layer.alpha > 0).sort((a, b) => b.alpha - a.alpha)[0];
  applySequences(rig, pose, dominant?.time ?? 0, options.skin ?? rig.defaultSkin ?? undefined);
  return pose;
}

function constraintSetup(rig: RuntimeRigData, name: string, field: "mix" | "softness"): number {
  const constraint = rig.constraints.find((candidate) => candidate.name === name);
  if (!constraint) return 0;
  return field === "mix" ? constraint.mix : constraint.type === "ik" ? constraint.softness : 0;
}

function applySequences(rig: RuntimeRigData, pose: RigPose, time: number, skinName: string | undefined): void {
  const skin = rig.skins.find((candidate) => candidate.name === skinName);
  if (!skin) return;
  for (const slot of pose.slots) {
    if (!slot.attachment) continue;
    const attachment = skin.attachments.find((entry) => entry.slot === slot.name && entry.name === slot.attachment)?.attachment;
    const sequence = attachment && (attachment.type === "region" || attachment.type === "mesh") ? attachment.sequence : null;
    if (!sequence || sequence.frames.length === 0) continue;
    const count = sequence.frames.length; const start = Math.max(0, Math.min(count - 1, sequence.setup_index));
    if (sequence.fps <= 0 || sequence.mode === "hold") { slot.sequenceFrame = start; continue; }
    const elapsed = Math.floor(time * sequence.fps);
    const reverse = sequence.mode.endsWith("reverse");
    const walked = start + (reverse ? -elapsed : elapsed);
    if (sequence.mode.startsWith("once")) slot.sequenceFrame = Math.max(0, Math.min(count - 1, walked));
    else if (sequence.mode.startsWith("loop")) slot.sequenceFrame = ((walked % count) + count) % count;
    else { const span = Math.max(1, 2 * count - 2); const phase = ((walked % span) + span) % span; slot.sequenceFrame = phase < count ? phase : span - phase; }
  }
}

function applyDrawOrder(setup: readonly string[], offsets: readonly { slot: string; offset: number }[]): string[] {
  const offsetBySlot = new Map(offsets.map((entry) => [entry.slot, entry.offset]));
  return setup.map((slot, index) => {
    const offset = offsetBySlot.get(slot) ?? 0;
    return { slot, target: index + offset + Math.sign(offset) * 0.5 };
  }).sort((a, b) => a.target - b.target).map((entry) => entry.slot);
}


// Shared native primitives, internal exports for the opt-in bone-only sampler.
// No FK, slots or constraints here. The complete evaluator remains unchanged.
function setupBones(rig: RuntimeRigData): BonePose[] {
  return rig.bones.map((bone) => ({
    name: bone.name,
    x: bone.x,
    y: bone.y,
    rotation: bone.rotation * DEG,
    scaleX: bone.scaleX,
    scaleY: bone.scaleY,
    shearX: bone.shearX * DEG,
    shearY: bone.shearY * DEG,
    world: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
  }));
}
function applyBoneTracks(rig: RuntimeRigData, animation: RuntimeRigData["animations"][string], layer: AnimationLayer, bones: BonePose[], boneIndex: ReadonlyMap<string,number>): void {
    for (const track of animation.bones) {
      const index = boneIndex.get(track.name);
      if (index === undefined) continue;
      const bone = bones[index]!;
      // V2 key times already contain the author's bone offset. Keep the legacy
      // paired path unchanged, including its optional sampling offset.
      const scalarAxes = rig.format_version === 2;
      // Match Rust's f32 playhead at exact stepped boundaries (e.g. 1.6s,
      // serialized as 1.600000023841858). Leave legacy v1 timing untouched.
      const time = scalarAxes ? Math.fround(layer.time) : layer.time - (track.offset ?? 0);
      const rotate = track.rotate ? scalar(track.rotate, time, true) : undefined;
      if (rotate !== undefined) bone.rotation = wrap(bone.rotation + rotate * DEG * layer.alpha);
      if (scalarAxes) {
        const tx = track.translate_x ? scalar(track.translate_x, time) : undefined;
        const ty = track.translate_y ? scalar(track.translate_y, time) : undefined;
        const sx = track.scale_x ? scalar(track.scale_x, time) : undefined;
        const sy = track.scale_y ? scalar(track.scale_y, time) : undefined;
        const hx = track.shear_x ? scalar(track.shear_x, time) : undefined;
        const hy = track.shear_y ? scalar(track.shear_y, time) : undefined;
        if (tx !== undefined) bone.x += tx * layer.alpha;
        if (ty !== undefined) bone.y += ty * layer.alpha;
        if (sx !== undefined) bone.scaleX *= 1 + (sx - 1) * layer.alpha;
        if (sy !== undefined) bone.scaleY *= 1 + (sy - 1) * layer.alpha;
        if (hx !== undefined) bone.shearX += hx * DEG * layer.alpha;
        if (hy !== undefined) bone.shearY += hy * DEG * layer.alpha;
      } else {
        const translate = track.translate ? vector(track.translate, time) : undefined;
        const scale = track.scale ? vector(track.scale, time) : undefined;
        const shear = track.shear ? vector(track.shear, time) : undefined;
        if (translate) {
          bone.x += translate[0] * layer.alpha;
          bone.y += translate[1] * layer.alpha;
        }
        if (scale) {
          bone.scaleX *= 1 + (scale[0] - 1) * layer.alpha;
          bone.scaleY *= 1 + (scale[1] - 1) * layer.alpha;
        }
        if (shear) {
          bone.shearX += shear[0] * DEG * layer.alpha;
          bone.shearY += shear[1] * DEG * layer.alpha;
        }
      }
    }

}
export function evaluateBoneLocals(rig: RuntimeRigData, layer: AnimationLayer): BonePose[] {
  const bones = setupBones(rig);
  applyBoneTracks(rig, animationOf(rig, layer.animation), layer, bones, new Map(bones.map((b,i)=>[b.name,i])));
  return bones;
}

/** Internal opt-in FFD sampling: reuse Legacy numbers/easing, no bones or Physics. */
export function sampleDeformOffsets(track: import('./types.js').DeformTrack, time: number): number[] | undefined {
  return numbers(track.keys, Math.fround(time), key => key.offsets);
}

/** A4 channel-only candidate sampler. Reuses native primitives; no FK/constraints.
 * Rust holds the first interpolatable color before its time. Discrete channels
 * retain setup until their first key. Legacy evaluate() is deliberately unchanged.
 */
export function sampleSlotChannels(rig: RuntimeRigData, animation: RuntimeRigData['animations'][string], canonical: number): Pick<RigPose,'slots'|'drawOrder'> {
 const time=Math.fround(canonical),slots:SlotPose[]=rig.slots.map(s=>({name:s.name,color:color(s.color),visible:true,attachment:s.attachment,sequenceFrame:0}));
 for(const track of animation.slots){const slot=slots.find(s=>s.name===track.name)!;
  if(track.channel==='color'){const exact=track.keys.find(k=>k.time===time);const sampled=exact?[...exact.color!]:numbers(track.keys.map(k=>({...k,curve:k.curve!})),time,k=>k.color!);if(sampled)slot.color=sampled as [number,number,number,number];}
  else{const key=stepped(track.keys,time);if(key){if(track.channel==='visible')slot.visible=key.value!;else slot.attachment=key.name!;}}
 }
 const key=stepped(animation.drawOrder,time);return{slots,drawOrder:key?applyDrawOrder(rig.drawOrder,key.offsets):[...rig.drawOrder]};
}
