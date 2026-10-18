import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {serve} from './web-server.mjs';
const output=resolve(process.env.ANKHIMATE_TEST_OUTPUT??'test-results/pixi-clipping');await mkdir(output,{recursive:true});
let cases=[];
for(const name of ['ffd_alt','tint_mesh','replacement']){
 for(const skin of ['default','alternate','convex','outside','cover'])for(const animation of ['clip','relax'])for(const time of [0,.25,.5,.75])for(const background of ['transparent','opaque'])cases.push({name,skin,animation,time,background,mode:'sample'});
 for(const skin of ['default','alternate','convex','outside','cover'])for(const time of [0,.25,.5,.75])cases.push({name,skin,time,mode:'fade'});
 for(const mode of ['stress','two'])cases.push({name,skin:'default',animation:'clip',time:.25,mode});
}
for(const name of ['audit-rect','audit-concave','audit-transformed','end-visible','end-empty','end-invisible','successive','toggle','concave','mesh-multi-dark','draw-order'])for(const time of [0,.25,.5,.75])cases.push({name,time,historical:true});
for(const time of [0,.25])cases.push({name:'end-animated',time,historical:true});
if(process.env.ANKHIMATE_PIXI_CLIPPING_FILTER)cases=cases.filter(c=>new RegExp(process.env.ANKHIMATE_PIXI_CLIPPING_FILTER).test([c.name,c.skin,c.animation??'clip',c.time,c.background??'transparent',c.mode].join('-')));
const server=await serve(),results=[];let browser;
try{browser=await chromium.launch({headless:true,...(process.env.ANKHIMATE_BROWSER_PATH?{executablePath:process.env.ANKHIMATE_BROWSER_PATH}:{})});
 for(const c of cases){const id=[c.name,c.skin,c.animation??'clip',c.time,c.background??'transparent',c.mode].join('-'),page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1}),errors=[],warnings=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});page.on('response',r=>{if(!r.ok())missing.push(`${r.status()} ${r.url()}`);});
 try{await page.addInitScript(()=>{addEventListener('error',e=>{window.__result={pass:false,failures:[e.message]};});addEventListener('unhandledrejection',e=>{window.__result={pass:false,failures:[String(e.reason)]};});});await page.goto(`${server.url}/pixi/test/clipping-webgl.html?${new URLSearchParams(c)}`);await page.waitForFunction(()=>window.__result,undefined,{timeout:45000});const r=await page.evaluate(()=>window.__result);Object.assign(r,{browser:browser.version(),errors,warnings,missing});r.pass&&=errors.length===0&&warnings.length===0&&missing.length===0;await page.locator('canvas').screenshot({path:resolve(output,`${id}.png`)});results.push(r);console.log(`${r.pass?'PASS':'FAIL'} ${id}: ${r.failures.join('; ')}`);
 }catch(e){results.push({...c,pass:false,error:String(e),errors,warnings,missing});console.log(`FAIL ${id}: ${e}`);}finally{await page.close();}}
}finally{await browser?.close();await server.close();await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2));}
if(results.length!==cases.length||results.some(r=>!r.pass))process.exitCode=1;
