export type Curve =
  | "linear"
  | "stepped"
  | { type: "bezier"; handles: readonly [number, number, number, number] };

export interface ScalarKey {
  time: number;
  value: number;
  curve: Curve;
}

export interface VectorKey {
  time: number;
  x: number;
  y: number;
  curve: Curve;
}

export interface BoneTrack {
  name: string;
  /** Legacy v1 sampling offset. V2 exports bake this into scalar key times. */
  offset?: number;
  /** Legacy v1 paired tracks. V2 uses the six independent scalar axes below. */
  translate?: VectorKey[];
  rotate?: ScalarKey[];
  scale?: VectorKey[];
  shear?: VectorKey[];
  translate_x?: ScalarKey[];
  translate_y?: ScalarKey[];
  scale_x?: ScalarKey[];
  scale_y?: ScalarKey[];
  shear_x?: ScalarKey[];
  shear_y?: ScalarKey[];
}

export interface SlotTrackKey {
  time: number;
  /** Authored light-color curve. Omitted legacy keys retain stepped sampling. */
  curve?: Curve;
  value?: boolean;
  name?: string | null;
  color?: readonly [number, number, number, number];
}

export interface SlotTrack {
  name: string;
  channel: "visible" | "attachment" | "color";
  keys: SlotTrackKey[];
}

export interface DrawOrderKey {
  time: number;
  offsets: Array<{ slot: string; offset: number }>;
}

export interface RuntimeEvent {
  time: number;
  name: string;
  int?: number;
  float?: number;
  string?: string;
  audio?: string | null;
  volume?: number;
  balance?: number;
}

export interface RuntimeAnimation {
  duration: number;
  looping: boolean;
  bones: BoneTrack[];
  slots: SlotTrack[];
  drawOrder: DrawOrderKey[];
  events: RuntimeEvent[];
  deform: DeformTrack[];
  ik: ConstraintScalarTrack[];
  transform: TransformConstraintTrack[];
}

export interface DeformKey {
  time: number;
  offsets: number[];
  curve: Curve;
}

export interface DeformTrack {
  slot: string;
  attachment: string;
  keys: DeformKey[];
}

export interface ConstraintScalarTrack {
  constraint: string;
  channel: "mix" | "softness" | "bend_direction";
  keys: ScalarKey[];
}

export interface TransformMixValue {
  rotate: number;
  translate_x: number;
  translate_y: number;
  scale_x: number;
  scale_y: number;
  shear_x: number;
  shear_y: number;
}

export interface TransformMixKey extends TransformMixValue {
  time: number;
  curve: Curve;
}

export interface TransformConstraintTrack {
  constraint: string;
  keys: TransformMixKey[];
}

export interface RuntimeBone {
  name: string;
  parent: number;
  length: number;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  shearX: number;
  shearY: number;
  inheritRotation: boolean;
  inheritScale: boolean;
  inheritReflect: boolean;
}

export interface RuntimeSlot {
  name: string;
  bone: string;
  attachment: string | null;
  color: string;
  /** Static R, G, B, shadow intensity. Missing means no dark contribution. */
  dark_color?: [number, number, number, number];
  blend: string;
}

export interface RegionAttachment {
  type: "region";
  texture: string;
  x: number;
  y: number;
  rotation: number;
  scale_x: number;
  scale_y: number;
  width: number;
  height: number;
  source_width: number;
  source_height: number;
  pivot_x: number;
  pivot_y: number;
  uv: number[];
  sequence: RuntimeSequence | null;
}

export interface RuntimeSequence {
  frames: string[];
  fps: number;
  mode: "hold" | "once" | "loop" | "ping_pong" | "once_reverse" | "loop_reverse" | "ping_pong_reverse";
  setup_index: number;
}

export interface VertexInfluence {
  bone: string;
  x: number;
  y: number;
  weight: number;
}

export interface MeshAttachment {
  type: "mesh";
  texture: string;
  vertices: number[];
  uvs: number[];
  triangles: number[];
  weights: Array<{ count: number; bones: VertexInfluence[] }>;
  weighted: boolean;
  vertex_count: number;
  linked: { skin: string; slot: string; attachment: string; inherit_deform: boolean } | null;
  sequence: RuntimeSequence | null;
}

export interface PathAttachment {
  type: "path";
  vertices: number[];
  vertex_count: number;
  closed: boolean;
  constant_speed: boolean;
}

export interface ClippingAttachment {
  type: "clipping";
  vertices: number[];
  vertex_count: number;
  end_slot: string | null;
}

export interface BoundingBoxAttachment {
  type: "bounding_box";
  vertices: number[];
  vertex_count: number;
  weights: Array<{ count: number; bones: VertexInfluence[] }>;
  weighted: boolean;
}

export interface PointAttachment {
  type: "point";
  x: number;
  y: number;
  rotation: number;
}

export type RuntimeAttachment =
  | RegionAttachment
  | MeshAttachment
  | PathAttachment
  | ClippingAttachment
  | BoundingBoxAttachment
  | PointAttachment;

export interface SkinAttachment {
  slot: string;
  name: string;
  attachment: RuntimeAttachment;
}

export interface RuntimeSkin {
  name: string;
  bones: string[];
  constraints: string[];
  attachments: SkinAttachment[];
}

export interface AtlasPage {
  index: number;
  width: number;
  height: number;
  file: string;
}

export interface AtlasRegion {
  name: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  offset_x: number;
  offset_y: number;
  original_width: number;
  original_height: number;
  rotated: boolean;
}

export interface RuntimeAtlas {
  pages: AtlasPage[];
  regions: AtlasRegion[];
}

export interface RuntimeRigData {
  format: "ankhimate-runtime";
  /** Absent or 1: legacy paired tracks. 2: independent scalar bone axes. */
  format_version?: 1 | 2;
  context_version: 1;
  name: string;
  fps: number;
  bones: RuntimeBone[];
  slots: RuntimeSlot[];
  drawOrder: string[];
  defaultSkin: string | null;
  skins: RuntimeSkin[];
  constraints: RuntimeConstraint[];
  constraintOrder: string[];
  animations: Record<string, RuntimeAnimation>;
  atlas: RuntimeAtlas | null;
}

export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export interface BonePose {
  name: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  shearX: number;
  shearY: number;
  world: Affine;
}

export interface SlotPose {
  name: string;
  attachment: string | null;
  visible: boolean;
  color: readonly [number, number, number, number];
  dark_color?: readonly [number, number, number, number];
  sequenceFrame: number;
}

export interface RigPose {
  bones: BonePose[];
  slots: SlotPose[];
  drawOrder: string[];
  deforms: Readonly<Record<string, readonly number[]>>;
}

export interface AnimationLayer {
  animation: string;
  time: number;
  alpha: number;
}

interface ConstraintBase {
  name: string;
  target: string;
  bones: string[];
  mix: number;
}

export interface IkConstraint extends ConstraintBase {
  type: "ik";
  bend_direction: number;
  softness: number;
  stretch: boolean;
  stretch_limit: number;
  stiffness: number;
}

export interface TransformConstraint extends ConstraintBase {
  type: "transform";
  mixes: TransformMixValue;
  offsets: { x: number; y: number; rotation: number; scale_x: number; scale_y: number; shear_x: number; shear_y: number };
  local: boolean;
  relative: boolean;
}

export interface PhysicsConstraint extends ConstraintBase {
  type: "physics";
  // Native: target names the simulated bone, bones is empty. Historical
  // bones-only input uses target="" and exactly one bone (validated on read).
  physics: { inertia: number; strength: number; damping: number; mass: number };
  forces: { wind_x: number; wind_y: number; gravity_x: number; gravity_y: number };
  channels: { rotate: boolean; translate: boolean };
}

export interface PathConstraint extends ConstraintBase {
  type: "path";
  slot: string;
  path: { position: number; spacing: number; mix_rotate: number; mix_translate: number };
}

export type RuntimeConstraint = IkConstraint | TransformConstraint | PhysicsConstraint | PathConstraint;

export interface PhysicsBoneState {
  rotation: number;
  rotationVelocity: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  anchorX?: number;
  anchorY?: number;
  remainder: number;
}

export interface EvaluationState {
  physics: Map<string, PhysicsBoneState>;
}
