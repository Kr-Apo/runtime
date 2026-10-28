import {mkdir,cp,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url)),runtime=resolve(here,'../..');
const [output,dependencies,core]=process.argv.slice(2);
if(!output||!dependencies||!core)throw Error('Usage: node prepare-demo.mjs NEW_OUTPUT EXISTING_DEPENDENCY_RUNTIME CORE_DIST');
await mkdir(output); // Refuse overwrite of an existing delivery.
const copy=async(from,to)=>{await mkdir(dirname(join(output,to)),{recursive:true});await cp(from,join(output,to),{recursive:true});};
await copy(core,'core');
await copy(join(dependencies,'node_modules/pixi.js/dist/pixi.mjs'),'vendor/pixi.mjs');
await copy(join(dependencies,'node_modules/phaser/dist/phaser.js'),'vendor/phaser.js');
await copy(join(dependencies,'node_modules/fflate/esm/browser.js'),'vendor/fflate.mjs');
await copy(join(dependencies,'pixi/dist/tint.js'),'pixi/tint.js');
for(const f of ['dark-tint.js','replay-load.js','validate.js'])await copy(join(dependencies,'phaser/dist',f),'phaser/'+f);
for(const folder of ['dynamic-weighted-pixi','bounded-pixi'])await copy(join(runtime,'experimental',folder,'geometry.mjs'),`experimental/${folder}/geometry.mjs`);
await copy(join(runtime,'experimental/dynamic-weighted-pixi/adapter.mjs'),'experimental/dynamic-weighted-pixi/adapter.mjs');
await copy(join(runtime,'experimental/dynamic-weighted-phaser/adapter.mjs'),'experimental/dynamic-weighted-phaser/adapter.mjs');
await copy(join(runtime,'scripts/t840c7c2-q1/projection.mjs'),'scripts/t840c7c2-q1/projection.mjs');
for(const f of ['actor.mjs','assets.mjs','pixi.mjs','phaser.mjs','demo.mjs'])await copy(join(here,f),'experimental/integration-pilot/'+f);
await copy(join(here,'fixtures'),'fixtures');await copy(join(here,'server.mjs'),'server.mjs');
for(const [src,name]of [[join(runtime,'LICENSE-APACHE'),'LICENSE-APACHE'],[join(runtime,'LICENSE-MIT'),'LICENSE-MIT'],[join(dependencies,'node_modules/phaser/LICENSE.md'),'PHASER-LICENSE.md'],[join(dependencies,'node_modules/pixi.js/LICENSE'),'PIXI-LICENSE'],[join(dependencies,'node_modules/fflate/LICENSE'),'FFLATE-LICENSE']])await copy(src,'notices/'+name);
const imports={'@ankhimate/runtime':'/core/index.js','@ankhimate/runtime/render':'/core/render/index.js','@ankhimate/runtime/experimental-host-time':'/core/replay-host-time.js','pixi.js':'/vendor/pixi.mjs',fflate:'/vendor/fflate.mjs','/dynamic-weighted-pixi/geometry.mjs':'/experimental/dynamic-weighted-pixi/geometry.mjs'};
for(const engine of ['pixi','phaser']){
    const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><title>Ankhimate application pilot — ${engine}</title>
<style>body{font:16px system-ui;background:#18212a;color:#eef;margin:24px}main{max-width:800px;margin:auto}canvas{width:640px;height:480px;max-width:100%;background:repeating-conic-gradient(#37434c 0% 25%,#29333b 0% 50%) 0/24px 24px;border:1px solid #789}button,select{font:inherit;padding:6px;margin:3px}pre{white-space:pre-wrap}a{color:#7df}</style>
<body data-engine="${engine}"><main><h1>Ankhimate ${engine} application pilot</h1><p>Experimental application mode — not supervised Q1 admission. Finite playback stops at tick256 (120Hz). No universal Rust/browser parity claim.</p>
<p><a href="pixi.html">PixiJS</a> · <a href="phaser.html">Phaser</a> · <a href="${engine}.html?manual=1">Manual tick mode</a></p>
<select id="fixture"><option value="combined">Courier: weighted mesh + Physics + dynamic skins</option><option value="regions">Courier: regions + Physics + dynamic skins</option></select><button id="reload">Reload two actors</button>
<p><button id="run">Start realtime</button><button id="pause">Pause</button><button id="resume">Resume</button><button id="tick">Manual +1 tick</button><button id="destroy">Destroy application</button></p>
<canvas width="640" height="480"></canvas><pre id="status">Loading native export and5atlas pages…</pre><p>Primary native calendar; default/festival/night. Reload recreates actors at origin. Tick controls cannot mix with a running realtime clock. Pausing preserves backlog; drawing alone never advances Physics.</p></main>
<script type="importmap">${JSON.stringify({imports})}</script>${engine==='phaser'?'<script src="/vendor/phaser.js"></script>':''}<script type="module" src="/experimental/integration-pilot/demo.mjs"></script></body></html>`;
    await writeFile(join(output,engine+'.html'),html);
}
await writeFile(join(output,'index.html'),'<!doctype html><meta charset="utf-8"><h1>Ankhimate application pilot</h1><a href="pixi.html">PixiJS</a> · <a href="phaser.html">Phaser</a>');
await writeFile(join(output,'START.cmd'),'@echo off\r\ncd /d "%~dp0"\r\nnode server.mjs .\r\npause\r\n');
await writeFile(join(output,'README.md'),'# Standalone browser applications\n\nRun `node server.mjs .` in this directory (Node18+ static server only), or serve these files with any local HTTP server. Open http://127.0.0.1:4188/pixi.html or phaser.html. No npm install, Playwright, supervisor, Q1 certificate or browser driver is needed to run the applications. Browser must support WebGL2; tested identity is reported separately. Network URLs stay local; assets/dependencies included with notices.\n\nFinite demo, H256 at120Hz. Pause/resume excludes waiting time; large gaps create bounded backlog, which drains before the horizon pause. Reload creates a fresh pair of actors, not an implicit Physics loop reset. Manual mode uses explicit tick requests. No FFD/links/clipping/mixing/free setSkin/preview.\n');
const fixtureHashes={};for(const kind of ['regions','combined'])fixtureHashes[kind]=createHash('sha256').update(await readFile(join(output,'fixtures',kind,'skeleton.json'))).digest('hex');
await writeFile(join(output,'FIXTURE-HASHES.json'),JSON.stringify(fixtureHashes,null,2));console.log('Standalone applications prepared',resolve(output));
