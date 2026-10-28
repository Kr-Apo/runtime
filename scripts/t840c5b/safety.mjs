import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {serve} from '../web-server.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {png} from '../parity-pixels.mjs';
const out=resolve(process.argv[2]),root=resolve(process.argv[3]),baseline=process.argv[4]==='baseline';
await mkdir(out);const server=await serve(root),rows=[];let browser;
const cases=['valid-shared','cached-remove','cached-replace','second-page-remove','dimensions','pma','callback-remove','renderer-replace','context-replace','canvas-renderer','foreign-token','stale-token','old-epoch','disposed','scene-restart','game-destroy','multiple-games','initial-webgl1','initial-canvas','real-context-loss-restore'];
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.ANKHIMATE_BROWSER_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const name of cases){
  const page=await browser.newPage(),errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'){warnings.push(m.text());console.log(name+': '+m.text());}});
  await page.goto(server.url+'/examples/replay-character-acceptance/?engine=Phaser&character=courier');await page.waitForFunction(()=>window.acceptance);
  const result=await page.evaluate(async({name,baseline})=>{
   const h=window.acceptance,a=h.actors[0].view,c=a.consumer,game=h.game,manager=game.textures,token=a.capture(),before=c.currentFrame(),displayed=a.displayed;
   const stringify=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?String(x):x),initial=stringify(before),oldRenderer=game.renderer;let refused=false,error=null,extra={};
   const attempt=fn=>{try{fn();}catch(e){refused=true;error=String(e);}};
   if(name==='valid-shared'){h.setActors(2);h.command(0,'play',0,false);h.command(0,'request',60,false);h.actors[0].view.present();h.actors[1].view.present();extra={independent:h.actors[1].view.consumer.currentFrame().completed===0n,shared:h.actors[0].view.root.list[0].texture===h.actors[1].view.root.list[0].texture};}
   if(['cached-remove','cached-replace','second-page-remove','dimensions','pma','callback-remove'].includes(name)){
    const mesh=name==='second-page-remove'?a.root.list.find(m=>m.texture!==a.root.list[0].texture):a.root.list[0];if(!mesh)throw Error('Missing multipage test mesh');const texture=mesh.texture,key=texture.key,src=texture.source[0];
    if(name==='cached-replace'){const b=h.asset.createInstance(h.scene,{clip:h.clip}),other=b.capture();b.present(other);const image=src.image;manager.remove(key);manager.addImage(key,image);attempt(()=>a.present(token));let secondRefused=false;try{b.present(other);}catch{secondRefused=true;}extra.twoCachedOwnersRefused=refused&&secondRefused;b.dispose();if(!extra.twoCachedOwnersRefused)throw Error('Shared cached replacement accepted');}
    else if(name==='dimensions'){const w=src.width;src.width++;attempt(()=>a.present(token));src.width=w;}
    else if(name==='pma'){const old=src.glTexture.pma;src.glTexture.pma=false;attempt(()=>a.present(token));src.glTexture.pma=old;}
    else if(name==='callback-remove'){c.play(c.context,h.clip,false);c.requestTick(c.context,1n);const f=c.currentFrame(),present=c.present;c.present=function(cb){manager.remove(key);return present.call(this,cb);};attempt(()=>a.present());c.present=present;extra={numericsUnchanged:stringify(c.currentFrame())===stringify(f),completed:String(f.completed)};}
    else{manager.remove(key);attempt(()=>a.present(token));}
   }
   if(name==='renderer-replace'){game.renderer={...oldRenderer};attempt(()=>a.present(token));game.renderer=oldRenderer;}
   if(name==='context-replace'){const gl=oldRenderer.gl,other=document.createElement('canvas').getContext('webgl2');oldRenderer.gl=other;attempt(()=>a.present(token));oldRenderer.gl=gl;other.getExtension('WEBGL_lose_context')?.loseContext();}
   if(name==='canvas-renderer'){game.renderer={type:1};attempt(()=>a.present(token));game.renderer=oldRenderer;}
   if(name==='foreign-token'){const b=h.asset.createInstance(h.scene,{clip:h.clip});attempt(()=>b.present(token));b.dispose();}
   if(name==='stale-token'){c.play(c.context,h.clip,false);c.requestTick(c.context,1n);attempt(()=>a.present(token));}
   if(name==='old-epoch'){c.reset(c.context,c.context.epoch+1n);attempt(()=>a.present(token));}
   if(name==='disposed'){a.dispose();attempt(()=>a.present(token));}
   if(name==='scene-restart'){h.restart();extra={oldDisposed:c.transportStatus().state==='disposed',freshInstances:h.asset.resources.instances};}
   if(name==='game-destroy'){await h.dispose();attempt(()=>a.present(token));extra={resources:h.asset.resources};}
   if(['multiple-games','initial-webgl1','initial-canvas'].includes(name)){
    const Phaser=await import('phaser'),{ExperimentalReplayPhaserAsset:Asset}=await import('@ankhimate/phaser-runtime/experimental-replay'),canvas=document.createElement('canvas'),context=canvas.getContext(name==='initial-canvas'?'2d':name==='initial-webgl1'?'webgl':'webgl2');let second,scene;
    const ready=new Promise(resolve=>{class Other extends Phaser.Scene{create(){scene=this;second.loop.stop();resolve();}}second=new Phaser.Game({type:name==='initial-canvas'?Phaser.CANVAS:Phaser.WEBGL,canvas,context,width:64,height:64,banner:false,audio:{noAudio:true},scene:Other});});await ready;
    let asset;try{asset=await Asset.load(second,h.sourceUrl);}catch(e){refused=true;error=String(e);}if(name==='multiple-games'&&!asset)throw Error(error);if(asset){const view=asset.createInstance(scene,{clip:h.clip});extra={differentContext:second.renderer.gl!==h.gl,independentInstances:asset.resources.instances===1&&h.asset.resources.instances===1};view.dispose();asset.destroy();}second.destroy(true);second.step(performance.now(),0);a.present(token);
   }
   if(name==='real-context-loss-restore'){
    const gl=h.gl,ext=gl.getExtension('WEBGL_lose_context');if(!ext)throw Error('WEBGL_lose_context unavailable');
    const pixels=()=>{h.submit();const b=new Uint8Array(1000*650*4);gl.readPixels(0,0,1000,650,gl.RGBA,gl.UNSIGNED_BYTE,b);let s='';for(let i=0;i<b.length;i+=32768)s+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(s);};const prior=pixels();
    const event=name=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Native event timeout '+name)),10000);h.canvas.addEventListener(name,()=>{clearTimeout(t);resolve();},{once:true});});
    const lost=event('webglcontextlost');ext.loseContext();await lost;attempt(()=>a.present(token));const lostRefused=refused;let restoreQueries=0;const original=gl.getParameter.bind(gl);gl.getParameter=function(p){if(p===gl.VERSION)restoreQueries++;return original(p);};
    const restored=event('webglcontextrestored');await new Promise(r=>setTimeout(r,1000));ext.restoreContext();await restored;const engineRestoreQueries=restoreQueries;restoreQueries=0;a.present(token);h.submit();const validationRestoreQueries=restoreQueries;
    const after=pixels();gl.getParameter=original;extra={lostRefused,engineRestoreQueries,validationRestoreQueries,samePixels:prior===after,beforePixels:prior,afterPixels:after,numericsUnchanged:initial===stringify(c.currentFrame()),nativeLoss:true,nativeRestoration:true};
   }
   const mustRefuse=!['valid-shared','scene-restart','multiple-games'].includes(name);
   const knownBaselineIdentityGap=baseline&&['renderer-replace','context-replace'].includes(name);
   if(mustRefuse&&!refused&&!knownBaselineIdentityGap)throw Error('Unsafe acceptance '+name);
   if(name==='real-context-loss-restore'&&(!extra.lostRefused||!extra.samePixels||!extra.numericsUnchanged))throw Error('Context recovery mismatch');
   if(name==='real-context-loss-restore'&&!baseline&&extra.validationRestoreQueries!==1)throw Error('Restoration did not requalify exactly once');
   if(['cached-remove','cached-replace','second-page-remove','dimensions','pma','renderer-replace','context-replace','canvas-renderer','foreign-token'].includes(name)&&initial!==stringify(c.currentFrame()))throw Error('Graphics changed numerical state');
   if(name==='callback-remove'&&!extra.numericsUnchanged)throw Error('Callback error changed committed Physics');
   if(name==='valid-shared'&&(!extra.shared||!extra.independent))throw Error('Owner sharing broken');
   if(name==='scene-restart'&&(!extra.oldDisposed||extra.freshInstances!==1))throw Error('Scene lifetime broken');
   if(name==='multiple-games'&&(!extra.independentInstances||!extra.differentContext))throw Error('Game isolation broken');
   if(name!=='game-destroy')await h.dispose();return{refused,error,...extra,status:knownBaselineIdentityGap&&!refused?'BASELINE_IDENTITY_GAP':'PASS'};
  },{name,baseline});
  if(name==='real-context-loss-restore'){for(const key of ['beforePixels','afterPixels']){const bytes=Buffer.from(result[key],'base64');result[key+'SHA256']=createHash('sha256').update(bytes).digest('hex');const flipped=Buffer.alloc(bytes.length);for(let y=0;y<650;y++)bytes.copy(flipped,(649-y)*4000,y*4000,(y+1)*4000);await writeFile(resolve(out,key+'.png'),png(1000,650,flipped));await writeFile(resolve(out,key+'.rgba'),bytes);delete result[key];}}
  if(name!=='real-context-loss-restore'){assert.deepEqual(warnings,[]);assert.deepEqual(errors,[]);}else{assert.ok(errors.every(e=>/requires WebGL2|context is lost/.test(e)),JSON.stringify(errors));result.expectedLostContextRefusals=errors.length;}rows.push({name,...result,errors,warnings});await page.close();await writeFile(resolve(out,'results.json'),JSON.stringify({browser:browser.version(),baseline,rows},null,2));console.log(name+' '+result.status);
 }
}finally{await writeFile(resolve(out,'results.json'),JSON.stringify({browser:browser?.version(),baseline,rows},null,2));await browser?.close();await server.close();}
