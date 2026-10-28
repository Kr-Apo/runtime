import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {ApplicationActor} from '../continuous-playback/actor.mjs';
test('A17 actor authority refuses mutated frozen metadata and captured inputs without changing accepted state',()=>{
 const rig=JSON.parse(readFileSync(new URL('./fixtures/skeleton.json',import.meta.url)));let authority;
 const actor=new ApplicationActor({asset:{rig,acquire(){},release(){}},clip:'Idle',crossfade:true,interruptible:true,weightedFfd:true,animatedSlots:true,animationEvents:true,createView(_binding,accepted){authority=accepted;return{resources:()=>({}),destroy(){},present:s=>authority(s.frame)};}});
 actor.play();for(let t=1;t<=80;t++){actor.advanceToTick(t);if(t===60)actor.requestTransition({to:'Attack',durationTicks:96n});if(t===73)actor.requestInterrupt({to:'Hit',durationTicks:24n});}
 const before=actor.observe();authority(before);
 for(const change of [f=>f.prePhysics[0].x+=1,f=>f.mixing.transition.source.tick=String(f.mixing.transition.source.tick),f=>f.mixing.transition.source.command=99,f=>f.mixing.kind='crossfade/v1',f=>f.deformation.entries[0].offsets[0]+=.01,f=>f.slotState.drawOrder.reverse(),f=>f.slotState.slots[0].color[0]=0]){const bad=structuredClone(before);change(bad);assert.throws(()=>authority(bad),/modified/);assert.deepEqual(actor.observe(),before);}
 actor.present();actor.beginAcceptedReplay();while(actor.observe().backlog)actor.pump(8);assert.deepEqual(actor.observe().prePhysics,before.prePhysics);actor.destroy();
});
