import type { RuntimeAnimation, RuntimeRigData } from "./types.js";

export class RigFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RigFormatError";
  }
}

function object(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RigFormatError(`${label} must be an object`);
  }
}

const SCALAR_AXES = ["translate_x", "translate_y", "scale_x", "scale_y", "shear_x", "shear_y"] as const;
const PAIRED_AXES = ["translate", "scale", "shear"] as const;

function scalarKeys(value: unknown, label: string): void {
  if (!Array.isArray(value)) throw new RigFormatError(`${label} must be an array`);
  let previousTime = -Infinity;
  value.forEach((key, index) => {
    const at = `${label}[${index}]`;
    object(key, at);
    if (typeof key.time !== "number" || !Number.isFinite(key.time) || key.time < previousTime) {
      throw new RigFormatError(`${at}.time must be finite and sorted`);
    }
    previousTime = key.time;
    if (typeof key.value !== "number" || !Number.isFinite(key.value)) {
      throw new RigFormatError(`${at}.value must be finite`);
    }
    if (key.curve === "linear" || key.curve === "stepped") return;
    object(key.curve, `${at}.curve`);
    const handles = key.curve.handles;
    if (key.curve.type !== "bezier" || !Array.isArray(handles) || handles.length !== 4
      || !handles.every((handle) => typeof handle === "number" && Number.isFinite(handle))
      || handles[0] < 0 || handles[0] > 1 || handles[2] < 0 || handles[2] > 1) {
      throw new RigFormatError(`${at}.curve must be linear, stepped, or bezier with finite handles and X in [0,1]`);
    }
  });
}

export function parseRig(source: string | unknown): RuntimeRigData {
  let value: unknown;
  try {
    value = typeof source === "string" ? JSON.parse(source) : source;
  } catch (error) {
    throw new RigFormatError(`invalid JSON: ${(error as Error).message}`);
  }
  object(value, "rig");
  if (value.format !== "ankhimate-runtime") {
    throw new RigFormatError(`unsupported format ${JSON.stringify(value.format)}`);
  }
  const formatVersion = value.format_version === undefined ? 1 : value.format_version;
  if (formatVersion !== 1 && formatVersion !== 2) {
    throw new RigFormatError(`unsupported format_version ${JSON.stringify(value.format_version)}`);
  }
  if (value.context_version !== 1) {
    throw new RigFormatError(`unsupported context_version ${JSON.stringify(value.context_version)}`);
  }
  if (!Array.isArray(value.bones) || !Array.isArray(value.slots) || !Array.isArray(value.skins)) {
    throw new RigFormatError("bones, slots, and skins must be arrays");
  }
  object(value.animations, "animations");

  const boneNames = new Set<string>();
  value.bones.forEach((raw, index) => {
    object(raw, `bones[${index}]`);
    if (typeof raw.name !== "string" || boneNames.has(raw.name)) {
      throw new RigFormatError(`bones[${index}].name must be unique`);
    }
    if (!Number.isInteger(raw.parent) || (raw.parent as number) < -1 || (raw.parent as number) >= index) {
      throw new RigFormatError(`bones[${index}].parent must refer to an earlier bone or be -1`);
    }
    boneNames.add(raw.name);
  });

  const slotNames = new Set<string>();
  value.slots.forEach((raw, index) => {
    object(raw, `slots[${index}]`);
    if (typeof raw.name !== "string" || slotNames.has(raw.name)) {
      throw new RigFormatError(`slots[${index}].name must be unique`);
    }
    if (typeof raw.bone !== "string" || !boneNames.has(raw.bone)) {
      throw new RigFormatError(`slots[${index}].bone does not name a bone`);
    }
    if ("dark_color" in raw) {
      const dark = raw.dark_color;
      if (!Array.isArray(dark) || dark.length !== 4
        || ![0, 1, 2, 3].every(channel => typeof dark[channel] === "number" && Number.isFinite(dark[channel]))) {
        throw new RigFormatError(`slots[${index}].dark_color must contain four finite numbers (R, G, B, intensity)`);
      }
    }
    slotNames.add(raw.name);
  });

  for (const [name, raw] of Object.entries(value.animations)) {
    object(raw, `animations.${name}`);
    if (typeof raw.duration !== "number" || raw.duration < 0 || !Number.isFinite(raw.duration)) {
      throw new RigFormatError(`animations.${name}.duration must be a finite non-negative number`);
    }
    for (const track of (raw.bones ?? []) as unknown[]) {
      object(track, `animations.${name}.bones[]`);
      if (typeof track.name !== "string" || !boneNames.has(track.name)) {
        throw new RigFormatError(`animations.${name} targets missing bone ${JSON.stringify(track.name)}`);
      }
      const label = `animations.${name}.bones.${track.name}`;
      if (formatVersion === 2) {
        if (PAIRED_AXES.some((axis) => track[axis] !== undefined) || track.offset !== undefined) {
          throw new RigFormatError(`${label}: v2 requires scalar axes with baked times, not paired tracks or offset`);
        }
        for (const axis of SCALAR_AXES) {
          if (track[axis] !== undefined) scalarKeys(track[axis], `${label}.${axis}`);
        }
      } else if (SCALAR_AXES.some((axis) => track[axis] !== undefined)) {
        throw new RigFormatError(`${label}: scalar axes require format_version 2`);
      }
    }
  }

  return value as unknown as RuntimeRigData;
}

export function animationOf(rig: RuntimeRigData, name: string): RuntimeAnimation {
  const animation = rig.animations[name];
  if (!animation) throw new Error(`unknown animation ${JSON.stringify(name)}`);
  return animation;
}

export function unsupportedFeatures(rig: RuntimeRigData): string[] {
  const features = new Set<string>();
  const attachmentTypes = new Set(["region", "mesh", "clipping", "bounding_box", "path", "point"]);
  const constraintTypes = new Set(["ik", "transform", "physics", "path"]);
  for (const constraint of rig.constraints) {
    if (!constraintTypes.has(constraint.type)) features.add(`${constraint.type} constraints`);
  }
  for (const skin of rig.skins) {
    for (const entry of skin.attachments) {
      if (!attachmentTypes.has(entry.attachment.type)) features.add(`${entry.attachment.type} attachments`);
    }
  }
  return [...features];
}
