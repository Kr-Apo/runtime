import { Application } from 'pixi.js';
import { loadPixiRig } from '@ankhimate/pixi-runtime';

const status=document.querySelector('#status');
let asset,app,left,right;
try {
  app=new Application();
  await app.init({preference:'webgl',width:900,height:600,resolution:1,backgroundAlpha:0,autoStart:false});
  app.stop();document.querySelector('#view').append(app.canvas);
  asset=await loadPixiRig(new URL('/pixi/test/fixtures/tagged/skeleton.json',location.href));
  left=asset.createInstance();right=asset.createInstance();
  left.root.position.set(240,300);right.root.position.set(660,300);
  left.root.scale.set(.8);right.root.scale.set(.8);
  app.stage.addChild(left.root,right.root);
  const update=()=>{
    for(const [id,instance] of [['left',left],['right',right]]) {
      const time=Number(document.querySelector(`#${id}`).value);
      instance.setTime('animation_1',time);
      document.querySelector(`#${id}-time`).textContent=`${time.toFixed(3)} s`;
    }
    app.render();
  };
  document.querySelectorAll('input').forEach(input=>input.addEventListener('input',update));
  update();
  status.textContent='Deux instances, atlas partagé, poses distinctes. WebGL actif.';
  window.pixiRegionExample={ready:true,app,left,right,asset};
}catch(error){status.textContent=`Chargement impossible : ${error.message}`;window.pixiRegionExample={ready:false,error:String(error)};}
window.addEventListener('pagehide',()=>{
  left?.destroy();right?.destroy();asset?.destroy();app?.destroy(true);
},{once:true});
