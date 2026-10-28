import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {serve} from '../web-server.mjs';
import {png,compare,policy} from '../parity-pixels.mjs';
const output=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('webgl.mjs <NEW output folder>');await mkdir(output);
const rows=[],errors=[],warnings=[],missing=[],external=[],contexts=[],server=await serve();let browser,page;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.ANKHIMATE_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-networking']});page=await browser.newPage({viewport:{width:1100,height:950},deviceScaleFactor:1});
 await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith(server.url+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();external.push(url);return route.abort();});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(!r.ok())missing.push(`${r.status()} ${r.url()}`);});
 await page.goto(server.url+'/examples/replay-pixi-pilot/');await page.waitForFunction(()=>window.pilotHarness,{timeout:30000});
 const environment=await page.evaluate(async()=>{
  const h=window.pilotHarness,gl=h.app.renderer.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');window.__refs=await(await fetch('./assets/rust-reference.json')).json();h.app.canvas.addEventListener('webglcontextlost',()=>window.__contextLost=true);
  return {pixi:h.version,userAgent:navigator.userAgent,webgl2:gl instanceof WebGL2RenderingContext,version:gl.getParameter(gl.VERSION),vendor:gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),attributes:gl.getContextAttributes(),canvas:[gl.drawingBufferWidth,gl.drawingBufferHeight],dpr:devicePixelRatio,hardwareConcurrency:navigator.hardwareConcurrency,memory:performance.memory?{used:performance.memory.usedJSHeapSize,limit:performance.memory.jsHeapSizeLimit}:null};
 });environment.browser=browser.version();assert.equal(environment.webgl2,true);
 await writeFile(resolve(output,'environment.json'),JSON.stringify(environment,null,2));await writeFile(resolve(output,'pixel-policy.json'),JSON.stringify(policy,null,2));
 async function command(index,name,value){return page.evaluate(({index,name,value})=>window.pilotHarness.command(index,name,value),{index,name,value});}
 async function capture(label,ticks,reference=true){
  const data=await page.evaluate(({ticks,reference})=>{
   const h=window.pilotHarness,rig=h.asset.source,gl=h.app.renderer.gl,w=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
   const read=()=>{const bottom=new Uint8Array(w*height*4),top=new Uint8Array(bottom.length);gl.readPixels(0,0,w,height,gl.RGBA,gl.UNSIGNED_BYTE,bottom);for(let y=0;y<height;y++)top.set(bottom.subarray(y*w*4,(y+1)*w*4),(height-1-y)*w*4);let s='';for(let i=0;i<top.length;i+=32768)s+=String.fromCharCode(...top.subarray(i,i+32768));return btoa(s);};
   let maxAffine=0,maxWorld=0,maxVertex=0,maxCamera=0;const states=[],counts=[];
   for(const [i,a]of h.actors.entries()){
    const f=a.last.snapshot,tick=a.last.kind==='pure-preview'?f.tick:f.poseTick;if(String(tick)!==String(ticks[i]))throw Error('wrong displayed tick');
    if(a.last.kind!=='pure-preview'&&tick!==f.completed)throw Error('future pose');
    states.push({kind:a.last.kind,poseTick:String(tick),completed:String(a.controller.frame.completed),requested:String(a.controller.frame.requested),backlog:String(a.controller.frame.backlog),state:a.controller.status.state,health:a.controller.frame.health,skin:f.skin});
    const ref=window.__refs[Number(tick)];
    if(reference)for(const b of f.bones){const r=ref.bones.find(r=>r.name===b.name).world;Object.values(b.world).forEach((v,k)=>{if(k<4)maxAffine=Math.max(maxAffine,Math.abs(v-r[k]));else maxWorld=Math.max(maxWorld,Math.abs(v-r[k]));});}
    if(a.view.root.children.map(m=>m.label).join()!==rig.drawOrder.join())throw Error('draw order');
    if(reference)for(const mesh of a.view.root.children){
     const d=ref.draws.find(d=>d.slot===mesh.label),entry=rig.skins[0].attachments.find(e=>e.slot===mesh.label),r=rig.atlas.regions.find(r=>r.name===entry.attachment.texture);
     const u0=Math.max(0,(r.offset_x-1)/(r.original_width-1)),u1=Math.min(1,(r.offset_x+r.width)/(r.original_width-1)),v0=Math.max(0,(r.offset_y-1)/(r.original_height-1)),v1=Math.min(1,(r.offset_y+r.height)/(r.original_height-1));
     for(const [k,u,v]of [[0,u0,v0],[1,u0,v1],[2,u1,v1],[3,u1,v0]]){
      const xy=[0,1].map(j=>d.corners[0][j]+u*(d.corners[3][j]-d.corners[0][j])+v*(d.corners[1][j]-d.corners[0][j]));
      xy.forEach((value,j)=>maxVertex=Math.max(maxVertex,Math.abs(mesh.geometry.positions[k*2+j]-value)));
      const p=mesh.toGlobal({x:mesh.geometry.positions[k*2],y:mesh.geometry.positions[k*2+1]});maxCamera=Math.max(maxCamera,Math.abs(p.x-(a.view.root.x+xy[0]*a.view.root.scale.x)),Math.abs(p.y-(a.view.root.y+xy[1]*a.view.root.scale.y)));
     }
    }counts.push(a.view.root.children.length);
   }
   h.draw();const actual=read();let expected=actual;
   if(reference){
    const saved=h.actors.map(a=>a.view.root.children.map(mesh=>({mesh,positions:mesh.geometry.positions.slice()})));
    for(const a of h.actors){const ref=window.__refs[Number(a.last.snapshot.poseTick)];for(const mesh of a.view.root.children){const d=ref.draws.find(d=>d.slot===mesh.label),entry=rig.skins[0].attachments.find(e=>e.slot===mesh.label),r=rig.atlas.regions.find(r=>r.name===entry.attachment.texture);const u0=Math.max(0,(r.offset_x-1)/(r.original_width-1)),u1=Math.min(1,(r.offset_x+r.width)/(r.original_width-1)),v0=Math.max(0,(r.offset_y-1)/(r.original_height-1)),v1=Math.min(1,(r.offset_y+r.height)/(r.original_height-1));for(const [k,u,v]of [[0,u0,v0],[1,u0,v1],[2,u1,v1],[3,u1,v0]])for(let j=0;j<2;j++)mesh.geometry.positions[k*2+j]=d.corners[0][j]+u*(d.corners[3][j]-d.corners[0][j])+v*(d.corners[1][j]-d.corners[0][j]);mesh.geometry.getBuffer('aPosition').update();}}
    h.draw();expected=read();for(const group of saved)for(const {mesh,positions}of group){mesh.geometry.positions.set(positions);mesh.geometry.getBuffer('aPosition').update();}h.draw();
   }
   if(gl.getError()!==gl.NO_ERROR||window.__contextLost)throw Error('WebGL error/context loss');return {actual,expected,width:w,height,states,maxAffine,maxWorld,maxVertex,maxCamera,meshes:counts,resources:h.asset.resources};
  },{ticks,reference});
  const a=Buffer.from(data.actual,'base64'),b=Buffer.from(data.expected,'base64'),pixels=compare(a,b,data.width,data.height,true);assert.ok(data.maxAffine<=.0001&&data.maxWorld<=.01&&data.maxVertex<=.01&&data.maxCamera<=.02,JSON.stringify(data));assert.equal(pixels.status,'PASS',label+JSON.stringify({...pixels,diff:undefined}));
  await writeFile(resolve(output,label+'.png'),png(data.width,data.height,a));await writeFile(resolve(output,label+'-rust-pose.png'),png(data.width,data.height,b));await writeFile(resolve(output,label+'.rgba'),a);delete data.actual;delete data.expected;delete pixels.diff;const row={label,status:'PASS',...data,pixels,pixelSHA256:hash(a),rustPosePixelSHA256:hash(b),reference:reference?'independent Rust simulation, same Pixi presentation':'pure preview, not a historical Physics oracle'};rows.push(row);console.log('PASS '+label+' '+JSON.stringify({states:row.states,maxVertex:row.maxVertex}));return row;
 }
 await capture('00-tick-zero',[0,0]);await command(0,'play');
 for(const tick of [1,30,60,120]){await command(0,'request',tick);await page.evaluate(()=>window.pilotHarness.pumpAll(0));await capture('tick-'+tick,[tick,0]);}
 await command(0,'pause');const paused=await capture('paused',[120,0]);await page.locator('#redraw').click();const redraw=await capture('redraw-observational',[120,0]);assert.equal(paused.pixelSHA256,redraw.pixelSHA256);await command(0,'resume');
 await command(0,'stop');await command(0,'play');await command(0,'hitch');const backlog=await capture('backlog-8-of-60',[8,0]);assert.equal(backlog.states[0].backlog,'52');await command(0,'pump',3);await capture('pump-partial-11',[11,0]);await page.evaluate(()=>window.pilotHarness.pumpAll(0));await capture('caught-up',[60,0]);
 const simulatedHash=(await capture('simulated-before-seek',[60,0])).pixelSHA256;await command(0,'seek',60);const pureCapture=await capture('pure-seek-preview',[60,0],false);assert.ok((await page.locator('#diagnostic').innerText()).includes('\"displayedTick\": \"60\"'));assert.notEqual(pureCapture.pixelSHA256,simulatedHash,'secondary motion must differ from pure preview pixels');await page.evaluate(()=>{let refused=false;try{window.pilotHarness.command(0,'resume');}catch{refused=true;}if(!refused)throw Error('ambiguous seek resume');});
 await command(0,'replay',60);await command(0,'pump',8);await capture('replay-partial',[8,0]);await page.evaluate(()=>window.pilotHarness.pumpAll(0));await capture('after-replay',[60,0]);
 await command(0,'stop');await command(0,'play');await command(0,'request',8);await command(0,'fault');const fault=await capture('fault-last-good',[8,0]);assert.equal(fault.states[0].health,'faulted');await page.evaluate(()=>{let refused=false;try{window.pilotHarness.command(0,'pump',8);}catch{refused=true;}if(!refused)throw Error('silent retry');});await command(0,'reset');await capture('after-reset',[0,0]);
 await command(0,'play');await command(1,'play');await command(0,'request',30);await command(1,'request',120);await page.evaluate(()=>{window.pilotHarness.pumpAll(0);window.pilotHarness.pumpAll(1);});await capture('two-independent',[30,120]);
 const presentation=await page.evaluate(()=>{const h=window.pilotHarness,a=h.actors[0],before=a.controller.frame;const snapshot=structuredClone(a.last.snapshot);snapshot.bones[0].world.tx=NaN;let error;try{a.view.present({kind:'simulated',snapshot});}catch(e){error=String(e);}const after=a.controller.frame;if(!error||after.health!=='healthy'||after.completed!==before.completed)throw Error('presentation affected simulation');return {error,completed:String(after.completed),health:after.health};});rows.push({label:'presentation-error-distinct',status:'PASS',...presentation});

 await page.evaluate(async()=>{const h=window.pilotHarness;h.setActors(1);h.replaceClip(0,'fault_at_9');const a=h.actors[0];a.controller.play();a.controller.request(8n);h.present(a);h.draw();});
 const preSolver=await capture('before-native-solver-fault',[8]);await page.evaluate(()=>{const h=window.pilotHarness,a=h.actors[0];const p=a.controller.request(60n);if(p.stop.kind!=='failed')throw Error('native singular parent must fail');h.present(a);h.draw();});const solverFault=await capture('native-solver-fault-last-good',[8]);assert.equal(solverFault.pixelSHA256,preSolver.pixelSHA256);assert.equal(solverFault.states[0].health,'faulted');assert.equal(solverFault.states[0].backlog,'52');
 // Exact display cadences, no host float conversion and no real-time pacing claim.
 for(const fps of [30,60,120,144]){await page.evaluate(fps=>{const h=window.pilotHarness;h.setActors(1);const a=h.actors[0];a.controller.play();for(let n=1;n<=fps*2;n++){a.controller.requestTime(BigInt(n),BigInt(fps));h.present(a);h.draw();}while(a.controller.frame.backlog)a.controller.pump(128);h.present(a);h.draw();},fps);await capture('cadence-'+fps,[240]);}
 await page.evaluate(()=>{const h=window.pilotHarness;h.setActors(1);const a=h.actors[0];a.controller.play();for(const t of [1,2,5,8,68,69,144,145,240]){a.controller.request(BigInt(t));h.present(a);h.draw();}while(a.controller.frame.backlog)a.controller.pump(128);h.present(a);h.draw();});await capture('irregular-hitch',[240]);
 const lifecycle=await page.evaluate(()=>{const h=window.pilotHarness,samples=[];for(let n=0;n<20;n++){const old=h.actors.map(a=>({root:a.view.root,buffers:a.view.root.children.flatMap(m=>[...m.geometry.buffers,m.geometry.indexBuffer])})),t=performance.now();h.setActors(n%2?2:1);samples.push(performance.now()-t);if(old.some(a=>!a.root.destroyed||a.buffers.some(b=>!b.destroyed)))throw Error('root/geometry buffers not destroyed');if(h.asset.resources.instances!==h.actors.length||h.actors.some(a=>a.view.root.children.length!==3))throw Error('resource growth');}return {cycles:20,createDestroyFrameMs:samples,textures:h.asset.resources.textures,activeInstances:h.asset.resources.instances};});
 const performanceRows=[];
 for(const count of (process.env.ANKHIMATE_REPLAY_COUNTS??'1,10').split(',').map(Number)){
  performanceRows.push(await page.evaluate(async count=>{const h=window.pilotHarness;h.setActors(count);for(const a of h.actors)a.controller.play();const samples=[],before=performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null;let previous;
   for(let frame=1;frame<=210;frame++){const timestamp=await new Promise(requestAnimationFrame),start=performance.now();let ticks=0;for(const a of h.actors){const p=a.controller.request(BigInt(frame*2));ticks+=p.processed;}const simulated=performance.now();const captures=h.actors.map(a=>a.controller.capture());const transferred=performance.now();for(let i=0;i<h.actors.length;i++){h.applyCaptured(h.actors[i],captures[i]);h.stats.snapshots++;h.stats.presentations++;}const presented=performance.now();h.draw();const end=performance.now();if(frame>30)samples.push({simulationMs:simulated-start,transferMs:transferred-simulated,pixiUpdateMs:presented-transferred,presentationMs:presented-simulated,renderSubmissionMs:end-presented,totalMs:end-start,frameIntervalMs:timestamp-previous,ticks,backlog:String(h.actors[0].controller.frame.backlog)});previous=timestamp;}
   return {count,warmup:30,samples,before,after:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null,snapshotCalls:h.stats.snapshots,integrationMetrics:h.actors.map(a=>a.view.metrics)};
  },count));
 }
 // Exercise the isolated real-time converter; this is not canonical parity evidence.
 await page.evaluate(()=>window.pilotHarness.setActors(1));await command(0,'live');await page.waitForTimeout(500);await command(0,'pause');const live=await page.evaluate(()=>{const a=window.pilotHarness.actors[0];return {completed:String(a.controller.frame.completed),requested:String(a.controller.frame.requested),paused:a.controller.status.state};});await page.waitForTimeout(150);const still=await page.evaluate(()=>String(window.pilotHarness.actors[0].controller.frame.completed));assert.equal(still,live.completed);await command(0,'resume');await page.waitForTimeout(150);await command(0,'pause');const liveAfter=await page.evaluate(()=>String(window.pilotHarness.actors[0].controller.frame.completed));assert.ok(BigInt(liveAfter)>BigInt(live.completed));
 const destroyed=await page.evaluate(()=>{const h=window.pilotHarness,roots=h.actors.map(a=>a.view.root);h.dispose();return {rootsDestroyed:roots.every(r=>r.destroyed),resources:h.asset.resources};});assert.equal(destroyed.rootsDestroyed,true);assert.equal(destroyed.resources.textures,0);assert.equal(destroyed.resources.instances,0);
 await writeFile(resolve(output,'performance.json'),JSON.stringify({environment,rows:performanceRows,lifecycle,liveDemo:{before:live,after:liveAfter},destroyed},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);assert.deepEqual(missing,[]);assert.deepEqual(external,[]);contexts.push({contextLost:false});
}finally{await writeFile(resolve(output,'results.json'),JSON.stringify({rows,errors,warnings,missing,external,contexts},null,2));await browser?.close();await server.close();}
