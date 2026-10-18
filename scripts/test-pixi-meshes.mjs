import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve } from './web-server.mjs';
const output=resolve(process.env.ANKHIMATE_TEST_OUTPUT??'test-results/pixi-meshes');await mkdir(output,{recursive:true});
const old=['weighted','weighted_partial','weighted_ffd','weighted_ffd_linear','ffd_linear','ffd_stepped','ffd_bezier'];
const fresh=['asymmetric','weighted_complex','partial_ffd','trim_multi','topology'];
let cases=[...old.flatMap(name=>[0,1,2,3].map(sample=>({name,mode:'clip',sample}))),
 ...fresh.flatMap(name=>['clip','relax','fade'].flatMap(mode=>[0,1,2,3,4].map(sample=>({name,mode,sample})))),
 ...['clip','relax'].flatMap(mode=>[0,1,2,3,4].map(sample=>({name:'trim_multi',mode,sample,background:'opaque'}))),
 {name:'weighted_complex',mode:'two',sample:0},{name:'weighted_complex',mode:'clip',sample:2,stress:true}];
if(process.env.ANKHIMATE_MESH_CASES)cases=cases.filter(c=>process.env.ANKHIMATE_MESH_CASES.split(',').includes(c.name));
const server=await serve(),results=[];let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.ANKHIMATE_BROWSER_PATH?{executablePath:process.env.ANKHIMATE_BROWSER_PATH}:{})});
 for(const c of cases){const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1}),errors=[],warnings=[],missing=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});page.on('response',r=>{if(!r.ok())missing.push(`${r.status()} ${r.url()}`);});
  try{await page.goto(`${server.url}/pixi/test/meshes-webgl.html?${new URLSearchParams({name:c.name,mode:c.mode,sample:String(c.sample),background:c.background??'transparent',stress:c.stress?'1':'0'})}`);
   await page.waitForFunction(()=>window.__result,undefined,{timeout:45000});const r=await page.evaluate(()=>window.__result);Object.assign(r,{stress:!!c.stress,browser:browser.version(),errors,warnings,missing});r.pass&&=errors.length===0&&warnings.length===0&&missing.length===0;
   await page.locator('canvas').screenshot({path:resolve(output,`${c.name}-${c.mode}-${c.sample}-${c.background??'transparent'}${c.stress?'-stress':''}.png`)});results.push(r);console.log(`${r.pass?'PASS':'FAIL'} ${c.name}/${c.mode}/${c.sample}/${c.background??'transparent'}${c.stress?'/stress':''}: ${r.failures.join('; ')}`);
  }catch(e){results.push({...c,pass:false,error:String(e),errors,warnings,missing});console.log(`FAIL ${c.name}/${c.mode}/${c.sample}: ${e}`);}finally{await page.close();}
 }
}finally{await browser?.close();await server.close();await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2));}
if(results.length!==cases.length||results.some(r=>!r.pass))process.exitCode=1;
