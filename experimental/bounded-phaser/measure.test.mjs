import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{join}from'node:path';
import{geometry}from'./measure.mjs';
const cfg=JSON.parse(readFileSync(process.argv[2])),info=JSON.parse(readFileSync(join(cfg.out,'accepted/captures/simple-fault_at_20-step-tick19.json'))),rig=JSON.parse(readFileSync(join(cfg.exports,'simple/skeleton.json'))),oracle=JSON.parse(readFileSync(join(cfg.out,'oracles/simple-fault_at_20.json'))),reference=oracle.frames.find(f=>f.tick===19&&!f.preview);
const check=actual=>geometry(actual,reference,info.snapshot,rig,info.row.placement);
test('actual recorded Phaser GPU buffers satisfy independent Rust positions',()=>assert.equal(check(info.actual).status,'PASS'));
for(const[name,patch]of[
 ['corrupt submitted position',a=>a.buffers[0].submitted[0].positions[0]+=10],
 ['corrupt submitted UV',a=>a.buffers[0].submitted[0].uvs[0]+=1],
 ['missing GPU readback',a=>a.buffers[0].submitted=[]],
 ['mismatched upload bytes',a=>a.buffers[0].submitted[0].uploadedBytesEqual=false],
 ['corrupt index',a=>a.buffers[0].indices[0]=99999]
])test('measurement refuses '+name,()=>{const copy=structuredClone(info.actual);patch(copy);assert.throws(()=>check(copy));});
