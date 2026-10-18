import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluate, parseRig, RigFormatError, RigPlayer } from "../src/index.js";

const source = readFileSync(new URL("../../../phaser/test/fixtures/dark_tint/skeleton.json", import.meta.url), "utf8");
const fixture = () => JSON.parse(source);

test("native M005.3a static dark RGBA survives parsing without rounding or clamping", () => {
  for (const dark of [[0, 0, 0, 0], [1, 1, 1, 1], [Math.fround(0.2), Math.fround(0.3), Math.fround(0.4), 0.5], [-0.25, 2, 0.123456789, 0.375]]) {
    const raw = fixture(); raw.slots[0].dark_color = dark;
    const before = structuredClone(raw);
    const parsed = parseRig(raw);
    assert.deepEqual(parsed, before);
    assert.deepEqual(raw, before);
  }
});

test("present dark tint requires four finite numbers, including API-only invalid values", () => {
  const invalid = [null, undefined, false, "ffffffff", {}, new Float32Array(4), [], [0, 0, 1], [0, 0, 0, 1, 2], [0, "0", 0, 1], [0, null, 0, 1], new Array(4)];
  for (let channel = 0; channel < 4; channel++) for (const value of [NaN, Infinity, -Infinity]) {
    const dark = [0, 0, 0, 1]; dark[channel] = value; invalid.push(dark);
  }
  for (const dark of invalid) {
    const raw = fixture(); raw.slots[0].dark_color = dark;
    assert.throws(() => parseRig(raw), RigFormatError, `invalid dark RGBA: ${String(dark)}`);
  }
  const raw = fixture(); raw.slots[0].dark_color = [0, 0, 0, 1];
  const overflow = JSON.stringify(raw).replace('"dark_color":[0,0,0,1]', '"dark_color":[0,0,0,1e400]');
  assert.throws(() => parseRig(overflow), RigFormatError);
  assert.throws(() => parseRig('{"format":"ankhimate-runtime",'), RigFormatError);
});

test("static dark tint reaches the pose while light color, attachment and draw order animate", () => {
  const raw = fixture(), rig = parseRig(raw);
  for (const time of [0, 0.25, 0.5, 0.75]) {
    const pose = evaluate(rig, [{ animation: "pulse", time, alpha: 1 }]);
    for (const slot of pose.slots) {
      const expected = raw.slots.find((s: { name: string }) => s.name === slot.name).dark_color;
      assert.deepEqual((slot as unknown as { dark_color: unknown }).dark_color, expected);
    }
    assert.equal(pose.slots.find(s => s.name === "switch")!.attachment, time < 0.5 ? "art" : "red");
  }
  const player = new RigPlayer(rig); player.play("pulse"); player.update(0.3);
  assert(player.events.some(event => event.name === "step"));
  player.crossFade("alternate", 0.25); const pose = player.update(0.125);
  assert.deepEqual((pose.slots[0] as unknown as { dark_color: unknown }).dark_color, raw.slots[0].dark_color);
});

test("absent dark tint in legacy v1 and v2 preserves the old pose shape", () => {
  for (const version of [1, 2]) {
    const raw = fixture(); raw.format_version = version; raw.animations = {};
    for (const slot of raw.slots) delete slot.dark_color;
    const rig = parseRig(raw), pose = evaluate(rig);
    for (const slot of pose.slots) assert.equal(Object.hasOwn(slot, "dark_color"), false);
  }
});

test("animated light RGBA follows its authored linear, stepped and Bezier curve with static dark tint", () => {
  for (const [curve, expected] of [
    ["linear", 0.5], ["stepped", 1], [{ type: "bezier", handles: [0, 0, 1, 0] }, 0.875],
  ] as const) {
    const raw = fixture();
    const track = raw.animations.pulse.slots.find((s: { channel: string }) => s.channel === "color");
    track.keys = [{time:0,color:[1,1,1,1],curve},{time:1,color:[0,0,0,0],curve:"linear"}];
    const pose = evaluate(parseRig(raw), [{animation:"pulse",time:0.5,alpha:1}]);
    const slot = pose.slots.find(s=>s.name==="animated")!;
    assert(slot.color.every(component=>Math.abs(component-expected)<1e-6));
  }
  const legacy = fixture();
  const track = legacy.animations.pulse.slots.find((s: { channel: string }) => s.channel === "color");
  for (const key of track.keys) delete key.curve;
  assert.deepEqual(evaluate(parseRig(legacy), [{animation:"pulse",time:0.5,alpha:1}]).slots.find(s=>s.name==="animated")!.color, [1,1,1,1]);
});
