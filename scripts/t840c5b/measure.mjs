import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {serve} from '../web-server.mjs';
import assert from 'node:assert/strict';
const out=resolve(process.argv[2]),root=resolve(process.argv[3]),instrument=process.argv[4]==='instrument';
await mkdir(out);const server=await serve(root),rows=[];let browser;
function wrapBody(source,marker,label){
 const start=source.indexOf(marker);assert.ok(start>=0,marker);const open=source.indexOf('{',start);let depth=1,end=open+1;
 for(;depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;assert.ok(end<source.length);}
 return source.slice(0,open+1)+`globalThis.__validationProfile.enter(${JSON.stringify(label)});try{`+source.slice(open+1,end-1)+`}finally{globalThis.__validationProfile.exit();}`+source.slice(end-1);
}
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.ANKHIMATE_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const character of ['scout','ranger','courier'])for(const count of (process.env.C5B_COUNTS?process.env.C5B_COUNTS.split(',').map(Number):instrument?[1,25]:[1,5,10,25]))for(const mode of ['exact','host'])for(let repetition=0;repetition<(process.env.C5B_REPETITIONS?Number(process.env.C5B_REPETITIONS):instrument?1:3);repetition++){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(instrument){
   await page.addInitScript(()=>{
    const p=window.__validationProfile={stats:{},stack:[],phase:'load',enter(label){const f={label,child:0,t:performance.now()};this.stack.push(f);},exit(){const f=this.stack.pop(),elapsed=performance.now()-f.t;if(this.stack.length)this.stack.at(-1).child+=elapsed;const k=this.phase+'/'+f.label,s=this.stats[k]??={calls:0,inclusiveMs:0,selfMs:0};s.calls++;s.inclusiveMs+=elapsed;s.selfMs+=elapsed-f.child;}};
    for(const k of ['getParameter','isContextLost','drawArrays','drawElements']){const old=WebGL2RenderingContext.prototype[k];WebGL2RenderingContext.prototype[k]=function(...args){const label=k==='getParameter'?(args[0]===this.VERSION?'GL.VERSION':'GL.otherParameter'):k;p.enter(label);try{return old.apply(this,args);}finally{p.exit();}};}
   });
   await page.route('**/phaser/dist/replay-load.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:wrapBody(await r.text(),'function replayWebGL2(game)','WebGL validation')});});
   await page.route('**/phaser/dist/experimental-replay.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:wrapBody(await r.text(),'#validateResources = () =>','Page validation')});});
  }
  await page.goto(server.url+`/examples/replay-character-acceptance/?engine=Phaser&character=${character}`);await page.waitForFunction(()=>window.acceptance);
  const result=await page.evaluate(async({count,mode,instrument})=>{
   const h=window.acceptance,p=window.__validationProfile,restore=[];
   if(instrument){
    function wrap(o,k,label){const old=o[k];o[k]=function(...args){p.enter(label);try{return old.apply(this,args);}finally{p.exit();}};restore.push(()=>o[k]=old);}
    const {PhaserRig}=await import('@ankhimate/phaser-runtime');for(const k of ['geometry','apply'])wrap(PhaserRig.prototype,k,'PhaserRig.'+k);
    wrap(Object.getPrototypeOf(h.actors[0].view.root.list[0].faces[0]),'transformCoordinatesLocal','Face projection');
    for(const k of ['get','exists'])wrap(h.game.textures,k,'TextureManager.'+k);
   }
   h.setActors(count);if(instrument)for(const a of h.actors)for(const key of ['capture','present']){const old=a.view[key];a.view[key]=function(...args){p.enter('instance.'+key);try{return old.apply(this,args);}finally{p.exit();}};restore.push(()=>a.view[key]=old);}
   const load=instrument?structuredClone(p.stats):null;
   const records=[];let hostNow=0,tick=0;
   function start(){hostNow=0;tick=0;for(let i=0;i<count;i++){h.command(i,'stop',0,false);h.command(i,mode==='host'?'host':'play',0,false);}}
   function request(j,hitch=false){tick+=hitch?60:2;hostNow+=hitch?500:1000/60;for(const a of h.actors){if(mode==='host')a.host.advance(hostNow);else a.view.consumer.requestTick(a.view.consumer.context,BigInt(tick));}}
   const samples=instrument?8:60,warm=instrument?2:16;
   for(const scenario of ['new-pose','same-token','redraw','paused','hitch','catchup']){
    if(p)p.phase=scenario;start();
    if(scenario==='paused')for(let i=0;i<count;i++)h.command(i,'pause',0,false);
    if(scenario==='catchup')request(0,true);
    const timings=[],progress=[];
    for(let j=0;j<samples+warm;j++){
     const t=performance.now();
     if(scenario==='new-pose'||scenario==='hitch')request(j,scenario==='hitch'&&j===warm+(instrument?2:10));
     if(scenario==='catchup')for(const a of h.actors)a.view.consumer.pump(a.view.consumer.context,8);
     const afterRequest=performance.now(),tokens=scenario==='redraw'?[]:h.actors.map(a=>a.view.capture()),afterCapture=performance.now();
     if(scenario!=='redraw')for(let i=0;i<count;i++)h.actors[i].view.present(tokens[i]);
     const afterPresent=performance.now();h.submit();const end=performance.now();
     if(instrument)progress.push({sample:j,clocks:h.actors.map(a=>{const c=a.view.consumer.transportStatus().clock;return{requested:String(c.requested),completed:String(c.completed),backlog:String(c.backlog)};})});
     if(j>=warm)timings.push({request:afterRequest-t,capture:afterCapture-afterRequest,present:afterPresent-afterCapture,submit:end-afterPresent,total:end-t});
    }
    records.push({scenario,timings,progress:instrument?progress:undefined,clocks:h.actors.map(a=>{const f=a.view.consumer.currentFrame();return{requested:String(f.requested),completed:String(f.completed),backlog:String(f.backlog),health:f.health};})});
   }
   if(p)p.phase='cached-removed-page';const a=h.actors[0],token=a.view.capture(),texture=a.view.root.list[0].texture;h.game.textures.remove(texture.key);let refused=false;try{a.view.present(token);}catch{refused=true;}if(!refused)throw Error('Deleted atlas accepted');
   if(p)p.phase='destroy';for(const f of restore.reverse())f();const d=performance.now();await h.dispose();
   return{load,records,stats:p?.stats??null,destructionMs:performance.now()-d,resources:h.asset.resources};
  },{count,mode,instrument});
  assert.equal(result.resources.instances,0);assert.deepEqual(errors,[]);rows.push({character,count,mode,repetition,...result});await page.close();
  await writeFile(resolve(out,'results.json'),JSON.stringify({browser:browser.version(),instrument,rows},null,2));console.log(`${character}/${count}/${mode}/${repetition} done`);
 }
}finally{await writeFile(resolve(out,'results.json'),JSON.stringify({browser:browser?.version(),instrument,note:'Timing and intrusive nested-exclusive instrumentation are separate executions. Validation entry/page wrappers are HTTP-only diagnostic response transforms, never written into either source/build. All resource and numerical guards remain active. CPU submit is not GPU duration.',rows},null,2));await browser?.close();await server.close();}
