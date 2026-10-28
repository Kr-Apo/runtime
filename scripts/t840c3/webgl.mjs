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
 await command(0,'host-start',0);await command(1,'host-start',0);
 await command(0,'host-advance',25);await command(1,'host-advance',50);await capture('regular',[3,6]);
 await command(0,'host-pause',25);await command(1,'host-advance',500);await capture('A-paused-B-progressing',[3,14]);
 await command(0,'host-resume',10000);await command(0,'host-advance',10000);await capture('resume-no-jump',[3,14]);
 await command(0,'host-advance',10025);await capture('resumed-active-time',[6,14]);
 await command(0,'host-advance',10525);const hitch=await capture('hitch8-of60-additional',[14,14]);assert.equal(hitch.states[0].backlog,'52');
 await command(0,'host-advance',11025);await capture('new-time-with-backlog',[22,14]);
 await command(0,'pump',3);await capture('explicit-partial-pump',[25,14]);await page.evaluate(()=>window.pilotHarness.pumpAll(0));const caught=await capture('caught-up',[126,14]);
 await page.evaluate(()=>{const h=window.pilotHarness,a=h.actors[0],before=JSON.stringify(a.controller.status,(_,v)=>typeof v==='bigint'?String(v):v),metrics=a.view.metrics;for(let i=0;i<30;i++){a.host.observe();a.host.advance(11025);h.present(a);h.draw();}if(JSON.stringify(a.controller.status,(_,v)=>typeof v==='bigint'?String(v):v)!==before||a.view.metrics.captures!==metrics.captures||a.view.metrics.submissions!==metrics.submissions)throw Error('observation advanced or copied');});const redraw=await capture('unchanged-redraw',[126,14]);assert.equal(redraw.pixelSHA256,caught.pixelSHA256);
 const conversion=await page.evaluate(()=>{const h=window.pilotHarness,a=h.actors[0],before=a.controller.frame;let error;try{h.command(0,'host-advance',11000);}catch(e){error=String(e);}if(!error||a.controller.frame.completed!==before.completed||!document.querySelector('#diagnostic').textContent.includes('backward_time'))throw Error('conversion error mutated transport or hidden');return {error,completed:String(before.completed)};});rows.push({label:'regressive-time-refusal',status:'PASS',...conversion});
 await command(0,'seek',30);await capture('preview30',[30,14],false);await command(0,'seek',90);await capture('preview90',[90,14],false);
 await command(0,'replay',126);await page.evaluate(()=>window.pilotHarness.pumpAll(0));await capture('replayed126',[126,14]);
 await page.evaluate(()=>{const h=window.pilotHarness;h.setActors(1);h.replaceClip(0,'fault_at_9');});await command(0,'host-start',0);await command(0,'host-advance',500);const good=await capture('before-native-fault',[8]);await command(0,'host-advance',509);const fault=await capture('native-fault-last-good',[8]);assert.equal(fault.states[0].health,'faulted');assert.equal(fault.pixelSHA256,good.pixelSHA256);
 const destroyed=await page.evaluate(()=>{const h=window.pilotHarness,roots=h.actors.map(a=>a.view.root),hosts=h.actors.map(a=>a.host);h.dispose();for(const host of hosts){let refused=false;try{host.advance(1000);}catch{refused=true;}if(!refused)throw Error('host still live');}return {roots:roots.every(r=>r.destroyed),resources:h.asset.resources};});assert.equal(destroyed.roots,true);assert.equal(destroyed.resources.instances,0);assert.equal(destroyed.resources.textures,0);
 assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);assert.deepEqual(missing,[]);assert.deepEqual(external,[]);contexts.push({contextLost:false});
}finally{await writeFile(resolve(output,'results.json'),JSON.stringify({rows,errors,warnings,missing,external,contexts},null,2));await browser?.close();await server.close();}
