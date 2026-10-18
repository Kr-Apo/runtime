import { Application } from 'pixi.js';
import { loadPixiRig } from '@ankhimate/pixi-runtime';
const status=document.querySelector('#status');
let app,asset,left,right;const events=[];
try{
  app=new Application();await app.init({preference:'webgl',width:900,height:420,resolution:1,backgroundColor:0,backgroundAlpha:0,autoStart:false});
  document.querySelector('#view').append(app.canvas);
  asset=await loadPixiRig(new URL('/pixi/test/fixtures/playback/skeleton.json',location.href));
  left=asset.createInstance();right=asset.createInstance();
  for(const [instance,x] of [[left,240],[right,660]]){instance.root.position.set(x,210);instance.root.scale.set(3);app.stage.addChild(instance.root);}
  const p=left.playback,q=right.playback;const options=()=>({loop:document.querySelector('#loop').checked});
  p.onEvent(e=>{events.push({...e});if(events.length>20)events.shift();document.querySelector('#events').textContent=`Événements gauche : ${events.map(e=>e.name).join(' → ')}`;});
  p.play('rise');q.play('recover',{loop:true});q.speed=.5;
  document.querySelector('#rise').onclick=()=>p.play('rise',options());
  document.querySelector('#recover').onclick=()=>p.play('recover',options());
  document.querySelector('#fade').onclick=()=>p.crossFade('recover',1,options());
  document.querySelector('#pause').onclick=()=>p.pause();document.querySelector('#resume').onclick=()=>p.resume();document.querySelector('#stop').onclick=()=>p.stop();
  document.querySelector('#speed').onchange=e=>{const v=Number(e.target.value);if(Number.isFinite(v)&&v>0)p.speed=v;else e.target.value=String(p.speed);};
  // This example owns the clock. The adapter registers no automatic/global ticker.
  app.ticker.add(ticker=>{p.update(ticker.deltaMS/1000);q.update(ticker.deltaMS/1000);status.textContent=`Gauche : ${p.animation??'setup'} · ${p.time.toFixed(3)} s · ×${p.speed} · ${p.playing?'lecture':'pause'} | Droite : ${q.time.toFixed(3)} s · ×${q.speed}`;});
  window.pixiPlaybackExample={ready:true,app,asset,left,right,events};app.start();
}catch(error){status.textContent=`Chargement impossible : ${error.message}`;window.pixiPlaybackExample={ready:false,error:String(error)};}
window.addEventListener('pagehide',()=>{app?.stop();left?.destroy();right?.destroy();asset?.destroy();app?.destroy(true);},{once:true});
