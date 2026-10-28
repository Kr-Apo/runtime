import * as Phaser from 'phaser';
import {ExperimentalReplayPhaserAsset} from '@ankhimate/phaser-runtime/experimental-replay';
import {ReplayHostTimeBridge} from '@ankhimate/runtime/experimental-host-time';
const fixture=new URL(location.href).searchParams.get('fixture')==='scaled'?'../../phaser/test/fixtures/t840c4/scaled/':'../replay-pixi-pilot/assets/';
const sourceUrl=new URL(fixture+'skeleton.json',import.meta.url),referenceUrl=new URL(fixture+'rust-reference.json',import.meta.url);
const canvas=document.createElement('canvas');canvas.width=900;canvas.height=520;
const context=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});if(!context)throw Error('WebGL2 required');
const diagnostic=document.querySelector('#diagnostic'),json=v=>JSON.stringify(v,(_,v)=>typeof v==='bigint'?String(v):v,2);
let scene,asset,actors=[],ready=0,disposed=false,loop=0;
function clearHost(a){a.host?.dispose();a.host=null;a.live=false;a.mode='exact';}
function present(a){if(a.disposed)return;const preview=a.view.capturePreview();try{a.last=preview?a.view.presentPreview(preview):a.view.present();a.presentationError=null;}catch(error){a.presentationError=String(error);throw error;}}
function describe(){diagnostic.textContent=json({experimental:true,phaser:Phaser.VERSION,actors:actors.map(a=>a.disposed?{disposed:true}:{mode:a.mode,...a.view.consumer.currentFrame(),bones:undefined,records:undefined,displayedTick:a.last?.kind==='pure-preview'?a.last.snapshot.tick:a.last?.snapshot.poseTick,presentation:a.last?.kind,time:a.host?.observe()??null,solverError:a.view.consumer.currentFrame().health==='faulted'?'Physics fault; reset required':null,presentationError:a.presentationError??null,commandError:a.error??null}),resources:asset?.resources});}
function setActors(count){
 if(!Number.isInteger(count)||count<1||count>25)throw Error('1..25 actors');
 for(const a of actors){clearHost(a);a.view.dispose();}actors=[];
 const cols=count===1?1:count===2?2:5,rows=Math.ceil(count/cols),cw=900/cols,ch=520/rows;
 for(let i=0;i<count;i++){const view=asset.createInstance(scene,{clip:'sway'});view.root.setPosition((i%cols+.5)*cw,(Math.floor(i/cols)+.65)*ch).setScale(count<=2?1.8:count<=10?.9:.5);actors.push({view,clip:'sway',host:null,mode:'exact',live:false,last:view.displayed,disposed:false});}
 describe();
}
function command(index,name,value,render=true){
 const a=actors[index];if(!a||a.disposed)throw Error('Missing/disposed actor');const c=a.view.consumer;
 try{
  if(name==='live'||name==='host-start'){clearHost(a);c.stop(c.context);c.play(c.context,a.clip,false);a.host=new ReplayHostTimeBridge(c,name==='live'?performance.now():value);a.mode='host';a.live=name==='live';}
  else if(name==='host-advance')a.host.advance(value);
  else if(name==='host-pause')a.host.pause(value);
  else if(name==='host-resume')a.host.resume(value);
  else if(name==='pause'){if(a.host){a.host.pause(performance.now());a.resumeLive=a.live;a.live=false;}else c.pause(c.context);}
  else if(name==='resume'){if(a.host){a.host.resume(performance.now());a.live=!!a.resumeLive;}else c.resume(c.context);}
  else if(name==='pump')c.pump(c.context,value??8);
  else if(name==='destroy'){clearHost(a);a.view.dispose();a.disposed=true;}
  else {clearHost(a);
   if(name==='play')c.play(c.context,a.clip,false);
   else if(name==='request')c.requestTick(c.context,BigInt(value));
   else if(name==='seek')c.seekTick(c.context,BigInt(value));
   else if(name==='replay')c.replayFromOrigin(c.context,BigInt(value));
   else if(name==='stop')c.stop(c.context);
   else if(name==='reset')c.reset(c.context,c.context.epoch+1n);
   else if(name==='fault')c.requestTick(c.context,c.currentFrame().requested+60n,()=>{throw Error('audit');});
   else throw Error('Unknown command');
  }
 }catch(error){a.error=String(error);describe();throw error;}
 if(render)draw();else describe();
}
function draw(){if(disposed)throw Error('Game disposed');try{game.step(performance.now(),0);}finally{describe();}}
function pumpAll(index){const c=actors[index].view.consumer;while(c.currentFrame().backlog)c.pump(c.context,128);}
function replaceClip(index,clip){const a=actors[index],p=[a.view.root.x,a.view.root.y],sx=a.view.root.scaleX,sy=a.view.root.scaleY;clearHost(a);a.view.dispose();a.view=asset.createInstance(scene,{clip});a.view.root.setPosition(...p).setScale(sx,sy);a.clip=clip;a.last=a.view.displayed;}
class Pilot extends Phaser.Scene {
 constructor(){super('Pilot');}
 async create(){
  try{scene=this;game.loop.stop();if(!asset)asset=await ExperimentalReplayPhaserAsset.load(game,sourceUrl);
   setActors(2);this.events.on('prerender',()=>{for(const a of actors)present(a);});ready++;
   this.events.once('shutdown',()=>{for(const a of actors)clearHost(a);});
   window.phaserHarness=h;describe();
  }catch(error){window.phaserBootError=String(error);diagnostic.textContent=String(error);}
 }
 update(){const now=performance.now();for(const a of actors)if(a.live&&!a.disposed){try{const p=a.host.advance(now);if(p.progress?.stop.kind==='failed'){a.live=false;a.error=String(p.progress.stop.error);}}catch(error){a.live=false;a.error=String(error);}}}
}
const game=new Phaser.Game({type:Phaser.WEBGL,canvas,context,width:900,height:520,parent:'view',banner:false,audio:{noAudio:true},backgroundColor:'#28323d',render:{antialias:false,roundPixels:false,preserveDrawingBuffer:true},scene:[Pilot]});
const h={game,get scene(){return scene;},get asset(){return asset;},get actors(){return actors;},get ready(){return ready;},referenceUrl:referenceUrl.href,sourceUrl:sourceUrl.href,setActors,command,draw,present,pumpAll,replaceClip,
 stopScene(){game.scene.stop('Pilot');game.step(performance.now(),0);},
 startScene(){game.scene.start('Pilot');game.step(performance.now(),0);},
 restart(){scene.scene.restart();game.step(performance.now(),0);},
 dispose(){if(disposed)return Promise.resolve();cancelAnimationFrame(loop);for(const a of actors)clearHost(a);disposed=true;return new Promise(resolve=>{game.events.once('destroy',()=>resolve());game.destroy(true);game.step(performance.now(),0);});}
};
function animate(){if(disposed)return;if(actors.some(a=>a.live)){try{draw();}catch(error){for(const a of actors)if(a.live){a.live=false;a.presentationError=String(error);}describe();}}loop=requestAnimationFrame(animate);}loop=requestAnimationFrame(animate);
for(const button of document.querySelectorAll('button'))button.onclick=()=>{try{if(button.id==='redraw')draw();else command(Number(document.querySelector('#target').value),button.id,button.id==='pump'?8:BigInt(document.querySelector('#tick').value));}catch(error){diagnostic.textContent+='\n'+String(error);}};
