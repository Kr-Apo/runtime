import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("phaser/test/fixtures/skin-uv/provenance.json", root)));
for (const [path, expected] of Object.entries(manifest.sha256)) {
  assert.equal(createHash("sha256").update(await readFile(new URL(path, root))).digest("hex"), expected, `changed skin UV fixture: ${path}`);
}
for (const [path, expected] of Object.entries(manifest.generatorSha256Lf)) {
  const source = (await readFile(new URL(path, root), "utf8")).replace(/\r\n/g, "\n");
  assert.equal(createHash("sha256").update(source).digest("hex"), expected, `reference generator changed: ${path}`);
}
assert.equal(manifest.sha256["phaser/test/fixtures/skin-uv/audit-same-light/native/skeleton.json"], manifest.m0054aNativeSha256, "original M005.4a skins export is byte-identical");
console.log(`${Object.keys(manifest.sha256).length} native skin exports / independent Rust CPU oracles match reviewed hashes.`);
