/** Trusted supervised entry. No exports, free factory, provider or consumer getter. */
import {ReplayConsumerBridge} from '/core/replay-consumer.js';
const approval = await fetch('/approved-session.json', {cache:'no-store'});
if (!approval.ok) throw Error('N6 supervisor did not approve bootstrap');
const input = await approval.json();
const {request, nativeText, history, instanceId, sessionId, reference} = input;
const q = request.trajectory, H = q.horizon;
const spec = q.histories.find(h => h.id === history);
if (!spec || !['step','bulk','replay','reset'].includes(history)) throw Error('N6 history');
const variant = reference.variants.find(v => v.id === history);
const baseline = reference.variants.find(v => v.id === 'step').frames;
let consumer = new ReplayConsumerBridge(JSON.parse(nativeText), q.clip, 1n);
let cursor = 0, busy = false, faulted = false, disposed = false, audited = 0;
const auditMs = [], dispatchMs = [], controlOnlyMs = [], coreInclusiveMs = [], copyMs = [], acceptedTicks = [];
class AdmissionError extends Error {
 constructor(kind, code) { super(`N6 ${kind}/${code}`); this.kind=kind; this.code=code; }
}
const fail=(kind,code)=>{throw new AdmissionError(kind,code);};
function dataOnly(v, seen=new Set(), depth=0){
 if(depth>32)fail('ADMISSION','command_depth');
 if(!v||typeof v!=='object')return;
 if(seen.has(v))fail('ADMISSION','command_cycle');seen.add(v);
 const proto=Object.getPrototypeOf(v);if(proto!==Object.prototype&&proto!==Array.prototype&&proto!==null)fail('ADMISSION','command_prototype');
 for(const key of Reflect.ownKeys(v)){const d=Object.getOwnPropertyDescriptor(v,key);if(typeof key!=='string'||!d||!('value'in d))fail('ADMISSION','command_accessor');dataOnly(d.value,seen,depth+1);}
 seen.delete(v);
}
function canonical(v) {
 if(v===null||typeof v!=='object')return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
}
function finite(v) {
 if(typeof v==='number'&&!Number.isFinite(v))fail('SIMULATION','nonfinite');
 if(v&&typeof v==='object')for(const x of Object.values(v))finite(x);
}
function check(a,b) {finite(a);if(canonical(a)!==canonical(b))fail('SIMULATION','reference_mismatch');}
function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
function detached(v){const t=performance.now(),x=freeze(structuredClone(v));copyMs.push(performance.now()-t);return x;}
function numerical(tick,bones,records){return {tick:Number(tick),bones:bones.map(b=>({name:b.name,local:[b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY],world:[b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty]})),records:records.map(r=>({constraint:r.constraint,bone:r.bone,values:[r.rotation,r.x,r.y,r.rotationVelocity,r.velocityX,r.velocityY,r.anchorX,r.anchorY]}))};}
function meta(f){return {epoch:String(f.epoch),requested:String(f.requested),completed:String(f.completed),backlog:String(f.backlog),poseTick:Number(f.poseTick),poseTime:[String(f.poseTime.numerator),String(f.poseTime.denominator)],clipTime:f.clipTime,state:f.state,health:f.health,skin:f.skin,targetReached:f.targetReached};}
function current(){if(disposed)fail('STATE','disposed');const {context,...f}=consumer.currentFrame();return f;}
function idle(){if(disposed)fail('STATE','disposed');if(busy)fail('STATE','busy');if(faulted)fail('STATE','faulted');}
function brand(receiver){if(receiver!==facade)fail('STATE','foreign_receiver');}
function bound(cmd){
 if(['request','seek','replay'].includes(cmd?.op)&&(!Number.isSafeInteger(cmd.tick)||cmd.tick<0||cmd.tick>H))fail('HORIZON','tick');
 if(['requestTime','seekTime','replayTime'].includes(cmd?.op)){
  try{const n=BigInt(cmd.n),d=BigInt(cmd.d);if(n<0n||d<=0n||n*120n>BigInt(H)*d)fail('HORIZON','time');}
  catch(e){if(e instanceof AdmissionError)throw e;fail('ADMISSION','time_shape');}
 }
}
function audit(frame){
 // N6_TEST_BOUNDARY: only explicitly instrumented test copies inject faults here.
 const t=performance.now();
 if(frame.tick<0n||frame.tick>BigInt(H))fail('HORIZON','candidate');
 check(numerical(frame.tick,frame.pose.bones,frame.records),baseline[Number(frame.tick)]);
 auditMs.push(performance.now()-t);audited++;acceptedTicks.push(Number(frame.tick));
}
function view(){return detached({sessionId,instanceId,qualificationId:input.qualificationId,history,cursor,complete:cursor===spec.commands.length,admissionState:faulted?'faulted':'ready',auditedCandidates:audited,frame:current()});}
try{const f=current();check(numerical(f.poseTick,f.bones,f.records),baseline[0]);check(meta(f),variant.endpoints[0]);}
catch(e){consumer.dispose(consumer.context);throw e;}
const facade=Object.freeze({
 observe(){brand(this);return view();},
 next(){brand(this);if(disposed)fail('STATE','disposed');return detached({sessionId,cursor,epoch:String(current().epoch),command:spec.commands[cursor]??null});},
 preview(){brand(this);if(disposed)fail('STATE','disposed');const p=consumer.previewFrame();if(!p)return null;const {context,...copy}=p;return detached(copy);},
 execute(envelope){
  brand(this);idle();busy=true;
  try{
   let e;try{dataOnly(envelope);e=structuredClone(envelope);}catch{fail('ADMISSION','command_shape');}
   if(!e||canonical(Object.keys(e).sort())!==canonical(['command','cursor','epoch','sessionId']))fail('ADMISSION','envelope');
   if(e.sessionId!==sessionId||e.cursor!==cursor||e.epoch!==String(current().epoch))fail('ADMISSION','session_cursor_epoch');
   const cmd=e.command;bound(cmd);
   if(cursor>=spec.commands.length||canonical(cmd)!==canonical(spec.commands[cursor]))fail('ADMISSION','transcript');
   check(meta(current()),variant.endpoints[cursor]);
   const started=performance.now();
   try{
    let result;const c=consumer.context;const nativeStart=performance.now(),auditStart=auditMs.length;
    switch(cmd.op){
     case 'play':consumer.play(c,q.clip,cmd.restart);break;
     case 'request':result=consumer.requestTick(c,BigInt(cmd.tick),audit);break;
     case 'pump':if(current().requested>BigInt(H)||current().completed>current().requested)fail('HORIZON','backlog');result=consumer.pump(c,cmd.budget,audit);break;
     case 'seek':consumer.seekTick(c,BigInt(cmd.tick));{const p=consumer.previewFrame();check(numerical(p.tick,p.bones,[]),variant.preview);}break;
     case 'replay':consumer.replayFromOrigin(c,BigInt(cmd.tick));break;
     case 'pause':consumer.pause(c);break;
     case 'resume':consumer.resume(c);break;
     case 'reset':consumer.reset(c,BigInt(cmd.epoch));break;
     default:fail('ADMISSION','operation');
    }
    const nativeElapsed=performance.now()-nativeStart;coreInclusiveMs.push(nativeElapsed);
    const auditElapsed=auditMs.slice(auditStart).reduce((a,b)=>a+b,0);
    if(result?.stop.kind==='failed')fail('SIMULATION','precommit_audit_refused');
    const f=current();check(numerical(f.poseTick,f.bones,f.records),baseline[Number(f.poseTick)]);check(meta(f),variant.endpoints[cursor+1]);cursor++;
    controlOnlyMs.push(performance.now()-started-nativeElapsed+auditElapsed);
   }catch(e){faulted=true;if(e instanceof AdmissionError)throw e;fail('SIMULATION','consumer_fault');}
   finally{dispatchMs.push(performance.now()-started);}
   return view();
  }finally{busy=false;}
 },
 present(callback){brand(this);idle();if(typeof callback!=='function')fail('PRESENTATION','callback');busy=true;
  try{const r=callback(view());if(r&&typeof r.then==='function'){Promise.resolve(r).catch(()=>{});fail('PRESENTATION','async_not_supported');}}
  catch{fail('PRESENTATION','callback_failed');}finally{busy=false;}
 },
 diagnostics(){brand(this);if(disposed)fail('STATE','disposed');return detached({auditedCandidates:audited,acceptedTicks,auditMs,dispatchMs,controlOnlyMs,coreInclusiveMs,copyMs:[...copyMs]});},
 dispose(){brand(this);if(disposed)return;if(busy)fail('STATE','busy');consumer.dispose(consumer.context);consumer=null;disposed=true;}
});
Object.defineProperty(globalThis,'N6',{value:facade,writable:false,configurable:false});
