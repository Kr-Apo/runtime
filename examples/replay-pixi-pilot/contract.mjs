// Experimental example only. Demo host-time policy stays here; transport/view use the explicit public experimental entry.
import {ReplayConsumerBridge} from '@ankhimate/runtime';
import {validateExperimentalReplayPixiSource} from '@ankhimate/pixi-runtime/experimental-replay';
const requireThat=(c,m)=>{if(!c)throw Error(`Replay pilot: ${m}`);};
export function validatePilot(source,clip){const rig=validateExperimentalReplayPixiSource(source);requireThat(Object.hasOwn(rig.animations,clip),'unknown clip');return rig;}
export class PilotController {
 #bridge; #disposed=false;
 constructor(source,clip){this.instance=source.consumer?source:null;this.#bridge=this.instance?.consumer??new ReplayConsumerBridge(validatePilot(source,clip),clip,1n);this.clip=clip;}
 #ready(){requireThat(!this.#disposed,'disposed');return this.#bridge.context;}
 get frame(){this.#ready();return this.#bridge.currentFrame();}
 get status(){return this.#bridge.transportStatus();}
 capture(){this.#ready();if(this.instance)return this.instance.capturePreview()??this.instance.capture();const preview=this.#bridge.previewFrame();return preview?{kind:'pure-preview',snapshot:preview}:{kind:'simulated',snapshot:this.#bridge.currentFrame()};}
 play(){this.#bridge.play(this.#ready(),this.clip,false);}
 request(tick,audit){return this.#bridge.requestTick(this.#ready(),tick,audit);}
 requestTime(n,d){return this.#bridge.requestTime(this.#ready(),n,d);}
 pump(budget=8){return this.#bridge.pump(this.#ready(),budget);}
 pause(){this.#bridge.pause(this.#ready());}
 resume(){this.#bridge.resume(this.#ready());}
 stop(){this.#bridge.stop(this.#ready());}
 reset(){const c=this.#ready();this.#bridge.reset(c,c.epoch+1n);}
 seek(tick){this.#bridge.seekTick(this.#ready(),tick);}
 replay(tick){this.#bridge.replayFromOrigin(this.#ready(),tick);}
 dispose(){if(!this.#disposed){this.#bridge.dispose(this.#ready());this.#disposed=true;}}
}
/** Demo-only absolute monotonic-ms -> floored integer microseconds. Never RigPlayer. */
export class DemoTime {
 #total=0n;#origin=null;#last=-Infinity;
 #check(now){requireThat(Number.isFinite(now)&&now>=this.#last,'nonmonotonic host time');this.#last=now;}
 start(now){this.#check(now);requireThat(this.#origin===null,'clock already running');this.#origin=now;}
 value(now){this.#check(now);const delta=this.#origin===null?0:Math.floor((now-this.#origin)*1000);requireThat(Number.isSafeInteger(delta)&&delta>=0,'host time range');const total=this.#total+BigInt(delta);requireThat(total*120n/1000000n<=8388607n,'B4 horizon exceeded');return total;}
 pause(now){const value=this.value(now);this.#total=value;this.#origin=null;}
 reset(){this.#total=0n;this.#origin=null;this.#last=-Infinity;}
}
