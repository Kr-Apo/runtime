import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createEvaluationState, evaluate, parseRig, RigPlayer } from "../src/index.js";

function fixture(name = "single") {
  return parseRig(readFileSync(new URL(`../../test/fixtures/t839/${name}.native.json`, import.meta.url), "utf8"));
}

test("native Physics target activates the driven bone without a fabricated chain", () => {
  const rig = fixture();
  assert.equal(rig.constraints[0]!.target, "tassel");
  assert.deepEqual(rig.constraints[0]!.bones, []);
  const state = createEvaluationState();
  const pose = evaluate(rig, [], { state, deltaSeconds: 1 / 60 });
  assert.equal(state.physics.size, 1, "the real native export must advance a simulation");
  assert.notEqual(pose.bones[1]!.rotation, 0);
  assert.notEqual(pose.bones[1]!.x, rig.bones[1]!.x);
  assert.equal(pose.bones[0]!.rotation, 0, "never simulate the parent by default");
});

test("legacy v1/v2 Physics bones-only exports retain their trajectories", () => {
  for (const version of [undefined, 1, 2] as const) {
    const native = fixture();
    const legacy = fixture();
    if (version === undefined) delete legacy.format_version;
    else legacy.format_version = version;
    // Physics compatibility is independent of v2 scalar animation tracks.
    legacy.animations = {};
    legacy.constraints[0]!.target = "";
    legacy.constraints[0]!.bones = ["tassel"];
    parseRig(legacy);
    const a = createEvaluationState(), b = createEvaluationState();
    for (let i = 0; i < 60; i++) assert.deepEqual(
      evaluate(native, [], { state: a, deltaSeconds: 1 / 60 }),
      evaluate(legacy, [], { state: b, deltaSeconds: 1 / 60 }),
    );
  }
});

test("Physics references must be unique, valid and unambiguous", () => {
  for (const [target, bones] of [
    ["missing", []], ["", []], ["", ["missing"]], ["", ["tassel", "tip"]],
    ["tassel", ["tip"]], ["tassel", ["tassel", "tassel"]],
  ] as Array<[string, string[]]>) {
    const rig = fixture();
    Object.assign(rig.constraints[0]!, { target, bones });
    assert.throws(() => parseRig(rig), /physics.*bone/i);
    assert.throws(() => evaluate(rig, [], { state: createEvaluationState(), deltaSeconds: 1 / 60 }), /physics.*bone/i);
  }
  const same = fixture();
  same.constraints[0]!.bones = ["tassel"];
  const before = structuredClone(same);
  assert.doesNotThrow(() => parseRig(same));
  assert.deepEqual(same, before, "reading must not normalize or mutate wire data");
  for (const change of [{ target: null }, { bones: null }, { bones: [12] }]) {
    const malformed = fixture();
    Object.assign(malformed.constraints[0]!, change);
    assert.throws(() => parseRig(malformed), /physics.*bone/i);
  }
});

test("Physics remains opt-in, mix-zero inert, and zero-dt preserves state", () => {
  const rig = fixture();
  assert.equal(evaluate(rig).bones[1]!.rotation, 0);
  const state = createEvaluationState();
  evaluate(rig, [], { state, deltaSeconds: 1 / 60 });
  const before = structuredClone(state);
  evaluate(rig, [], { state, deltaSeconds: 0 });
  assert.deepEqual(state, before);
  rig.constraints[0]!.mix = 0;
  assert.equal(evaluate(rig, [], { state, deltaSeconds: 1 / 60 }).bones[1]!.rotation, 0);
});

test("native multi-constraint and transformed-parent replays reset deterministically", () => {
  for (const name of ["multiple", "parent"]) {
    const run = () => {
      const p = new RigPlayer(fixture(name)).play("move");
      return Array.from({ length: 60 }, () => p.update(1 / 60));
    };
    assert.deepEqual(run(), run());
  }
});

test("Physics transport audit: seek retains offsets, play resets, crossfade retains state", () => {
  const rig = fixture();
  rig.animations.other = structuredClone(rig.animations.move!);
  const player = new RigPlayer(rig).play("move");
  for (let i = 0; i < 20; i++) player.update(1 / 60);
  const rotation = player.pose().bones[1]!.rotation;
  assert.notEqual(rotation, 0);
  player.seek(0);
  assert.equal(player.pose().bones[1]!.rotation, rotation, "seek is not physical replay");
  player.crossFade("other", 0.5);
  assert.equal(player.pose().bones[1]!.rotation, rotation);
  player.play("move");
  assert.equal(player.pose().bones[1]!.rotation, 0);
  const fresh = new RigPlayer(rig).play("move");
  fresh.pose(); // Same anchor initialization as the reset player's pose() above.
  assert.deepEqual(player.update(1 / 60), fresh.update(1 / 60));
});
