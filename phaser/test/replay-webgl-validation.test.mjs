import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'eventemitter3';
import {replayWebGL2} from '../dist/replay-load.js';

function fixture() {
  let lost=false,queries=0;
  const canvas=new EventTarget(),events=new EventEmitter();
  const gl={VERSION:7938,getParameter(){queries++;return 'WebGL 2.0 controlled headless double';},isContextLost:()=>lost};
  const renderer={gl,canvas,contextLost:false},game={renderer,events,pendingDestroy:false};
  return {game,renderer,gl,canvas,events,get queries(){return queries;},lose(){lost=true;renderer.contextLost=true;canvas.dispatchEvent(new Event('webglcontextlost'));},restore(){lost=false;renderer.contextLost=false;canvas.dispatchEvent(new Event('webglcontextrestored'));}};
}
test('unchanged Game/context performs one VERSION qualification, not one per validation',()=>{
  const f=fixture();for(let i=0;i<100;i++)replayWebGL2(f.game);assert.equal(f.queries,1);f.events.emit('destroy');
});
test('independent Games qualify separately and cached identity changes are refused',()=>{
  const a=fixture(),b=fixture();replayWebGL2(a.game);replayWebGL2(b.game);assert.equal(a.queries,1);assert.equal(b.queries,1);
  a.game.renderer={...a.renderer};assert.throws(()=>replayWebGL2(a.game),/renderer|context/i);a.game.renderer=a.renderer;
  const original=a.renderer.gl;a.renderer.gl=b.gl;assert.throws(()=>replayWebGL2(a.game),/renderer|context/i);a.renderer.gl=original;
  a.events.emit('destroy');b.events.emit('destroy');
});
test('loss rejects cached qualification; restoration requires a new full qualification',()=>{
  const f=fixture();replayWebGL2(f.game);f.lose();assert.throws(()=>replayWebGL2(f.game),/lost/i);f.restore();replayWebGL2(f.game);assert.equal(f.queries,2);replayWebGL2(f.game);assert.equal(f.queries,2);f.events.emit('destroy');
});
test('loss/restoration unseen by presentation still invalidates the cached qualification',()=>{
  const f=fixture();replayWebGL2(f.game);f.lose();f.restore();replayWebGL2(f.game);assert.equal(f.queries,2);replayWebGL2(f.game);assert.equal(f.queries,2);f.events.emit('destroy');
});
test('destroyed or pending-destroy Game never requalifies',()=>{
  const a=fixture();replayWebGL2(a.game);a.events.emit('destroy');assert.throws(()=>replayWebGL2(a.game),/destroy/i);
  const b=fixture();replayWebGL2(b.game);b.game.pendingDestroy=true;assert.throws(()=>replayWebGL2(b.game),/destroy/i);b.events.emit('destroy');
});
test('Canvas, WebGL1 and initially lost contexts are refused',()=>{
  const a=fixture();a.game.renderer={};assert.throws(()=>replayWebGL2(a.game),/WebGL2/i);
  const b=fixture();b.gl.getParameter=()=> 'WebGL 1.0';assert.throws(()=>replayWebGL2(b.game),/WebGL2/i);
  const c=fixture();c.lose();assert.throws(()=>replayWebGL2(c.game),/lost/i);
});
test('native loss is checked before an asynchronous loss event arrives',()=>{
  const f=fixture();replayWebGL2(f.game);const healthy=f.gl.isContextLost;f.gl.isContextLost=()=>true;
  assert.throws(()=>replayWebGL2(f.game),/lost/i);f.gl.isContextLost=healthy;replayWebGL2(f.game);assert.equal(f.queries,2);f.events.emit('destroy');
});
test('failed restored qualification is never cached as valid',()=>{
  const f=fixture();replayWebGL2(f.game);f.lose();f.restore();const version=f.gl.getParameter;
  f.gl.getParameter=()=> 'WebGL 1.0';assert.throws(()=>replayWebGL2(f.game),/WebGL2/i);
  f.gl.getParameter=version;replayWebGL2(f.game);assert.equal(f.queries,2);replayWebGL2(f.game);assert.equal(f.queries,2);f.events.emit('destroy');
});
test('Game destroy detaches both native context listeners',()=>{
  const f=fixture();let added=0,removed=0;const add=f.canvas.addEventListener,remove=f.canvas.removeEventListener;
  f.canvas.addEventListener=function(...a){added++;return add.apply(this,a);};f.canvas.removeEventListener=function(...a){removed++;return remove.apply(this,a);};
  replayWebGL2(f.game);replayWebGL2(f.game);assert.equal(added,2);assert.equal(removed,0);f.events.emit('destroy');assert.equal(removed,2);assert.equal(f.events.listenerCount('destroy'),0);
});
