import {ReplayConsumerBridge} from '@ankhimate/runtime';
import {ReplayHostTimeBridge} from '@ankhimate/runtime/experimental-host-time';
import {selection} from '../../scripts/t840c7c2-q1/projection.mjs';

export const APPLICATION_HORIZON = 256;
let serial = 0;
const need = (ok, message) => { if (!ok) throw new Error(`Application pilot: ${message}`); };
const tick = value => {
    need(Number.isSafeInteger(value) && value >= 0 && value <= APPLICATION_HORIZON, 'tick must be an integer in [0,256]');
    return BigInt(value);
};
export const defaultPlacement = () => ({x:300,y:330,scaleX:.9,scaleY:.9,rotation:0,parent:{x:0,y:0,scaleX:1,scaleY:1,rotation:0}});

/** One owned consumer, borrowed native/atlas asset, one independent mutable view.
 * Application mode only: the internal view envelope is NOT Q1 admission.
 */
export class ApplicationActor {
    #consumer; #view; #asset; #binding; #placement; #cursor = 0;
    #host = null; #draining = false; #disposed = false; #off = () => {};
    #rig; #metrics = {consumersCreated:0,consumersDisposed:0,presentations:0};

    constructor({asset, clip, skinEvents, createView, placement = defaultPlacement(), lifecycle}) {
        need(typeof clip === 'string' && asset.rig.animations[clip], 'unknown clip');
        need(Array.isArray(skinEvents) && skinEvents.length && skinEvents[0].tick === 0n && skinEvents.every(e => typeof e.tick === 'bigint' && e.tick >= 0n && e.tick <= 256n), 'explicit bounded native skin calendar required');
        this.#asset = asset; this.#rig = asset.rig; this.#placement = structuredClone(placement);
        asset.acquire();
        try {
            this.#consumer = new ReplayConsumerBridge(this.#rig, clip, 1n, skinEvents);
            this.#metrics.consumersCreated++;
            const id = `application-${serial++}`;
            this.#binding = {sessionId:id,instanceId:id,qualificationId:'application-only-not-Q1',history:'application',clip,horizon:256,
                selections:Object.fromEntries(this.#rig.skins.map(s => [s.name, selection(this.#rig,s.name)]))};
            this.#view = createView(this.#binding);
            this.#off = lifecycle?.(() => this.destroy()) ?? (() => {});
        } catch (error) {
            this.#view?.destroy();
            if (this.#consumer) { this.#consumer.dispose(this.#consumer.context); this.#metrics.consumersDisposed++; }
            this.#disposed = true; asset.release(); throw error;
        }
    }
    #ready() { need(!this.#disposed, 'actor destroyed'); }
    #ticksOnly() { this.#ready(); need(!this.#host && !this.#draining, 'explicit tick control cannot mix with active realtime clock'); }
    #changed() { this.#cursor++; }
    #envelope(frame) {
        return {sessionId:this.#binding.sessionId,instanceId:this.#binding.instanceId,qualificationId:this.#binding.qualificationId,
            history:this.#binding.history,cursor:this.#cursor,admissionState:'ready',frame:structuredClone(frame),selection:selection(this.#rig,frame.skin),
            mode:'application-experimental',certified:false};
    }
    observe() { this.#ready(); return structuredClone(this.#consumer.currentFrame()); }
    snapshot() { return this.#envelope(this.observe()); }
    play() {
        this.#ticksOnly(); this.#consumer.play(this.#consumer.context,this.#binding.clip,false); this.#changed(); return this.observe();
    }
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
     * At H256 only the already requested backlog drains; the demo then pauses.
     */
    update(nowMilliseconds) {
        this.#ready();
        if (this.#draining) {
            if (this.observe().state === 'paused') return this.observe();
            this.#consumer.pump(this.#consumer.context,8); this.#changed();
        } else {
            need(this.#host, 'call startRealtime first');
            if (this.#host.observe().state === 'paused') return this.observe();
            const candidate=this.#host.preview(nowMilliseconds);
            if (candidate.targetTick > 256n) {
                this.#host.dispose(); this.#host=null; this.#draining=true;
                this.#consumer.requestTick(this.#consumer.context,256n); this.#changed();
            } else {
                this.#host.advance(nowMilliseconds); this.#changed();
            }
        }
        const frame=this.observe();
        if (frame.health === 'faulted') throw new Error('Application pilot: numerical fault; destroy and recreate actor');
        if (frame.completed === 256n && frame.targetReached) {
            this.#host?.dispose(); this.#host=null; this.#draining=true;
            this.#consumer.pause(this.#consumer.context); this.#changed();
        }
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
    resources() { return {disposed:this.#disposed,...this.#metrics,view:this.#view?.resources() ?? null}; }
    destroy() {
        if (this.#disposed) return this.resources();
        // If called from a Scene event the view may already have disposed itself.
        this.#off(); this.#off=()=>{}; this.#host?.dispose(); this.#host=null;
        try { this.#view.destroy(); }
        finally { this.#consumer.dispose(this.#consumer.context); this.#metrics.consumersDisposed++; this.#disposed=true; this.#asset.release(); }
        return this.resources();
    }
}
