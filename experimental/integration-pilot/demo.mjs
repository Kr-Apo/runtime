import {defaultPlacement} from './actor.mjs';

const engine=document.body.dataset.engine,manual=new URL(location.href).searchParams.has('manual');
const status=document.querySelector('#status'),metrics={loads:[],firstFrames:[],draws:[],destroy:[]};
const bootStart=performance.now();
let drawEngine,destroyEngine,createActor,loadAsset,stage,renderer,scene,game,gl;
const canvas=document.querySelector('canvas');
gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:true,stencil:true,depth:false});
if(!gl)throw Error('This pilot requires WebGL2');
if(engine==='pixi') {
    const {Application}=await import('pixi.js'),api=await import('./pixi.mjs'),app=new Application();
    await app.init({canvas,context:gl,preference:'webgl',preferWebGLVersion:2,width:640,height:480,resolution:1,antialias:false,autoStart:false,preserveDrawingBuffer:true,backgroundAlpha:0});app.stop();
    stage=app.stage;renderer=app.renderer;createActor=options=>api.createPixiActor({...options,renderer,stage});loadAsset=options=>api.loadPixiAsset(options);
    drawEngine=()=>{if(!app.renderer?.gl||gl.isContextLost())throw Error('Renderer destroyed or context lost');app.render();};
    destroyEngine=()=>app.destroy(false,{children:true});
} else {
    await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Scene boot timeout')),20000);
        game=new Phaser.Game({type:Phaser.WEBGL,canvas,context:gl,width:640,height:480,transparent:true,antialias:false,roundPixels:false,banner:false,audio:{noAudio:true},scene:{key:'application',create(){scene=this;clearTimeout(timer);resolve();}}});
    });game.loop.stop();
    const api=await import('./phaser.mjs');createActor=options=>api.createPhaserActor({...options,scene,audit:globalThis.__pilotAudit});loadAsset=options=>api.loadPhaserAsset({...options,game});
    drawEngine=()=>{if(game.pendingDestroy||game.renderer?.gl!==gl||game.renderer.contextLost||gl.isContextLost())throw Error('Game destroyed or context lost');game.renderer.preRender();game.scene.render(game.renderer);game.renderer.postRender();};
    destroyEngine=()=>{if(!game.renderer?.gl)return;game.destroy(true);if(game.pendingDestroy)game.step(performance.now(),0);};
}

metrics.engineInitializationMs=performance.now()-bootStart;
let actors=[],asset=null,animationFrame=0,running=false,closed=false,generation=0,loading=null;
const book=await(await fetch('/fixtures/catalog.json')).json();
function alive(){return actors.filter(a=>!a.resources().disposed);}
function stopLoop(){running=false;cancelAnimationFrame(animationFrame);animationFrame=0;}
function draw(){const start=performance.now();drawEngine();metrics.draws.push(performance.now()-start);if(metrics.draws.length>2048)metrics.draws.shift();}
function show(){status.textContent=alive().map((a,i)=>{const f=a.observe();return `Actor ${i+1}: ${f.completed}/${f.requested}, ${f.skin}, ${f.state}, backlog ${f.backlog}`;}).join('\n')||'No actors';}
function frame(now){
    if(!running||closed)return;
    // RAF's frame-start timestamp can precede an anchor created later in that frame.
    // Use the same absolute monotone clock as start/pause/resume, never a delta.
    now=performance.now();
    try{for(const actor of alive()){actor.update(now);actor.present();}draw();show();
        if(alive().every(a=>a.observe().state==='paused')){stopLoop();return;}
        animationFrame=requestAnimationFrame(frame);
    }catch(error){stopLoop();status.textContent=String(error);}
}
function loop(){if(running||closed)return;running=true;animationFrame=requestAnimationFrame(frame);}
function destroyActors(){for(const a of actors)a.destroy();actors=[];}
async function reload(kind='combined'){
    if(closed)throw Error('Application destroyed');const version=++generation;stopLoop();loading?.abort();const controller=new AbortController();loading=controller;
    destroyActors();asset?.destroy();asset=null;const start=performance.now();
    let next=null;
    try{
        next=await loadAsset({source:`/fixtures/${kind}/skeleton.json`,signal:controller.signal});
        if(closed||version!==generation){next.destroy();return;}
        asset=next;
        const events=book.primary.map(e=>({tick:BigInt(e.tick),skin:e.skin}));
        for(let i=0;i<2;i++)actors.push(createActor({asset,clip:'march',skinEvents:events,placement:{...defaultPlacement(),x:190+260*i,scaleX:.7,scaleY:.7}}));
        metrics.loads.push({kind,ms:performance.now()-start,sha256:asset.nativeSHA256});
        const first=performance.now();for(const a of actors)a.present();draw();metrics.firstFrames.push(performance.now()-first);show();
        if(!manual){const now=performance.now();for(const a of actors)a.startRealtime(now);loop();}
    }catch(error){if(next&&next!==asset)next.destroy();if(version===generation){destroyActors();asset?.destroy();asset=null;status.textContent=`Load failed: ${error}`;}throw error;}
}
function shutdown(){
    if(closed)return;closed=true;generation++;loading?.abort();stopLoop();const start=performance.now();destroyActors();asset?.destroy();asset=null;destroyEngine();metrics.destroy.push(performance.now()-start);show();
}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stopLoop();status.textContent='Context lost: numeric state retained. Resume only after restoration.';});
canvas.addEventListener('webglcontextrestored',()=>{if(!closed){try{for(const a of alive())a.present();draw();show();}catch(error){status.textContent=String(error);}}});
window.addEventListener('pagehide',shutdown,{once:true});
document.querySelector('#pause').onclick=()=>{try{const now=performance.now();stopLoop();for(const a of alive())a.pause(now);show();}catch(e){status.textContent=String(e);}};
document.querySelector('#resume').onclick=()=>{try{const now=performance.now();for(const a of alive())a.resume(now);if(!manual)loop();show();}catch(e){status.textContent=String(e);}};
document.querySelector('#run').onclick=()=>{try{const now=performance.now();for(const a of alive())a.startRealtime(now);loop();}catch(e){status.textContent=String(e);}};
document.querySelector('#tick').onclick=()=>{try{for(const a of alive()){if(a.observe().state==='stopped')a.play();const target=Number(a.observe().requested)+1;a.advanceToTick(target);a.present();}draw();show();}catch(e){status.textContent=String(e);}};
document.querySelector('#reload').onclick=()=>reload(document.querySelector('#fixture').value).catch(e=>status.textContent=String(e));
document.querySelector('#destroy').onclick=shutdown;
globalThis.Pilot={engine,gl,canvas,game,scene,manual,metrics,stopLoop,draw,reload,shutdown,
    get actors(){return [...actors];},get asset(){return asset;},
    loadAsset,createActor,resources(){return{closed,actors:actors.map(a=>a.resources()),asset:asset?.resources()??null,metrics};}};
await reload(new URL(location.href).searchParams.get('fixture')??'combined');
metrics.applicationReadyMs=performance.now()-bootStart;
document.body.dataset.ready='true';
