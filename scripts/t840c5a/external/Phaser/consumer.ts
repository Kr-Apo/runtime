import * as Phaser from 'phaser';
import {ReplayHostTimeBridge} from '@ankhimate/runtime/experimental-host-time';
import {ExperimentalReplayPhaserAsset, validateExperimentalReplayPhaserSource, type ReplayPhaserPresentation} from '@ankhimate/phaser-runtime/experimental-replay';
function check(v:unknown,s:string):asserts v {if(!v)throw Error(s);}
export async function exercise(url:string) {
 const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2',{preserveDrawingBuffer:true});check(context,'WebGL2');
 let scene!:Phaser.Scene;let done!:()=>void;const ready=new Promise<void>(r=>done=r);
 class ConsumerScene extends Phaser.Scene {create(){scene=this;done();}}
 const game=new Phaser.Game({type:Phaser.WEBGL,canvas,context:context as unknown as CanvasRenderingContext2D,width:640,height:360,banner:false,audio:{noAudio:true},transparent:true,scene:ConsumerScene});await ready;game.loop.stop();document.body.append(canvas);
 const asset=await ExperimentalReplayPhaserAsset.load(game,url);validateExperimentalReplayPhaserSource(asset.source);
 const a=asset.createInstance(scene,{clip:'march'}),b=asset.createInstance(scene,{clip:'march'});a.root.setPosition(180,240);b.root.setPosition(460,240);
 scene.events.on('prerender',()=>{if(a.displayed)a.present();if(b.displayed)b.present();});
 const ca=a.consumer,cb=b.consumer;ca.play(ca.context,'march',false);cb.play(cb.context,'march',false);ca.requestTick(ca.context,60n);
 const frame:ReplayPhaserPresentation=a.capture();check(frame.kind==='simulated'&&frame.snapshot.completed===8n&&frame.snapshot.backlog===52n,'exact60/8/52');a.present(frame);game.step(performance.now(),0);
 const gl=context,pixels=new Uint8Array(640*360*4);gl.readPixels(0,0,640,360,gl.RGBA,gl.UNSIGNED_BYTE,pixels);check(pixels.some((v,i)=>i%4===3&&v>0),'real pixels');const picture=canvas.toDataURL();
 const host=new ReplayHostTimeBridge(cb,1000);host.advance(1500);check(cb.currentFrame().completed===8n,'host bridge');host.pause(1500);host.resume(2500);check(host.advance(2500).progress===null,'resume');host.dispose();
 ca.seekTick(ca.context,30n);a.presentPreview();check(a.displayed?.kind==='pure-preview','preview');ca.replayFromOrigin(ca.context,60n);while(ca.currentFrame().backlog)ca.pump(ca.context,128);const replayed=a.present();game.step(performance.now(),0);check(replayed.kind==='simulated'&&replayed.snapshot.poseTick===60n,'replay');
 const bad=asset.source;bad.slots[0]!.blend='add';let refused=false;try{validateExperimentalReplayPhaserSource(bad);}catch{refused=true;}check(refused,'capability refusal');
 a.dispose();a.dispose();check(asset.resources.instances===1&&cb.currentFrame().health==='healthy','shared ownership');b.present();b.dispose();asset.destroy();asset.destroy();game.destroy(true);game.step(performance.now(),0);
 return {pass:true,webgl2:true,picture,exact:true,host:true,independent:true,previewReplay:true,refused,resources:asset.resources};
}
