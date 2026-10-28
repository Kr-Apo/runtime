/** Node trust authority. No changes to existing npm/core/renderer APIs. */
import {readFileSync,statSync,lstatSync,openSync,readSync,closeSync} from 'node:fs';
import {dirname,join,resolve,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {verify} from '../../scripts/t840c7b-n5/proof.mjs';
import {canonical,identity,hash} from '../../scripts/t840c7b-n5/contract.mjs';
const HERE=dirname(fileURLToPath(import.meta.url));
export class AdmissionError extends Error {
 constructor(kind,code){super(`N6 ${kind}/${code}`);this.kind=kind;this.code=code;}
}
const fail=(kind,code)=>{throw new AdmissionError(kind,code);};
const equal=(a,b)=>canonical(a)===canonical(b);
const json=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const clone=v=>structuredClone(v);
export function seal(path){
 if(lstatSync(path).isSymbolicLink()||!statSync(path).isFile())fail('TRUST','regular_file');
 const fd=openSync(path,'r'),h=createHash('sha256'),b=Buffer.alloc(1048576);let bytes=0;
 try{let n;while((n=readSync(fd,b,0,b.length,null))>0){h.update(b.subarray(0,n));bytes+=n;}}finally{closeSync(fd);}
 return {sha256:h.digest('hex'),bytes};
}
function dataOnly(v, seen=new Set(), depth=0){
 if(depth>32)fail('ADMISSION','command_depth');
 if(!v||typeof v!=='object')return;
 if(seen.has(v))fail('ADMISSION','command_cycle');seen.add(v);
 const proto=Object.getPrototypeOf(v);if(proto!==Object.prototype&&proto!==Array.prototype&&proto!==null)fail('ADMISSION','command_prototype');
 for(const key of Reflect.ownKeys(v)){const d=Object.getOwnPropertyDescriptor(v,key);if(typeof key!=='string'||!d||!('value'in d))fail('ADMISSION','command_accessor');dataOnly(d.value,seen,depth+1);}
 seen.delete(v);
}
function sealed(path,expected){try{if(!equal(seal(path),expected))fail('TRUST','changed_file');}catch(e){if(e instanceof AdmissionError)throw e;fail('TRUST','missing_file');}}
/** anchorPath and anchorSHA256 come ONLY from the trusted launcher, never page input. */
export async function createSupervisor({anchorPath,anchorSHA256,dependencyRuntime,chrome}={}){
 let anchor,manifest;const started=performance.now(),costs={verification:[],creation:[],rpc:[],destruction:[]};
 try{if(!/^[a-f0-9]{64}$/.test(anchorSHA256)||seal(anchorPath).sha256!==anchorSHA256)fail('TRUST','anchor_digest');anchor=json(anchorPath);sealed(anchor.manifest.path,anchor.manifest.seal);manifest=json(anchor.manifest.path);}catch(e){if(e instanceof AdmissionError)throw e;fail('TRUST','anchor_or_manifest');}
 if(anchor.contract!=='ankhimate.chrome-admission-anchor/1'||manifest.contract!=='ankhimate.chrome-approved-bank/1'||!Array.isArray(manifest.entries)||manifest.entries.length!==10)fail('TRUST','bank_shape');
 const entries=new Map();for(const e of manifest.entries){if(!e||typeof e.id!=='string'||entries.has(e.id)||identity(e.expected)!==e.requestHash)fail('TRUST','entry');entries.set(e.id,clone(e));}
 function trust(){
  if(seal(anchorPath).sha256!==anchorSHA256)fail('TRUST','anchor_changed');sealed(anchor.manifest.path,anchor.manifest.seal);
  for(const [f,s]of Object.entries(anchor.code))sealed(join(HERE,f),s);
  for(const [f,s]of Object.entries(anchor.dependencies))sealed(resolve(HERE,f),s);
  for(const m of anchor.javascriptBuild.modules)sealed(join(anchor.coreDirectory,m.path.slice(6)),{sha256:m.sha256,bytes:m.bytes});
  for(const b of anchor.browserIdentity.binaries)sealed(join(dirname(chrome),b.file),{sha256:b.sha256,bytes:b.bytes});
 }
 trust();
 const cache=new Map(),tickets=new WeakMap(),sessions=new Set();let closed=false,browser=null,server=null;
 function assertOpen(){if(closed)fail('STATE','supervisor_closed');}
 function prepare(entry){
  const t=performance.now();trust();
  for(const [p,s]of Object.entries(entry.seals))sealed(p,s);
  if(!equal(entry.expected.browserIdentity,anchor.browserIdentity)||!equal(entry.expected.javascriptBuild,anchor.javascriptBuild))fail('TRUST','bank_build_identity');
  let prepared=cache.get(entry.id);
  if(!prepared){
   const nativeBytes=readFileSync(entry.native),rustBytes=readFileSync(entry.rust);
   const verdict=verify({directory:entry.bundle,expected:entry.expected,nativeBytes,rustBytes,javascriptBuild:anchor.javascriptBuild,browserIdentity:anchor.browserIdentity});
   if(!verdict.valid)fail('CERTIFICATE',verdict.status);
   prepared={entry,nativeText:nativeBytes.toString('utf8'),reference:json(join(entry.bundle,'chrome.json')),verdict};cache.set(entry.id,prepared);
  }
  costs.verification.push({id:entry.id,ms:performance.now()-t,cached:!!prepared&&costs.verification.some(v=>v.id===entry.id)});return prepared;
 }
 const modules=new Map(anchor.javascriptBuild.modules.map(m=>[m.path,readFileSync(join(anchor.coreDirectory,m.path.slice(6)))]));
 modules.set('/browser.mjs',readFileSync(join(HERE,'browser.mjs')));
 const required=anchor.javascriptBuild.requiredScripts.filter(p=>p!=='/capture.mjs').concat('/browser.mjs').sort();
 const html='<!doctype html><title>N6 private CPU session</title><script type="module" src="/browser.mjs"></script>';
 server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname,b=modules.get(path);res.setHeader('Cache-Control','no-store');if(path==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html);}else if(b){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(b);}else{res.writeHead(404);res.end();}});
 try{
  await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
  const origin='http://127.0.0.1:'+server.address().port;
  const {chromium}=await import(pathToFileURL(join(dependencyRuntime,'node_modules/playwright/index.mjs')));
  browser=await chromium.launch({executablePath:chrome,headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--no-first-run']});
  const root=await browser.newBrowserCDPSession(),version=await root.send('Browser.getVersion'),commandLine=await root.send('Browser.getBrowserCommandLine');
  const ctx=await browser.newContext({locale:'en-US',timezoneId:'UTC'}),page=await ctx.newPage();
  await page.route('**/*',r=>r.request().url()===origin+'/probe'?r.fulfill({contentType:'text/html',body:'<!doctype html><title>N6 identity probe</title>'}):r.abort());
  await page.goto(origin+'/probe');const navigator=await page.evaluate(async()=>({userAgent:navigator.userAgent,platform:navigator.platform,highEntropy:navigator.userAgentData?await navigator.userAgentData.getHighEntropyValues(['architecture','bitness','platformVersion','fullVersionList']):null}));await ctx.close();
  const observed={navigator,product:version.product,revision:version.revision,v8:version.jsVersion,protocol:version.protocolVersion,userAgent:version.userAgent,mode:'headless',platform:process.platform,architecture:process.arch,host:{release:os.release(),version:os.version(),cpu:os.cpus()[0].model},normalizedCommandLine:commandLine.arguments.map(x=>x.startsWith('--user-data-dir=')?'--user-data-dir=<fresh-private-profile>':x),binaries:anchor.browserIdentity.binaries.map(b=>({file:b.file,...seal(join(dirname(chrome),b.file))})),playwright:json(join(dependencyRuntime,'node_modules/playwright/package.json')).version};
  const engine={sha256:identity(observed),...observed};if(!equal(engine,anchor.browserIdentity))fail('IDENTITY','Chrome_V8_flags_host');
  const receipt={engine,actualCommandLine:commandLine.arguments,origin,headless:true,supervisorStartMs:performance.now()-started,manifestSHA256:anchor.manifest.seal.sha256,transport:'Trusted Playwright route.fulfill for exact local bytes; no page network request reaches a socket'};
  async function start(ticket,instanceId){
   assertOpen();const t=tickets.get(ticket);if(!t||t.instanceId!==instanceId)fail('ADMISSION','foreign_or_used_ticket');tickets.delete(ticket);trust();
   const begin=performance.now(),context=await browser.newContext({locale:'en-US',timezoneId:'UTC',viewport:{width:1280,height:720}}),page=await context.newPage(),cdp=await context.newCDPSession(page),scripts=new Map(),errors=[];let bootstrap=false,observedScripts=[];
   page.on('pageerror',e=>errors.push(String(e)));cdp.on('Debugger.scriptParsed',s=>{if(s.url.startsWith(origin+'/core/')||s.url===origin+'/browser.mjs')scripts.set(s.scriptId,s.url.slice(origin.length));});await cdp.send('Debugger.enable');
   async function verifyScripts(){
    const found=[];for(const [scriptId,path]of scripts){const source=(await cdp.send('Debugger.getScriptSource',{scriptId})).scriptSource,bytes=Buffer.from(source);if(!modules.has(path)||hash(bytes)!==hash(modules.get(path)))fail('IDENTITY','executed_module');found.push({path,sha256:hash(bytes),bytes:bytes.length});}
    found.sort((a,b)=>a.path.localeCompare(b.path));if(!equal(found.map(f=>f.path).sort(),required))fail('IDENTITY','executed_graph');return found;
   }
   const sessionId=randomUUID(),payload={qualificationId:t.p.entry.id,request:t.p.entry.expected,nativeText:t.p.nativeText,history:t.history,instanceId,sessionId,reference:t.p.reference};
   await context.route('**/*',async route=>{
    const url=route.request().url();if(!url.startsWith(origin+'/'))return route.abort();
    if(url===origin+'/approved-session.json'){
     if(bootstrap)return route.abort();bootstrap=true;
     try{trust();observedScripts=await verifyScripts();return route.fulfill({contentType:'application/json',body:JSON.stringify(payload)});}catch(e){errors.push(String(e));return route.abort();}
    }
    const path=new URL(url).pathname;
    if(path==='/')return route.fulfill({contentType:'text/html',body:html});
    const bytes=modules.get(path);if(bytes)return route.fulfill({contentType:'text/javascript',body:bytes});
    return route.abort();
   });
   try{await page.goto(origin);await page.waitForFunction(()=>!!globalThis.N6,{},{timeout:15000});if(errors.length||!bootstrap)fail('EXECUTION','bootstrap');observedScripts=await verifyScripts();}
   catch(e){await context.close();fail('EXECUTION','Chrome_bootstrap_'+JSON.stringify(errors)+'_'+String(e));}
   let disposed=false,inflight=false;const creationMs=performance.now()-begin;costs.creation.push(creationMs);
   async function call(method,arg){if(disposed)fail('STATE','disposed');if(inflight)fail('STATE','busy');inflight=true;const t=performance.now();try{dataOnly(arg);arg=clone(arg);return await page.evaluate(({method,arg})=>{try{return {ok:true,value:globalThis.N6[method](arg)};}catch(e){return{ok:false,kind:e.kind??'EXECUTION',code:e.code??String(e)};}},{method,arg}).then(r=>{if(!r.ok)fail(r.kind,r.code);return r.value;});}finally{costs.rpc.push({method,ms:performance.now()-t});inflight=false;}}
   const brand=receiver=>{if(receiver!==session)fail('STATE','foreign_receiver');};
   const session={
    observe(){brand(this);return call('observe');},next(){brand(this);return call('next');},execute(envelope){brand(this);return call('execute',envelope);},preview(){brand(this);return call('preview');},diagnostics(){brand(this);return call('diagnostics');},
    async present(callback){brand(this);if(typeof callback!=='function')fail('PRESENTATION','callback');if(disposed||inflight)fail('STATE','busy_or_disposed');const f=await call('observe');inflight=true;try{await callback(clone(f));}catch{fail('PRESENTATION','callback_failed');}finally{inflight=false;}},
    evidence(){brand(this);return clone({sessionId,instanceId,qualificationId:t.p.entry.id,history:t.history,engineHash:engine.sha256,manifestSHA256:anchor.manifest.seal.sha256,scripts:observedScripts,creationMs,pageErrors:errors});},
    async dispose(){brand(this);if(disposed)return;if(inflight)fail('STATE','busy');const t=performance.now();await call('dispose');disposed=true;sessions.delete(session);await context.close();costs.destruction.push(performance.now()-t);},
    // N6_TEST_SUPERVISOR: test-only copies may exercise browser callbacks, no production eval surface.
   };
   sessions.add(session);return Object.freeze(session);
  }
  return Object.freeze({
   authorize({qualificationId,history,instanceId,nativeBytes,request}={}){
    assertOpen();if(typeof instanceId!=='string'||!instanceId)fail('ADMISSION','instance');const e=entries.get(qualificationId);if(!e)fail('TRUST','unapproved_trajectory');
    let bytes;try{bytes=Buffer.from(nativeBytes);}catch{fail('ADMISSION','native_bytes');}
    if(hash(bytes)!==e.expected.trajectory.asset.sha256||!equal(request,e.expected)||!['step','bulk','replay','reset'].includes(history)||!e.expected.trajectory.histories.some(h=>h.id===history))fail('ADMISSION','requested_identity');
    const p=prepare(e),ticket=Object.freeze(Object.create(null));tickets.set(ticket,{p,history,instanceId});return ticket;
   },start,identity(){return clone(receipt);},costs(){return clone(costs);},
   async close(){if(closed)return;closed=true;try{for(const s of [...sessions])await s.dispose();}finally{await browser.close();await new Promise(r=>server.close(r));}}
  });
 }catch(e){if(browser)await browser.close();if(server?.listening)await new Promise(r=>server.close(r));throw e;}
}
