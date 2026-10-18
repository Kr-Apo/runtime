import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./web-server.mjs";
const output=resolve(process.env.ANKHIMATE_TEST_OUTPUT??"test-results/dark-tint");await mkdir(output,{recursive:true});
const server=await serve();let browser;const results=[];
try {
  browser=await chromium.launch({headless:true,...(process.env.ANKHIMATE_BROWSER_PATH?{executablePath:process.env.ANKHIMATE_BROWSER_PATH}:{})});
  for(const filtered of [false,true])for(const opaque of [false,true])for(const clip of ["pulse","alternate"])for(const sample of [0,1,2,3]) {
    const page=await browser.newPage({viewport:{width:720,height:800},deviceScaleFactor:1});const errors=[],warnings=[],missing=[];
    if(process.env.ANKHIMATE_BASELINE_DIST)await page.route(/^https?:\/\/[^/]+\/(core|phaser)\/dist\/.*\.js$/,async route=>{
      const path=new URL(route.request().url()).pathname.replace("/dist/","/");
      await route.fulfill({contentType:"text/javascript",body:await readFile(resolve(process.env.ANKHIMATE_BASELINE_DIST,`.${path}`))});
    });
    page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="warning")warnings.push(m.text());if(m.type()==="error")errors.push(m.text());});page.on("response",r=>{if(!r.ok())missing.push(`${r.status()} ${r.url()}`);});
    await page.goto(`${server.url}/phaser/test/dark-tint.html?clip=${clip}&sample=${sample}${opaque?"&opaque=1":""}${filtered?"&filtered=1":""}`);
    await page.waitForFunction(()=>window.__result,undefined,{timeout:30000});
    const result=await page.evaluate(()=>window.__result);Object.assign(result,{browser:browser.version(),errors,warnings,missing});
    result.pass&&=errors.length===0&&warnings.length===0&&missing.length===0;results.push(result);
    await page.locator("canvas").screenshot({path:resolve(output,`${filtered?"filtered":"native"}-${opaque?"opaque":"clear"}-${clip}-${sample}.png`)});
    console.log(`${result.pass?"PASS":"FAIL"} ${filtered?"filtered":"native"}/${opaque?"opaque":"clear"}/${clip}/${sample}: ${result.failures.join("; ")}`);
    await page.close();
  }
}finally{await browser?.close();await server.close();await writeFile(resolve(output,"results.json"),JSON.stringify(results,null,2));}
if(results.length!==32||results.some(r=>!r.pass))process.exitCode=1;
