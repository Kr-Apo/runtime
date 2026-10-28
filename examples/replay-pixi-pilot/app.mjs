import {Application,VERSION} from 'pixi.js';
import {PilotAsset} from './view.mjs';
import {PilotController} from './contract.mjs';
import {ReplayHostTimeBridge} from '@ankhimate/runtime/experimental-host-time';
const diagnostic=document.querySelector('#diagnostic'),json=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v,2);
const app=new Application();
await app.init({preference:'webgl',width:900,height:520,resolution:1,antialias:false,autoStart:false,backgroundColor:0x28323d,preserveDrawingBuffer:true});app.stop();document.querySelector('#view').append(app.canvas);
if(!(app.renderer.gl instanceof WebGL2RenderingContext))throw Error('Pilot requires real WebGL2');
const asset=await PilotAsset.load(new URL('./assets/skeleton.json',import.meta.url));
let actors=[],renders=0,liveLoop=0,disposed=false;
const stats={snapshots:0,presentations:0};
function applyCaptured(actor,capture){if(capture.kind==='pure-preview')actor.view.presentPreview(capture);else actor.view.present(capture);actor.last=capture;}
function present(actor){const capture=actor.controller.capture();stats.snapshots++;applyCaptured(actor,capture);stats.presentations++;actor.last=capture;return capture;}
function describe(){diagnostic.textContent=json({mode:'EXPERIMENTAL â€” controlled host time',pixi:VERSION,renders,actors:actors.map(a=>({kind:a.last?.kind,...a.controller.frame,bones:undefined,records:undefined,displayedTick:a.last?.kind==='pure-preview'?a.last.snapshot.tick:a.last?.snapshot.poseTick,displayStatus:a.controller.frame.health==='faulted'?'faulted':a.last?.kind==='pure-preview'?'pure-preview':a.controller.frame.backlog>0n?'catching-up':'committed',mode:a.mode,host:a.host?.observe()??null,live:a.live,hostError:a.hostError??null,solverError:a.solverError??null,presentationError:a.presentationError??null})),allocations:{...stats,note:'snapshot calls, not total allocations/GC'}});}
function draw(){if(disposed)throw Error('pilot disposed');app.render();renders++;}
function setActors(count){
 if(!Number.isInteger(count)||count<1||count>25)throw Error('pilot limit1..25');
 for(const a of actors){a.host?.dispose();a.controller.dispose();a.view.dispose();}actors=[];
 for(let i=0;i<count;i++){
  const view=asset.createInstance({clip:'sway'}),controller=new PilotController(view,'sway');
  const cols=count===1?1:count===2?2:5,rows=Math.ceil(count/cols),cellW=900/cols,cellH=520/rows;
  view.root.position.set((i%cols+.5)*cellW,(Math.floor(i/cols)+.65)*cellH);view.root.scale.set(count<=2?1.8:count<=10?.9:.5);app.stage.addChild(view.root);
  const a={view,controller,host:null,mode:'exact',live:false,resumeLive:false,last:null};actors.push(a);present(a);
 }draw();describe();
}
function dropHost(a){a.host?.dispose();a.host=null;a.mode='exact';}
function startHost(a,now,live=false){dropHost(a);a.controller.stop();a.controller.play();a.host=new ReplayHostTimeBridge(a.view.consumer,now);a.mode='host';a.live=live;a.resumeLive=false;a.hostError=null;a.solverError=null;a.presentationError=null;}
function command(index,name,value){
 const a=actors[index];if(!a)throw Error('missing actor');const c=a.controller;
 if(name==='live')startHost(a,performance.now(),true);
 else if(name==='host-start')startHost(a,value);
 else if(name==='host-advance'){try{const p=a.host.advance(value);a.hostError=null;if(p.progress?.stop.kind==='failed')a.solverError=String(p.progress.stop.error);}catch(error){a.hostError=String(error);describe();throw error;}}
 else if(name==='host-pause')a.host.pause(value);
 else if(name==='host-resume')a.host.resume(value);
 else if(name==='pause'){a.resumeLive=a.live;if(a.host)a.host.pause(performance.now());else c.pause();a.live=false;}
 else if(name==='resume'){if(a.host)a.host.resume(performance.now());else c.resume();if(a.resumeLive)a.live=true;}
 else if(name==='stop'){a.live=false;a.resumeLive=false;dropHost(a);c.stop();}
 else if(name==='reset'){a.live=false;a.resumeLive=false;dropHost(a);c.reset();}
 else {a.live=false;a.resumeLive=false;if(name!=='pump')dropHost(a);
  if(name==='play')c.play();
  else if(name==='request')c.request(BigInt(value));
  else if(name==='pump')c.pump(value??8);
  else if(name==='seek')c.seek(BigInt(value));
  else if(name==='replay')c.replay(BigInt(value));
  else if(name==='hitch')c.request(c.frame.requested+60n);
  else if(name==='fault')c.request(c.frame.requested+1n,()=>{throw Error('intentional precommit audit fault');});
  else throw Error('unknown command');
 }present(a);draw();describe();return a.controller.frame;
}
function pumpAll(index){const a=actors[index];while(a.controller.frame.backlog>0n)a.controller.pump(128);present(a);draw();describe();}
function animate(){
 if(disposed)return;
 // Use the same clock read as start/pause/resume, not a frame-start timestamp.
 const now=performance.now();
 let changed=false,diagnostics=false;
 for(const a of actors)if(a.live){
  let progress;
  try{
   progress=a.host.advance(now).progress;
  }catch(error){a.live=false;a.hostError=String(error);diagnostics=true;continue;}
  if(progress?.stop.kind==='failed'){a.live=false;a.solverError=String(progress.stop.error);}
  try{present(a);changed=true;}
  catch(error){a.live=false;a.presentationError=String(error);}
  diagnostics=true;
 }
 if(changed){try{draw();}catch(error){for(const a of actors){a.live=false;a.presentationError='Renderer: '+String(error);}diagnostics=true;}}
 if(diagnostics)describe();liveLoop=requestAnimationFrame(animate);
}
setActors(2);liveLoop=requestAnimationFrame(animate);
for(const button of document.querySelectorAll('button'))button.onclick=()=>{
 try{const index=Number(document.querySelector('#target').value),tick=BigInt(document.querySelector('#tick').value);if(button.id==='redraw'){draw();describe();}else command(index,button.id,button.id==='pump'?8:tick);}
 catch(error){diagnostic.textContent+='\nCOMMAND REFUSED: '+String(error);}
};
function replaceClip(index,clip){const a=actors[index],position=a.view.root.position.clone(),scale=a.view.root.scale.clone();a.live=false;dropHost(a);a.controller.dispose();a.view.dispose();a.view=asset.createInstance({clip});a.controller=new PilotController(a.view,clip);a.view.root.position.copyFrom(position);a.view.root.scale.copyFrom(scale);app.stage.addChild(a.view.root);present(a);draw();}
window.pilotHarness={app,asset,replaceClip,applyCaptured,get actors(){return actors;},setActors,command,pumpAll,present,draw,stats,version:VERSION,get renders(){return renders;},
 dispose(){if(disposed)return;cancelAnimationFrame(liveLoop);for(const a of actors){a.host?.dispose();a.controller.dispose();a.view.dispose();}actors=[];asset.destroy();app.destroy();disposed=true;}
};
