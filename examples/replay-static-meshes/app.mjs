import {ReplayHostTimeBridge}from '@ankhimate/runtime/experimental-host-time';
const q=new URL(location.href).searchParams,engine='Pixi',character=q.get('character')??'simple',clip=q.get('clip')??'march';
if(!['simple','mixed','perf-region','perf-grid1','perf-grid4','perf-grid8','perf-grid16'].includes(character))throw Error('Unknown character/engine');
const variant=clip==='fault_at_20';
const calendar='fixed';
const url=new URL(`./assets/${character}/skeleton.json`,import.meta.url),refUrl=new URL(`./assets/${character}/rust-${clip}.json`,import.meta.url);
const schedules={fixed:[{tick:0,skin:'default'}]},events=[];
let asset,app,actors=[],disposed=false,loop;const json=v=>JSON.stringify(v,(_,v)=>typeof v==='bigint'?String(v):v,2);
function diagnostics(){document.querySelector('#diagnostic').textContent=json({experimental:true,engine,character,clip,actors:actors.map(a=>a.disposed?{disposed:true}:{...a.view.consumer.currentFrame(),bones:undefined,records:a.view.consumer.currentFrame().records.map(r=>r.constraint),visualSkin:a.view.visualSkin,visible:a.view.root.children.filter(m=>m.visible).map(m=>m.label),displayed:a.view.displayed?.kind==='simulated'?a.view.displayed.snapshot.poseTick:a.view.displayed?.snapshot.tick,presentation:a.view.displayed?.kind,mode:a.host?'host':'exact',error:a.error??null}),resources:asset?.resources});}
function present(){for(const a of actors)if(!a.disposed){const p=a.view.capturePreview();if(p)a.view.presentPreview(p);else a.view.present();}}
function submit(){if(disposed)throw Error('Disposed');app.render();}
function draw(){present();submit();diagnostics();}
function dropHost(a){a.host?.dispose();a.host=null;a.live=false;a.suspendUntil=0;}
function setActors(count,desynchronized=false,customEvents=null){if(!Number.isInteger(count)||count<1||count>25)throw Error('1..25 actors');for(const a of actors){dropHost(a);a.view.dispose();}actors=[];const cols=count<=2?count:5,rows=Math.ceil(count/cols);for(let i=0;i<count;i++){const view=asset.createInstance({clip});const x=(i%cols+.5)*1000/cols,y=(Math.floor(i/cols)+.57)*650/rows,s=count<=2?1.25:count<=5?.8:count<=10?.62:.32;view.root.position.set(x,y);view.root.scale.set(s);app.stage.addChild(view.root);actors.push({view,host:null,live:false,disposed:false});}draw();}
function pumpAll(i){const c=actors[i].view.consumer;while(c.currentFrame().backlog)c.pump(c.context,128);}
function command(i,name,value,render=true){const a=actors[i];if(!a||a.disposed)throw Error('Invalid actor');const c=a.view.consumer;
try{if(name==='host'||name==='live'){dropHost(a);c.stop(c.context);c.play(c.context,variant?'fault_at_20':clip,false);a.host=new ReplayHostTimeBridge(c,name==='live'?performance.now():value);a.live=name==='live';}
else if(name==='host-advance')a.host.advance(value);
else if(name==='pause'){if(a.host)a.host.pause(value??performance.now());else c.pause(c.context);a.wasLive=a.live;a.live=false;}
else if(name==='resume'){if(a.host){a.host.resume(value??performance.now());a.live=!!a.wasLive;}else c.resume(c.context);}
else if(name==='rebind'){dropHost(a);if(c.transportStatus().state==='paused')c.resume(c.context);a.host=new ReplayHostTimeBridge(c,value);}
else if(name==='pump')c.pump(c.context,value??8);
else if(name==='hitch'){if(a.live)a.suspendUntil=performance.now()+500;else if(a.host)a.host.advance(a.host.observe().lastHostMilliseconds+500);else c.requestTick(c.context,c.currentFrame().requested+60n);}
else{dropHost(a);if(name==='play')c.play(c.context,variant?'fault_at_20':clip,false);else if(name==='request')c.requestTick(c.context,BigInt(value));else if(name==='seek')c.seekTick(c.context,BigInt(value));else if(name==='replay')c.replayFromOrigin(c.context,BigInt(value));else if(name==='stop')c.stop(c.context);else if(name==='reset')c.reset(c.context,c.context.epoch+1n);else if(name==='fault')c.requestTick(c.context,c.currentFrame().completed+1n,()=>{throw Error('C6A precommit audit fault');});else if(name==='destroy'){a.view.dispose();a.disposed=true;}else throw Error('Unknown command');}}
catch(error){a.error=String(error);diagnostics();throw error;}if(render)draw();}
async function dispose(){if(disposed)return;cancelAnimationFrame(loop);for(const a of actors){dropHost(a);a.view.dispose();}asset.destroy();actors=[];disposed=true;app.destroy();}
const{Application}=await import('pixi.js'),{ExperimentalReplayPixiAsset:Asset}=await import('@ankhimate/pixi-runtime/experimental-replay');app=new Application();await app.init({preference:'webgl',width:1000,height:650,resolution:1,antialias:false,autoStart:false,preserveDrawingBuffer:true,backgroundAlpha:0,backgroundColor:0x28323d});app.stop();app.renderer.background.alpha=1;document.querySelector('#view').append(app.canvas);asset=await Asset.load(url,character==='perf-region'?undefined:{staticMeshes:true});
setActors(1);const h={engine,character,clip,get asset(){return asset;},get actors(){return actors;},get app(){return app;},get gl(){return app.renderer.gl;},get canvas(){return app.canvas;},refUrl:refUrl.href,sourceUrl:url.href,setActors,command,pumpAll,draw,submit,present,dispose,calendar,schedules};window.acceptance=h;
function animate(){if(disposed)return;const now=performance.now();let changed=false;for(const a of actors)if(a.live&&!a.disposed&&now>=(a.suspendUntil??0)){try{a.host.advance(now);changed=true;}catch(error){a.error=String(error);a.live=false;}}if(changed)draw();loop=requestAnimationFrame(animate);}loop=requestAnimationFrame(animate);
for(const name of ['play','request','pump','pause','resume','seek','replay','hitch','stop','reset','live','destroy']){const b=document.createElement('button');b.textContent=name;b.onclick=()=>{try{command(Number(document.querySelector('#target').value),name,['request','seek','replay'].includes(name)?Number(document.querySelector('#tick').value):undefined);}catch(e){document.querySelector('#diagnostic').textContent+='\n'+e;}};document.querySelector('#controls').append(b);}document.querySelector('#actors').onclick=()=>setActors(Number(document.querySelector('#count').value));

for(const [name,value]of Object.entries({character}))document.querySelector(`select[name=${name}]`).value=value;
