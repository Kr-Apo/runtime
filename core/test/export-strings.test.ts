import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { animationOf, evaluate, parseRig } from "../src/index.js";

test("native Rust JSON preserves names, control characters and event payloads in TypeScript", () => {
  const reference = JSON.parse(readFileSync(
    new URL("../../test/fixtures/runtime_strings_roundtrip.json", import.meta.url), "utf8",
  )) as { cases: Array<{ text: string; expected: Record<string, string> }> };
  assert.equal(reference.cases.length, 4);
  for (const { text, expected } of reference.cases) {
    const rig = parseRig(text);
    assert.equal(rig.format_version, 2);
    assert.equal(rig.name, expected.name);
    assert.equal(rig.bones[0]!.name, expected.bone);
    assert.equal(rig.slots[0]!.name, expected.slot);
    assert.equal(rig.slots[0]!.bone, expected.bone);
    assert.equal(rig.slots[0]!.attachment, expected.attachment);
    assert.equal(rig.defaultSkin, expected.skin);
    assert.equal(rig.skins[0]!.name, expected.skin);
    assert.equal(rig.skins[0]!.attachments[0]!.slot, expected.slot);
    assert.equal(rig.skins[0]!.attachments[0]!.name, expected.attachment);
    const attachment = rig.skins[0]!.attachments[0]!.attachment;
    assert.ok(attachment.type === "region");
    assert.equal(attachment.texture, expected.texture);
    const clip = animationOf(rig, expected.animation!);
    assert.equal(clip.bones[0]!.name, expected.bone);
    assert.equal(clip.events[0]!.name, expected.event);
    assert.equal(clip.events[0]!.string, expected.payload);
    assert.equal(clip.events[0]!.audio, expected.audio);
    const pose = evaluate(rig, [{ animation: expected.animation!, time: 0.5, alpha: 1 }]);
    assert.equal(pose.bones[0]!.name, expected.bone);
    assert.ok(Math.abs(pose.bones[0]!.x - 5) <= 0.01);
  }
});
