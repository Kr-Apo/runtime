import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve } from './web-server.mjs';

const output=resolve(process.env.ANKHIMATE_TEST_OUTPUT??'test-results/pixi-webgl');
await mkdir(output,{recursive:true});
const cases=[
  ...[0,1,2,3].map(sample=>({name:'tagged',sample,skin:'default',background:'opaque'})),
  ...['default','alternate'].flatMap(skin=>['transparent','opaque'].flatMap(background=>[0,1,2,3].map(sample=>({name:'multipage',sample,skin,background})))),
  ...['transparent','opaque'].flatMap(background=>[0,1,2,3,4].map(sample=>({name:'trim',sample,skin:'royal',background}))),
  ...['fail-page','abort'].map(name=>({name,sample:0,skin:'default',background:'transparent'})),
];
const server=await serve();let browser;const results=[];
try {
  browser=await chromium.launch({headless:true,...(process.env.ANKHIMATE_BROWSER_PATH?{executablePath:process.env.ANKHIMATE_BROWSER_PATH}:{})});
  for(const c of cases) {
    const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1});
    const errors=[],warnings=[],missing=[],expectedFaults=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{
      if(m.type()==='warning')warnings.push(m.text());
      if(m.type()==='error' && !(c.name==='fail-page'&&m.text().includes('404')))errors.push(m.text());
    });
    page.on('response',r=>{if(!r.ok())(c.name==='fail-page'&&r.status()===404?expectedFaults:missing).push(`${r.status()} ${r.url()}`);});
    if(c.name==='fail-page')await page.route('**/multipage/atlas_2.png',r=>r.fulfill({status:404,body:'intentional missing page'}));
    try {
      const qs=new URLSearchParams({case:c.name,sample:String(c.sample),skin:c.skin,background:c.background});
      await page.goto(`${server.url}/pixi/test/webgl.html?${qs}`);
      await page.waitForFunction(()=>window.__result,undefined,{timeout:45000});
      const result=await page.evaluate(()=>window.__result);
      Object.assign(result,{browser:browser.version(),errors,warnings,missing,expectedFaults});
      result.pass&&=errors.length===0&&warnings.length===0&&missing.length===0;
      if(c.name==='fail-page')result.pass&&=expectedFaults.length===1;
      if(await page.locator('canvas').count())await page.locator('canvas').screenshot({path:resolve(output,`${c.name}-${c.skin}-${c.background}-${c.sample}.png`)});
      results.push(result);
      console.log(`${result.pass?'PASS':'FAIL'} ${c.name}/${c.skin}/${c.background} t=${result.time??0}: ${result.failures.join('; ')} errors=${errors.length} warnings=${warnings.length}`);
    } catch(error){results.push({...c,pass:false,error:String(error),errors,warnings,missing});console.log(`FAIL ${c.name}: ${error}`);}
    finally {await page.close();}
  }
  const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1});
  const errors=[],warnings=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  try {
    await page.goto(`${server.url}/examples/pixi-regions/`);
    await page.waitForFunction(()=>window.pixiRegionExample,undefined,{timeout:30000});
    const initial=await page.evaluate(()=>{
      const e=window.pixiRegionExample;
      if(!e.ready)throw Error(e.error);
      return {left:e.left.root.children.map(m=>Array.from(m.geometry.positions)),right:e.right.root.children.map(m=>Array.from(m.geometry.positions))};
    });
    await page.locator('#left').evaluate(input=>{input.value='0.5';input.dispatchEvent(new Event('input',{bubbles:true}));});
    const after=await page.evaluate(()=>({left:window.pixiRegionExample.left.root.children.map(m=>Array.from(m.geometry.positions)),right:window.pixiRegionExample.right.root.children.map(m=>Array.from(m.geometry.positions)),webgl:!!window.pixiRegionExample.app.renderer.gl}));
    const pass=JSON.stringify(initial.left)!==JSON.stringify(after.left)&&JSON.stringify(initial.right)===JSON.stringify(after.right)&&after.webgl;
    await page.locator('canvas').screenshot({path:resolve(output,'example-two-instances.png')});
    results.push({name:'example',pass:pass&&errors.length===0&&warnings.length===0,browser:browser.version(),errors,warnings});
    console.log(`${pass?'PASS':'FAIL'} public example sliders: independent poses, actual WebGL`);
  } catch(error){results.push({name:'example',pass:false,error:String(error),errors,warnings});}
  finally {await page.close();}
}finally {await browser?.close();await server.close();await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2));}
if(results.length!==cases.length+1||results.some(r=>!r.pass))process.exitCode=1;
