import test from 'node:test';import assert from 'node:assert/strict';
import {DemoTime} from '../../examples/replay-pixi-pilot/contract.mjs';
test('microsecond flooring intentionally does not bias exact tick boundaries',()=>{const c=new DemoTime();c.start(0);assert.equal(c.value(8.333333333333),8333n);assert.equal(c.value(8.334),8334n);assert.equal(8333n*120n/1000000n,0n);assert.equal(8334n*120n/1000000n,1n);});
test('many paused submicrosecond segments may lose quantized fractions; reset reanchors',()=>{const c=new DemoTime();for(let n=0;n<1000;n++){c.start(n);c.pause(n+.0009);}assert.equal(c.value(1001),0n);c.reset();c.start(0);assert.equal(c.value(500),500000n);});
test('nonfinite, backward host readings and horizon overflow reject; hitch debt is not clamped',()=>{const c=new DemoTime();c.start(0);assert.throws(()=>c.value(NaN));assert.equal(c.value(500),500000n);assert.throws(()=>c.value(499));assert.throws(()=>c.value(70000000));});
