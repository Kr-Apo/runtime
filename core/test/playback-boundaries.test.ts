import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluate, RigPlayer } from '../src/index.js';
import type { RuntimeRigData, RuntimeEvent } from '../src/index.js';

// Synthetic API fixtures, not regenerated or patched historical native exports.
function rig(events: RuntimeEvent[] = []): RuntimeRigData {
  return {
    format: 'ankhimate-runtime', format_version: 2, context_version: 1, name: 'boundaries', fps: 60,
    bones: [{ name: 'root', parent: -1, x: 0, y: 0, length: 10, rotation: 0,
      scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, inheritRotation: true, inheritScale: true, inheritReflect: true }],
    slots: [], skins: [], defaultSkin: null, constraints: [], constraintOrder: [], drawOrder: [], atlas: null,
    animations: { clip: { duration: 1, looping: false, bones: [], slots: [], drawOrder: [], events, deform: [], ik: [], transform: [] } },
  };
}

test('negative and positive exact half turns follow the signed Rust shortest arc', () => {
  // Independent reference: accepted T-209.3 Rust samples: 0→-180 at .5 = -90.
  for (const [end,mid] of [[-180,-90],[180,90],[-179,-89.5],[179,89.5],[181,-89.5],[-181,89.5]]) {
    const data=rig();
    data.animations.clip!.bones=[{name:'root',rotate:[{time:0,value:0,curve:'linear'},{time:1,value:end!,curve:'linear'}]}];
    const pose=evaluate(data,[{animation:'clip',time:.5,alpha:1}]);
    const actual=pose.bones[0]!.rotation*180/Math.PI;
    assert.ok(Math.abs(actual-mid!)<1e-8, `0→${end}: midpoint ${actual}, expected Rust ${mid}`);
    assert.ok(Math.abs(pose.bones[0]!.world.b*10-Math.sin(mid!*Math.PI/180)*10)<.01);
  }
});

test('events fire in stable chronological order without changing authored storage', () => {
  const events=[{time:.75,name:'late'},{time:.25,name:'early-1'},{time:.25,name:'early-2'}];
  const data=rig(events),before=JSON.stringify(data);
  const player=new RigPlayer(data).play('clip');
  player.update(1);
  assert.deepEqual(player.events.map(e=>e.name), ['early-1','early-2','late']);
  assert.equal(JSON.stringify(data),before);
  player.update(0);assert.deepEqual(player.events,[]);
});

test('Rust event window (from,to] excludes t=0 on every lap, including exact boundaries', () => {
  const data = rig([{time:0,name:'start'},{time:.5,name:'hit'},{time:1,name:'end'}]);
  data.animations.clip!.looping = true;
  const trace = (steps: number[]) => {
    const player = new RigPlayer(data).play('clip');
    const names: string[] = [];
    for (const dt of steps) { player.update(dt); names.push(...player.events.map(e=>e.name)); }
    return { names, time: player.time };
  };
  assert.deepEqual(trace([1.25]), {names:['hit','end'],time:.25});
  assert.deepEqual(trace([1,0,.25]), trace([1.25]));
  assert.deepEqual(trace([3.25]), {names:['hit','end','hit','end','hit','end'],time:.25});
  assert.deepEqual(trace([1,1,1,.25]), trace([3.25]));
});
