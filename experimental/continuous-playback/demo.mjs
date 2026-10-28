import {defaultPlacement} from './actor.mjs';

const crossfade=document.body.dataset.crossfade==='true',interruptible=document.body.dataset.interruptible==='true';
const linkedMeshes=document.body.dataset.linkedMeshes==='true';
const clipping=document.body.dataset.clipping==='true';
const weightedFfd=document.body.dataset.weightedFfd==='true',animatedSlots=document.body.dataset.animatedSlots==='true', animationEvents=document.body.dataset.animationEvents==='true', apiRoot=document.body.dataset.integratedCombat==='true'?(interruptible?'../integrated-interruptions/':'../integrated-combat/'):document.body.dataset.ffdCrossfade==='true'?(interruptible?'../ffd-interruptions/':'../ffd-crossfade/'):document.body.dataset.eventCrossfade==='true'?(interruptible?'../event-interruptions/':'../events-crossfade/'):document.body.dataset.slotCrossfade==='true'?(interruptible?'../slot-interruptions/':'../slot-crossfade/'):interruptible?'../interruptions/':crossfade?'../crossfade/':linkedMeshes?(weightedFfd?'../linked-ffd/':'../linked-meshes/'):weightedFfd&&animatedSlots?'../composed-ffd/':clipping?'../replay-clipping/':animatedSlots&&animationEvents?'../slots-events/':animationEvents?'../replay-events/':weightedFfd?'../weighted-ffd/':animatedSlots?'../animated-slots/':'./';
const engine=document.body.dataset.engine,manual=new URL(location.href).searchParams.has('manual');
const status=document.querySelector('#status'),metrics={loads:[],firstFrames:[],draws:[],destroy:[]};
const bootStart=performance.now();
let drawEngine,destroyEngine,createActor,loadAsset,stage,renderer,scene,game,gl;
const canvas=document.querySelector('canvas');
gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:true,stencil:true,depth:false});
if(!gl)throw Error('This pilot requires WebGL2');
if(engine==='pixi') {
    const {Application}=await import('pixi.js'),api=await import(apiRoot+'pixi.mjs'),app=new Application();
    await app.init({canvas,context:gl,preference:'webgl',preferWebGLVersion:2,width:640,height:480,resolution:1,antialias:false,autoStart:false,preserveDrawingBuffer:true,backgroundAlpha:0});app.stop();
    stage=app.stage;renderer=app.renderer;createActor=options=>api.createPixiActor({...options,renderer,stage,...(weightedFfd&&animatedSlots?{clipping}:{})});loadAsset=options=>api.loadPixiAsset({...options,...(weightedFfd&&animatedSlots?{clipping}:{})});
    drawEngine=()=>{if(!app.renderer?.gl||gl.isContextLost())throw Error('Renderer destroyed or context lost');app.render();};
    destroyEngine=()=>app.destroy(false,{children:true});
} else {
    await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Scene boot timeout')),20000);
        game=new Phaser.Game({type:Phaser.WEBGL,canvas,context:gl,width:640,height:480,transparent:true,antialias:false,roundPixels:false,banner:false,audio:{noAudio:true},scene:{key:'application',create(){scene=this;clearTimeout(timer);resolve();}}});
    });game.loop.stop();
    const api=await import(apiRoot+'phaser.mjs');createActor=options=>api.createPhaserActor({...options,scene,audit:globalThis.__pilotAudit,...(weightedFfd&&animatedSlots?{clipping}:{})});loadAsset=options=>api.loadPhaserAsset({...options,game,...(weightedFfd&&animatedSlots?{clipping}:{})});
    drawEngine=()=>{if(game.pendingDestroy||game.renderer?.gl!==gl||game.renderer.contextLost||gl.isContextLost())throw Error('Game destroyed or context lost');game.renderer.preRender();game.scene.render(game.renderer);game.renderer.postRender();};
    destroyEngine=()=>{if(!game.renderer?.gl)return;game.destroy(true);if(game.pendingDestroy)game.step(performance.now(),0);};
}

metrics.engineInitializationMs=performance.now()-bootStart;
let eventCount=0,eventLog=[],impactCount=0;
function receiveEvents(){if(!animationEvents)return;for(const actor of alive())for(const e of actor.drainEvents()){eventCount++;eventLog.push(e);if(eventLog.length>128)eventLog.shift();if(document.body.dataset.eventCrossfade!=='true'&&e.event.name==='impact'){impactCount++;const el=document.querySelector('#impact');el.textContent='IMPACT '+impactCount;el.animate([{background:'#ffd04d',color:'#101820'},{background:'#18212a',color:'#eef'}],{duration:450});}}}
let actors=[],asset=null,recipe=null,animationFrame=0,running=false,closed=false,generation=0,loading=null,userPaused=false,autoResume=false;
const reasons=new Set();
metrics.suspensions=[];metrics.frames={count:0,totalMs:0,maxMs:0,maxBacklog:'0'};
function log(item){metrics.suspensions.push(item);if(metrics.suspensions.length>256)metrics.suspensions.shift();}
function alive(){return actors.filter(a=>!a.resources().disposed);}
function stopLoop(){running=false;cancelAnimationFrame(animationFrame);animationFrame=0;}
function draw(){const start=performance.now();drawEngine();metrics.draws.push(performance.now()-start);if(metrics.draws.length>2048)metrics.draws.shift();}
function show(){if(document.body.dataset.eventCrossfade==='true'){const el=document.querySelector('#event-log');if(el)el.textContent=eventLog.map(e=>`${e.actorId} epoch${e.epoch} tick${e.tick} owner${e.clip}@${e.clipTick} key${e.keyIndex} #${e.ordinal} ${e.event.name} | eye=${e.slotState?.slots.find(s=>s.name==='eye_left')?.attachment} weight=${e.mixing?.transition?.weight??'-'} | ${JSON.stringify(e.event)}`).join('\n');}const last=eventLog.at(-1),association=last?.slotState?.slots.find(s=>s.name===last.event.string);status.textContent=(animationEvents?`Events ${eventCount}; last ${eventLog.at(-1)?.event.name??'none'} at tick ${eventLog.at(-1)?.tick??'-'}; pending ${alive().map(a=>a.eventStatus().pending).join(',')}${association?`; app slot ${association.name}, attachment ${String(association.attachment)} at event tick ${last.tick}`:''}\n`:'')+alive().map((a,i)=>{const f=a.observe();const linkedInfo=linkedMeshes?a.snapshot().selection.attachments.filter(d=>d.geometryOwner).map(d=>d.slot+'/'+d.name+' → '+d.geometryOwner.skin+'/'+d.geometryOwner.slot+'/'+d.geometryOwner.attachment+'; FFD '+(d.deformationOwner?d.deformationOwner.slot+'/'+d.deformationOwner.attachment:'none')+'; timeline '+(d.timelineOwner?d.timelineOwner.attachment:'rest')+'; texture '+d.texture).join(' | '):'';const masks=clipping&&!gl.isContextLost()&&!(engine==='phaser'&&game.renderer.contextLost)?a.inspect().view.masks:[];return (linkedMeshes?'Linked ownership: '+linkedInfo+'\n':'')+(clipping?`Masks: ${masks.map(m=>m.action==='activate'?m.slot+' → '+String(m.endSlot):m.slot+':'+m.action+(m.endInclusive?' (end inclusive)':'')).join('; ')}\n`:'')+(f.mixing?`Mix ${f.mixing.transition?.from??f.mixing.activeClip} → ${f.mixing.transition?.to??'-'}; duration ${f.mixing.transition?.durationTicks??0n} ticks; weight ${f.mixing.transition?.weight??0}; status ${f.mixing.transition?.status??'playing'}; source ${f.mixing.transition?.source?'frozen@'+f.mixing.transition.source.tick:'live'}; journal ${a.transitionStatus().commands}/${a.transitionStatus().capacity}; pending ${a.transitionStatus().pending?.to??'none'}\n`:'')+`Actor ${i+1}: tick ${f.completed}/${f.requested}, clip ${f.clip}, skin ${f.skin}, Physics ${f.health}${f.deformation?`, FFD tick ${f.deformation.tick}, target ${f.deformation.entries.map(e=>e.owner+'/'+e.slot+'/'+e.attachment).join(',')}, max offset ${Math.max(...f.deformation.entries.flatMap(e=>e.offsets.map(Math.abs))).toFixed(3)}`:''}, ${f.slotState?`order ${f.slotState.drawOrder.join(' > ')}; attachments ${f.slotState.slots.map(s=>s.name+'='+String(s.attachment)+(s.visible?'':' (hidden)')).join(' ')}; `:''}${f.state}, backlog ${f.backlog}, epoch ${f.epoch}`;}).join('\n')+`\nPolicy: pause while hidden/frozen/context lost. Suspensions: ${[...reasons].join(',')||'none'}. Calendar: ${recipe?.calendarSource??'none'}`;}
function frame(){
    if(!running||closed)return;
    const now=performance.now(),start=now;
    try{
        for(const actor of alive()){actor.update(now);receiveEvents();actor.present();const b=actor.observe().backlog;if(b>BigInt(metrics.frames.maxBacklog))metrics.frames.maxBacklog=String(b);}
        draw();show();const ms=performance.now()-start;metrics.frames.count++;metrics.frames.totalMs+=ms;metrics.frames.maxMs=Math.max(ms,metrics.frames.maxMs);
        animationFrame=requestAnimationFrame(frame);
    }catch(error){
        // GL loss can stop drawing before its asynchronous DOM event is delivered.
        // Pause owned clocks now; a stopped RAF flag alone does not pause time.
        if(gl.isContextLost())suspend('context-lost');
        else{
            userPaused=true;stopLoop();let pauseRefused=false;const failedAt=performance.now();
            for(const a of alive()){const f=a.observe();if(a.resources().mode==='realtime'&&f.state==='playing'&&f.health==='healthy'){try{a.pause(failedAt);}catch{pauseRefused=true;}}}
            // At the native sampling bound even pause(now) may reject. Preserve the
            // accepted state, stop RAF and surface the original error; never clamp/reset.
            status.textContent=String(error)+(pauseRefused?' — clock pause refused; reload required':'');return;
        }
        status.textContent=String(error);
    }
}
function loop(){if(running||closed||userPaused||reasons.size)return;running=true;animationFrame=requestAnimationFrame(frame);}
function suspend(reason){
    if(closed||reasons.has(reason))return;
    reasons.add(reason);const now=performance.now();
    const playing=alive().filter(a=>a.resources().mode==='realtime'&&a.observe().state==='playing');
    if(playing.length){for(const a of playing)a.pause(now);autoResume=true;}
    receiveEvents();stopLoop();log({kind:'suspend',reason,now,ticks:alive().map(a=>String(a.observe().completed))});show();
}
function restore(reason){
    if(closed||!reasons.delete(reason))return;
    const now=performance.now();log({kind:'restore',reason,now,ticks:alive().map(a=>String(a.observe().completed))});
    if(!reasons.size&&autoResume&&!userPaused){for(const a of alive())if(a.resources().mode==='realtime'&&a.observe().state==='paused')a.resume(now);autoResume=false;loop();}show();
}
function destroyActors(){for(const a of actors)a.destroy();actors=[];}
async function reload(kind=linkedMeshes?'linked_frog':weightedFfd&&animatedSlots?'morphing_frog':clipping?'masked_frog':animatedSlots&&animationEvents?'signal_costume':weightedFfd?'impact':animatedSlots?'costume':animationEvents?'signals':'combined',calendar='primary'){
    if(closed)throw Error('Application destroyed');const version=++generation;stopLoop();loading?.abort();const controller=new AbortController();loading=controller;
    destroyActors();eventCount=0;impactCount=0;eventLog=[];asset?.destroy();asset=null;recipe=null;userPaused=false;autoResume=false;const start=performance.now();
    let next=null;
    try{
        const{loadIntegrationManifest}=await import('./manifest.mjs');
        const path=calendar==='fixed'?'fixed.json':'integration.json';
        next=await loadIntegrationManifest({source:`/fixtures/${kind}/${path}`,signal:controller.signal,loadAsset});
        if(closed||version!==generation){next.asset.destroy();return;}
        recipe=next;asset=next.asset;
        const count=Number(new URL(location.href).searchParams.get('actors')??(animatedSlots||animationEvents?1:2));
        if(![1,2].includes(count))throw Error('Demo supports one or two actors');
        for(let i=0;i<count;i++)actors.push(createActor({asset,clip:recipe.clip,skinEvents:recipe.skinEvents,placement:{...defaultPlacement(),x:count===1?300:190+260*i,...(animatedSlots||animationEvents?{y:280}:{}),scaleX:animatedSlots||animationEvents?(count===1?2.5:1.5):count===1?.9:.7,scaleY:animatedSlots||animationEvents?(count===1?2.5:1.5):count===1?.9:.7}}));
        metrics.loads.push({kind,calendar,ms:performance.now()-start,sha256:asset.nativeSHA256,looping:recipe.looping});if(metrics.loads.length>64)metrics.loads.shift();
        const first=performance.now();for(const a of actors)a.present();draw();metrics.firstFrames.push(performance.now()-first);if(metrics.firstFrames.length>64)metrics.firstFrames.shift();show();
        if(!manual){const now=performance.now();for(const a of actors)a.startRealtime(now);if(reasons.size||document.hidden){for(const a of actors)a.pause(now);autoResume=true;if(document.hidden)reasons.add('hidden');}else loop();}
    }catch(error){if(next&&next.asset!==asset)next.asset.destroy();if(version===generation){destroyActors();asset?.destroy();asset=null;status.textContent=`Load failed: ${error}`;}throw error;}
}
function shutdown(){
    if(closed)return;closed=true;generation++;loading?.abort();stopLoop();const start=performance.now();destroyActors();asset?.destroy();asset=null;destroyEngine();metrics.destroy.push(performance.now()-start);show();
}
document.addEventListener('visibilitychange',()=>document.hidden?suspend('hidden'):restore('hidden'));
document.addEventListener('freeze',()=>suspend('frozen'));
document.addEventListener('resume',()=>restore('frozen'));
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();suspend('context-lost');});
canvas.addEventListener('webglcontextrestored',()=>{
    if(closed)return;
    try{for(const a of alive())a.present();draw();log({kind:'redraw-before-resume',now:performance.now(),ticks:alive().map(a=>String(a.observe().completed))});restore('context-lost');}
    catch(error){stopLoop();status.textContent=String(error);}
});
window.addEventListener('pagehide',event=>event.persisted?suspend('page-cache'):shutdown());
window.addEventListener('pageshow',event=>{if(event.persisted)restore('page-cache');});
document.querySelector('#pause').onclick=()=>{try{const now=performance.now();userPaused=true;stopLoop();for(const a of alive())if(a.observe().state==='playing')a.pause(now);receiveEvents();show();}catch(e){status.textContent=String(e);}};
document.querySelector('#resume').onclick=()=>{try{if(crossfade&&alive().some(a=>a.observe().state==='stopped'))throw Error('Use Play after Reset');if(reasons.size)throw Error('Still suspended: '+[...reasons]);const now=performance.now();for(const a of alive())if(a.observe().state==='paused'){if(interruptible&&!manual&&a.resources().mode==='manual')a.startRealtime(now);else a.resume(now);}userPaused=false;autoResume=false;if(!manual)loop();show();}catch(e){status.textContent=String(e);}};
document.querySelector('#run').onclick=()=>{try{if(reasons.size)throw Error('Still suspended');const now=performance.now();for(const a of alive())a.startRealtime(now);userPaused=false;loop();}catch(e){status.textContent=String(e);}};
document.querySelector('#tick').onclick=()=>{try{for(const a of alive()){if(a.observe().state==='stopped')a.play();a.advanceToTick(Number(a.observe().requested)+1);receiveEvents();a.present();}draw();show();}catch(e){status.textContent=String(e);}};
document.querySelector('#reload').onclick=()=>reload(document.querySelector('#fixture').value,document.querySelector('#calendar').value).catch(e=>status.textContent=String(e));
document.querySelector('#destroy').onclick=shutdown;
globalThis.Pilot={engine,gl,canvas,game,scene,manual,metrics,stopLoop,draw,reload,shutdown,
    get events(){return structuredClone({count:eventCount,impactCount,log:eventLog});},get actors(){return [...actors];},get asset(){return asset;},get recipe(){return recipe;},
    loadAsset,createActor,resources(){return{closed,running,userPaused,suspensions:[...reasons],actors:actors.map(a=>a.resources()),asset:asset?.resources()??null,metrics};}};
if(crossfade){const {installMixControls}=await import(document.body.dataset.integratedCombat==='true'?(interruptible?'../integrated-interruptions/controls.mjs':'../integrated-combat/controls.mjs'):document.body.dataset.ffdCrossfade==='true'?(interruptible?'../ffd-interruptions/controls.mjs':'../ffd-crossfade/controls.mjs'):document.body.dataset.eventCrossfade==='true'?(interruptible?'../event-interruptions/controls.mjs':'../events-crossfade/controls.mjs'):document.body.dataset.slotCrossfade==='true'?(interruptible?'../slot-interruptions/controls.mjs':'../slot-crossfade/controls.mjs'):interruptible?'../interruptions/controls.mjs':'../crossfade/controls.mjs');installMixControls({actors:alive,draw,show,receiveEvents,stop:()=>{stopLoop();userPaused=true;}});}
const query=new URL(location.href).searchParams;
await reload(query.get('fixture')??(crossfade?'combat_frog':linkedMeshes?'linked_frog':weightedFfd&&animatedSlots?'morphing_frog':clipping?'masked_frog':animatedSlots&&animationEvents?'signal_costume':weightedFfd?'impact':animatedSlots?'costume':animationEvents?'signals':'combined'),query.get('calendar')??'primary');
metrics.applicationReadyMs=performance.now()-bootStart;
document.body.dataset.ready='true';
