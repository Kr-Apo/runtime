import{numeric as project,skinAt,meta as frameMeta}from'./projection.mjs';
/** Capture actual C7A consumer states; numeric mesh probes only, no graphics imports. */
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export async function capture(coreDirectory,rig,request){
 const {ReplayConsumerBridge}=await import(pathToFileURL(resolve(coreDirectory,'replay-consumer.js')).href);
 const {parseRig}=await import(pathToFileURL(resolve(coreDirectory,'rig.js')).href);rig=parseRig(structuredClone(rig));
 const numeric=(tick,bones,records,skin=skinAt(request.initialization.skinSchedule,Number(tick)))=>project(rig,Number(tick),skin,bones,records);
 const variants=[];
 for(const spec of request.histories){const c=new ReplayConsumerBridge(rig,request.clip,1n,request.initialization.skinSchedule.map(e=>({tick:BigInt(e.tick),skin:e.skin})));let f=c.currentFrame();const v={id:spec.id,commands:spec.commands,frames:[numeric(f.poseTick,f.bones,f.records,f.skin)],endpoints:[frameMeta(c.currentFrame())]};if(spec.id!=='step')v.commits=[numeric(f.poseTick,f.bones,f.records,f.skin)];let target=v.frames;
  for(const command of spec.commands){let progress;
   const audit=frame=>{if(spec.id!=='step')target.push(numeric(frame.tick,frame.pose.bones,frame.records));};
   try{switch(command.op){case'play':c.play(c.context,request.clip,command.restart);break;case'request':progress=c.requestTick(c.context,BigInt(command.tick),audit);break;case'pump':progress=c.pump(c.context,command.budget,audit);break;case'seek':c.seekTick(c.context,BigInt(command.tick));{const p=c.previewFrame();v.preview=numeric(p.tick,p.bones,[]);}break;case'replay':c.replayFromOrigin(c.context,BigInt(command.tick));break;case'pause':c.pause(c.context);break;case'resume':c.resume(c.context);break;case'reset':c.reset(c.context,BigInt(command.epoch));f=c.currentFrame();v.resetFrames=[numeric(f.poseTick,f.bones,f.records,f.skin)];target=v.resetFrames;break;default:throw Error('unknown history command');}
    f=c.currentFrame();if(spec.id==='step'&&command.op==='request'&&v.frames.at(-1).tick!==Number(f.poseTick))v.frames.push(numeric(f.poseTick,f.bones,f.records,f.skin));v.endpoints.push(frameMeta(c.currentFrame()));if(spec.id!=='step')v.commits.push(numeric(f.poseTick,f.bones,f.records,f.skin));if(progress?.stop.kind==='failed'){v.termination={kind:'failed',error:String(progress.stop.error)};break;}
   }catch(e){v.termination={kind:'error',error:String(e)};break;}
  }
  c.dispose(c.context);variants.push(v);
 }
 return{requestHash:await import('./contract.mjs').then(m=>m.identity(request)),variants};
}
