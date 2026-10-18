import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const project=resolve(process.env.ANKHIMATE_EXAMPLE_DIR??"examples/phaser-game");
const {start}=await import(pathToFileURL(resolve(project,"server.mjs")).href);
const output=resolve(process.env.ANKHIMATE_TEST_OUTPUT??"test-results/game");
await mkdir(output,{recursive:true});
const seconds=Number(process.env.ANKHIMATE_SOAK_SECONDS??300);
assert(Number.isFinite(seconds)&&seconds>0,"positive wall-clock soak duration required");
const server=await start(0);
const errors=[],warnings=[],missing=[],samples=[];
let browser,page;
const result={durationSeconds:seconds,errors,warnings,missing,samples,pass:false};
try {
  browser=await chromium.launch({headless:true,...(process.env.ANKHIMATE_BROWSER_PATH?{executablePath:process.env.ANKHIMATE_BROWSER_PATH}:{})});
  page=await browser.newPage({viewport:{width:1060,height:900},deviceScaleFactor:1});
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text());if(m.type()==="warning")warnings.push(m.text());});
  page.on("response",r=>{if(!r.ok())missing.push(`${r.status()} ${r.url()}`);});
  page.on("requestfailed",r=>missing.push(`${r.failure()?.errorText} ${r.url()}`));
  await page.goto(server.url);
  await page.waitForFunction(()=>window.ankhimateExample?.ready,undefined,{timeout:30000});
  const initial=await page.evaluate(()=>structuredClone(window.ankhimateExample));
  assert(initial.texturesReady&&initial.visibleMeshes===19,"both real exports and all meshes loaded");
  await page.locator("canvas").click({position:{x:50,y:40}});
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(x=>window.ankhimateExample.x>x+100,initial.x,{timeout:5000});
  await page.keyboard.up("ArrowRight");
  const moved=await page.evaluate(()=>structuredClone(window.ankhimateExample));
  assert(moved.score>0,"movement reaches a collectible");
  await page.getByRole("button",{name:"leg_ik",exact:true}).click();
  await page.waitForFunction(()=>window.ankhimateExample.clip==="leg_ik");
  await page.locator("canvas").click({position:{x:50,y:40}});
  await page.keyboard.down("Space");
  await page.waitForFunction(()=>window.ankhimateExample.clip==="walk");
  await page.keyboard.up("Space");
  await page.waitForFunction(()=>window.ankhimateExample.eventCount>0);
  await page.screenshot({path:resolve(output,"game-start.png"),fullPage:true});
  result.browser=browser.version();
  result.gpu=await page.evaluate(()=>{
    const gl=document.querySelector("canvas").getContext("webgl2")??document.querySelector("canvas").getContext("webgl");
    const extension=gl?.getExtension("WEBGL_debug_renderer_info");return extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):"WebGL";
  });
  const began=performance.now();
  const startPlayback=await page.evaluate(()=>window.ankhimateExample.playbackMs);
  let nextLog=0;
  for(;;){
    const stats=await page.evaluate(()=>structuredClone(window.ankhimateExample));
    const wall=performance.now()-began;
    assert.equal(stats.errors.length,0,stats.errors.join("\n"));
    assert.equal(errors.length,0,errors.join("\n"));
    assert.equal(warnings.length,0,warnings.join("\n"));
    assert.equal(missing.length,0,missing.join("\n"));
    if(wall>=nextLog){samples.push({wallMs:wall,...stats});console.log(`Soak ${(wall/1000).toFixed(1)}s: ${stats.frames} frames, ${stats.eventCount} events, ${stats.loopWraps} loops`);nextLog+=30000;}
    if(wall>=seconds*1000&&stats.playbackMs-startPlayback>=seconds*1000){result.wallMs=wall;result.final=stats;break;}
    if(wall>(seconds+90)*1000)throw new Error("playback failed to keep advancing in real time");
    await new Promise(done=>setTimeout(done,1000));
  }
  assert(result.final.frames>initial.frames,"render/update frames advance");
  assert(result.final.eventCount>initial.eventCount,"real exported events keep arriving");
  assert(result.final.loopWraps>initial.loopWraps,"real clips loop");
  await page.screenshot({path:resolve(output,"game-end.png"),fullPage:true});
  result.pass=true;
  console.log(`PASS: ${result.wallMs/1000}s wall clock, no JavaScript errors, warnings or missing resources.`);
}catch(error){result.failure=error.stack??String(error);process.exitCode=1;console.error(result.failure);}
finally{await browser?.close();await server.close();await writeFile(resolve(output,"result.json"),JSON.stringify(result,null,2));}
