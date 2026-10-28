import {mkdir,readFile,writeFile,copyFile,symlink,rmdir,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
import {chromium} from 'playwright';import {serve,repository} from '../web-server.mjs';
const out=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('consumer.mjs NEW_OUTPUT');await mkdir(out);const project=resolve(out,'external-project');await mkdir(project);await mkdir(resolve(project,'node_modules/@ankhimate'),{recursive:true});
for(const name of ['pixi-runtime','runtime'])await symlink(resolve(repository,name==='runtime'?'core':'pixi'),resolve(project,'node_modules/@ankhimate',name),'junction');
for(const name of ['pixi.js','fflate'])await symlink(resolve(repository,'node_modules',name),resolve(project,'node_modules',name),'junction');
await writeFile(resolve(project,'package.json'),'{"private":true,"type":"module"}\n');
for(const name of ['consumer.ts','tsconfig.json'])await copyFile(resolve(repository,'pixi/test/consumer',name),resolve(project,name));
const typecheck=spawnSync(process.execPath,[resolve(repository,'node_modules/typescript/bin/tsc'),'-p',resolve(project,'tsconfig.json')],{encoding:'utf8'});await writeFile(resolve(out,'typecheck.log'),typecheck.stdout+typecheck.stderr);assert.equal(typecheck.status,0,typecheck.stdout+typecheck.stderr);
const pkg=JSON.parse(await readFile(resolve(repository,'pixi/package.json'),'utf8')),entry=pkg.exports['./experimental-replay'];assert.equal(entry.import,'./dist/experimental-replay.js');assert.equal(entry.types,'./dist/experimental-replay.d.ts');
const imports={'pixi.js':'/node_modules/pixi.js/dist/pixi.mjs','@ankhimate/runtime':'/core/dist/index.js','@ankhimate/runtime/experimental-host-time':'/core/dist/replay-host-time.js','@ankhimate/runtime/render':'/core/dist/render/index.js','@ankhimate/pixi-runtime':'/pixi/dist/index.js','@ankhimate/pixi-runtime/experimental-replay':'/pixi/'+entry.import.replace('./',''),'fflate':'/node_modules/fflate/esm/browser.js'};
const server=await serve();let browser;const rows=[];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.ANKHIMATE_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage(),errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());if(m.type()==='error')errors.push(m.text());});
 await page.route('**/external-consumer.mjs',route=>route.fulfill({contentType:'text/javascript',path:resolve(project,'build/consumer.js')}));
 await page.route('**/external-consumer.html',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><link rel="icon" href="data:,"><script type="importmap">${JSON.stringify({imports})}</script><script type="module">import {exercise} from '/external-consumer.mjs';try{window.__result=await exercise(new URL('/examples/replay-pixi-pilot/assets/skeleton.json',location.href).href);}catch(e){window.__result={pass:false,error:String(e)};}</script>`}));
 await page.goto(server.url+'/external-consumer.html');await page.waitForFunction(()=>window.__result,{timeout:30000});const result=await page.evaluate(()=>window.__result);assert.equal(result.pass,true,result.error);assert.equal(result.webgl2,true);await writeFile(resolve(out,'consumer.png'),Buffer.from(result.picture.split(',')[1],'base64'));delete result.picture;assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);rows.push({name:'external-TypeScript-public-exports',...result,errors,warnings});await page.close();
 const multipage=JSON.parse(await readFile(resolve(repository,'pixi/test/fixtures/t840c2/multipage/skeleton.json'),'utf8'));assert.ok(multipage.atlas.pages.length>=2);
 for(const fault of ['success','preabort','bad-json','missing-json','page-failure-after-one','abort-after-one']){
  const page=await browser.newPage();const warnings=[],unexpected=[];page.on('pageerror',e=>unexpected.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());});
  await page.route('**/resource-test.html',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><link rel="icon" href="data:,"><script type="importmap">${JSON.stringify({imports})}</script>`}));
  let release;const held=new Promise(r=>release=r);
  if(fault.includes('after-one'))await page.route('**/multipage/atlas_2.png',async route=>{await held;if(fault==='abort-after-one')await route.abort();else await route.fulfill({status:404,body:'intentional page failure'});});
  if(fault==='bad-json'||fault==='missing-json')await page.route('**/multipage/skeleton.json',route=>route.fulfill({status:fault==='missing-json'?404:200,contentType:'application/json',body:fault==='bad-json'?'{':'intentional404'}));
  await page.goto(server.url+'/resource-test.html');
  await page.evaluate(async fault=>{
   const {ExperimentalReplayPixiAsset:Asset}=await import('@ankhimate/pixi-runtime/experimental-replay'),{TextureSource}=await import('pixi.js');let destroyed=0,loaded=0;const original=TextureSource.prototype.destroy;TextureSource.prototype.destroy=function(){destroyed++;return original.call(this);};const ImageClass=window.Image;window.Image=class extends ImageClass{constructor(...args){super(...args);this.addEventListener('load',()=>queueMicrotask(()=>loaded++));}};
   window.__loads=()=>loaded;const controller=new AbortController();window.__abort=()=>controller.abort(new Error('intentional abort'));if(fault==='preabort')window.__abort();
   Asset.load(new URL('/pixi/test/fixtures/t840c2/multipage/skeleton.json',location.href),{signal:controller.signal}).then(asset=>{
    const a=asset.createInstance({clip:'sway'}),b=asset.createInstance({clip:'sway'});a.dispose();if(destroyed)throw Error('premature shared texture release');b.present();b.dispose();asset.destroy();asset.destroy();window.__out={success:true,destroyed,resources:asset.resources};
   }).catch(error=>{window.__out={success:false,error:String(error),destroyed};}).finally(()=>{TextureSource.prototype.destroy=original;window.Image=ImageClass;});
  },fault);
  if(fault.includes('after-one')){await page.waitForFunction(()=>window.__loads?.()>=1,{timeout:30000});if(fault==='abort-after-one')await page.evaluate(()=>window.__abort());release();}
  await page.waitForFunction(()=>window.__out,{timeout:30000});const r=await page.evaluate(()=>window.__out);if(fault==='success'){assert.equal(r.success,true);assert.equal(r.destroyed,multipage.atlas.pages.length);assert.equal(r.resources.instances,0);}else{assert.equal(r.success,false);assert.equal(r.destroyed,fault.includes('after-one')?1:0);}
  assert.deepEqual(unexpected,[]);assert.deepEqual(warnings,[]);rows.push({name:fault,status:'PASS',...r,warnings});await page.close();
 }
}finally{await writeFile(resolve(out,'results.json'),JSON.stringify({browser:browser?.version(),project,entry,rows},null,2));await browser?.close();await server.close();}
const links=['@ankhimate/pixi-runtime','@ankhimate/runtime','pixi.js','fflate'];for(const name of links){const p=resolve(project,'node_modules',name);assert.ok((await lstat(p)).isSymbolicLink());await rmdir(p);}await writeFile(resolve(out,'DEPENDENCY-LINKS-DETACHED.json'),JSON.stringify({links,reason:'Temporary junction pointers removed after validation; package targets and all project source/build evidence preserved.'},null,2));console.log(JSON.stringify({externalProject:project,checks:rows.length,allPassed:true}));
