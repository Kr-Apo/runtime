import {Application} from 'pixi.js';
import {loadPixiRig} from '@ankhimate/pixi-runtime';
import {PhaserRig,parseRig} from '@ankhimate/phaser-runtime';
const $=id=>document.getElementById(id);
const deterministic = new URL(location.href).searchParams.has('headless');
const fixtures=['clipping/ffd_alt','clipping/tint_mesh','clipping/replacement','meshes/partial_ffd','meshes/weighted_complex','meshes/ffd_bezier','meshes/trim_multi','meshes/topology','appearance/skins','appearance/tint_grid','appearance/tint_mesh','multipage','trim','tagged','playback'];
for(const name of fixtures)$('fixture').add(new Option(name,name));
let asset,pixi,app,game,phaser,raw,playing=false,loading=false,eventLines=[],controller;
const show=e=>{$('error').textContent=String(e?.message??e);playing=false;};
function dispose(){playing=false;controller?.abort();controller=undefined;phaser?.destroy();phaser=undefined;if(game){game.destroy(true);if(deterministic)game.step(0,0);}game=undefined;pixi?.destroy();pixi=undefined;asset?.destroy();asset=undefined;app?.destroy(true);app=undefined;$('status').textContent='Destroyed; textures owned by each engine have been released.';}
const options=(id,names,value)=>{$(id).replaceChildren(...names.map(n=>new Option(n,n)));$(id).value=value;};
function events(who,event){eventLines.push(`${who} Â· ${event.time}s Â· ${event.name} Â· ${event.string??''}`);$('events').textContent=eventLines.slice(-12).join('\n')||'Events: none';}
function status(){if(!phaser)return;$('status').textContent=`${$('fixture').value}\nPixi ${pixi.playback.animation??'direct/setup'} ${pixi.playback.time.toFixed(3)}s Â· Phaser ${phaser.playback.animation??'direct/setup'} ${phaser.playback.time.toFixed(3)}s\nSkin ${phaser.skinName} Â· ${phaser.unsupported.join('; ')||'No legacy extras requested (not a pixel certificate)'}`;}
function sample(time){if(!phaser)return;const clip=$('clip').value,duration=raw.animations[clip].duration;if(!Number.isFinite(time)||time<0||time>duration)throw Error(`Sample must be in [0,${duration}]`);playing=false;phaser.setTime(clip,time);pixi.setTime(clip,time);$('time').value=String(time);status();}
async function load(){if(loading)return;loading=true;$('load').disabled=true;$('destroy').disabled=true;$('error').textContent='';dispose();controller=new AbortController();const signal=controller.signal;eventLines=[];$('events').textContent='Events: none';
 try{
  const url=new URL(`/pixi/test/fixtures/${$('fixture').value}/skeleton.json`,location.href);const response=await fetch(url,{signal});if(!response.ok)throw Error(`Native JSON HTTP ${response.status}`);raw=parseRig(await response.json());
  asset=await loadPixiRig(url,{signal});pixi=asset.createInstance();app=new Application();await app.init({width:640,height:520,preference:'webgl',backgroundAlpha:0,antialias:!deterministic,resolution:1,autoStart:!deterministic,preserveDrawingBuffer:deterministic});signal.throwIfAborted();$('pixi').appendChild(app.canvas);app.stage.addChild(pixi.root);pixi.root.position.set(320,280);pixi.root.scale.set(2);pixi.playback.onEvent(e=>events('Pixi',e));
  const keys=raw.atlas.pages.map(p=>`parity-page-${p.index}`);let ready,fail;const started=new Promise((r,j)=>{ready=r;fail=j;});
  game=new Phaser.Game({type:Phaser.WEBGL,parent:'phaser',width:640,height:520,transparent:true,banner:false,audio:{noAudio:true},render:{antialias:true,antialiasGL:!deterministic,roundPixels:false,preserveDrawingBuffer:deterministic},scene:{
   preload(){this.load.on('loaderror',file=>fail(Error(`Phaser page failed: ${file.key}`)));raw.atlas.pages.forEach(p=>this.load.image(keys[p.index],new URL(p.file,url).href));},
   create(){try{signal.throwIfAborted();phaser=new PhaserRig(this,raw,{pageTextureKeys:keys});phaser.root.setPosition(320,280).setScale(2);phaser.playback.onEvent(e=>events('Phaser',e));ready();}catch(e){fail(e);}},
   update(_now,ms){if(!playing||!phaser)return;try{phaser.update(ms);pixi.playback.update(ms/1000);status();}catch(e){show(e);}}
  }});
  await started;if(deterministic){game.loop.stop();app.stop();}signal.throwIfAborted();options('clip',Object.keys(raw.animations),Object.keys(raw.animations)[0]);options('skin',raw.skins.map(s=>s.name),phaser.skinName);$('time').max=String(raw.animations[$('clip').value].duration);sample(0);
 }catch(e){dispose();show(e);}finally{loading=false;$('load').disabled=false;$('destroy').disabled=false;}
}
function safely(fn){return()=>{try{fn();}catch(e){show(e);}};}
$('load').onclick=load;$('destroy').onclick=()=>{dispose();$('error').textContent='';};
$('play').onclick=safely(()=>{if(!phaser)return;const speed=Number($('speed').value);phaser.playback.speed=speed;pixi.playback.speed=speed;phaser.playback.play($('clip').value);pixi.playback.play($('clip').value);playing=true;status();});
$('pause').onclick=safely(()=>{phaser?.playback.pause();pixi?.playback.pause();playing=false;status();});
$('resume').onclick=safely(()=>{phaser?.playback.resume();pixi?.playback.resume();playing=!!phaser?.playback.playing;status();});
$('stop').onclick=safely(()=>{phaser?.playback.stop();pixi?.playback.stop();playing=false;status();});
$('fade').onclick=safely(()=>{if(!phaser)return;const names=Object.keys(raw.animations);if(names.length<2)throw Error('This native fixture has only one clip');const next=names[(names.indexOf(phaser.playback.animation??$('clip').value)+1)%names.length];phaser.playback.crossFade(next,.35);pixi.playback.crossFade(next,.35);$('clip').value=next;playing=true;status();});
$('clip').onchange=safely(()=>{if(!phaser)return;$('time').max=String(raw.animations[$('clip').value].duration);sample(0);});
$('skin').onchange=safely(()=>{if(!phaser)return;const old=phaser.skinName;try{phaser.setSkin($('skin').value);pixi.setSkin($('skin').value);}catch(e){$('skin').value=old;throw e;}status();});
$('time').oninput=safely(()=>sample(Number($('time').value)));for(const button of document.querySelectorAll('[data-t]'))button.onclick=safely(()=>sample(Number(button.dataset.t)));
addEventListener('beforeunload',dispose);$('status').textContent='Choose a fixture and click Load / recreate. No model, network CDN or automatic scene comparison.';

// Deterministic test surface over this same bench: no extra renderer or source conversion.
if (deterministic) {
 const info = gl => {
  if(!gl || gl.isContextLost())throw Error('No active WebGL context');
  const ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {version:gl.getParameter(gl.VERSION),shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
   vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),
   renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
   attributes:gl.getContextAttributes(),framebuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],
   canvas:[gl.canvas.width,gl.canvas.height],dpr:devicePixelRatio};
 };
 const read = gl => {
  gl.finish();const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,raw=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,raw);const error=gl.getError();
  if(error!==gl.NO_ERROR)throw Error(`WebGL error ${error}`);
  const top=new Uint8Array(raw.length);for(let y=0;y<h;y++)top.set(raw.subarray((h-y-1)*w*4,(h-y)*w*4),y*w*4);
  let text='';for(let i=0;i<top.length;i+=32768)text+=String.fromCharCode(...top.subarray(i,i+32768));
  return {width:w,height:h,rgba:btoa(text)};
 };
 window.ankhimateParity={
  fixtures,
  async load(name){if(!fixtures.includes(name))throw Error('Unknown fixture');$('fixture').value=name;await load();if(!phaser)throw Error($('error').textContent||'Fixture failed');return {clips:raw.animations,skins:raw.skins.map(s=>s.name),environment:{pixi:info(app.renderer.gl),phaser:info(game.renderer.gl)}};},
  background(opaque){const color=0x28323d;app.renderer.background.color=opaque?color:0;app.renderer.background.alpha=opaque?1:0;phaser.root.scene.cameras.main.setBackgroundColor(opaque?color:'rgba(0,0,0,0)');},
  sample(clip,time){$('clip').value=clip;sample(time);},
  skin(name){phaser.setSkin(name);pixi.setSkin(name);},
  transform({x=320,y=280,scale=2,rotation=0,alpha=1}={}){phaser.root.setPosition(x,y).setScale(scale).setRotation(rotation).setAlpha(alpha);pixi.root.position.set(x,y);pixi.root.scale.set(scale);pixi.root.rotation=rotation;pixi.root.alpha=alpha;},
  playback(steps){const events={pixi:[],phaser:[]};const off=[pixi.playback.onEvent(e=>events.pixi.push(e)),phaser.playback.onEvent(e=>events.phaser.push(e))];try{for(const step of steps)for(const rig of [pixi,phaser]){const p=rig.playback;switch(step.op){case 'play':p.play(step.clip,{loop:step.loop??true});break;case 'update':p.update(step.dt);break;case 'pause':p.pause();break;case 'resume':p.resume();break;case 'speed':p.speed=step.value;break;case 'fade':p.crossFade(step.clip,step.duration);break;case 'stop':p.stop();break;default:throw Error('Unknown controlled playback operation');}}}finally{off.forEach(f=>f());}return {events,pixi:{time:pixi.playback.time,playing:pixi.playback.playing},phaser:{time:phaser.playback.time,playing:phaser.playback.playing}};},
  render(){app.render();game.step(0,0);return {pixi:read(app.renderer.gl),phaser:read(game.renderer.gl),resources:{pixiMeshes:pixi.root.children.length,phaserMeshes:phaser.root.list.length,phaserTextures:Object.keys(game.textures.list).length,phaserPrerenderListeners:phaser.root.scene.events.listenerCount('prerender')}};},
  dispose(){const meshes=[...pixi.root.children,...phaser.root.list];const pg=phaser.root.scene,baseline=pg.events.listenerCount('prerender');pixi.destroy();phaser.destroy();const after={pixiMeshes:pixi.root.children.length,phaserMeshes:phaser.root.list.length,prerenderBefore:baseline,prerenderAfter:pg.events.listenerCount('prerender'),phaserDestroyed:meshes.filter(m=>'scene'in m).every(m=>!m.scene)};dispose();return after;}
 };
}
