import assert from "node:assert/strict";
import test from "node:test";
import { evaluate, parseRig, RigFormatError, RigPlayer } from "../src/index.js";
import type { RuntimeRigData } from "../src/index.js";

function fixture(): RuntimeRigData {
  return {
    format: "ankhimate-runtime",
    context_version: 1,
    name: "test",
    fps: 30,
    bones: [
      { name: "root", parent: -1, length: 10, x: 2, y: 3, rotation: 0, scaleX: 2, scaleY: 2, shearX: 0, shearY: 0, inheritRotation: true, inheritScale: true, inheritReflect: true },
      { name: "child", parent: 0, length: 5, x: 10, y: 0, rotation: 0, scaleX: 3, scaleY: 1, shearX: 0, shearY: 0, inheritRotation: true, inheritScale: true, inheritReflect: true },
    ],
    slots: [{ name: "part", bone: "child", attachment: "part", color: "804020ff", blend: "normal" }],
    drawOrder: ["part"],
    defaultSkin: null,
    skins: [],
    constraints: [],
    constraintOrder: [],
    animations: {
      walk: {
        duration: 1,
        looping: true,
        bones: [{
          name: "child",
          translate: [
            { time: 0, x: 0, y: 0, curve: "linear" },
            { time: 1, x: 10, y: 0, curve: "linear" },
          ],
          rotate: [
            { time: 0, value: 170, curve: "linear" },
            { time: 1, value: -170, curve: "linear" },
          ],
          scale: [{ time: 0, x: 2, y: 0.5, curve: "linear" }],
        }],
        slots: [],
        deform: [],
        drawOrder: [],
        ik: [],
        transform: [],
        events: [{ time: 0.25, name: "step" }, { time: 0.75, name: "step" }],
      },
      idle: {
        duration: 1,
        looping: true,
        bones: [{ name: "child", translate: [{ time: 0, x: -10, y: 0, curve: "linear" }] }],
        slots: [],
        deform: [],
        drawOrder: [],
        ik: [],
        transform: [],
        events: [],
      },
    },
    atlas: null,
  };
}

test("parseRig rejects forward parent references", () => {
  const data = fixture() as unknown as { bones: Array<{ parent: number }> };
  data.bones[0]!.parent = 1;
  assert.throws(() => parseRig(data), RigFormatError);
});

test("setup pose composes parent transforms exactly once", () => {
  const pose = evaluate(fixture());
  assert.equal(pose.bones[1]!.world.tx, 22);
  assert.equal(pose.bones[1]!.world.ty, 3);
  assert.deepEqual(pose.slots[0]!.color, [128 / 255, 64 / 255, 32 / 255, 1]);
});

test("animation uses additive translation, shortest rotation, and multiplicative scale", () => {
  const pose = evaluate(fixture(), [{ animation: "walk", time: 0.5, alpha: 1 }]);
  const child = pose.bones[1]!;
  assert.equal(child.x, 15);
  assert.ok(Math.abs(Math.abs(child.rotation) - Math.PI) < 1e-6);
  assert.equal(child.scaleX, 6);
  assert.equal(child.scaleY, 0.5);
});

test("a stepped attachment does not hold its first key backward", () => {
  const rig = fixture();
  rig.slots[0] = { ...rig.slots[0]!, attachment: null };
  rig.animations.walk!.slots = [{
    name: "part",
    channel: "attachment",
    keys: [{ time: 0.5, name: "late" }],
  }];

  assert.equal(
    evaluate(rig, [{ animation: "walk", time: 0, alpha: 1 }]).slots[0]!.attachment,
    null,
  );
  assert.equal(
    evaluate(rig, [{ animation: "walk", time: 0.5, alpha: 1 }]).slots[0]!.attachment,
    "late",
  );
});

test("looping update emits every crossed event once", () => {
  const player = new RigPlayer(fixture()).play("walk").seek(0.6);
  player.update(0.8);
  assert.deepEqual(player.events.map((event) => event.time), [0.75, 0.25]);
  player.update(0);
  assert.deepEqual(player.events, []);
});

test("crossfade advances both tracks and reaches the incoming pose", () => {
  const player = new RigPlayer(fixture()).play("idle");
  player.crossFade("walk", 0.5);
  const halfway = player.update(0.25);
  assert.equal(halfway.bones[1]!.x, 6.25);
  const finished = player.update(0.25);
  assert.equal(finished.bones[1]!.x, 15);
});

test("an exported curve belongs to the segment leaving its key", () => {
  const rig = fixture();
  rig.animations.walk!.bones[0]!.translate = [
    { time: 0, x: 0, y: 0, curve: "stepped" },
    { time: 1, x: 10, y: 0, curve: "linear" },
  ];
  assert.equal(evaluate(rig, [{ animation: "walk", time: 0.5, alpha: 1 }]).bones[1]!.x, 10);
});

test("single-bone IK aims at its target", () => {
  const rig = fixture();
  rig.bones[0] = { ...rig.bones[0]!, x: 0, y: 0, scaleX: 1, scaleY: 1 };
  rig.bones[1] = { ...rig.bones[1]!, x: 0, y: 0, scaleX: 1, scaleY: 1 };
  rig.bones.push({ name: "target", parent: -1, length: 0, x: 0, y: 10, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, inheritRotation: true, inheritScale: true, inheritReflect: true });
  rig.constraints = [{ name: "aim", type: "ik", target: "target", bones: ["child"], mix: 1, bend_direction: 1, softness: 0, stretch: false, stretch_limit: 1.1, stiffness: 0 }];
  rig.constraintOrder = ["aim"];
  const pose = evaluate(rig);
  assert.ok(Math.abs(pose.bones[1]!.world.a) < 1e-6);
  assert.ok(pose.bones[1]!.world.b > 0.999);
});

test("deform offsets blend and sequences advance", () => {
  const rig = fixture();
  rig.defaultSkin = "default";
  rig.skins = [{
    name: "default", bones: [], constraints: [], attachments: [{
      slot: "part", name: "part", attachment: {
        type: "region", texture: "one", x: 0, y: 0, rotation: 0, scale_x: 1, scale_y: 1,
        width: 10, height: 10, source_width: 10, source_height: 10, pivot_x: 0.5, pivot_y: 0.5,
        uv: [0, 0, 1, 1], sequence: { frames: ["one", "two", "three"], fps: 2, mode: "loop", setup_index: 0 },
      },
    }],
  }];
  rig.animations.walk!.deform = [{ slot: "part", attachment: "part", keys: [
    { time: 0, offsets: [0, 0], curve: "linear" },
    { time: 1, offsets: [10, 20], curve: "linear" },
  ] }];
  const pose = evaluate(rig, [{ animation: "walk", time: 0.5, alpha: 1 }]);
  assert.deepEqual(pose.deforms["part\0part"], [5, 10]);
  assert.equal(pose.slots[0]!.sequenceFrame, 1);
});

test("physics state is deterministic for the same delta sequence", () => {
  const run = () => {
    const rig = fixture();
    rig.constraints = [{ name: "spring", type: "physics", target: "", bones: ["child"], mix: 1,
      physics: { inertia: 0.5, strength: 20, damping: 0.3, mass: 1 },
      forces: { wind_x: 10, wind_y: 0, gravity_x: 0, gravity_y: -9.8 }, channels: { rotate: true, translate: true } }];
    rig.constraintOrder = ["spring"];
    const player = new RigPlayer(rig).play("walk");
    for (const delta of [0.016, 0.02, 0.01, 0.033]) player.update(delta);
    return player.pose().bones[1]!.world;
  };
  assert.deepEqual(run(), run());
});

test("transform constraints copy driven channels", () => {
  const rig = fixture();
  rig.bones.push({ name: "target", parent: -1, length: 0, x: 50, y: 20, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, inheritRotation: true, inheritScale: true, inheritReflect: true });
  rig.constraints = [{ name: "follow", type: "transform", target: "target", bones: ["child"], mix: 1, local: false, relative: false,
    mixes: { rotate: 0, translate_x: 1, translate_y: 1, scale_x: 0, scale_y: 0, shear_x: 0, shear_y: 0 },
    offsets: { x: 0, y: 0, rotation: 0, scale_x: 1, scale_y: 1, shear_x: 0, shear_y: 0 } }];
  rig.constraintOrder = ["follow"];
  const world = evaluate(rig).bones[1]!.world;
  assert.ok(Math.abs(world.tx - 50) < 1e-6);
  assert.ok(Math.abs(world.ty - 20) < 1e-6);
});

test("path constraints place bones along the selected skin path", () => {
  const rig = fixture();
  rig.defaultSkin = "default";
  rig.slots[0] = { ...rig.slots[0]!, bone: "root", attachment: "route" };
  rig.skins = [{ name: "default", bones: [], constraints: [], attachments: [{ slot: "part", name: "route", attachment: {
    type: "path", vertices: [0, 0, 100, 0], vertex_count: 2, closed: false, constant_speed: true,
  } }] }];
  rig.constraints = [{ name: "route", type: "path", target: "", bones: ["child"], mix: 1, slot: "part",
    path: { position: 0, spacing: 1, mix_rotate: 1, mix_translate: 1 } }];
  rig.constraintOrder = ["route"];
  const world = evaluate(rig).bones[1]!.world;
  assert.equal(world.tx, 2);
  assert.equal(world.ty, 3);
});


// M001a regression fixtures use parseRig so the versioned wire contract is tested.
function scalarFixture(channels: Record<string, unknown>): RuntimeRigData {
  const data = fixture();
  data.bones[1] = { ...data.bones[1]!, x: 0, y: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0 };
  return parseRig({ ...data, format_version: 2, animations: {
    walk: { ...data.animations.walk, bones: [{ name: "child", ...channels }] },
  } });
}

test("v2 scalar axes work without sibling channels and leave missing axes at setup", () => {
  for (const channel of ["translate_x", "translate_y", "scale_x", "scale_y", "shear_x", "shear_y"]) {
    const scale = channel.startsWith("scale");
    const rig = scalarFixture({ [channel]: [
      { time: 0, value: scale ? 1 : 0, curve: "linear" },
      { time: 1, value: scale ? 2 : 10, curve: "linear" },
    ] });
    const pose = evaluate(rig, [{ animation: "walk", time: 0.5, alpha: 1 }]).bones[1]!;
    const expected = { x: 0, y: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0 };
    const property = { translate_x: "x", translate_y: "y", scale_x: "scaleX", scale_y: "scaleY", shear_x: "shearX", shear_y: "shearY" }[channel]! as keyof typeof expected;
    expected[property] = scale ? 1.5 : channel.startsWith("shear") ? 5 * Math.PI / 180 : 5;
    for (const name of Object.keys(expected) as Array<keyof typeof expected>) {
      assert.ok(Math.abs(pose[name] - expected[name]) < 1e-6, channel + " " + name);
    }
  }
});

test("v2 independent steps and asynchronous key times do not contaminate X/Y", () => {
  const rig = scalarFixture({
    translate_x: [{ time: 0, value: 0, curve: "linear" }, { time: 1, value: 10, curve: "linear" }],
    translate_y: [{ time: 0, value: 0, curve: "stepped" }, { time: 0.5, value: 4, curve: "linear" }, { time: 1, value: 8, curve: "linear" }],
  });
  const early = evaluate(rig, [{ animation: "walk", time: 0.25, alpha: 1 }]).bones[1]!;
  assert.equal(early.x, 2.5);
  assert.equal(early.y, 0);
  const late = evaluate(rig, [{ animation: "walk", time: 0.75, alpha: 1 }]).bones[1]!;
  assert.equal(late.x, 7.5);
  assert.equal(late.y, 6);
});

test("v2 independent bezier axes preserve their own easing and key times", () => {
  const rig = scalarFixture({
    translate_x: [{ time: 0, value: 0, curve: { type: "bezier", handles: [0.3, 0, 0.7, 1] } }, { time: 1, value: 10, curve: "linear" }],
    translate_y: [{ time: 0.25, value: 0, curve: { type: "bezier", handles: [1 / 3, 0, 2 / 3, 0] } }, { time: 1.25, value: 8, curve: "linear" }],
  });
  const pose = evaluate(rig, [{ animation: "walk", time: 0.5, alpha: 1 }]).bones[1]!;
  assert.ok(Math.abs(pose.x - 5) < 0.01);
  assert.ok(Math.abs(pose.y - 0.125) < 0.01);
});

test("v2 baked times and empty axes preserve offset and setup semantics", () => {
  const rig = scalarFixture({
    translate_x: [{ time: 0.25, value: 0, curve: "linear" }, { time: 1.25, value: 10, curve: "linear" }],
    scale_y: [],
  });
  const pose = evaluate(rig, [{ animation: "walk", time: 0.75, alpha: 1 }]).bones[1]!;
  assert.equal(pose.x, 5);
  assert.equal(pose.scaleY, 1);
});

test("runtime versions distinguish legacy paired tracks from scalar v2", () => {
  const legacy = fixture();
  assert.deepEqual(evaluate(parseRig(legacy)), evaluate(parseRig({ ...legacy, format_version: 1 })));
  assert.throws(() => parseRig({ ...legacy, format_version: 3 }), RigFormatError);
  assert.throws(() => parseRig({ ...legacy, format_version: null }), RigFormatError);
  assert.throws(() => parseRig({ ...legacy, format_version: 2 }), RigFormatError);
  const scalar = scalarFixture({ translate_x: [{ time: 0, value: 3, curve: "linear" }] });
  assert.throws(() => parseRig({ ...scalar, format_version: 1 }), RigFormatError);
  assert.throws(() => parseRig({ ...scalar, format_version: undefined }), RigFormatError);
  scalar.animations.walk!.bones[0]!.offset = 0.25;
  assert.throws(() => parseRig(scalar), RigFormatError);
});

test("v2 validates scalar keys, sorted times and finite bezier handles", () => {
  for (const keys of [
    [{ time: 0, value: "bad", curve: "linear" }],
    [{ time: NaN, value: 1, curve: "linear" }],
    [{ time: 1, value: 1, curve: "linear" }, { time: 0, value: 0, curve: "linear" }],
    [{ time: 0, value: 1, curve: { type: "bezier", handles: [0, 0, Infinity, 1] } }],
    [{ time: 0, value: 1, curve: { type: "bezier", handles: [-1, 0, 1, 1] } }],
    [{ time: 0, value: 1, curve: null }],
  ]) assert.throws(() => scalarFixture({ translate_x: keys }), RigFormatError);
});

test("v2 reaches a stepped decimal endpoint at the same f32 instant as Rust", () => {
  const rig = scalarFixture({ translate_x: [
    { time: Math.fround(0.8), value: 12, curve: "stepped" },
    { time: Math.fround(1.6), value: -4, curve: "linear" },
  ] });
  assert.equal(evaluate(rig, [{ animation: "walk", time: 1.6, alpha: 1 }]).bones[1]!.x, -4);
  assert.equal(evaluate(rig, [{ animation: "walk", time: 1.599, alpha: 1 }]).bones[1]!.x, 12);
});

test("legacy v1 FFD retains double-precision playhead semantics", () => {
  for (const version of [undefined, 1] as const) {
    const rig = fixture();
    if (version !== undefined) rig.format_version = version;
    rig.animations.walk!.deform = [{ slot: "part", attachment: "part", keys: [
      { time: 0.25, offsets: [0, 0], curve: "stepped" },
      { time: Math.fround(0.8), offsets: [10, 20], curve: "linear" },
    ] }];
    const read = parseRig(rig);
    assert.deepEqual(evaluate(read, [{ animation: "walk", time: 0.8, alpha: 1 }]).deforms["part\0part"], [0, 0]);
    assert.deepEqual(evaluate(read, [{ animation: "walk", time: Math.fround(0.8), alpha: 1 }]).deforms["part\0part"], [10, 20]);
  }
});
