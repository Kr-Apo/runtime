// Development-only smoke test of the actual extracted candidate, never shipped.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';

const root=resolve(process.argv[2]),out=resolve(process.argv[3]);await mkdir(out,{recursive:true});
const result={checks:[],errors:[],externalRequests:[],negativeErrors:[]};
const check=(ok,name,detail)=>{result.checks.push({pass:!!ok,name,detail});console.log(`${ok?'PASS':'HOLD'} ${name}`);assert.ok(ok,name);};
const launcher=spawn(join(root,'Start-Demo.exe'),['--no-browser'],{cwd:out,windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser,context;
try{
 const url=await new Promise((ok,no)=>{let text='';const timer=setTimeout(()=>no(Error('Launcher did not print a URL')),10000);launcher.stdout.on('data',data=>{text+=data;const m=text.match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);ok(m[0]);}});launcher.on('error',no);launcher.on('exit',code=>{if(code)no(Error('Launcher exited '+code));});});
 result.url=url;console.log(url);
 const request=(path,options={})=>new Promise((ok,no)=>{const endpoint=new URL(url);const req=http.request({hostname:endpoint.hostname,port:endpoint.port,path,...options},res=>{let body='';res.on('data',b=>body+=b);res.on('end',()=>ok({status:res.statusCode,body,headers:res.headers}));});req.on('error',no);req.end();});
 for(const [path,options,status] of [['/%2e%2e/README.md',{},400],['/C%3a/Windows/win.ini',{},400],['/README.md',{headers:{Host:'example.invalid'}},403],['/README.md',{method:'POST'},405],['/missing-file.json',{},404],['/README.md',{method:'HEAD'},200]]){
  const response=await request(path,options);check(response.status===status,'Read-only server: '+path+' '+(options.method??'GET'),{expected:status,actual:response.status});
 }
 browser=await chromium.launch({headless:true,executablePath:process.env.ANKHIMATE_BROWSER_PATH,args:['--disable-background-networking','--proxy-server=http://127.0.0.1:9','--proxy-bypass-list=127.0.0.1']});
 result.browser=browser.version();
 context=await browser.newContext({viewport:{width:1200,height:1100}});context.setDefaultTimeout(15000);
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin===url)return route.continue();result.externalRequests.push(route.request().url());return route.abort('internetdisconnected');});
 const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 await page.goto(url+'/Examples/Jade-Sentinel/demo.html');await page.waitForFunction(()=>window.demo?.ready);
 check(await page.evaluate(()=>window.demo.rigs.length===2&&window.demo.app.renderer.gl instanceof WebGL2RenderingContext),'Two characters on actual WebGL2');
 await page.locator('#auto-0').uncheck();await page.locator('#auto-1').uncheck();
 await page.click('#idle-0');await page.click('#idle-1');await page.click('#pause-0');
 const time=await page.evaluate(()=>window.demo.rigs.map(r=>r.playback.time));await page.waitForTimeout(250);
 const later=await page.evaluate(()=>window.demo.rigs.map(r=>r.playback.time));
 check(time[0]===later[0]&&later[1]>time[1],'Pause affects only one instance',{time,later});
 await page.selectOption('#speed-0','1.5');await page.click('#resume-0');
 check(await page.evaluate(()=>window.demo.rigs[0].playback.speed===1.5&&window.demo.rigs[1].playback.speed===.75),'Independent resume and speed');
 await page.click('#attack-0');await page.waitForFunction(()=>window.demo.impacts[0]>0);
 const impact=await page.evaluate(()=>window.demo.events[0].find(e=>e.name==='impact'));
 check(impact?.int===7&&impact?.float===.25&&impact?.string==='jade impact','Real attack event payload',impact);
 await page.click('#fade-0');check(await page.evaluate(()=>window.demo.rigs[0].playback.animation==='idle'&&window.demo.changes[0]===1),'Crossfade switches to a distinct clip');
 await page.screenshot({path:join(out,'demo.png'),fullPage:true});
 const gpu=await page.evaluate(()=>{const app=window.demo.app,gl=app.renderer.gl;app.render();const bytes=new Uint8Array(1000*540*4);gl.readPixels(0,0,1000,540,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return{nontransparent:bytes.filter((_,i)=>i%4===3&&bytes[i]>0).length,error:gl.getError(),renderer:gl.getParameter(gl.RENDERER)};});
 check(gpu.nontransparent>1000&&gpu.error===0,'Visible GPU pixels and no GL error',gpu);
 for(const dir of ['Missing atlas é','Invalid data','Malformed data'])await mkdir(join(root,'Validation',dir),{recursive:true});
 await copyFile(join(root,'Examples/Jade-Sentinel/Export/skeleton.json'),join(root,'Validation/Missing atlas é/skeleton.json'));
 await writeFile(join(root,'Validation/Invalid data/skeleton.json'),'{}');
 await writeFile(join(root,'Validation/Malformed data/skeleton.json'),'{');
 for(const [path,match] of [['Missing/skeleton.json','Runtime JSON failed: HTTP 404'],['Validation/Missing atlas é/skeleton.json','Atlas page 0 failed: HTTP 404'],['Validation/Invalid data/skeleton.json','Invalid native runtime JSON'],['Validation/Malformed data/skeleton.json','SyntaxError']]){
  const before=await page.evaluate(()=>window.demo.rigs[0].root.uid);
  await page.fill('#export-path',path);await page.click('#load');await page.waitForFunction(text=>document.querySelector('#status').textContent.includes(text),match);
  const message=await page.locator('#status').textContent();result.negativeErrors.push(message);
  check(await page.evaluate(uid=>window.demo.ready&&window.demo.rigs.length===2&&window.demo.rigs[0].root.uid===uid,before),'Failed replacement preserves working characters: '+path,message);
 }
 // New path with spaces/Unicode, byte-identical export; no JSON rewriting.
 const fresh=join(root,'Exports','Jade été Ω');await mkdir(fresh,{recursive:true});
 for(const name of ['skeleton.json','atlas.png'])await copyFile(join(root,'Examples/Jade-Sentinel/Export',name),join(fresh,name));
 await page.fill('#export-path','Exports/Jade été Ω/skeleton.json');await page.click('#load');await page.waitForFunction(()=>window.demo.ready&&document.querySelector('#status').textContent.startsWith('Native v2 loaded'));
 check(await page.evaluate(()=>window.demo.rigs.length===2),'Relative export path with spaces and Unicode');
 const disposal=await page.evaluate(()=>{const old=window.demo.asset,rigs=[...window.demo.rigs];document.querySelector('#dispose').click();let error;try{old.createInstance();}catch(e){error=e.message;}return{roots:rigs.map(r=>r.root.destroyed),count:window.demo.rigs.length,error};});
 check(disposal.count===0&&disposal.roots.every(Boolean)&&disposal.error==='Rig asset is destroyed','Explicit instance and owned-asset cleanup',disposal);
 await page.click('#load');await page.waitForFunction(()=>window.demo.ready);check(await page.evaluate(()=>window.demo.rigs.length===2),'Reload after cleanup');
 const released=await page.evaluate(()=>{const gl=window.demo.app.renderer.gl;window.demo.destroy();return window.demo.destroyed&&gl.isContextLost();});check(released,'Application cleanup releases WebGL context');
 const snippet=await context.newPage();snippet.on('pageerror',e=>result.errors.push(e.message));await snippet.goto(url+'/Docs/minimal.html');await snippet.waitForFunction(()=>window.integration);
 check(await snippet.evaluate(()=>window.integration.rigs.length===2&&window.integration.rigs[0].playback.speed===1.25&&window.integration.rigs[1].playback.animation==='idle'),'Documented snippet uses shipped public modules');
 await snippet.waitForTimeout(1000);
 const snippetEvents=await snippet.evaluate(()=>window.integration.events.map(e=>e.name));check(snippetEvents.length>0,'Documented event listener receives authored events',snippetEvents);
 await snippet.evaluate(()=>window.integration.destroy());
 check(result.errors.length===0,'No uncaught JavaScript errors',result.errors);
 check(result.externalRequests.length===0,'No external request; nonloopback network blocked by proxy and routing',result.externalRequests);
 result.pass=true;
}catch(error){result.pass=false;result.failure=error.stack??String(error);}
finally{await browser?.close();launcher.kill();await writeFile(join(out,'results.json'),JSON.stringify(result,null,2));}
console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
