import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeOraclePng} from './oracle-png.mjs';
test('all 288 direct PNG oracles decode byte-for-byte like independent Pillow, without Canvas alpha conversion',()=>{
 const manifest=JSON.parse(readFileSync(new URL('./appearance-png-rgba.json',import.meta.url),'utf8'));assert.equal(manifest.entries.length,288);
 for(const e of manifest.entries){const p=decodeOraclePng(readFileSync(new URL(e.file,import.meta.url)));assert.equal(p.width,e.width);assert.equal(p.height,e.height);assert.equal(createHash('sha256').update(p.rgba).digest('hex'),e.rgba_sha256,e.file);}
});
