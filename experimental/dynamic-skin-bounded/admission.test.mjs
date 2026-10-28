import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {join} from 'node:path';
import {createSupervisor} from './supervisor.mjs';
const cfg=JSON.parse(readFileSync(process.argv[2])),out=process.argv[3];mkdirSync(out);const bank=JSON.parse(readFileSync(cfg.manifest)),e=bank.entries.find(e=>e.id==='courier-combined-primary'),rows=[];
const base={qualificationId:e.id,history:'step',instanceId:'negative',nativeBytes:readFileSync(e.native),request:e.expected};
await test('missing/wrong anchor and historical fixed anchor are not dynamic authority',async()=>{for(const c of [{...cfg,anchorSHA256:undefined},{...cfg,anchorSHA256:'0'.repeat(64)},{...cfg,anchorPath:cfg.fixedAnchor,anchorSHA256:'78f0318363659b7665645451547c1f58cc6bf29e07c49bc6a7abc6efc92fbb01'}])await assert.rejects(createSupervisor(c));});
const s=await createSupervisor(cfg);
try{
for(const[name,change]of[['unknown trajectory',v=>v.qualificationId='unapproved'],['free history',v=>v.history='free'],['native bytes',v=>v.nativeBytes=Buffer.concat([v.nativeBytes,Buffer.from(' ')])],['event tick',v=>v.request.trajectory.initialization.skinSchedule[1].tick++],['event skin',v=>v.request.trajectory.initialization.skinSchedule[1].skin='night']])await test('authority refuses '+name,()=>{const v=structuredClone(base);change(v);assert.throws(()=>s.authorize(v));});
await test('ticket is instance-bound, opaque, and single-use',async()=>{await assert.rejects(s.start({},'negative'));const t=s.authorize(base);await assert.rejects(s.start(t,'foreign'));const c=await s.start(t,'negative');await assert.rejects(s.start(t,'negative'));await c.dispose();});
const c=await s.start(s.authorize({...base,instanceId:'safe'}),'safe');
try{
 await test('private API has no mutable consumer/context/rig or free methods',()=>{for(const k of ['consumer','context','rig','factory','createConsumer','setSkin','requestTick','reset'])assert.equal(c[k],undefined);assert(Object.isFrozen(c));assert.throws(()=>c.observe.call({}));});
 for(const[name,change]of[['H+1',v=>v.command={op:'request',tick:257}],['extra reset',v=>v.command={op:'reset',epoch:'2'}],['setSkin',v=>v.command={op:'setSkin',skin:'night'}],['foreign session',v=>v.sessionId='foreign'],['stale cursor',v=>v.cursor++],['foreign epoch',v=>v.epoch='99']])await test('command refusal '+name,async()=>{const before=await c.observe(),v=await c.next();change(v);await assert.rejects(c.execute(v));const after=await c.observe();assert.deepEqual(after,before);rows.push({name,before,after});});
 await test('accessor rejected without invoking getter',async()=>{let calls=0;const v=await c.next();Object.defineProperty(v,'command',{get(){calls++;return{};}});await assert.rejects(c.execute(v));assert.equal(calls,0);});
 await test('detached snapshot/selection/plan cannot mutate owner',async()=>{const before=await c.observe(),v=await c.observe(),plan=await c.next();v.frame.bones[0].x=Infinity;v.selection.active=[];plan.command.op='reset';assert.deepEqual(await c.observe(),before);});
 await test('presentation prevents reentrancy and recovers from callbacks',async()=>{const before=await c.observe();await c.present(async()=>{await assert.rejects(c.execute(await Promise.resolve({})));await assert.rejects(c.dispose());});assert.deepEqual(await c.observe(),before);await assert.rejects(c.present(()=>{throw Error('intentional');}));assert.deepEqual(await c.observe(),before);});
 await test('stale envelope after valid command refuses without mutation',async()=>{const n=await c.next();await c.execute(n);const before=await c.observe();await assert.rejects(c.execute(n));assert.deepEqual(await c.observe(),before);});
}finally{await c.dispose();}
}finally{await s.close();writeFileSync(join(out,'REFUSALS.json'),JSON.stringify(rows,(_,v)=>typeof v==='bigint'?String(v):v,2));}
