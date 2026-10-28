/** Node-only opt-in local admission. No existing consumer/adapter API is changed. */
import {readFileSync,lstatSync,openSync,readSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {canonical,hash,identity} from '../../scripts/t840c7b-n3/contract.mjs';
import {loadBuild,readJSON,projectIdentity} from '../../scripts/t840c7b-n3/build.mjs';
import {verifyBundle} from '../../scripts/t840c7b-n3/cli.mjs';

export class AdmissionError extends Error {
  constructor(kind,code){super(`Bounded admission: ${kind}/${code}`);this.name='AdmissionError';this.kind=kind;this.code=code;}
}
const fail=(kind,code)=>{throw new AdmissionError(kind,code);};
function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
const detached=v=>freeze(structuredClone(v));
function finite(v){if(typeof v==='number'&&!Number.isFinite(v))fail('SIMULATION','nonfinite');if(v&&typeof v==='object')for(const x of Object.values(v))finite(x);}
function equal(a,b){try{return canonical(a)===canonical(b);}catch{return false;}}
function fileSeal(path){if(lstatSync(path).isSymbolicLink())fail('CERTIFICATE','symlink');const fd=openSync(path,'r'),buffer=Buffer.alloc(1048576),h=createHash('sha256');let bytes=0;try{let n;while((n=readSync(fd,buffer,0,buffer.length,null))>0){h.update(buffer.subarray(0,n));bytes+=n;}}finally{closeSync(fd);}return{sha256:h.digest('hex'),bytes};}
function reference(f){return {tick:f.tick,bones:f.bones.map(b=>({name:b.name,local:b.local,world:b.world})),records:f.records};}
function numerical(tick,bones,records){return {tick:Number(tick),bones:bones.map(b=>({name:b.name,local:[b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY],world:[b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty]})),records:records.map(r=>({constraint:r.constraint,bone:r.bone,values:[r.rotation,r.x,r.y,r.rotationVelocity,r.velocityX,r.velocityY,r.anchorX,r.anchorY]}))};}
function meta(f){return {epoch:String(f.epoch),requested:String(f.requested),completed:String(f.completed),backlog:String(f.backlog),poseTick:Number(f.poseTick),poseTime:[String(f.poseTime.numerator),String(f.poseTime.denominator)],clipTime:f.clipTime,state:f.state,health:f.health,skin:f.skin,targetReached:f.targetReached};}
function check(actual,expected){finite(actual);if(!equal(actual,expected))fail('SIMULATION','trajectory_mismatch');}
function horizon(command,H){
  if(['request','seek','replay'].includes(command?.op)&&(!Number.isSafeInteger(command.tick)||command.tick<0||command.tick>H))fail('HORIZON','tick');
  if(['requestTime','seekTime'].includes(command?.op)){
    try{const n=BigInt(command.n),d=BigInt(command.d);if(n<0n||d<=0n||n*120n>BigInt(H)*d)fail('HORIZON','time');}catch(e){if(e instanceof AdmissionError)throw e;fail('ADMISSION','invalid_time');}
  }
}
function controller(prepared,spec,instanceId,Consumer){
  const q=prepared.request,H=q.horizon,variant=prepared.variants[spec.id],baseline=prepared.frames;
  let consumer=new Consumer(JSON.parse(prepared.bytes.toString('utf8')),q.clip,1n),cursor=0,busy=false,faulted=false,disposed=false,auditedCandidates=0;
  const sessionId=randomUUID();
  const idle=()=>{if(disposed)fail('STATE','disposed');if(busy)fail('STATE','busy');if(faulted)fail('STATE','faulted');};
  const current=()=>{if(disposed)fail('STATE','disposed');return consumer.currentFrame();};
  function audit(frame){
    // N4_TEST_BOUNDARY: test-only copies inject faults here; production has no injection API.
    if(frame.tick<0n||frame.tick>BigInt(H))fail('HORIZON','candidate');
    check(numerical(frame.tick,frame.pose.bones,frame.records),baseline[Number(frame.tick)]);auditedCandidates++;
  }
  try{const f=current();check(numerical(f.poseTick,f.bones,f.records),baseline[0]);check(meta(f),variant.endpoints[0]);}catch(e){consumer.dispose(consumer.context);throw e;}
  const view=()=>detached({sessionId,instanceId,qualificationId:prepared.id,history:spec.id,cursor,auditedCandidates,complete:cursor===spec.commands.length,admissionState:faulted?'faulted':'ready',frame:current()});
  const facade={
    observe(){return view();},
    preview(){const p=current().state==='seek_preview'?consumer.previewFrame():null;return detached(p);},
    next(){if(disposed)fail('STATE','disposed');return detached({sessionId,command:spec.commands[cursor]??null});},
    execute(envelope){
      idle();busy=true;
      try{
        let e;try{e=structuredClone(envelope);}catch{fail('ADMISSION','command_shape');}
        if(!e||!equal(Object.keys(e).sort(),['command','sessionId'])||e.sessionId!==sessionId)fail('ADMISSION','foreign_session');
        const cmd=e.command;horizon(cmd,H);
        if(!equal(cmd,spec.commands[cursor]??null)||cursor>=spec.commands.length)fail('ADMISSION','unqualified_command');
        let result;
        try{
          const c=consumer.context;
          switch(cmd.op){
            case'play':consumer.play(c,q.clip,cmd.restart);break;
            case'request':result=consumer.requestTick(c,BigInt(cmd.tick),audit);break;
            case'pump':{const f=current();if(f.requested>BigInt(H)||f.completed>f.requested)fail('HORIZON','backlog');result=consumer.pump(c,cmd.budget,audit);break;}
            case'seek':consumer.seekTick(c,BigInt(cmd.tick));{const p=consumer.previewFrame();check(numerical(p.tick,p.bones,[]),variant.preview);}break;
            case'replay':consumer.replayFromOrigin(c,BigInt(cmd.tick));break;
            case'pause':consumer.pause(c);break;
            case'resume':consumer.resume(c);break;
            case'reset':consumer.reset(c,BigInt(cmd.epoch));break;
            default:fail('ADMISSION','unsupported_command');
          }
          if(result?.stop.kind==='failed')fail('SIMULATION','transaction_refused');
          const f=current();check(numerical(f.poseTick,f.bones,f.records),baseline[Number(f.poseTick)]);check(meta(f),variant.endpoints[cursor+1]);cursor++;
        }catch(error){faulted=true;if(error instanceof AdmissionError)throw error;fail('SIMULATION','consumer_fault');}
        return view();
      }finally{busy=false;}
    },
    present(callback){idle();if(typeof callback!=='function')fail('PRESENTATION','callback');busy=true;try{const result=callback(view());if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});fail('PRESENTATION','async_not_supported');}}catch{fail('PRESENTATION','callback_failed');}finally{busy=false;}},
    dispose(){if(disposed)return;if(busy)fail('STATE','busy');consumer.dispose(consumer.context);consumer=null;disposed=true;},
  };
  return Object.freeze(facade);
}

/** Caller supplies an independently pinned manifest digest from its trusted local bank. */
export function loadApprovedBank({manifestPath,approvedManifestSHA256,buildPath}={}){
  let manifest,build;
  try{if(!/^[a-f0-9]{64}$/.test(approvedManifestSHA256)||lstatSync(manifestPath).isSymbolicLink())fail('TRUST','manifest');const bytes=readFileSync(manifestPath);if(hash(bytes)!==approvedManifestSHA256)fail('TRUST','manifest_digest');manifest=JSON.parse(bytes.toString());build=loadBuild(buildPath);}catch(e){if(e instanceof AdmissionError)throw e;fail('TRUST','missing_or_invalid_bank');}
  if(manifest?.contract!=='ankhimate.local-bounded-bank/1'||!Array.isArray(manifest.entries)||!manifest.entries.length)fail('TRUST','manifest_shape');
  const entries=new Map();try{for(const e of manifest.entries){if(!e||typeof e.id!=='string'||entries.has(e.id)||!e.expected||identity(e.expected)!==e.requestHash||!/^[a-f0-9]{64}$/.test(e.certificateSHA256))fail('TRUST','entry');entries.set(e.id,detached(e));}}catch(error){if(error instanceof AdmissionError)throw error;fail('TRUST','entry');}
  const tickets=new WeakMap(),cache=new Map();let serial=0;
  function prepare(id){
    const entry=entries.get(id);if(!entry)fail('TRUST','unapproved_qualification');
    let b;try{b=loadBuild(buildPath);}catch{fail('ADMISSION','stale_build');}
    if(!equal(b.builds,entry.expected.builds))fail('ADMISSION','numeric_identity');
    const bytes=readFileSync(entry.asset);if(hash(bytes)!==entry.expected.asset.sha256||bytes.length!==entry.expected.asset.byteLength)fail('ADMISSION','native_identity');
    if(!equal(projectIdentity(entry.project),entry.expected.project))fail('ADMISSION','author_identity');
    if(cache.has(id)){const p=cache.get(id);try{if(lstatSync(entry.bundle).isSymbolicLink()||lstatSync(join(entry.bundle,'certificate.json')).isSymbolicLink()||hash(readFileSync(join(entry.bundle,'certificate.json')))!==entry.certificateSHA256)fail('CERTIFICATE','changed_cached_certificate');for(const[name,seal]of Object.entries(p.evidence))if(!equal(fileSeal(join(entry.bundle,name)),seal))fail('CERTIFICATE','changed_cached_proof');}catch(error){if(error instanceof AdmissionError)throw error;fail('CERTIFICATE','missing_cached_proof');}return p;}
    if(hash(readFileSync(join(entry.bundle,'certificate.json')))!==entry.certificateSHA256)fail('CERTIFICATE','unapproved_certificate_bytes');
    const v=verifyBundle({directory:entry.bundle,expected:entry.expected,bytes,build:b,project:entry.project});if(!v.valid)fail('CERTIFICATE',v.status);
    const raw=readJSON(join(entry.bundle,'typescript.json'));
    const frames=raw.variants.find(v=>v.id==='step').frames.map(reference),variants=Object.fromEntries(raw.variants.map(v=>[v.id,{endpoints:v.endpoints,...(v.preview?{preview:reference(v.preview)}:{})}]));
    const p={id,evidence:detached(v.certificate.evidence),request:entry.expected,bytes:Buffer.from(bytes),frames:detached(frames),variants:detached(variants)};cache.set(id,p);return p;
  }
  return Object.freeze({
    async authorize({qualificationId,history,instanceId,nativeBytes,request}={}){
      if(typeof instanceId!=='string'||!instanceId)fail('ADMISSION','instance_identity');
      const e=entries.get(qualificationId);if(!e)fail('TRUST','unapproved_qualification');
      let bytes;try{bytes=Buffer.from(nativeBytes);}catch{fail('ADMISSION','native_bytes');}
      if(hash(bytes)!==e.expected.asset.sha256||bytes.length!==e.expected.asset.byteLength||!equal(request,e.expected))fail('ADMISSION','requested_identity');
      const spec=e.expected.histories.find(h=>h.id===history);if(!spec)fail('ADMISSION','history');
      let p;try{p=prepare(qualificationId);}catch(error){if(error instanceof AdmissionError)throw error;fail('CERTIFICATE','source_or_proof_io');}
      const {ReplayConsumerBridge}=await import(pathToFileURL(join(build.coreDirectory,'replay-consumer.js')).href);
      const ticket=Object.freeze(Object.create(null));tickets.set(ticket,{p,spec,instanceId,Consumer:ReplayConsumerBridge,serial:serial++});return ticket;
    },
    start(ticket,instanceId){
      const t=ticket&&typeof ticket==='object'?tickets.get(ticket):null;if(!t||t.instanceId!==instanceId)fail('ADMISSION','foreign_or_used_ticket');
      tickets.delete(ticket);try{const b=loadBuild(buildPath);if(!equal(b.builds,t.p.request.builds))fail('ADMISSION','numeric_identity');return controller(t.p,t.spec,instanceId,t.Consumer);}catch(e){if(e instanceof AdmissionError)throw e;fail('ADMISSION','initialization');}
    },
  });
}
