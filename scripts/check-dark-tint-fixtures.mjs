import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const root=new URL("../",import.meta.url);
const manifest=JSON.parse(await readFile(new URL("phaser/test/fixtures/dark-tint-provenance.json",root)));
for(const [path,expected] of Object.entries(manifest.sha256)) {
  assert.equal(createHash("sha256").update(await readFile(new URL(path,root))).digest("hex"),expected,`changed reviewed dark-tint fixture: ${path}`);
}
for(const [path,expected] of Object.entries(manifest.generatorSha256Lf)) {
  const source=(await readFile(new URL(path,root),"utf8")).replace(/\r\n/g,"\n");
  assert.equal(createHash("sha256").update(source).digest("hex"),expected,`reference generator changed: ${path}`);
}
console.log(`${Object.keys(manifest.sha256).length} M005.3a native export / CPU reference files match their reviewed SHA-256 hashes.`);
