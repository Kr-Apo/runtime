import {Application} from 'pixi.js';
import {loadPixiRig} from '@ankhimate/pixi-runtime';

const status = document.querySelector('#status');
const archive = new URL('../../', location.href);
const state = {ready:false, events:[[],[]], totalEvents:[0,0], impacts:[0,0], changes:[0,0], errors:[]};
window.demo = state;
const app = new Application();
let asset, rigs = [], unsubscribes = [], auto = [], lastChange = [], elapsed = 0, generation = 0, pending;
let destroyed = false;

function release() {
  state.ready = false;
  for (const unsubscribe of unsubscribes) unsubscribe();
  unsubscribes = [];
  for (const rig of rigs) { app.stage.removeChild(rig.root); rig.destroy(); }
  rigs = []; state.rigs = rigs;
  asset?.destroy(); asset = undefined; state.asset = undefined;
  document.querySelector('#controls').replaceChildren();
}
function fail(error) {
  const message = `${error.name ?? 'Error'}: ${error.message ?? error}`;
  state.errors.push(message); status.textContent = message;
}
function control(i) {
  const p = rigs[i].playback;
  const card = document.createElement('section'); card.className = 'card';
  card.innerHTML = `<strong>Character ${i+1}</strong><div><button id="idle-${i}">Idle (loop)</button><button id="attack-${i}">Attack (one shot)</button><button id="fade-${i}">Crossfade to other clip</button></div><div><button id="pause-${i}">Pause</button><button id="resume-${i}">Resume</button><label>Speed <select id="speed-${i}"><option>0.5</option><option>0.75</option><option>1</option><option>1.5</option><option>2</option></select></label><label><input id="auto-${i}" type="checkbox" checked> Alternate clips</label></div><pre id="transport-${i}"></pre><pre class="event" id="events-${i}">No events yet</pre>`;
  document.querySelector('#controls').append(card);
  const act = callback => () => { try { callback(); } catch (error) { fail(error); } };
  const manual = () => { auto[i] = false; card.querySelector(`#auto-${i}`).checked = false; };
  const select = card.querySelector('select'); select.value = String(p.speed);
  select.onchange = act(() => { p.speed = Number(select.value); });
  card.querySelector(`#idle-${i}`).onclick = act(() => { manual(); p.play('idle', {loop:true}); });
  card.querySelector(`#attack-${i}`).onclick = act(() => { manual(); p.play('attack', {loop:false}); });
  card.querySelector(`#fade-${i}`).onclick = act(() => { manual(); state.changes[i]++; p.crossFade(p.animation === 'idle' ? 'attack' : 'idle', .75); });
  card.querySelector(`#pause-${i}`).onclick = act(() => { manual(); p.pause(); });
  card.querySelector(`#resume-${i}`).onclick = act(() => p.resume());
  card.querySelector(`#auto-${i}`).onchange = e => { auto[i] = e.target.checked; lastChange[i] = elapsed; };
  unsubscribes.push(p.onEvent(e => {
    state.totalEvents[i]++; if (e.name === 'impact') state.impacts[i]++;
    state.events[i].push({name:e.name,time:e.time,int:e.int,float:e.float,string:e.string});
    if (state.events[i].length > 8) state.events[i].shift();
    card.querySelector(`#events-${i}`).textContent = state.events[i].map(e => JSON.stringify(e)).join('\n');
  }));
}
async function load() {
  const current = ++generation;
  pending?.abort(); pending = new AbortController();
  let candidate, next = [];
  document.querySelector('#load').disabled = true;
  try {
    const path = document.querySelector('#export-path').value.trim().replaceAll('\\', '/');
    const url = new URL(path, archive);
    if (!path || url.origin !== archive.origin || !url.pathname.startsWith(archive.pathname) || !url.pathname.endsWith('/skeleton.json')) throw new Error('Choose a skeleton.json path inside the extracted archive');
    status.textContent = 'Loading native v2 export…';
    candidate = await loadPixiRig(url, {signal:pending.signal});
    // Validate the sample controls before replacing a working character.
    for (let i=0; i<2; i++) { const rig = candidate.createInstance(); next.push(rig); rig.playback.play(i ? 'attack' : 'idle'); }
    if (current !== generation || destroyed) return;
    release(); asset = candidate; candidate = undefined; rigs = next; next = [];
    Object.assign(state, {asset, rigs, events:[[],[]], totalEvents:[0,0], impacts:[0,0], changes:[0,0]});
    auto = [true,true]; state.auto = auto; lastChange = [0,1.1]; elapsed = 0;
    rigs.forEach((rig, i) => { rig.root.scale.set(2.7); rig.root.position.set(260+i*480,280); app.stage.addChild(rig.root); rig.playback.speed = i ? .75 : 1; control(i); });
    state.ready = true; status.textContent = 'Native v2 loaded. Two independent characters; crossfade duration 0.75 s.';
  } catch (error) { if (current === generation && !destroyed) fail(error); }
  finally {
    for (const rig of next) rig.destroy(); candidate?.destroy();
    if (current === generation && !destroyed) document.querySelector('#load').disabled = false;
  }
}
function destroy() {
  if (destroyed) return;
  destroyed = true; ++generation; pending?.abort(); app.stop(); release(); app.destroy(true);
  state.destroyed = true;
}
try {
  await app.init({preference:'webgl', preferWebGLVersion:2, width:1000,height:540,resolution:1,antialias:false,autoStart:false,backgroundAlpha:0});
  state.app = app;
  if (!(app.renderer.gl instanceof WebGL2RenderingContext)) throw new Error('WebGL2 unavailable: use a desktop browser with WebGL2 enabled');
  document.querySelector('#view').append(app.canvas);
  app.ticker.add(t => {
    if (!state.ready) return;
    try {
      const dt = t.deltaMS / 1000; elapsed += dt;
      for (let i=0; i<2; i++) {
        const p = rigs[i].playback;
        if (auto[i] && elapsed-lastChange[i] >= 3.5) { lastChange[i] = elapsed; state.changes[i]++; p.crossFade(p.animation === 'idle' ? 'attack' : 'idle', .75); }
        p.update(dt);
        document.querySelector(`#transport-${i}`).textContent = `${p.animation} | t=${p.time.toFixed(3)} s | speed=${p.speed} | ${p.playing?'active':'paused'} | impacts=${state.impacts[i]}`;
      }
    } catch (error) { state.ready = false; fail(error); }
  });
  document.querySelector('#load-form').onsubmit = e => { e.preventDefault(); void load(); };
  document.querySelector('#dispose').onclick = () => { ++generation; pending?.abort(); release(); document.querySelector('#load').disabled = false; status.textContent = 'Characters and owned atlas textures released. Load export to restart.'; };
  window.addEventListener('pagehide', destroy, {once:true}); state.destroy = destroy;
  await load(); app.start();
} catch (error) { fail(error); if (state.app) destroy(); }
