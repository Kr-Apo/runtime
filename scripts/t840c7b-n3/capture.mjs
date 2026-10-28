/** Capture actual C7A consumer states; numeric mesh probes only, no graphics imports. */
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export async function capture(coreDirectory,rig,request){
 const {ReplayConsumerBridge}=await import(pathToFileURL(resolve(coreDirectory,'replay-consumer.js')).href);
 const {parseRig}=await import(pathToFileURL(resolve(coreDirectory,'rig.js')).href);rig=parseRig(structuredClone(rig));
 const meshEntries=rig.drawOrder.flatMap(slot=>{const s=rig.slots.find(s=>s.name===slot),e=rig.skins.find(s=>s.name===rig.defaultSkin).attachments.find(e=>e.slot===slot&&e.name===s.attachment);return e?.attachment.type==='mesh'?[{slot,bone:s.bone,a:e.attachment}]:[];});
 const numeric=(tick,bones,records)=>({tick:Number(tick),bones:bones.map((b,i)=>{const x=b.rotation+b.shearX,y=b.rotation+Math.PI/2+b.shearY;return{name:b.name,local:[b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY],matrix:[Math.cos(x)*b.scaleX,Math.sin(x)*b.scaleX,Math.cos(y)*b.scaleY,Math.sin(y)*b.scaleY,b.x,b.y],world:[b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty],tip:[b.world.tx+b.world.a*rig.bones[i].length,b.world.ty+b.world.b*rig.bones[i].length]};}),records:records.map(r=>({constraint:r.constraint,bone:r.bone,values:[r.rotation,r.x,r.y,r.rotationVelocity,r.velocityX,r.velocityY,r.anchorX,r.anchorY]})),meshes:meshEntries.map(({slot,bone,a})=>({slot,vertices:Array.from({length:a.vertex_count},(_,i)=>{let x=0,y=0,total=0;const influences=(a.weights[i]?.bones??[]).map(w=>{const m=bones.find(b=>b.name===w.bone).world,position=[m.a*w.x+m.c*w.y+m.tx,m.b*w.x+m.d*w.y+m.ty];x+=position[0]*w.weight;y+=position[1]*w.weight;total+=w.weight;return{bone:w.bone,position};});if(total>0)return{position:[x/total,y/total],influences};const m=bones.find(b=>b.name===bone).world,px=a.vertices[i*2],py=a.vertices[i*2+1];return{position:[m.a*px+m.c*py+m.tx,m.b*px+m.d*py+m.ty],influences};})}))});
 const meta=c=>{const f=c.currentFrame();return{epoch:String(f.epoch),requested:String(f.requested),completed:String(f.completed),backlog:String(f.backlog),poseTick:Number(f.poseTick),poseTime:[String(f.poseTime.numerator),String(f.poseTime.denominator)],clipTime:f.clipTime,state:f.state,health:f.health,skin:f.skin,targetReached:f.targetReached};};
 const variants=[];
 for(const spec of request.histories){const c=new ReplayConsumerBridge(rig,request.clip,1n);let f=c.currentFrame();const v={id:spec.id,commands:spec.commands,frames:[numeric(f.poseTick,f.bones,f.records)],endpoints:[meta(c)]};if(spec.id!=='step')v.commits=[numeric(f.poseTick,f.bones,f.records)];let target=v.frames;
  for(const command of spec.commands){let progress;
   const audit=frame=>{if(spec.id!=='step')target.push(numeric(frame.tick,frame.pose.bones,frame.records));};
   try{switch(command.op){case'play':c.play(c.context,request.clip,command.restart);break;case'request':progress=c.requestTick(c.context,BigInt(command.tick),audit);break;case'pump':progress=c.pump(c.context,command.budget,audit);break;case'seek':c.seekTick(c.context,BigInt(command.tick));{const p=c.previewFrame();v.preview=numeric(p.tick,p.bones,[]);}break;case'replay':c.replayFromOrigin(c.context,BigInt(command.tick));break;case'pause':c.pause(c.context);break;case'resume':c.resume(c.context);break;case'reset':c.reset(c.context,BigInt(command.epoch));f=c.currentFrame();v.resetFrames=[numeric(f.poseTick,f.bones,f.records)];target=v.resetFrames;break;default:throw Error('unknown history command');}
    f=c.currentFrame();if(spec.id==='step'&&command.op==='request'&&v.frames.at(-1).tick!==Number(f.poseTick))v.frames.push(numeric(f.poseTick,f.bones,f.records));v.endpoints.push(meta(c));if(spec.id!=='step')v.commits.push(numeric(f.poseTick,f.bones,f.records));if(progress?.stop.kind==='failed'){v.termination={kind:'failed',error:String(progress.stop.error)};break;}
   }catch(e){v.termination={kind:'error',error:String(e)};break;}
  }
  c.dispose(c.context);variants.push(v);
 }
 return{requestHash:await import('./contract.mjs').then(m=>m.identity(request)),variants};
}
