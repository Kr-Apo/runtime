import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./web-server.mjs";

const output = resolve(process.env.ANKHIMATE_TEST_OUTPUT ?? "test-results/skin-uv");
await mkdir(output, { recursive: true });
const server = await serve();
const names = ["audit-same-light", ...["region", "mesh"].flatMap(k => ["same", "multi"].flatMap(p => ["light", "dark"].map(t => `${k}-${p}-${t}`)))];
const cases = names.flatMap(name => ["default", "direct", "switch", "roundtrip"].flatMap(mode => [0, 1, 2, 3].map(sample => ({ name, mode, sample }))));
if (!process.env.ANKHIMATE_SKIP_STRESS) cases.push(...names.map(name => ({ name, mode: "stress", sample: 1 })));
const results = [];
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.ANKHIMATE_BROWSER_PATH ? { executablePath: process.env.ANKHIMATE_BROWSER_PATH } : {}) });
  for (const { name, mode, sample } of cases) {
    const page = await browser.newPage({ viewport: { width: 940, height: 760 }, deviceScaleFactor: 1 });
    const infrastructure = [];
    page.on("pageerror", e => infrastructure.push(e.message));
    page.on("console", m => { if (["warning", "error"].includes(m.type())) infrastructure.push(m.text()); });
    page.on("response", r => { if (!r.ok()) infrastructure.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${server.url}/phaser/test/skin-uv.html?case=${name}&mode=${mode}&sample=${sample}`);
    await page.waitForFunction(() => window.__result, undefined, { timeout: 30000 });
    const result = await page.evaluate(() => window.__result);
    Object.assign(result, { browser: browser.version(), infrastructure });
    result.pass &&= infrastructure.length === 0;
    results.push(result);
    await page.locator("canvas").screenshot({ path: resolve(output, `${name}-${mode}-${sample}.png`) });
    console.log(`${result.pass ? "PASS" : "FAIL"} ${name}/${mode} t=${result.time}: ${result.failures.join("; ")} infrastructure=${infrastructure.length}`);
    await page.close();
  }
} finally {
  await browser?.close(); await server.close();
  await writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2));
}
if (results.length !== cases.length || results.some(r => !r.pass)) process.exitCode = 1;
