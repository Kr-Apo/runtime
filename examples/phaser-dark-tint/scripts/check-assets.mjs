import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("vendor/provenance.json", root)));
for(const [file,expected] of Object.entries(manifest.sha256)) {
  assert.equal(createHash("sha256").update(await readFile(new URL(file,root))).digest("hex"),expected,`changed tested artifact: ${file}`);
}
console.log("Real exports and tested local runtime archives match their recorded hashes.");
