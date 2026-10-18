import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluate, parseRig, RigPlayer } from "../src/index.js";

// Unmodified native Rust export. Sparse stepped FFD ends at 0.8f32.
const source = readFileSync(new URL("../../test/fixtures/ffd_sparse_v2.json", import.meta.url), "utf8");
const end = [-8, 12, 4, -8, 20, 4, 0, 16];

test("native v2 FFD reaches a stepped decimal endpoint at Rust's f32 instant", () => {
  const rig = parseRig(source);
  const pose = evaluate(rig, [{ animation: "clip", time: 0.8, alpha: 1 }]);
  assert.deepEqual(pose.deforms["art\0shape"], end);
  const player = new RigPlayer(rig).play("clip").seek(0.8);
  assert.deepEqual(player.update(0).deforms["art\0shape"], end);
});

test("native v2 sparse FFD holds before the endpoint and after the final key", () => {
  const rig = parseRig(source);
  for (const time of [-0.25, 0, 0.24999, 0.25, 0.5, 0.75, 0.79999]) {
    assert.deepEqual(evaluate(rig, [{ animation: "clip", time, alpha: 1 }]).deforms["art\0shape"], new Array(8).fill(0));
  }
  for (const time of [Math.fround(0.8), 0.80001, 1, 1.25]) {
    assert.deepEqual(evaluate(rig, [{ animation: "clip", time, alpha: 1 }]).deforms["art\0shape"], end);
  }
});
