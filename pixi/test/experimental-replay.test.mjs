import test from 'node:test';
import assert from 'node:assert/strict';
import {ExperimentalReplayPixiAsset} from '@ankhimate/pixi-runtime/experimental-replay';
test('public opt-in entry exists without internal dist imports',()=>assert.equal(typeof ExperimentalReplayPixiAsset.load,'function'));

import {readFileSync} from 'node:fs';
import {Texture,TextureSource,RendererType} from 'pixi.js';
import {PixiRigAsset} from '@ankhimate/pixi-runtime';
import {validateExperimentalReplayPixiSource} from '@ankhimate/pixi-runtime/experimental-replay';
const raw=JSON.parse(readFileSync(new URL('../../examples/replay-pixi-pilot/assets/skeleton.json',import.meta.url),'utf8'));
const pagesFor=rig=>new Map(rig.atlas.pages.map(p=>[p.index,new Texture({source:new TextureSource({width:p.width,height:p.height,alphaMode:'premultiplied-alpha'})})]));
const withAsset=fn=>{const pages=pagesFor(raw),asset=ExperimentalReplayPixiAsset.from(raw,pages);try{fn(asset,pages);}finally{asset.destroy();for(const p of pages.values())if(!p.destroyed)p.destroy(true);}};
for(const [name,edit]of [
 ['v1',r=>r.format_version=1],['no-physics',r=>{r.constraints=[];r.constraintOrder=[];r.skins[0].constraints=[];}],['mixed-ik',r=>r.constraints[0].type='ik'],['mixed-transform',r=>r.constraints[0].type='transform'],['mixed-path',r=>r.constraints[0].type='path'],
 ['nonfinite-mass',r=>r.constraints[0].physics.mass=NaN],['nonfinite-force',r=>r.constraints[0].forces.wind_x=NaN],['missing-bone',r=>r.constraints[0].target='missing'],['duplicate-order',r=>r.constraintOrder.push(r.constraintOrder[0])],
 ['alternate-skin',r=>r.skins.push({...r.skins[0],name:'alternate'})],['skin-constraint-reference',r=>r.skins[0].constraints.push('missing')],['skin-bone-reference',r=>r.skins[0].bones.push('missing')],
 ['add-blend',r=>r.slots[0].blend='add'],['dark-tint',r=>r.slots[0].dark_color=[0,0,0,0]],['missing-slot-bone',r=>r.slots[0].bone='missing'],['missing-setup-attachment',r=>r.slots[0].attachment='missing'],['invalid-color',r=>r.slots[0].color='bad'],
 ['mesh',r=>r.skins[0].attachments[0].attachment.type='mesh'],['clipping',r=>r.skins[0].attachments[0].attachment.type='clipping'],['sequence',r=>r.skins[0].attachments[0].attachment.sequence={frames:['body'],fps:1,mode:'loop',setup_index:0}],
 ['slot-animation',r=>r.animations.sway.slots.push({name:'body',channel:'attachment',keys:[]})],['ffd',r=>r.animations.sway.deform.push({slot:'body',attachment:'body',keys:[]})],['draw-order',r=>r.animations.sway.drawOrder.push({time:0,offsets:[]})],['event',r=>r.animations.sway.events.push({time:0,name:'event'})],['empty-clip',r=>r.animations.sway.bones=[]],['no-clip',r=>r.animations={}],
 ['missing-texture',r=>r.skins[0].attachments[0].attachment.texture='missing'],['rotated-atlas',r=>r.atlas.regions[0].rotated=true],['bad-atlas-rect',r=>r.atlas.regions[0].width=999999]
])test('strict capability refusal: '+name,()=>{const source=structuredClone(raw);edit(source);assert.throws(()=>validateExperimentalReplayPixiSource(source));});
test('Legacy refusal preserved; native source and constraints never stripped or mutated',()=>withAsset((asset)=>{const before=JSON.stringify(raw);assert.throws(()=>PixiRigAsset.from(raw,new Map()),/Constraints/);assert.equal(asset.source.constraints.length,raw.constraints.length);assert.deepEqual(asset.source,raw);assert.equal(JSON.stringify(raw),before);}));
test('8-of60 immutable snapshot, bounded pump, stale/forged/foreign frames, cached redraw',()=>withAsset(asset=>{
 const a=asset.createInstance({clip:'sway'}),b=asset.createInstance({clip:'sway'});try{
  assert.throws(()=>a.consumer=b.consumer);a.consumer.play(a.consumer.context,'sway',false);a.consumer.requestTick(a.consumer.context,60n);const f=a.capture();assert.equal(f.snapshot.completed,8n);assert.equal(f.snapshot.backlog,52n);assert.equal(f.snapshot.targetReached,false);assert.throws(()=>f.snapshot.bones[0].world.tx=9000);assert.throws(()=>a.present({...f}));assert.throws(()=>b.present(f));
  a.present(f);const counters=a.metrics,clock=a.consumer.transportStatus();for(let i=0;i<20;i++){assert.equal(a.capture(),f);a.present(f);}assert.equal(a.metrics.captures,counters.captures);assert.equal(a.metrics.guardedReads,counters.guardedReads);assert.deepEqual(a.consumer.transportStatus(),clock);
  a.consumer.pump(a.consumer.context,3);assert.throws(()=>a.present(f),/Stale/);a.present();assert.equal(a.displayed.snapshot.completed,11n);
 }finally{a.dispose();b.dispose();}
}));
test('pause/resume, seek preview kind, explicit replay, reset invalidates presentations',()=>withAsset(asset=>{
 const a=asset.createInstance({clip:'sway'}),c=a.consumer;try{c.play(c.context,'sway',false);c.requestTick(c.context,8n);c.pause(c.context);assert.throws(()=>c.pump(c.context,8));c.resume(c.context);c.seekTick(c.context,60n);const p=a.capturePreview();assert.equal(p.snapshot.tick,60n);assert.equal(a.capture().snapshot.completed,0n);assert.throws(()=>a.present(p));a.presentPreview(p);assert.equal(a.displayed.kind,'pure-preview');assert.throws(()=>c.resume(c.context));c.replayFromOrigin(c.context,60n);while(c.currentFrame().backlog)c.pump(c.context,128);a.present();assert.equal(a.displayed.snapshot.completed,60n);c.reset(c.context,c.context.epoch+1n);assert.throws(()=>a.present(p));a.present();}finally{a.dispose();}
}));
test('real solver fault, observer fault, explicit reset and another owner isolation',()=>withAsset(asset=>{
 const a=asset.createInstance({clip:'fault_at_9'}),b=asset.createInstance({clip:'sway'});try{const beforeB=b.capture();const c=a.consumer;c.play(c.context,'fault_at_9',false);c.requestTick(c.context,8n);a.present();const before=a.displayed,p=c.requestTick(c.context,60n);assert.equal(p.stop.kind,'failed');a.present();assert.deepEqual(a.displayed.snapshot.bones,before.snapshot.bones);assert.equal(a.displayed.snapshot.health,'faulted');assert.equal(a.displayed.snapshot.backlog,52n);assert.equal(b.capture(),beforeB);assert.throws(()=>c.pump(c.context,8));c.reset(c.context,c.context.epoch+1n);a.present();c.play(c.context,'sway',false);c.requestTick(c.context,60n,()=>{throw Error('audit');});a.present();assert.equal(a.displayed.snapshot.health,'faulted');}finally{a.dispose();b.dispose();}
}));
test('shared borrowed textures, invalid ownership, root destruction and repeated disposal',()=>withAsset((asset,pages)=>{
 const a=asset.createInstance({clip:'sway'}),b=asset.createInstance({clip:'sway'}),mesh=a.root.children[0],buffers=[...mesh.geometry.buffers,mesh.geometry.indexBuffer];assert.equal(a.root.children[0].texture,b.root.children[0].texture);assert.notEqual(a.root.children[0].geometry,b.root.children[0].geometry);assert.throws(()=>asset.destroy(),/instances/);a.dispose();a.dispose();assert.ok(buffers.every(b=>b.destroyed));assert.ok([...pages.values()].every(t=>!t.destroyed));b.present();b.root.destroy();assert.equal(b.consumer.transportStatus().state,'disposed');assert.equal(asset.resources.instances,0);asset.destroy();asset.destroy();assert.ok([...pages.values()].every(t=>!t.destroyed));assert.throws(()=>asset.createInstance({clip:'sway'}));
}));
test('invalid construction/clip/page and read-only source fail without resource registration',()=>withAsset((asset,pages)=>{assert.throws(()=>asset.createInstance({clip:'missing'}));assert.equal(asset.resources.instances,0);assert.throws(()=>ExperimentalReplayPixiAsset.from(raw,new Map()));const source=asset.source;source.constraints=[];assert.equal(asset.source.constraints.length,1);assert.throws(()=>asset.createInstance({clip:'sway',epoch:0n}));assert.equal(asset.resources.instances,0);}));

test('presentation texture failure cannot retroactively fault or roll back a committed tick',()=>withAsset((asset,pages)=>{
 const a=asset.createInstance({clip:'sway'}),c=a.consumer;try{const old=a.displayed;c.play(c.context,'sway',false);c.requestTick(c.context,1n);for(const t of pages.values())t.destroy(true);assert.throws(()=>a.present(),/texture.*destroyed/);assert.equal(c.currentFrame().completed,1n);assert.equal(c.currentFrame().health,'healthy');assert.equal(a.displayed,old);}finally{a.dispose();}
}));

test('experimental render boundary explicitly rejects WebGL1 and WebGPU',()=>withAsset(asset=>{const a=asset.createInstance({clip:'sway'});try{assert.throws(()=>a.root.onRender({type:RendererType.WEBGL,context:{webGLVersion:1}}),/WebGL2/);assert.doesNotThrow(()=>a.root.onRender({type:RendererType.WEBGL,context:{webGLVersion:2}}));assert.throws(()=>a.root.onRender({type:RendererType.WEBGPU}),/WebGL/);}finally{a.dispose();}}));

test('unsupported JavaScript skin/layers/crossfade options must never be silently ignored',()=>withAsset(asset=>{
 for(const option of ['skin','layers','crossfade']){let unexpected;try{assert.throws(()=>{unexpected=asset.createInstance({clip:'sway',[option]:option==='skin'?'alternate':[]});},/options/);}finally{unexpected?.dispose();}assert.equal(asset.resources.instances,0);}
}));


test('successive seeks 30 then90 use effective preview identity and never stale cache',()=>withAsset(asset=>{
 const a=asset.createInstance({clip:'sway'}),c=a.consumer;try{c.seekTick(c.context,30n);const first=a.capturePreview(),firstContext=c.context;a.presentPreview(first);const counts=a.metrics;assert.equal(a.capturePreview(),first);c.seekTick(c.context,90n);const second=a.capturePreview();assert.notEqual(c.context,firstContext);assert.notEqual(second,first);assert.equal(second.snapshot.context,c.context);assert.equal(second.snapshot.tick,90n);assert.deepEqual(second.snapshot.bones,c.previewFrame().bones);assert.notDeepEqual(second.snapshot.bones,first.snapshot.bones);assert.equal(a.metrics.previewCaptures,counts.previewCaptures+1);assert.equal(a.metrics.poseTransfers,counts.poseTransfers+1);assert.throws(()=>a.presentPreview(first),/stale/);a.presentPreview(second);assert.equal(a.displayed,second);const after=a.metrics;assert.equal(a.capturePreview(),second);a.presentPreview(second);assert.equal(a.metrics.previewCaptures,after.previewCaptures);assert.equal(a.metrics.submissions,after.submissions);assert.equal(c.currentFrame().completed,0n);}finally{a.dispose();}
}));
