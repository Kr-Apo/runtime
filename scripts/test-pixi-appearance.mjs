import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {serve} from './web-server.mjs';
const output=resolve(process.env.ANKHIMATE_TEST_OUTPUT??'test-results/pixi-appearance');await mkdir(output,{recursive:true});
let cases=[];
for(const [name,skins] of Object.entries({skins:['default','alternate','triangle','quad'],ffd_alt:['default','alternate'],tint_grid:['default','alternate'],tint_mesh:['default','alternate'],blend_normal:['default','alternate']}))
 for(const skin of skins)for(const animation of ['clip','relax'])for(const time of [0,.25,.5,.75])for(const background of ['transparent','opaque'])cases.push({name,skin,animation,time,background,mode:'sample'});
for(const name of ['skins','ffd_alt','tint_mesh'])for(const skin of ['default','alternate'])for(const time of [0,.25,.5,.75])cases.push({name,skin,time,mode:'fade'});
for(const name of ['skins','ffd_alt','tint_mesh'])cases.push({name,skin:'alternate',time:.25,mode:'stress'});
for(const name of ['ffd_alt','tint_mesh'])cases.push({name,skin:'default',time:.25,mode:'two'});
for(const name of ['skins','tint_mesh'])cases.push({name,skin:'alternate',time:.25,mode:'direct'});
for(const name of ['skins','tint_mesh'])cases.push({name,skin:'alternate',time:.25,mode:'pose-isolation'});
cases.push({name:'ffd_alt',skin:'alternate',time:.25,mode:'callback'});
for(const name of ['blend_additive','blend_multiply','blend_screen'])for(const background of ['transparent','opaque'])cases.push({name,skin:'default',time:0,background,mode:'blend-probe'});
if(process.env.ANKHIMATE_APPEARANCE_CASES)cases=cases.filter(c=>process.env.ANKHIMATE_APPEARANCE_CASES.split(',').includes(c.name));
if(process.env.ANKHIMATE_APPEARANCE_MODES)cases=cases.filter(c=>process.env.ANKHIMATE_APPEARANCE_MODES.split(',').includes(c.mode));
if(process.env.ANKHIMATE_APPEARANCE_FILTER)cases=cases.filter(c=>new RegExp(process.env.ANKHIMATE_APPEARANCE_FILTER).test([c.name,c.skin,c.animation??'clip',c.time,c.background??'transparent',c.mode].join('-')));
for(const c of cases)if(process.env.ANKHIMATE_DITHER)c.dither=process.env.ANKHIMATE_DITHER;
const server=await serve(),results=[];let browser;
try{browser=await chromium.launch({headless:true,...(process.env.ANKHIMATE_BROWSER_PATH?{executablePath:process.env.ANKHIMATE_BROWSER_PATH}:{})});
 for(const c of cases){const id=[c.name,c.skin,c.animation??'clip',c.time,c.background??'transparent',c.mode].join('-'),page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1}),errors=[],warnings=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});page.on('response',r=>{if(!r.ok())missing.push(`${r.status()} ${r.url()}`);});
 try{await page.addInitScript(()=>{addEventListener('error',e=>{window.__result={pass:false,failures:[e.message]};});addEventListener('unhandledrejection',e=>{window.__result={pass:false,failures:[String(e.reason)]};});});await page.goto(`${server.url}/pixi/test/appearance-webgl.html?${new URLSearchParams(c)}`);await page.waitForFunction(()=>window.__result,undefined,{timeout:45000});const r=await page.evaluate(()=>window.__result);Object.assign(r,{browser:browser.version(),errors,warnings,missing});r.pass&&=errors.length===0&&warnings.length===0&&missing.length===0;await page.locator('canvas').screenshot({path:resolve(output,`${id}.png`)});results.push(r);console.log(`${r.pass?'PASS':'FAIL'} ${id}: ${r.failures.join('; ')}`);
 }catch(e){results.push({...c,pass:false,error:String(e),errors,warnings,missing});console.log(`FAIL ${id}: ${e}`);}finally{await page.close();}}
}finally{await browser?.close();await server.close();await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2));}
if(results.length!==cases.length||results.some(r=>!r.pass))process.exitCode=1;
