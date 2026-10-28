import test from 'node:test';import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{join,dirname,resolve}from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';import{seal}from'./supervisor.mjs';
const cfg=JSON.parse(readFileSync(process.argv[2])),out=cfg.out,here=dirname(fileURLToPath(import.meta.url)),root=join(out,'instrumented-tests');mkdirSync(root);const baseAnchor=JSON.parse(readFileSync(cfg.anchorPath)),manifest=JSON.parse(readFileSync(cfg.manifest)),e=manifest.entries.find(e=>e.id==='courier-combined-primary');const receipts=[];
const json=(p,x)=>writeFileSync(p,JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v,2));
async function instrument(mode){
 const folder=join(root,mode);mkdirSync(folder);let browser=readFileSync(join(here,'browser.mjs'),'utf8'),supervisor=readFileSync(join(here,'supervisor.mjs'),'utf8');
 supervisor=supervisor.replace(/from (['"])(\.\.\/\.\.\/scripts\/[^'"]+)\1/g,(_,q,s)=>'from '+JSON.stringify(new URL(s,import.meta.url).href));
 supervisor=supervisor.replace("resolve(HERE,'../../scripts/t840c7c2-q1/projection.mjs')",JSON.stringify(fileURLToPath(new URL('../../scripts/t840c7c2-q1/projection.mjs',import.meta.url))));
 const marker='// N6_TEST_SUPERVISOR: test-only copies may exercise browser callbacks, no production eval surface.';assert(supervisor.includes(marker));supervisor=supervisor.replace(marker,'testEval(fn,arg){return page.evaluate(fn,arg);},');
 const boundary='// Q1_TEST_BOUNDARY: only explicitly instrumented test copies inject faults here.';assert(browser.includes(boundary));
 const injection={throw:"throw Error('deliberate N6 observer exception');",nonfinite:'frame=structuredClone(frame);frame.pose.bones[0].x=Infinity;',record_nonfinite:'frame=structuredClone(frame);frame.records[0].x=NaN;',finite_divergence:'frame=structuredClone(frame);frame.pose.bones[0].x+=1;'}[mode];
 if(injection)browser=browser.replace(boundary,`if(frame.tick===20n){${injection}}`);
 writeFileSync(join(folder,'browser.mjs'),browser);writeFileSync(join(folder,'supervisor.mjs'),supervisor);
 const a=structuredClone(baseAnchor);a.code=Object.fromEntries(['browser.mjs','supervisor.mjs'].map(f=>[f,seal(join(folder,f))]));a.dependencies=Object.fromEntries(Object.entries(baseAnchor.dependencies).map(([f,s])=>[resolve(here,f),s]));
 const ap=join(folder,'anchor.json');json(ap,a);const mod=await import(pathToFileURL(join(folder,'supervisor.mjs')));const s=await mod.createSupervisor({...cfg,anchorPath:ap,anchorSHA256:seal(ap).sha256});const id=mode,t=s.authorize({qualificationId:e.id,history:'step',instanceId:id,nativeBytes:readFileSync(e.native),request:e.expected}),c=await s.start(t,id);
 return {s,c,folder,source:{normal:{browser:seal(join(here,'browser.mjs')),supervisor:seal(join(here,'supervisor.mjs'))},instrumented:a.code,scope:'Explicit test-copy supervisor eval hook; four test-only precommit audit injections. Numeric modules unchanged. No such API/injection in normal controller.'}};
}
for(const mode of ['throw','nonfinite','record_nonfinite','finite_divergence'])await test('actual Chrome B6 rejects precommit '+mode,async()=>{
 const {s,c,source}=await instrument(mode);try{
  while((await c.observe()).frame.completed<19n)await c.execute(await c.next());const before=await c.observe();assert.equal(before.frame.completed,19n);const command=await c.next();await assert.rejects(c.execute(command),x=>x.kind==='SIMULATION');const after=await c.observe();
  assert.equal(after.frame.completed,19n);assert.equal(after.frame.requested,20n);assert.deepEqual(after.frame.bones,before.frame.bones);assert.deepEqual(after.frame.records,before.frame.records);assert.equal(after.frame.skin,before.frame.skin);assert.deepEqual(after.selection,before.selection);assert.equal(after.frame.health,'faulted');assert.equal(after.admissionState,'faulted');assert.equal(after.cursor,before.cursor);assert.equal(after.auditedCandidates,before.auditedCandidates);
  for(const cmd of [command.command,{op:'reset',epoch:'2'},{op:'resume'},{op:'replay',tick:19}])await assert.rejects(c.execute({...command,command:cmd}),x=>x.kind==='STATE');assert.deepEqual(await c.observe(),after);
  receipts.push({mode,source,before,after,recovery:'new independent authorization only'});
 }finally{await s.close();}
});
await test('browser facade bypass, snapshots, callbacks, preview and disposal',async()=>{
 const {s,c,source}=await instrument('bypass');try{
 const r=await c.testEval(async()=>{
  const c=globalThis.N6Dynamic,tests=[],snapshots=[];
  function same(a,b){return JSON.stringify(a,(_,v)=>typeof v==='bigint'?String(v):v)===JSON.stringify(b,(_,v)=>typeof v==='bigint'?String(v):v);}
  function attempt(label,fn){const before=c.observe();let error=null;try{fn();}catch(e){error={kind:e.kind,code:e.code,message:String(e)};}const after=c.observe();if(!same(before,after))throw Error('mutation '+label);tests.push({label,error,noMutation:true});snapshots.push({label,before,after});return error;}
  const publicKeys=Object.keys(c).sort(),expected=['diagnostics','dispose','execute','next','observe','present','preview'].sort();if(!same(publicKeys,expected))throw Error('unexpected facade keys');
  for(const key of ['consumer','transport','rig','context','factory','provider','createConsumer','requestTick','requestTime','seekTick','replayFromOrigin','pump','reset','resume','play','setSkin'])if(c[key]!==undefined)throw Error('raw route '+key);
  attempt('bone snapshot',()=>{c.observe().frame.bones[0].x=200;});
  attempt('record snapshot',()=>{c.observe().frame.records[0].x=200;});
  attempt('command plan',()=>{c.next().command.restart=true;});
  attempt('attach raw property',()=>Object.defineProperty(c,'consumer',{value:{}}));
  if(!attempt('borrowed observe',()=>c.observe.call({})))throw Error('receiver accepted');
  if(!attempt('borrowed execute',()=>c.execute.call({},c.next())))throw Error('receiver accepted');
  if(!attempt('wrong session',()=>c.execute({...c.next(),sessionId:'other'})))throw Error('foreign session accepted');
  const {ReplayConsumerBridge}=await import('/core/replay-consumer.js');
  if(!attempt('old consumer prototype',()=>ReplayConsumerBridge.prototype.requestTick.call(c,{},1n)))throw Error('consumer prototype accepted');
  if(!attempt('callback reentrant',()=>c.present(()=>c.execute(c.next()))))throw Error('reentry accepted');
  if(!attempt('callback disposal',()=>c.present(()=>c.dispose())))throw Error('disposal accepted');
  if(!attempt('callback error',()=>c.present(()=>{throw Error('display');})))throw Error('presentation error accepted');
  if(!attempt('async callback',()=>c.present(async()=>{})))throw Error('async accepted');
  let own;attempt('snapshot returned to callback',()=>c.present(v=>{own=v;try{v.frame.bones[0].x=Infinity;}catch{}}));
  if(!own||c.observe().frame.health!=='healthy')throw Error('presentation contaminated');
  const envelope={...c.next()};Object.defineProperty(envelope,'command',{enumerable:true,get(){c.execute(c.next());return {};}});
  if(!attempt('getter reentrant',()=>c.execute(envelope)))throw Error('getter accepted');
  c.dispose();let disposed=0;for(const f of [()=>c.observe(),()=>c.preview(),()=>c.next(),()=>c.present(()=>{}),()=>c.execute({})])try{f();}catch{disposed++;}if(disposed!==5)throw Error('disposed surface active');c.dispose();
  return {publicKeys,tests,snapshots,disposedRefusals:disposed,consumerExposed:false};
 });receipts.push({mode:'bypass',source,...r});
 // A separate independently authorized replay session exercises the qualified preview.
 const id='preview',t=s.authorize({qualificationId:e.id,history:'replay',instanceId:id,nativeBytes:readFileSync(e.native),request:e.expected}),p=await s.start(t,id);
 const preview=await p.testEval(()=>{const c=N6Dynamic;c.execute(c.next());c.execute(c.next());const before=c.observe(),p=c.preview();try{p.bones[0].x=Infinity;}catch{}const after=c.observe();if(p.tick!==60n||after.frame.bones[0].x!==before.frame.bones[0].x)throw Error('preview leak');let failed=false;try{c.execute({...c.next(),command:{op:'seek',tick:257}});}catch(e){failed=e.kind==='HORIZON';}if(!failed)throw Error('preview H+1 accepted');return {before,after,preview:p,refused:true};});receipts.push({mode:'preview',...preview});await p.dispose();
 }finally{await s.close();}
});
await test('real browser execution exception cannot become a successful command',async()=>{
 const {s,c,source}=await instrument('execution');try{const before=await c.observe();await assert.rejects(c.testEval(()=>{throw Error('N6 actual browser execution exception');}));assert.deepEqual(await c.observe(),before);receipts.push({mode:'execution',source,before,after:await c.observe(),status:'INCOMPLETE_EVIDENCE'});}finally{await s.close();}
});
json(join(out,'B6-BYPASS-RECEIPT.json'),receipts);
