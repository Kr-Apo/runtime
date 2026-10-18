import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("phaser/test/fixtures/clipping/provenance.json", root)));
for (const [path, expected] of Object.entries(manifest.sha256)) {
  assert.equal(createHash("sha256").update(await readFile(new URL(path, root))).digest("hex"), expected, `changed clipping fixture: ${path}`);
}
for (const [path, expected] of Object.entries(manifest.generatorSha256Lf)) {
  const source = (await readFile(new URL(path, root), "utf8")).replace(/\r\n/g, "\n");
  assert.equal(createHash("sha256").update(source).digest("hex"), expected, `clipping oracle generator changed: ${path}`);
}
for (const [path, expected] of Object.entries(manifest.m0054aNativeSha256)) assert.equal(manifest.sha256[path], expected, `historical native clipping export changed: ${path}`);
console.log(`${Object.keys(manifest.sha256).length} native clipping / independent Rust CPU files and five M005.4a exports match reviewed hashes.`);
