import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createSupervisor,seal} from './supervisor.mjs';
import {verify} from '../../scripts/t840c7b-n5/proof.mjs';
const cfg=JSON.parse(readFileSync(process.argv[2])),out=cfg.out,manifest=JSON.parse(readFileSync(cfg.manifest)),anchor=JSON.parse(readFileSync(cfg.anchorPath));
const here=dirname(fileURLToPath(import.meta.url)),scratch=join(out,'negative-copies');mkdirSync(scratch);
const reports={positive:[],negative:[],faults:[],near:[],bypass:[],costs:[],trust:[]};
const write=(name,data)=>writeFileSync(join(out,name),JSON.stringify(data,(_,v)=>typeof v==='bigint'?String(v):v,2)+'\n');
const short=manifest.entries.find(e=>e.id==='simple-fault_at_20');let authority;
const input=(e=short,h='bulk',id=randomUUID())=>({qualificationId:e.id,history:h,instanceId:id,nativeBytes:readFileSync(e.native),request:structuredClone(e.expected)});
async function start(e=short,h='bulk',s=authority){const i=input(e,h),t=s.authorize(i);return s.start(t,i.instanceId);}
async function refuses(c,command,kind){const before=await c.observe(),next=await c.next();await assert.rejects(c.execute({...next,command}),e=>!kind||e.kind===kind);const after=await c.observe();assert.deepEqual(after,before);reports.negative.push({command,kind,before,after});}
function localConfig(change,{code=here}={}){
 const folder=join(scratch,randomUUID());mkdirSync(folder);const m=structuredClone(manifest);change?.(m);
 const mp=join(folder,'manifest.json');writeFileSync(mp,JSON.stringify(m));const a=structuredClone(anchor);a.manifest={path:mp,seal:seal(mp)};
 a.code=Object.fromEntries(['browser.mjs','supervisor.mjs'].map(f=>[f,seal(join(code,f))]));
 a.dependencies=Object.fromEntries(Object.keys(anchor.dependencies).map(f=>[resolve(here,f),anchor.dependencies[f]]));
 const ap=join(folder,'anchor.json');writeFileSync(ap,JSON.stringify(a));return {...cfg,manifest:mp,anchorPath:ap,anchorSHA256:seal(ap).sha256};
}
try{
 authority=await createSupervisor(cfg);write('CHROME-IDENTITY.json',authority.identity());
 for(const e of manifest.entries)for(const history of ['step','bulk','replay','reset'])await test('admitted Chrome trajectory '+e.id+'/'+history,async()=>{
  const c=await start(e,history),commands=[];try{
   while(!(await c.observe()).complete){const n=await c.next(),f=await c.execute(n);commands.push({envelope:n,frame:f});}
   const f=await c.observe(),d=await c.diagnostics(),H=e.expected.trajectory.horizon;
   assert.equal(f.frame.completed,BigInt(H));assert.equal(f.frame.requested,BigInt(H));assert.equal(f.frame.backlog,0n);assert.equal(f.frame.health,'healthy');
   assert.equal(d.auditedCandidates,H*(history==='reset'?2:1));assert.deepEqual(d.acceptedTicks,Array.from({length:history==='reset'?2:1},()=>Array.from({length:H},(_,i)=>i+1)).flat());
   assert.equal(commands.length,e.expected.trajectory.histories.find(h=>h.id===history).commands.length);
   await refuses(c,{op:'request',tick:H+1},'HORIZON');await refuses(c,{op:'pump',budget:1},'ADMISSION');
   const receipt={id:e.id,history,horizon:H,cursor:f.cursor,commands,audits:d.auditedCandidates,acceptedTicks:d.acceptedTicks,end:f,evidence:c.evidence(),metrics:d};
   write('history-'+e.id+'-'+history+'.json',receipt);reports.positive.push({id:e.id,history,horizon:H,commands:commands.length,audits:d.auditedCandidates,complete:true});
   reports.costs.push({id:e.id,history,...d});
  }finally{await c.dispose();}
 });
 for(const [name,mutate]of [
  ['native bytes',i=>i.nativeBytes=Buffer.concat([i.nativeBytes,Buffer.from(' ')])],['clip',i=>i.request.trajectory.clip='other'],['Physics',i=>i.request.trajectory.simulation.constraints[0].physics.mass+=1],['H',i=>i.request.trajectory.horizon++],['history',i=>i.history='free'],['origin',i=>i.request.trajectory.initialization.originTick=1],['flags',i=>i.request.trajectory.histories[0].commands[0].restart=true],['request module',i=>i.request.javascriptBuild.modules[0].sha256='0'.repeat(64)]
 ])await test('admission rejects '+name,()=>{const i=input();mutate(i);assert.throws(()=>authority.authorize(i));});
 await test('foreign and consumed tickets, buffers and requests detached',async()=>{
  const i=input(),t=authority.authorize(i);i.nativeBytes.fill(0);i.request.trajectory.horizon=10000;
  await assert.rejects(authority.start({},i.instanceId));await assert.rejects(authority.start(t,'wrong'));
  const c=await authority.start(t,i.instanceId);await assert.rejects(authority.start(t,i.instanceId));assert.equal((await c.observe()).frame.completed,0n);await c.dispose();
 });
 await test('foreign ticket from another authority is refused',async()=>{const s=await createSupervisor(cfg);try{const i=input(),t=authority.authorize(i);await assert.rejects(s.start(t,i.instanceId));const c=await authority.start(t,i.instanceId);await c.dispose();}finally{await s.close();}});
 await test('two sessions isolate envelopes, snapshots and mutable Node copies',async()=>{
  const a=await start(),b=await start();try{const before=await b.observe(),n=await a.next();await assert.rejects(b.execute(n));assert.deepEqual(await b.observe(),before);await a.execute(n);const f=await a.observe();f.frame.bones[0].x=999;f.frame.records[0].x=999;const plan=await a.next();plan.command.tick=9999;assert.notEqual((await a.observe()).frame.bones[0].x,999);assert.notEqual((await a.next()).command.tick,9999);assert.deepEqual(await b.observe(),before);}finally{await a.dispose();await b.dispose();}
 });
 for(const [name,command,kind]of [
  ['H+1 request',{op:'request',tick:20},'HORIZON'],['H+1 seek',{op:'seek',tick:20},'HORIZON'],['H+1 replay',{op:'replay',tick:20},'HORIZON'],['over-H time',{op:'requestTime',n:'20',d:'120'},'HORIZON'],['over-H seekTime',{op:'seekTime',n:'20',d:'120'},'HORIZON'],['over-H replayTime',{op:'replayTime',n:'20',d:'120'},'HORIZON'],['within-H unqualified',{op:'request',tick:2},'ADMISSION'],['within-H time',{op:'requestTime',n:'1',d:'120'},'ADMISSION'],['host time',{op:'advance',seconds:0.01},'ADMISSION'],['free pause',{op:'pause'},'ADMISSION'],['free reset',{op:'reset',epoch:'2'},'ADMISSION'],['wrong play flag',{op:'play',restart:true},'ADMISSION']
 ])await test('no mutation: '+name,async()=>{const c=await start();try{await refuses(c,command,kind);}finally{await c.dispose();}});
 await test('backlog active H+1 refused before intent or ticks change',async()=>{const c=await start();try{await c.execute(await c.next());await c.execute(await c.next());assert.equal((await c.observe()).frame.completed,8n);assert.equal((await c.observe()).frame.backlog,11n);await refuses(c,{op:'request',tick:20},'HORIZON');await refuses(c,{op:'pump',budget:2},'ADMISSION');const n=await c.next(),before=await c.observe();for(const patch of [{cursor:n.cursor+1},{epoch:'99'},{sessionId:'foreign'}]){await assert.rejects(c.execute({...n,...patch}));assert.deepEqual(await c.observe(),before);}}finally{await c.dispose();}});
 await test('supervisor presentation rejects reentrance, errors do not fault Physics',async()=>{const c=await start();try{const before=await c.observe();await assert.rejects(c.present(async()=>{await c.execute(await c.next());}));assert.deepEqual(await c.observe(),before);await assert.rejects(c.present(()=>{throw Error('presentation');}));assert.deepEqual(await c.observe(),before);}finally{await c.dispose();}await assert.rejects(c.observe());await assert.rejects(c.present(()=>{}));});
 await test('proof replacement after cached authorization is rejected',async()=>{
  const path=join(scratch,'cache-bundle');cpSync(short.bundle,path,{recursive:true});const a=localConfig(m=>{const e=m.entries.find(e=>e.id===short.id);const old=e.bundle;e.bundle=path;e.seals=Object.fromEntries(Object.entries(e.seals).map(([p,s])=>[p.startsWith(old)?path+p.slice(old.length):p,s]));});const s=await createSupervisor(a);
  try{const i=input(),ticket=s.authorize(i),c=await s.start(ticket,i.instanceId);await c.dispose();writeFileSync(join(path,'rust-placeholder.json'),'not used');writeFileSync(join(path,'chrome.json'),'{}');assert.throws(()=>s.authorize(input()),e=>e.kind==='TRUST');reports.trust.push({test:'cache proof replaced',refused:true});}finally{await s.close();}
 });
 for(const kind of ['manifest missing','trust digest','manifest replaced','binary hash','module hash','certificate','Rust','Chrome trace','incomplete'])await test('trust refusal: '+kind,async()=>{
  const config=localConfig();let a=JSON.parse(readFileSync(config.anchorPath));let entry=JSON.parse(readFileSync(config.manifest)).entries.find(e=>e.id===short.id);
  if(kind==='manifest missing')a.manifest.path+='-missing';
  if(kind==='trust digest')config.anchorSHA256='0'.repeat(64);
  if(kind==='manifest replaced')writeFileSync(config.manifest,'{}');
  if(kind==='binary hash')a.browserIdentity.binaries[0].sha256='0'.repeat(64);
  if(kind==='module hash')a.javascriptBuild.modules[0].sha256='0'.repeat(64);
  if(['certificate','Rust','Chrome trace','incomplete'].includes(kind)){
   const m=JSON.parse(readFileSync(config.manifest)),e=m.entries.find(e=>e.id===short.id),folder=dirname(config.manifest),f=join(folder,'wrong.json');writeFileSync(f,'{}');
   if(kind==='Rust')e.rust=f;else if(kind==='incomplete')e.bundle=join(folder,'missing');else {const copy=join(folder,'bundle');cpSync(short.bundle,copy,{recursive:true});e.bundle=copy;writeFileSync(join(copy,kind==='certificate'?'certificate.json':'chrome.json'),'{}');}
   writeFileSync(config.manifest,JSON.stringify(m));a.manifest.seal=seal(config.manifest);
  }
  if(kind!=='trust digest'){writeFileSync(config.anchorPath,JSON.stringify(a));config.anchorSHA256=seal(config.anchorPath).sha256;}
  let s;try{s=await createSupervisor(config);assert.throws(()=>s.authorize(input()));}catch(e){assert.notEqual(e.code,'ERR_ASSERTION',String(e));reports.trust.push({test:kind,refused:true,error:String(e)});}finally{await s?.close();}
 });
 await test('all three actual Near numerical proofs are refused even in a trusted test bank',async()=>{
  const nc=localConfig(m=>{m.entries.splice(0,3,...cfg.near);});const s=await createSupervisor(nc);try{for(const e of cfg.near){const verdict=verify({directory:e.bundle,expected:e.expected,nativeBytes:readFileSync(e.native),rustBytes:readFileSync(e.rust),javascriptBuild:anchor.javascriptBuild,browserIdentity:anchor.browserIdentity});assert.equal(verdict.status,'FAILED_NUMERICAL_PARITY');assert.throws(()=>s.authorize(input(e)),x=>x.kind==='CERTIFICATE'&&x.code==='FAILED_NUMERICAL_PARITY');const comparison=JSON.parse(readFileSync(join(e.bundle,'comparison.json')));reports.near.push({id:e.id,...verdict,firstViolation:comparison.firstViolation});}}finally{await s.close();}
 });
 await test('cached authorization rechecks a replaced Rust reference',async()=>{
  const a=localConfig(m=>{const e=m.entries.find(e=>e.id===short.id),rp=join(scratch,'rust-copy.json');writeFileSync(rp,readFileSync(e.rust));const old=e.rust;e.rust=rp;e.seals[rp]=e.seals[old];delete e.seals[old];});const m=JSON.parse(readFileSync(a.manifest)),e=m.entries.find(e=>e.id===short.id),s=await createSupervisor(a);
  try{const i=input(),t=s.authorize(i),c=await s.start(t,i.instanceId);await c.dispose();writeFileSync(e.rust,'{}');assert.throws(()=>s.authorize(input()),x=>x.kind==='TRUST');reports.trust.push({test:'cached Rust replaced',refused:true});}finally{await s.close();}
 });
 await test('cached authorization rechecks its independent manifest',async()=>{
  const a=localConfig(),s=await createSupervisor(a);try{const i=input(),t=s.authorize(i),c=await s.start(t,i.instanceId);await c.dispose();writeFileSync(a.manifest,'{}');assert.throws(()=>s.authorize(input()),x=>x.kind==='TRUST');reports.trust.push({test:'cached manifest replaced',refused:true});}finally{await s.close();}
 });
 write('ADMISSION-RECEIPT.json',reports);write('COSTS-RAW.json',{supervisor:authority.costs(),histories:reports.costs});
}finally{await authority?.close();write('ADMISSION-RECEIPT.json',reports);}
