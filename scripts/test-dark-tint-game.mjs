import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
const project=resolve(process.env.ANKHIMATE_DARK_EXAMPLE_DIR??"examples/phaser-dark-tint");
const {start}=await import(pathToFileURL(resolve(project,"server.mjs")).href);
const output=resolve(process.env.ANKHIMATE_TEST_OUTPUT??"test-results/dark-tint-game");await mkdir(output,{recursive:true});
const seconds=Number(process.env.ANKHIMATE_SOAK_SECONDS??300);assert(Number.isFinite(seconds)&&seconds>0);
const server=await start(0);let browser;const errors=[],warnings=[],missing=[],samples=[];const result={seconds,pass:false,errors,warnings,missing,samples};
try{
  browser=await chromium.launch({headless:true,...(process.env.ANKHIMATE_BROWSER_PATH?{executablePath:process.env.ANKHIMATE_BROWSER_PATH}:{})});
  const page=await browser.newPage({viewport:{width:980,height:1000},deviceScaleFactor:1});
  page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="warning")warnings.push(m.text());if(m.type()==="error")errors.push(m.text());});page.on("response",r=>{if(!r.ok())missing.push(`${r.status()} ${r.url()}`);});
  await page.goto(server.url);await page.waitForFunction(()=>window.darkTintExample?.ready&&window.darkTintExample.frames>5);
  assert(await page.evaluate(()=>window.darkTintExample.hasDark));
  const first=await page.evaluate(()=>structuredClone(window.darkTintExample));
  await page.locator("canvas").click({position:{x:20,y:20}});await page.keyboard.down("ArrowRight");
  await page.waitForFunction(x=>window.darkTintExample.x>x+30,first.x);await page.keyboard.up("ArrowRight");
  await page.getByRole("button",{name:"alternate",exact:true}).click();await page.waitForFunction(()=>window.darkTintExample.clip==="alternate");
  await page.getByRole("button",{name:"pulse",exact:true}).click();await page.waitForFunction(()=>window.darkTintExample.eventCount>0);
  const beforeChurn=await page.evaluate(()=>structuredClone(window.darkTintExample.resources));
  await page.evaluate(()=>window.darkTintChurn());await page.waitForFunction(()=>window.darkTintExample.frames>15);
  await page.waitForTimeout(150);
  const afterChurn=await page.evaluate(()=>structuredClone(window.darkTintExample.resources));
  assert.deepEqual(afterChurn,beforeChurn,"30 real rig destroy/recreate cycles must not grow pipelines, GL wrappers, display objects or meshes");
  result.churn={cycles:30,before:beforeChurn,after:afterChurn};result.browser=browser.version();
  await page.screenshot({path:resolve(output,"dark-game-start.png"),fullPage:true});
  result.gpu=await page.evaluate(()=>{const gl=document.querySelector("canvas").getContext("webgl2")??document.querySelector("canvas").getContext("webgl");const ext=gl.getExtension("WEBGL_debug_renderer_info");return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  const started=performance.now(),playback=await page.evaluate(()=>window.darkTintExample.playbackMs);let nextLog=0;
  for(;;){
    const state=await page.evaluate(()=>structuredClone(window.darkTintExample)),elapsed=performance.now()-started;
    assert.equal(errors.length,0,errors.join("\n"));assert.equal(warnings.length,0,warnings.join("\n"));assert.equal(missing.length,0,missing.join("\n"));assert.equal(state.errors.length,0,state.errors.join("\n"));
    assert.deepEqual(state.resources,afterChurn,"GPU/display resource counts must remain bounded during playback");
    if(elapsed>=nextLog){samples.push({elapsedMs:elapsed,...state});console.log(`${(elapsed/1000).toFixed(1)}s: ${state.frames} frames / ${state.eventCount} events / stable resources`);nextLog+=30000;}
    if(elapsed>=seconds*1000&&state.playbackMs-playback>=seconds*1000){result.final=state;result.wallMs=elapsed;break;}
    if(elapsed>(seconds+90)*1000)throw new Error("Playback stalled");await new Promise(done=>setTimeout(done,1000));
  }
  assert(result.final.eventCount>first.eventCount);assert(result.final.loops>first.loops);
  await page.screenshot({path:resolve(output,"dark-game-end.png"),fullPage:true});result.pass=true;
}catch(error){result.failure=error.stack??String(error);console.error(result.failure);process.exitCode=1;}
finally{await browser?.close();await server.close();await writeFile(resolve(output,"result.json"),JSON.stringify(result,null,2));}
