import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./web-server.mjs";

const output = resolve(process.env.ANKHIMATE_TEST_OUTPUT ?? "test-results/webgl");
await mkdir(output, { recursive: true });
const server = await serve();
let browser;
const results = [];
try {
  browser = await chromium.launch({ headless: true, ...(process.env.ANKHIMATE_BROWSER_PATH ? { executablePath: process.env.ANKHIMATE_BROWSER_PATH } : {}) });
  const cases = ["walker", "tagged_rig"].flatMap(rig => [0,1,2,3].map(sample=>({rig,sample})));
  cases.push(...[0,1,2,3].map(sample=>({rig:"walker",sample,clip:"leg_ik"})));
  cases.push({rig:"diagnostic",sample:0});
  cases.push(...["walk", "leg_ik"].flatMap(clip=>[0,1,2,3].map(sample=>({rig:"walker_dark",sample,...(clip==="leg_ik"?{clip}: {})}))));
  for (const {rig,sample,clip} of cases) {
    const page = await browser.newPage({ viewport: { width: 940, height: 760 }, deviceScaleFactor: 1 });
    const errors = [], warnings = [], missing = [];
    page.on("pageerror", error=>errors.push(error.message));
    page.on("console", message=>{if(message.type()==="warning")warnings.push(message.text());if(message.type()==="error")errors.push(message.text());});
    page.on("response", response=>{if(!response.ok())missing.push(`${response.status()} ${response.url()}`);});
    await page.goto(rig === "diagnostic" ? `${server.url}/phaser/test/diagnostic.html` : `${server.url}/phaser/test/webgl.html?rig=${rig}&sample=${sample}${clip ? `&clip=${clip}` : ""}`);
    await page.waitForFunction(()=>window.__result, undefined, { timeout: 30000 });
    const result = await page.evaluate(()=>window.__result);
    Object.assign(result,{browser:browser.version(),errors,warnings,missing});
    result.pass &&= errors.length===0 && warnings.length===0 && missing.length===0;
    await page.locator("canvas").screenshot({ path: resolve(output, `${rig}${clip ? `-${clip}` : ""}-${sample}.png`) });
    results.push(result);
    console.log(`${result.pass ? "PASS" : "FAIL"} ${rig}/${result.animation ?? "probe"} t=${result.time}: ${result.failures.join("; ")} warnings=${warnings.length}`);
    await page.close();
  }
} finally {
  await browser?.close(); await server.close();
  await writeFile(resolve(output,"results.json"),JSON.stringify(results,null,2));
}
if (results.length!==21 || results.some(result=>!result.pass)) process.exitCode=1;
