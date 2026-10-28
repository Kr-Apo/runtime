import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ApplicationActor} from '../../experimental/continuous-playback/actor.mjs';
for(const [label,fixture,options]of [
 ['A4','animated-slots',{animatedSlots:true}],
 ['A12','crossfade',{crossfade:true}],
 ['A14A','slot-crossfade',{crossfade:true,animatedSlots:true}],
 ['A14B','slot-crossfade',{crossfade:true,animatedSlots:true,interruptible:true}],
 ['A16A','ffd-crossfade',{crossfade:true,weightedFfd:true}],
 ['A16B','ffd-crossfade',{crossfade:true,weightedFfd:true,interruptible:true}],
 ['A15A','events-crossfade',{crossfade:true,animatedSlots:true,animationEvents:true}],
 ['A15B','events-crossfade',{crossfade:true,animatedSlots:true,animationEvents:true,interruptible:true}],
])test('Accepted-frame authority remains available to '+label+' actor views',()=>{
 const rig=JSON.parse(readFileSync(new URL('../../experimental/'+fixture+'/fixtures/skeleton.json',import.meta.url))),asset={rig,acquire(){},release(){}};let authority;
 const actor=new ApplicationActor({asset,clip:Object.keys(rig.animations)[0],...options,createView:(_binding,accepted)=>{authority=accepted;return{destroy(){},resources(){return{};}};}});
 try{assert.equal(typeof authority,'function');const frame=actor.observe();authority(frame);frame.bones[0].world.tx+=1;assert.throws(()=>authority(frame),/modified/);}finally{actor.destroy();}
});
