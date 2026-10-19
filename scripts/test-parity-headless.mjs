import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {policy,png,compare} from './parity-pixels.mjs';
import {createHash} from 'node:crypto';
import {serve,repository} from './web-server.mjs';
const output=resolve(process.env.ANKHIMATE_PARITY_OUTPUT??'test-results/parity-headless');

const fixtures=['clipping/ffd_alt','clipping/tint_mesh','clipping/replacement','meshes/partial_ffd','meshes/weighted_complex','meshes/ffd_bezier','meshes/trim_multi','meshes/topology','appearance/skins','appearance/tint_grid','appearance/tint_mesh','multipage','trim','tagged','playback'];
const plan=[];
for(const fixture of fixtures){const raw=JSON.parse(await readFile(resolve(repository,'pixi/test/fixtures',fixture,'skeleton.json'),'utf8')),clips=Object.entries(raw.animations),clip=clips[0][0],duration=clips[0][1].duration;
 for(const time of [...new Set([0,.25,.5,.75,duration])].filter(t=>t<=duration))plan.push({fixture,clip,time,mode:'sample'});
 if(clips[1])plan.push({fixture,clip:clips[1][0],time:.5,mode:'second-clip'});
 for(const skin of raw.skins.map(s=>s.name).filter(n=>n!=='default'&&n!=='incompatible').slice(0,3))plan.push({fixture,clip,time:.5,skin,mode:'skin'});
 if(['meshes/weighted_complex','meshes/partial_ffd','meshes/trim_multi','clipping/ffd_alt','appearance/tint_grid','appearance/tint_mesh','multipage','trim'].includes(fixture))plan.push({fixture,clip,time:.5,opaque:true,mode:'opaque'});
}
for(const alpha of [.1,.37,.5,.73,.99])plan.push({fixture:'appearance/tint_mesh',clip:'clip',time:.5,alpha,mode:'root-alpha'});
for(const fixture of ['meshes/weighted_complex','clipping/ffd_alt'])plan.push({fixture,clip:'clip',time:.5,transform:{x:302,y:260,scale:1.7,rotation:.18},mode:'root-transform'});
const playback=[{name:'loop',steps:[{op:'play',clip:'rise'},{op:'update',dt:1.25}]},{name:'pause-resume',steps:[{op:'play',clip:'rise'},{op:'update',dt:.25},{op:'pause'},{op:'update',dt:.5},{op:'resume'},{op:'update',dt:.25}]},{name:'speed',steps:[{op:'play',clip:'rise'},{op:'speed',value:2},{op:'update',dt:.25}]},{name:'stop',steps:[{op:'play',clip:'rise'},{op:'update',dt:.5},{op:'stop'}]},... [0,.175,.35].map(t=>({name:'fade-'+t,steps:[{op:'play',clip:'rise'},{op:'update',dt:.25},{op:'fade',clip:'recover',duration:.35},{op:'update',dt:t}]}))];
for(const c of playback)plan.push({fixture:'playback',clip:'rise',time:0,mode:c.name,steps:c.steps});
plan.push({fixture:'appearance/skins',clip:'clip',time:.5,mode:'skin-cycle',skinSequence:['alternate','default','alternate','triangle','quad','default','alternate']});
if(plan.length>policy.maxScenarios)throw Error('Scenario budget exceeded');
await mkdir(output,{recursive:true});for(const d of ['pixi','phaser','diff','raw','logs','contact-sheets'])await mkdir(resolve(output,d),{recursive:true});
await writeFile(resolve(output,'thresholds.json'),JSON.stringify(policy,null,2));await writeFile(resolve(output,'plan.json'),JSON.stringify(plan,null,2));
const results=[],lifecycle=[],environment={policy,thresholdSha256:createHash('sha256').update(JSON.stringify(policy)).digest('hex'),headless:true,browserDownloaded:false,externalNetworkAllowed:false,logicalResourcesOnly:true};let browser,server;
try{const executable=process.env.ANKHIMATE_BROWSER_PATH??(existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'C:/Program Files/Google/Chrome/Application/chrome.exe':chromium.executablePath());if(!existsSync(executable))throw Error('Installed browser missing; no download allowed');server=await serve(undefined,4180);browser=await chromium.launch({headless:true,executablePath:executable});environment.browser=browser.version();environment.executable=executable;
 let current,page,scene,errors,warnings,missing,external;
 const close=async()=>{if(page){try{const state=await page.evaluate(()=>window.ankhimateParity?.dispose());lifecycle.push({fixture:current,...state,status:state?.pixiMeshes===0&&state?.phaserMeshes===0&&state?.phaserDestroyed?'PASS':'DIFFERENCE'});}catch(e){lifecycle.push({fixture:current,status:'BLOCKED',error:String(e)});}await page.close();page=undefined;}};
 for(const [index,c]of plan.entries()){
  const id=String(index).padStart(3,'0')+'-'+c.fixture.replaceAll('/','-')+'-'+c.mode+'-'+String(c.time).replace('.','_')+(c.skin?'-'+c.skin:'')+(c.alpha?'-a'+c.alpha:'');
  try{
   if(c.fixture!==current){await close();errors=[];warnings=[];missing=[];external=[];page=await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:1});await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith(server.url+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();external.push(url);return route.abort();});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});page.on('response',r=>{if(!r.ok())missing.push(`${r.status()} ${r.url()}`);});await page.goto(server.url+'/examples/phaser-pixi-parity/?headless=1');await page.waitForFunction(()=>window.ankhimateParity);scene=await page.evaluate(name=>window.ankhimateParity.load(name),c.fixture);current=c.fixture;
    for(const name of ['pixi','phaser']){const e=scene.environment[name];if(e.attributes.antialias!==false||e.dpr!==1||e.canvas.join()!=='640,520'||e.framebuffer.join()!=='640,520')throw Error('Mismatched framebuffer conditions');}environment.contexts??={};environment.contexts[current]=scene.environment;}
   const data=await page.evaluate(c=>{const api=window.ankhimateParity;api.background(!!c.opaque);api.transform({...c.transform,alpha:c.alpha??1});api.skin(c.skin??'default');api.sample(c.clip,c.time);let playback;if(c.steps)playback=api.playback(c.steps);let resourcesBefore;if(c.skinSequence){resourcesBefore=api.render().resources;for(let n=0;n<4;n++)for(const skin of c.skinSequence){api.skin(skin);api.render();}}
    return {...api.render(),playback,resourcesBefore};},c);
   const a=Buffer.from(data.pixi.rgba,'base64'),b=Buffer.from(data.phaser.rgba,'base64');if(data.pixi.width!==data.phaser.width||data.pixi.height!==data.phaser.height)throw Error('Dimension mismatch');for(const data of [a,b])for(let i=0;i<data.length;i+=4)if(data[i+3]===0&&(data[i]||data[i+1]||data[i+2]))throw Error('Invalid premultiplied clear: RGB present at alpha zero');const m=compare(a,b,data.pixi.width,data.pixi.height,!!c.opaque);
   if(errors.length||missing.length||external.length)m.status='BLOCKED';if(data.playback&&JSON.stringify(data.playback.pixi)!==JSON.stringify(data.playback.phaser))m.status='DIFFERENCE';if(data.playback&&JSON.stringify(data.playback.events.pixi)!==JSON.stringify(data.playback.events.phaser))m.status='DIFFERENCE';if(data.resourcesBefore&&JSON.stringify(data.resourcesBefore)!==JSON.stringify(data.resources))m.status='DIFFERENCE';
   await writeFile(resolve(output,'pixi',id+'.png'),png(m.width,m.height,a));await writeFile(resolve(output,'phaser',id+'.png'),png(m.width,m.height,b));await writeFile(resolve(output,'diff',id+'.png'),png(m.width,m.height,m.diff,false));await writeFile(resolve(output,'raw',id+'-pixi.rgba'),a);await writeFile(resolve(output,'raw',id+'-phaser.rgba'),b);delete m.diff;
   const row={id,...c,...m,resources:data.resources,resourcesBefore:data.resourcesBefore,playback:data.playback,errors:[...errors],warnings:[...warnings],missing:[...missing],external:[...external]};results.push(row);await writeFile(resolve(output,'logs',id+'.json'),JSON.stringify({errors,warnings,missing,external},null,2));console.log(`${m.status} ${id} different=${m.differentPixels} max=${m.maxChannelDifference} uniform=${m.uniformPixelsOutsideTolerance} major=${m.largeDifferencePixels}`);
  }catch(e){results.push({id,...c,status:'BLOCKED',error:String(e),errors:[...(errors??[])]});console.log('BLOCKED '+id+' '+e);}
  await writeFile(resolve(output,'metrics.json'),JSON.stringify({policy,results,lifecycle},null,2));await writeFile(resolve(output,'environment.json'),JSON.stringify(environment,null,2));
 }
 await close();
}catch(e){environment.blocked=String(e);console.log('BLOCKED '+e);}finally{await browser?.close();await server?.close();await writeFile(resolve(output,'metrics.json'),JSON.stringify({policy,results,lifecycle},null,2));await writeFile(resolve(output,'environment.json'),JSON.stringify(environment,null,2));}
console.log(JSON.stringify({planned:plan.length,executed:results.length,statuses:results.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{}),lifecycle}));
if(results.length!==plan.length||results.some(r=>r.status==='BLOCKED'||r.status==='DIFFERENCE')||lifecycle.some(r=>r.status!=='PASS'))process.exitCode=1;
