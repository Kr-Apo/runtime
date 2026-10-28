import {slotSelection} from '../animated-slots/geometry.mjs';
import {ReplayConsumerBridge,MAX_SAMPLE_TICK} from '@ankhimate/runtime';
import {ReplayHostTimeBridge} from '@ankhimate/runtime/experimental-host-time';
import {selection} from '../../scripts/t840c7c2-q1/projection.mjs';

// Native sampling safety bound, NOT an extension of the independent Q1 horizon.
export const APPLICATION_HORIZON = Number(MAX_SAMPLE_TICK);
let serial = 0;
const need = (ok, message) => { if (!ok) throw new Error(`Application pilot: ${message}`); };
const tick = value => {
    need(Number.isSafeInteger(value) && value >= 0 && value <= APPLICATION_HORIZON, 'tick outside native sampling domain');
    return BigInt(value);
};
export const defaultPlacement = () => ({x:300,y:330,scaleX:.9,scaleY:.9,rotation:0,parent:{x:0,y:0,scaleX:1,scaleY:1,rotation:0}});

/** One owned consumer, borrowed native/atlas asset, one independent mutable view.
 * Application mode only: the internal view envelope is NOT Q1 admission.
 */
// Exact typed equality for the new mixed-frame authority (BigInt is not a string).
function sameTypedFrame(a,b){
 if(Object.is(a,b))return true;
 if(typeof a!==typeof b||a===null||b===null||typeof a!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Reflect.ownKeys(a);return keys.length===Reflect.ownKeys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameTypedFrame(a[k],b[k]));
}
export class ApplicationActor {
    #consumer; #view; #asset; #binding; #placement; #cursor = 0;
    #host = null; #disposed = false; #off = () => {};
    #interruptible=false;#ffd=false;#linked=false;#clipping=false;#eventMode=false;#rig; #metrics = {consumersCreated:0,consumersDisposed:0,presentations:0};

    constructor({asset, clip, skinEvents=[{tick:0n,skin:asset.rig.defaultSkin}], createView, weightedFfd=false, animatedSlots=false, animationEvents=false, clipping=false, linkedMeshes=false, crossfade=false,interruptible=false, placement = defaultPlacement(), lifecycle}) {
        this.#interruptible=interruptible;need(typeof interruptible==='boolean'&&(!interruptible||crossfade),'interruptible requires crossfade');need(typeof crossfade==='boolean'&&(!crossfade||!linkedMeshes&&!clipping&&(!weightedFfd||!animatedSlots&&!animationEvents||animatedSlots&&animationEvents)&&(!animationEvents||animatedSlots)),'explicit crossfade-only actor');
        need(typeof linkedMeshes==='boolean'&&(!linkedMeshes||animatedSlots&&!animationEvents&&!clipping),'linked+slots only, optional FFD');this.#linked=linkedMeshes;this.#ffd=weightedFfd;
        need(typeof weightedFfd==='boolean'&&typeof animatedSlots==='boolean'&&typeof animationEvents==='boolean'&&(!(weightedFfd&&animationEvents)||crossfade&&animatedSlots),'one explicit experimental channel mode');
        need(typeof clip === 'string' && asset.rig.animations[clip], 'unknown clip');
        need(Array.isArray(skinEvents) && skinEvents.length && skinEvents[0].tick === 0n && skinEvents.every(e => typeof e.tick === 'bigint' && e.tick >= 0n && e.tick <= MAX_SAMPLE_TICK), 'native skin calendar domain');
        need(typeof clipping==='boolean'&&(!clipping||animatedSlots&&!animationEvents),'explicit clipping+slots only');this.#clipping=clipping;this.#eventMode=animationEvents;this.#asset = asset; this.#rig = asset.rig; this.#placement = structuredClone(placement);
        asset.acquire();
        try {
            this.#consumer = new ReplayConsumerBridge(this.#rig, clip, 1n, skinEvents,crossfade?{crossfade:true,...(interruptible?{interruptible:true}:{}),...(animatedSlots?{animatedSlots:true}:{}),...(animationEvents?{animationEvents:true}:{}),...(weightedFfd?{weightedFfd:true}:{})}:linkedMeshes?{linkedMeshes:true,animatedSlots:true,...(weightedFfd?{weightedFfd:true}:{})}:weightedFfd&&animatedSlots?{weightedFfd:true,animatedSlots:true,...(clipping?{clipping:true}:{})}:clipping?{animatedSlots:true,clipping:true}:animatedSlots&&animationEvents?{animatedSlots:true,animationEvents:true}:weightedFfd?{weightedFfd:true}:animatedSlots?{animatedSlots:true}:animationEvents?{animationEvents:true}:undefined);
            this.#metrics.consumersCreated++;
            const id = `application-${serial++}`;
            this.#binding = {sessionId:id,instanceId:id,qualificationId:'application-only-not-Q1',history:'application',clip,horizon:APPLICATION_HORIZON,
                selections:Object.fromEntries(this.#rig.skins.map(s => [s.name, clipping?{skin:s.name,active:[...this.#rig.constraintOrder],attachments:[]}:selection(this.#rig,s.name)]))};
            this.#view = createView(this.#binding,crossfade||weightedFfd||animatedSlots||animationEvents?frame=>{
                const serial=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v);
                const accepted=this.#consumer.currentFrame();need(crossfade?sameTypedFrame(frame,accepted):serial(frame)===serial(accepted),'foreign or modified accepted channel frame');
            }:undefined);
            this.#off = lifecycle?.(() => this.destroy()) ?? (() => {});
        } catch (error) {
            this.#view?.destroy();
            if (this.#consumer) { this.#consumer.dispose(this.#consumer.context); this.#metrics.consumersDisposed++; }
            this.#disposed = true; asset.release(); throw error;
        }
    }
    #ready() { need(!this.#disposed, 'actor destroyed'); }
    #ticksOnly() { this.#ready(); need(!this.#host, 'explicit tick control cannot mix with realtime mode, including a pause'); }
    #changed() { this.#cursor++; }
    #envelope(frame) {
        return {sessionId:this.#binding.sessionId,instanceId:this.#binding.instanceId,qualificationId:this.#binding.qualificationId,
            history:this.#binding.history,cursor:this.#cursor,admissionState:'ready',frame:structuredClone(frame),selection:frame.slotState?slotSelection(this.#rig,frame,this.#clipping,this.#linked,this.#ffd):selection(this.#rig,frame.skin),
            mode:'application-experimental',certified:false};
    }
    observe() { this.#ready(); return structuredClone(this.#consumer.currentFrame()); }
    drainEvents() {this.#ready();return this.#consumer.drainEvents(this.#consumer.context).map(e=>({...e,actorId:this.#binding.instanceId}));}
    eventStatus() {this.#ready();return this.#consumer.eventStatus(this.#consumer.context);}
    snapshot() { return this.#envelope(this.observe()); }
    play() {
        this.#ticksOnly(); this.#consumer.play(this.#consumer.context,this.#binding.clip,false); this.#changed(); return this.observe();
    }
    requestTransition(request) {this.#ready();const value=this.#consumer.requestTransition(this.#consumer.context,request);this.#changed();return value;}
    requestInterrupt(request) {this.#ready();const value=this.#consumer.requestInterrupt(this.#consumer.context,request);this.#changed();return value;}
    transitionStatus() {this.#ready();return this.#consumer.transitionStatus(this.#consumer.context);}
    reset() {this.#ready();this.#host?.dispose();this.#host=null;this.#consumer.reset(this.#consumer.context,this.#consumer.context.epoch+1n);this.#changed();return this.observe();}
    beginAcceptedReplay() {this.#ready();need(this.#interruptible,'A13 capability required');const target=this.observe().completed;this.#consumer.replayFromOrigin(this.#consumer.context,target);this.#host?.dispose();this.#host=null;this.#changed();return this.observe();}
    replayToTick(target) {this.#ticksOnly();this.#consumer.replayFromOrigin(this.#consumer.context,tick(target));this.#changed();return this.observe();}
    advanceToTick(target) {
        this.#ticksOnly(); const t=tick(target);
        need(t >= this.#consumer.currentFrame().requested, 'backward request; recreate actor to restart');
        const progress=this.#consumer.requestTick(this.#consumer.context,t); this.#changed(); return progress;
    }
    pump(budget = 8) {
        this.#ticksOnly(); need(Number.isInteger(budget) && budget > 0 && budget <= 8, 'pump budget must be 1..8');
        const result=this.#consumer.pump(this.#consumer.context,budget); this.#changed(); return result;
    }
    startRealtime(nowMilliseconds) {
        need(Number.isFinite(nowMilliseconds) && nowMilliseconds >= 0 && nowMilliseconds <= Number.MAX_SAFE_INTEGER,'finite nonnegative host milliseconds required');
        this.play(); this.#host=new ReplayHostTimeBridge(this.#consumer,nowMilliseconds); return this.observe();
    }
    pause(nowMilliseconds) {
        this.#ready();
        if (this.#host) this.#host.pause(nowMilliseconds);
        else this.#consumer.pause(this.#consumer.context);
        this.#changed(); return this.observe();
    }
    resume(nowMilliseconds) {
        this.#ready();
        if (this.#host) this.#host.resume(nowMilliseconds);
        else this.#consumer.resume(this.#consumer.context);
        this.#changed(); return this.observe();
    }
    /** Absolute monotone host milliseconds, never a delta or a render hook.
     * Existing host bridge owns conversion. Each call performs bounded native work.
     * No I1 H256 clamp. Native sampling bounds and8tick request budget remain intact.
     */
    update(nowMilliseconds) {
        this.#ready();
        need(this.#host, 'call startRealtime first');
        if (this.#host.observe().state === 'paused') return this.observe();
        this.#host.advance(nowMilliseconds); this.#changed();
        const frame=this.observe();
        if (frame.health === 'faulted') throw new Error('Application pilot: numerical fault; destroy and recreate actor');
        return this.observe();
    }
    /** Pure presentation: no request, pump, clock update or evaluator. */
    present() {
        this.#ready(); let result;
        this.#consumer.present(frame => { result=this.#view.present(this.#envelope(frame),this.#placement); });
        this.#metrics.presentations++; return result;
    }
    setPosition(x,y) {
        this.#ready(); need(Number.isFinite(x) && Number.isFinite(y),'finite position required'); this.#placement={...this.#placement,x,y};
    }
    inspect() { this.#ready(); return {snapshot:this.snapshot(),view:this.#view.inspect(),placement:structuredClone(this.#placement),resources:this.resources()}; }
    readBuffers() { this.#ready(); return this.#view.readBuffers(); }
    resources() { return {disposed:this.#disposed,mode:this.#host?'realtime':'manual',...(this.#eventMode&&!this.#disposed?{events:this.eventStatus()}:{}),...this.#metrics,view:this.#view?.resources() ?? null}; }
    destroy() {
        if (this.#disposed) return this.resources();
        // If called from a Scene event the view may already have disposed itself.
        this.#off(); this.#off=()=>{}; this.#host?.dispose(); this.#host=null;
        try { this.#view.destroy(); }
        finally { this.#consumer.dispose(this.#consumer.context); this.#metrics.consumersDisposed++; this.#disposed=true; this.#asset.release(); }
        return this.resources();
    }
}
