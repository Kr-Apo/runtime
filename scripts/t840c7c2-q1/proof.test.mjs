/** Negative evidence copies; never modify approved originals. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,statSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {verify} from './proof.mjs';
import {analyze,hash} from './browser-contract.mjs';
const cfg=JSON.parse(readFileSync(process.argv[2])),bank=JSON.parse(readFileSync(cfg.manifest)),e=bank.entries.find(e=>e.id==='courier-combined-primary');
const scratch=process.argv[3];mkdirSync(scratch);let serial=0;
const read=p=>JSON.parse(readFileSync(p)),save=(p,n,v)=>writeFileSync(join(p,n),JSON.stringify(v)),copy=()=>{const p=join(scratch,'case'+serial++);cpSync(e.bundle,p,{recursive:true});return p;};
const args={directory:e.bundle,expected:e.expected,nativeBytes:readFileSync(e.native),rustBytes:readFileSync(e.rust),javascriptBuild:e.expected.javascriptBuild,browserIdentity:e.expected.browserIdentity},check=o=>verify({...args,...o});
function reseal(p,n){const c=read(join(p,'certificate.json'));c.proofs[n]={sha256:hash(readFileSync(join(p,n))),bytes:statSync(join(p,n)).size};save(p,'certificate.json',c);}
test('independent real Rust/Node/Chrome H256 proof is favorable',()=>assert.equal(check().valid,true));
for(const [name,change] of [
 ['event tick',q=>q.trajectory.initialization.skinSchedule[1].tick++],
 ['event skin',q=>q.trajectory.initialization.skinSchedule[1].skin='night'],
 ['absent calendar',q=>delete q.trajectory.initialization.skinSchedule],
 ['unknown skin',q=>q.trajectory.initialization.skinSchedule[0].skin='unknown'],
 ['H+1',q=>q.trajectory.horizon++],
 ['free history',q=>q.trajectory.histories[0].commands.push({op:'setSkin',skin:'night'})],
])test('expected trajectory mutation refuses '+name,()=>{const expected=structuredClone(e.expected);change(expected);assert.equal(check({expected}).valid,false);});
for(const field of ['browserIdentity','javascriptBuild'])test('changed actual '+field+' refuses even with same version labels',()=>{const v=structuredClone(args[field]);v.sha256='0'.repeat(64);assert.equal(check({[field]:v}).valid,false);});
test('incomplete independent Rust reference refuses',()=>{const r=JSON.parse(args.rustBytes);r.variants[0].frames.splice(20,1);assert.equal(check({rustBytes:Buffer.from(JSON.stringify(r))}).valid,false);const chrome=read(join(e.bundle,'chrome.json'));assert.notEqual(analyze(e.expected,JSON.parse(args.nativeBytes),r,chrome).status,'QUALIFIED_DYNAMIC_BROWSER_BOUNDED');});
test('same native semantics with different exact bytes refuses',()=>assert.equal(check({nativeBytes:Buffer.concat([args.nativeBytes,Buffer.from(' ')])}).valid,false));
for(const name of ['fixed certificate','falsified status','missing trace','missing Rust identity','wrong executed module','missing executed module','nonzero WebGL','altered comparison'])test('bundle refusal '+name,()=>{
 const p=copy();if(name==='fixed certificate'||name==='falsified status'){const c=read(join(p,'certificate.json'));if(name==='fixed certificate')c.contract='ankhimate.browser.bounded/1';else c.status='QUALIFIED_BROWSER_BOUNDED';save(p,'certificate.json',c);}
 if(name==='missing trace')unlinkSync(join(p,'chrome.json'));
 if(name==='missing Rust identity'){const c=read(join(p,'certificate.json'));delete c.request.rustReference;save(p,'certificate.json',c);}
 if(['wrong executed module','missing executed module','nonzero WebGL'].includes(name)){const x=read(join(p,'execution.json'));if(name==='wrong executed module')x.scripts[0].sha256='0'.repeat(64);if(name==='missing executed module')x.scripts.pop();if(name==='nonzero WebGL')x.webGLCalls=1;save(p,'execution.json',x);reseal(p,'execution.json');}
 if(name==='altered comparison'){const a=read(join(p,'comparison.json'));a.maxima={};save(p,'comparison.json',a);reseal(p,'comparison.json');}
 assert.equal(check({directory:p}).valid,false);
});
for(const [name,change] of [
 ['skin',f=>f.selection.skin='night'],['membership',f=>f.selection.active.pop()],
 ['attachment',f=>f.selection.attachments[0].texture='forged'],['missing record',f=>f.records.pop()],
 ['entrant',f=>f.records.at(-1).values[3]+=1],['nonfinite',f=>f.bones[0].local[0]={$nonfinite:'NaN'}],
 ['weighted geometry',f=>f.meshes[0].vertices[0].position[0]+=1],
])test('rehashed Chrome trace and execution claims still refuse '+name,()=>{
 const p=copy(),c=read(join(p,'chrome.json'));change(c.variants[0].frames[20]);save(p,'chrome.json',c);reseal(p,'chrome.json');const x=read(join(p,'execution.json'));x.rawSHA256=hash(readFileSync(join(p,'chrome.json')));save(p,'execution.json',x);reseal(p,'execution.json');assert.equal(check({directory:p}).valid,false);
});
