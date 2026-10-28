import {chromium} from 'playwright';
import {serve} from '../web-server.mjs';
const server=await serve();let browser;
try {browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const p=await browser.newPage();p.on('console',m=>console.log(m.type(),m.text()));p.on('pageerror',e=>console.log('pageerror',e.message));await p.goto(server.url+'/examples/replay-pixi-pilot/');await p.waitForFunction(()=>window.pilotHarness,{timeout:30000});console.log(await p.evaluate(()=>({canvas:!!window.pilotHarness.app.renderer.gl,actors:window.pilotHarness.actors.length,renderer:window.pilotHarness.app.renderer.gl.getParameter(window.pilotHarness.app.renderer.gl.RENDERER)})));}finally{await browser?.close();await server.close();}
