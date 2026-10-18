import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repository, serve } from "./web-server.mjs";

const output = resolve(process.env.ANKHIMATE_TEST_OUTPUT ?? "test-results/clipping"); await mkdir(output, { recursive: true });
const entries = JSON.parse(await readFile(resolve(repository, "phaser/test/fixtures/clipping/cases.json")));
const cases = entries.filter(e => process.env.ANKHIMATE_CLIPPING_CASES ? process.env.ANKHIMATE_CLIPPING_CASES.split(",").includes(e.name) : process.env.ANKHIMATE_CLIPPING_CONCAVE ? e.concave : !e.concave)
  .flatMap(e => (e.audit ? ["audit"] : ["identity", "translated", "rotated", "nested", "camera", "parallax", "dynamic"]).map(mode => ({ name: e.name, mode })));
const server = await serve(); let browser; const results = [];
try {
  browser = await chromium.launch({ headless: true, ...(process.env.ANKHIMATE_BROWSER_PATH ? { executablePath: process.env.ANKHIMATE_BROWSER_PATH } : {}) });
  for (const { name, mode } of cases) {
    const page = await browser.newPage({ viewport: { width: 800, height: 650 }, deviceScaleFactor: 1 }), infrastructure = [];
    if (process.env.ANKHIMATE_BASELINE_DIST) await page.route(/^https?:\/\/[^/]+\/(core|phaser)\/dist\/.*\.js$/, async route => {
      const file = new URL(route.request().url()).pathname.replace("/dist/", "/");
      await route.fulfill({ contentType: "text/javascript", body: await readFile(resolve(process.env.ANKHIMATE_BASELINE_DIST, `.${file}`)) });
    });
    page.on("pageerror", e => infrastructure.push(e.message)); page.on("console", m => { if (["error", "warning"].includes(m.type())) infrastructure.push(m.text()); }); page.on("response", r => { if (!r.ok()) infrastructure.push(`${r.status()} ${r.url()}`); });
    const stress = !process.env.ANKHIMATE_SKIP_STRESS && mode === "dynamic" && ["toggle", "successive"].includes(name);
    await page.goto(`${server.url}/phaser/test/clipping.html?case=${name}&mode=${mode}${stress ? "&stress=1" : ""}`);
    for (const index of [0, 1, 2, 3]) {
      await page.waitForFunction(i => window.__sample === i || window.__result, index, { timeout: 30000 });
      if (await page.evaluate(() => !!window.__result)) break;
      if (index === 2) await page.locator("canvas").screenshot({ path: resolve(output, `${name}-${mode}.png`) });
      await page.evaluate(() => window.__advance());
    }
    await page.waitForFunction(() => window.__result, undefined, { timeout: 30000 });
    const result = await page.evaluate(() => window.__result); Object.assign(result, { browser: browser.version(), infrastructure });
    result.pass &&= infrastructure.length === 0 && result.samples.length === 4; results.push(result);
    console.log(`${result.pass ? "PASS" : "FAIL"} ${name}/${mode}: ${result.samples.filter(s => s.pass).length}/4 poses; ${result.failures.join("; ")} infrastructure=${infrastructure.length}`);
    await page.close();
  }
} finally { await browser?.close(); await server.close(); await writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2)); }
if (results.length !== cases.length || results.some(r => !r.pass)) process.exitCode = 1;
