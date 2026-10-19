import { evaluate, parseRig } from '@ankhimate/runtime';
import type { MeshAttachment, RegionAttachment, RigPose, RuntimeRigData } from '@ankhimate/runtime';
import { validateClipping } from '@ankhimate/runtime/render';
export class PhaserRigError extends Error {
    constructor(message: string) { super(message); this.name = 'PhaserRigError'; }
}
export function requireThat(value: unknown, message: string): asserts value {
    if (!value)
        throw new PhaserRigError(message);
}
export function finite(values: readonly unknown[], label: string): void { requireThat(values.every(v => typeof v === 'number' && Number.isFinite(v)), `${label}: expected finite numbers`); }
export function color(value: unknown, label: string): asserts value is [
    number,
    number,
    number,
    number
] {
    requireThat(Array.isArray(value) && value.length === 4, `${label}: expected RGBA`);
    finite(value, label);
    requireThat(value.every(v => v >= 0 && v <= 1), `${label}: components outside [0,1]`);
}
export function validateMesh(a: MeshAttachment, name: string, rig: RuntimeRigData): void {
    requireThat(Number.isInteger(a.vertex_count) && a.vertex_count >= 3 && Array.isArray(a.vertices) && a.vertices.length === a.vertex_count * 2 && Array.isArray(a.uvs) && a.uvs.length === a.vertices.length, `${name}: invalid mesh topology/dimensions`);
    finite(a.vertices, `${name}: mesh vertices`);
    finite(a.uvs, `${name}: mesh UVs`);
    requireThat(a.uvs.every(v => v >= 0 && v <= 1), `${name}: mesh UVs outside source`);
    requireThat(Array.isArray(a.triangles) && a.triangles.length > 0 && a.triangles.length % 3 === 0 && a.triangles.every(i => Number.isInteger(i) && i >= 0 && i < a.vertex_count), `${name}: invalid triangle indices`);
    for (let i = 0; i < a.triangles.length; i += 3)
        requireThat(new Set(a.triangles.slice(i, i + 3)).size === 3, `${name}: repeated triangle index`);
    requireThat(typeof a.weighted === 'boolean' && Array.isArray(a.weights) && (a.weighted ? a.weights.length === a.vertex_count : a.weights.length === 0), `${name}: invalid weights topology`);
    for (const w of a.weights) {
        requireThat(w && Array.isArray(w.bones) && w.count === w.bones.length, `${name}: invalid influence count`);
        let sum = 0;
        for (const b of w.bones) {
            requireThat(b && rig.bones.some(v => v.name === b.bone), `${name}: missing influence bone`);
            finite([b.x, b.y, b.weight], `${name}: influence`);
            requireThat(b.weight >= 0, `${name}: negative weight`);
            sum += b.weight;
        }
        requireThat(Number.isFinite(sum) && (!w.bones.length || sum > 0), `${name}: invalid total weight`);
    }
}
function region(a: RegionAttachment, label: string): void {
    finite([a.x, a.y, a.rotation, a.scale_x, a.scale_y, a.width, a.height, a.source_width, a.source_height, a.pivot_x, a.pivot_y], label);
    requireThat(a.width > 0 && a.height > 0 && a.source_width > 0 && a.source_height > 0, `${label}: invalid region dimensions`);
    requireThat(Array.isArray(a.uv) && a.uv.length === 4, `${label}: invalid UV rectangle`);
    finite(a.uv, `${label}: UV`);
    const [u, v, x, y] = a.uv as [
        number,
        number,
        number,
        number
    ];
    requireThat(0 <= u && u < x && x <= 1 && 0 <= v && v < y && y <= 1, `${label}: reversed/repeated/out-of-source UV rectangle`);
}
/** Same native parser. These checks concern the adapter's textures/geometry, not a new format. */
export function phaserSource(source: unknown): RuntimeRigData {
    const rig = parseRig(structuredClone(source));
    requireThat(rig.atlas && Array.isArray(rig.atlas.pages) && rig.atlas.pages.length > 0 && Array.isArray(rig.atlas.regions), 'Missing embedded atlas/pages');
    for (const [i, p] of rig.atlas.pages.entries())
        requireThat(p.index === i && typeof p.file === 'string' && p.file.length > 0 && [p.width, p.height].every(v => Number.isInteger(v) && v > 0), `Atlas page ${i}: invalid index/dimensions/file`);
    const names = new Set<string>();
    for (const r of rig.atlas.regions) {
        const p = rig.atlas.pages[r.page];
        requireThat(typeof r.name === 'string' && !names.has(r.name), 'Atlas region names must be unique');
        names.add(r.name);
        requireThat(Number.isInteger(r.page) && p, `${r.name}: missing atlas page`);
        requireThat(typeof r.rotated === 'boolean' && [r.x, r.y, r.offset_x, r.offset_y].every(v => Number.isInteger(v) && v >= 0) && [r.width, r.height, r.original_width, r.original_height].every(v => Number.isInteger(v) && v > 0), `${r.name}: invalid atlas rectangle`);
        requireThat(r.x + r.width <= p.width && r.y + r.height <= p.height && r.offset_x + r.width <= r.original_width && r.offset_y + r.height <= r.original_height, `${r.name}: atlas outside page/source`);
    }
    for (const b of rig.bones)
        finite([b.x, b.y, b.rotation, b.scaleX, b.scaleY, b.shearX, b.shearY, b.length], `Bone ${b.name}`);
    for (const b of rig.bones)
        requireThat([b.inheritRotation, b.inheritScale, b.inheritReflect].every(v => typeof v === 'boolean'), `Bone ${b.name}: invalid inheritance flags`);
    for (const s of rig.slots) {
        requireThat(['normal', 'additive', 'multiply', 'screen'].includes(s.blend), `Slot ${s.name}: unknown blend mode`);
        if (s.dark_color !== undefined)
            color(s.dark_color, `${s.name}: dark tint`);
    }
    const slots = new Set(rig.slots.map(s => s.name));
    requireThat(Array.isArray(rig.drawOrder) && rig.drawOrder.length === slots.size && new Set(rig.drawOrder).size === slots.size && rig.drawOrder.every(n => slots.has(n)), 'Invalid setup draw order');
    if (rig.defaultSkin == null)
        rig.defaultSkin = rig.skins[0]?.name ?? null;
    requireThat(rig.skins.some(s => s.name === rig.defaultSkin), 'Missing default skin');
    const skins = new Set<string>();
    for (const skin of rig.skins) {
        requireThat(typeof skin.name === 'string' && !skins.has(skin.name) && Array.isArray(skin.attachments), 'Invalid/duplicate skin');
        skins.add(skin.name);
        const entries = new Set<string>();
        for (const e of skin.attachments) {
            const key = `${e.slot}\0${e.name}`;
            requireThat(slots.has(e.slot) && typeof e.name === 'string' && !entries.has(key), 'Invalid/duplicate slot attachment');
            entries.add(key);
            const a = e.attachment;
            requireThat(a && ['region', 'mesh', 'clipping', 'bounding_box', 'path', 'point'].includes(a.type), `${e.name}: unknown attachment type`);
            if (a.type === 'clipping') {
                validateClipping(a, e.name, slots, requireThat);
                continue;
            }
            if (a.type !== 'mesh' && a.type !== 'region')
                continue;
            if (a.type === 'region')
                region(a, e.name);
            else if (!a.linked)
                validateMesh(a, e.name, rig);
            if (a.type === 'mesh' && a.linked)
                continue; // resolved, validated and bound with its actual host in the selected appearance
            if (a.sequence) {
                requireThat(Array.isArray(a.sequence.frames) && a.sequence.frames.length > 0, `${e.name}: empty sequence`);
                finite([a.sequence.fps, a.sequence.setup_index], `${e.name}: sequence`);
                requireThat(a.sequence.fps >= 0 && Number.isInteger(a.sequence.setup_index) && a.sequence.setup_index >= 0 && a.sequence.setup_index < a.sequence.frames.length, `${e.name}: invalid sequence setup`);
                requireThat(['hold', 'once', 'loop', 'ping_pong', 'once_reverse', 'loop_reverse', 'ping_pong_reverse'].includes(a.sequence.mode), `${e.name}: unknown sequence mode`);
            }
            for (const texture of [a.texture, ...(a.sequence?.frames ?? [])]) {
                const r = rig.atlas.regions.find(r => r.name === texture);
                requireThat(r, `${e.name}: missing atlas region ${texture}`);
                if (a.type === 'region')
                    requireThat(r.original_width === a.source_width && r.original_height === a.source_height, `${e.name}: source dimensions disagree with atlas`);
            }
        }
    }
    for (const [name, a] of Object.entries(rig.animations)) {
        requireThat(typeof a.looping === 'boolean' && Array.isArray(a.events) && Array.isArray(a.deform), `Clip ${name}: invalid looping/events/deform`);
        for (const e of a.events) {
            requireThat(typeof e.name === 'string', `Clip ${name}: event name required`);
            finite([e.time], `Clip ${name}: event time`);
            requireThat(e.time >= 0 && e.time <= a.duration, `Clip ${name}: event outside duration`);
            for (const f of ['int', 'float', 'volume', 'balance'] as const)
                if (e[f] !== undefined)
                    finite([e[f]], `Clip ${name}: event ${f}`);
            requireThat(e.int === undefined || Number.isInteger(e.int), `Clip ${name}: event int must be integer`);
            requireThat((e.string === undefined || typeof e.string === 'string') && (e.audio == null || typeof e.audio === 'string'), `Clip ${name}: invalid event payload`);
        }
        for (const d of a.deform) {
            requireThat(slots.has(d.slot) && typeof d.attachment === 'string' && Array.isArray(d.keys), `Clip ${name}: invalid deform target/keys`);
            let previous = -Infinity;
            for (const k of d.keys) {
                finite([k.time], `Clip ${name}: deform time`);
                requireThat(k.time >= previous, `Clip ${name}: deform times must be sorted`);
                previous = k.time;
                requireThat(Array.isArray(k.offsets), `Clip ${name}: invalid deform offsets`);
                finite(k.offsets, `Clip ${name}: deform offsets`);
                if (k.curve !== 'linear' && k.curve !== 'stepped') {
                    requireThat(k.curve?.type === 'bezier' && Array.isArray(k.curve.handles) && k.curve.handles.length === 4, `Clip ${name}: invalid deform curve`);
                    finite(k.curve.handles, `Clip ${name}: deform handles`);
                    requireThat([k.curve.handles[0], k.curve.handles[2]].every(v => v >= 0 && v <= 1), `Clip ${name}: invalid Bezier X`);
                }
            }
        }
    }
    // Confirm the native setup is evaluable before allocating Scene objects.
    const setup = evaluate(rig);
    for (const b of setup.bones)
        finite(Object.values(b.world), `Setup world ${b.name}`);
    return rig;
}
export function validatePose(rig: RuntimeRigData, pose: RigPose, deforms: ReadonlyMap<string, number>): void {
    requireThat(pose && Array.isArray(pose.bones) && Array.isArray(pose.slots) && Array.isArray(pose.drawOrder) && pose.deforms && typeof pose.deforms === 'object' && !Array.isArray(pose.deforms), 'Invalid pose/FFD');
    const bones = new Set(pose.bones.map(b => b.name)), slots = new Set(pose.slots.map(s => s.name));
    requireThat(bones.size === rig.bones.length && bones.size === pose.bones.length && rig.bones.every(b => bones.has(b.name)), 'Pose bones do not match rig');
    for (const b of pose.bones) {
        requireThat(b.world && typeof b.world === 'object', `${b.name}: missing world affine`);
        finite([b.world.a, b.world.b, b.world.c, b.world.d, b.world.tx, b.world.ty], `${b.name}: world transform`);
    }
    requireThat(slots.size === rig.slots.length && slots.size === pose.slots.length && rig.slots.every(s => slots.has(s.name)), 'Pose slots do not match rig');
    requireThat(pose.drawOrder.length === slots.size && new Set(pose.drawOrder).size === slots.size && pose.drawOrder.every(n => slots.has(n)), 'Invalid pose draw order');
    for (const s of pose.slots) {
        requireThat(typeof s.visible === 'boolean', `${s.name}: invalid visibility`);
        color(s.color, `${s.name}: light color`);
        if (s.dark_color !== undefined)
            color(s.dark_color, `${s.name}: dark tint`);
    }
    for (const [key, offsets] of Object.entries(pose.deforms)) {
        requireThat(deforms.has(key) && Array.isArray(offsets) && offsets.length === deforms.get(key), 'Invalid pose deform attachment/dimensions');
        finite(offsets, 'Pose deform offsets');
    }
}
