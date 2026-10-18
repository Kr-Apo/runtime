import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../phaser/test/fixtures/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("provenance.json", root)));
for (const [name, expected] of Object.entries(manifest.sha256)) {
  assert.equal(createHash("sha256").update(await readFile(new URL(name, root))).digest("hex"), expected, `changed reference fixture: ${name}`);
}
console.log(`${Object.keys(manifest.sha256).length} real-export / CPU reference files match their reviewed SHA-256 hashes.`);
