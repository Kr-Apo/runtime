import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{validateSource,validateFrame}from'./geometry.mjs';
const cfg=JSON.parse(readFileSync(process.argv[2])),rig=JSON.parse(readFileSync(cfg.exports+'/combined/skeleton.json'));
test('dynamic native E1 accepts actual Q1 region/mesh4/mesh5 skins without changing bytes',()=>{const before=JSON.stringify(rig);assert.equal(validateSource(rig),rig);assert.equal(JSON.stringify(rig),before);assert.equal(typeof validateFrame,'function');});
