import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve } from './web-server.mjs';
const output=resolve(process.env.ANKHIMATE_TEST_OUTPUT??'test-results/pixi-playback');await mkdir(output,{recursive:true});
const cases=[...['rise','recover'].flatMap(mode=>[0,1,2,3,4].map(sample=>({mode,sample}))),...[0,1,2,3,4].map(sample=>({mode:'fade',sample})),...['loop','event','two','deterministic'].map(mode=>({mode,sample:0}))];
const server=await serve(),results=[];let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.ANKHIMATE_BROWSER_PATH?{executablePath:process.env.ANKHIMATE_BROWSER_PATH}:{})});
  for(const c of [...cases,{mode:'example',sample:0}]){
    const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1});const errors=[],warnings=[],missing=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});page.on('response',r=>{if(!r.ok())missing.push(`${r.status()} ${r.url()}`);});
    try{
      let result;
      if(c.mode==='example'){
        await page.goto(`${server.url}/examples/pixi-playback/`);await page.waitForFunction(()=>window.pixiPlaybackExample,undefined,{timeout:30000});
        assert(await page.evaluate(()=>window.pixiPlaybackExample.ready));
        await page.waitForFunction(()=>window.pixiPlaybackExample.events.some(e=>e.name==='impact'));
        await page.locator('#pause').click();const t=await page.evaluate(()=>window.pixiPlaybackExample.left.playback.time);
        await page.waitForFunction(()=>window.pixiPlaybackExample.right.playback.time>.1);assert.equal(await page.evaluate(()=>window.pixiPlaybackExample.left.playback.time),t);
        await page.locator('#speed').fill('2');await page.locator('#speed').dispatchEvent('change');await page.locator('#resume').click();
        await page.waitForFunction(()=>window.pixiPlaybackExample.left.playback.playing&&window.pixiPlaybackExample.left.playback.speed===2);
        await page.locator('#fade').click();await page.waitForFunction(()=>window.pixiPlaybackExample.left.playback.animation==='recover');
        await page.waitForFunction(()=>window.pixiPlaybackExample.events.some(e=>e.name==='incoming'));
        await page.locator('#stop').click();assert.equal(await page.evaluate(()=>window.pixiPlaybackExample.left.playback.animation),undefined);
        await page.locator('#rise').click();await page.waitForFunction(()=>window.pixiPlaybackExample.left.playback.time>.25);
        result={...c,pass:await page.evaluate(()=>!!window.pixiPlaybackExample.app.renderer.gl),checks:['real WebGL, public controls, pause, speed, incoming event, stop/restart'],failures:[]};
      }else{
        await page.goto(`${server.url}/pixi/test/playback-webgl.html?${new URLSearchParams({mode:c.mode,sample:String(c.sample)})}`);
        await page.waitForFunction(()=>window.__result,undefined,{timeout:45000});result=await page.evaluate(()=>window.__result);
      }
      Object.assign(result,{browser:browser.version(),errors,warnings,missing});result.pass&&=errors.length===0&&warnings.length===0&&missing.length===0;
      if(await page.locator('canvas').count())await page.locator('canvas').screenshot({path:resolve(output,`${c.mode}-${c.sample}.png`)});
      results.push(result);console.log(`${result.pass?'PASS':'FAIL'} ${c.mode}/${c.sample}: ${result.failures.join('; ')}`);
    }catch(e){results.push({...c,pass:false,error:String(e),errors,warnings,missing});console.log(`FAIL ${c.mode}/${c.sample}: ${e}`);}finally{await page.close();}
  }
}finally{await browser?.close();await server.close();await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2));}
if(results.length!==20||results.some(r=>!r.pass))process.exitCode=1;
