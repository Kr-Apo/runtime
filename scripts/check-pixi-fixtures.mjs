import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const entries=JSON.parse(await readFile(resolve(root,'pixi/test/fixtures/provenance.json'),'utf8'));
for(const e of entries) {
  const actual=createHash('sha256').update(await readFile(resolve(root,e.destination))).digest('hex');
  assert.equal(actual,e.sha256,`Native fixture/reference changed: ${e.destination}`);
}
console.log(`${entries.length} copied native JSON/atlas/independent oracle files match their source SHA-256; no patched native data.`);
