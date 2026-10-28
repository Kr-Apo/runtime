import { ReplayHostTimeBridge } from '@ankhimate/runtime/experimental-host-time';
import { Application } from 'pixi.js';
import { ExperimentalReplayPixiAsset, type ReplayPixiPresentation } from '@ankhimate/pixi-runtime/experimental-replay';
import { PixiRigAsset } from '@ankhimate/pixi-runtime';

function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export async function exercise(url: string) {
  const app = new Application();
  await app.init({ preference: 'webgl', width: 640, height: 360, autoStart: false, antialias: false });
  app.stop(); document.body.append(app.canvas);
  const asset = await ExperimentalReplayPixiAsset.load(new URL(url));
  const a = asset.createInstance({ clip: 'march' }), b = asset.createInstance({ clip: 'march' });
  app.stage.addChild(a.root, b.root); a.root.position.set(180,240); b.root.position.set(460,240);
  const ca = a.consumer, cb = b.consumer;
  ca.play(ca.context, 'march', false); cb.play(cb.context, 'march', false);
  const host = new ReplayHostTimeBridge(ca,1000); host.advance(1500);
  const frame: ReplayPixiPresentation = a.capture();
  check(frame.kind === 'simulated' && frame.snapshot.completed === 8n && frame.snapshot.backlog === 52n, 'exact8of60');
  a.present(frame); app.render(); const gl=(app.renderer as unknown as {gl:WebGL2RenderingContext}).gl;check(gl instanceof WebGL2RenderingContext,'real WebGL2');const pixels=new Uint8Array(640*360*4);gl.readPixels(0,0,640,360,gl.RGBA,gl.UNSIGNED_BYTE,pixels);check(pixels.some((v,i)=>i%4===3&&v>0),'real rendered pixels');const picture=(app.canvas as HTMLCanvasElement).toDataURL();const count=a.metrics.captures; a.present(frame); app.render();app.render();check(a.metrics.captures===count,'redraw copies');
  check(b.capture().snapshot.bones[0]!.world.tx === b.displayed!.snapshot.bones[0]!.world.tx,'independent');
  host.pause(1500); let refused=false;try{ca.pump(ca.context,8);}catch{refused=true;}check(refused,'paused pump');host.resume(2500);check(host.advance(2500).progress===null,'no resume jump');host.dispose();
  ca.seekTick(ca.context,60n);a.presentPreview();check(a.displayed!.kind==='pure-preview','preview label');
  ca.replayFromOrigin(ca.context,60n);while(ca.currentFrame().backlog)ca.pump(ca.context,128);const replayed=a.present();
  check(replayed.kind==='simulated'&&replayed.snapshot.poseTick===60n,'replay');
  let invalid=false;const source=asset.source;source.slots[0]!.blend='add';try{ExperimentalReplayPixiAsset.from(source,new Map());}catch{invalid=true;}check(invalid,'unsupported refusal');
  let legacy=false;try{PixiRigAsset.from(asset.source,new Map());}catch{legacy=true;}check(legacy,'legacy refusal');
  a.dispose();check(asset.resources.instances===1&&cb.currentFrame().health==='healthy','shared texture lifetime');b.present();b.dispose();asset.destroy();asset.destroy();app.destroy();
  return {pass:true,webgl2:true,picture,exact8of60:true,previewReplay:true,independent:true,unsupportedRejected:true,legacyRefusal:true,resources:asset.resources};
}
