import {Application} from 'pixi.js';
import {loadPixiRig} from '@ankhimate/pixi-runtime';

export async function start(host) {
  const app = new Application();
  let initialized = false, asset, tick;
  const rigs = [], unsubscribes = [], events = [];
  let disposed = false;
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('pagehide', destroy);
    if (tick) app.ticker.remove(tick);
    for (const unsubscribe of unsubscribes) unsubscribe();
    for (const rig of rigs) { app.stage.removeChild(rig.root); rig.destroy(); }
    asset?.destroy();
    if (initialized) app.destroy(true);
  };
  try {
    await app.init({preference:'webgl', preferWebGLVersion:2, width:800,height:500, backgroundAlpha:0});
    initialized = true;
    if (!(app.renderer.gl instanceof WebGL2RenderingContext)) throw new Error('This candidate requires WebGL2');
    host.append(app.canvas);
    asset = await loadPixiRig(new URL('../Examples/Jade-Sentinel/Export/skeleton.json', import.meta.url));
    for (let i=0; i<2; i++) {
      const rig = asset.createInstance({skin:'default'}); rigs.push(rig);
      rig.root.position.set(220+i*360,260); rig.root.scale.set(2.5); app.stage.addChild(rig.root);
      rig.playback.play(i ? 'attack' : 'idle', {loop:i === 0});
      unsubscribes.push(rig.playback.onEvent(event => { events.push(event); if (events.length>100) events.shift(); }));
    }
    // These operations are independent per instance. Jade only authors default.
    rigs[0].setSkin('default'); rigs[0].playback.pause(); rigs[0].playback.resume(); rigs[0].playback.speed = 1.25;
    rigs[1].playback.crossFade('idle', .5, {loop:true});
    tick = ticker => { for (const rig of rigs) rig.playback.update(ticker.deltaMS / 1000); };
    app.ticker.add(tick);
    window.addEventListener('pagehide', destroy, {once:true});
    return {app, asset, rigs, events, destroy};
  } catch (error) { destroy(); throw error; }
}
