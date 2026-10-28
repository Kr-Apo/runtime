import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ReplayConsumerBridge,ReplayAnimationInstance,parseRig} from '../../core/dist/index.js';
const input=resolve(process.argv[2]??''),out=resolve(process.argv[3]??'');
if(!process.argv[2]||!process.argv[3])throw Error('compare.mjs <reference> <new output>');await mkdir(out);
const limits=JSON.parse(await readFile(new URL('./thresholds.json',import.meta.url),'utf8'));
const events=[{tick:0n,skin:'on'},{tick:120n,skin:'off'},{tick:240n,skin:'on'}];
const vectors=JSON.parse(await readFile(new URL('../../core/test/fixtures/t840b5b2/consumer-vectors.json',import.meta.url),'utf8'));
const cases=JSON.parse(await readFile(resolve(input,'cases.json'),'utf8')),rows=[],traces=[],maxima={},groupings=new Map();
const bones=p=>p.map(b=>({name:b.name,values:[b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY,b.world.a,b.world.b,b.world.c,b.world.d,b.world.tx,b.world.ty]}));
const records=p=>p.map(r=>({constraint:r.constraint,values:[r.rotation,r.x,r.y,r.rotationVelocity,r.velocityX,r.velocityY,r.anchorX,r.anchorY]}));
const time=t=>[String(t.numerator),String(t.denominator)];
function snapshot(b){try{const {context,bones:bs,records:rs,...s}=b.currentFrame();return {...s,identity:[String(s.epoch),String(s.poseTick)],epoch:String(s.epoch),requested:String(s.requested),completed:String(s.completed),backlog:String(s.backlog),poseTick:String(s.poseTick),poseTime:time(s.poseTime),bones:bones(bs),records:records(rs)};}catch{return null;}}
function preview(b){try{const p=b.previewFrame();return p?{epoch:String(p.epoch),tick:String(p.tick),skin:p.skin,poseTime:time(p.poseTime),clipTime:p.clipTime,bones:bones(p.bones)}:null;}catch{return null;}}
function status(b){const s=b.transportStatus();return {state:s.state,epoch:String(b.context.epoch),position:s.position===null?null:String(s.position),kind:s.poseKind==='pure'?'Pure':s.poseKind==='simulated'?'Simulated':null,replayComplete:s.replayComplete};}
function pose(rig,p){return p.bones.map((b,i)=>({name:b.name,values:[...bones([b])[0].values,b.world.tx+b.world.a*rig.bones[i].length,b.world.ty+b.world.b*rig.bones[i].length]}));}
const frame=(r,f)=>({tick:String(f.tick),bones:pose(r,f.pose),records:records(f.records)});
for(const c of cases){
 const vector=vectors.find(v=>v.name===c.name);assert.deepEqual(c.ops,vector.ops);
 const bytes=await readFile(resolve(input,c.rig+'.native.json'));assert.deepEqual(bytes,await readFile(new URL('../../core/test/fixtures/t840b5b2/'+c.rig+'.native.json',import.meta.url)));
 const rig=parseRig(bytes.toString()),b=new ReplayConsumerBridge(rig,'breathing',1n,events),pure=new ReplayAnimationInstance(rig,'breathing',1n,events),tokens=new Map(),steps=[],frames=[];
 for(const [index,o]of c.ops.entries()){
  const ctx=o.context?tokens.get(o.context):b.context,before={snapshot:snapshot(b),preview:preview(b),status:status(b)};
  const audit=f=>frames.push({op:index,pre:pose(rig,pure.sampleTick(f.tick)),post:frame(rig,f)});let failed=false;
  try{switch(o.op){
   case'capture':tokens.set(o.name,ctx);break;case'play':b.play(ctx,'breathing',false);break;case'pause':b.pause(ctx);break;case'resume':b.resume(ctx);break;case'stop':b.stop(ctx);break;
   case'reset':b.reset(ctx,BigInt(o.epoch));break;case'seek':b.seekTick(ctx,BigInt(o.tick));break;case'replay':b.replayFromOrigin(ctx,BigInt(o.tick));break;
   case'request':assert.notEqual(b.requestTime(ctx,BigInt(o.n),BigInt(o.d),audit).stop.kind,'failed');break;case'pump':assert.notEqual(b.pump(ctx,o.budget,audit).stop.kind,'failed');break;
   case'observe':for(let n=0;n<100;n++){assert.deepEqual({snapshot:snapshot(b),preview:preview(b),status:status(b)},before);if(before.snapshot)b.present(()=>{});}break;
   case'present-fail':assert.throws(()=>b.present(()=>{throw Error('renderer failed');}));assert.deepEqual({snapshot:snapshot(b),preview:preview(b),status:status(b)},before);break;
   case'audit-fail':assert.equal(b.requestTick(ctx,BigInt(o.tick),()=>{throw Error('precommit audit');}).stop.kind,'failed');assert.equal(b.transportStatus().state,'faulted');break;
   case'dispose':b.dispose(ctx);break;default:assert.fail(o.op);
  }}catch(e){failed=true;if(!o.error)throw e;}
  assert.equal(failed,o.error??false,`${c.name}/${index}`);if(failed)assert.deepEqual({snapshot:snapshot(b),preview:preview(b),status:status(b)},before);
  const f=snapshot(b);if(f){
   assert.equal(f.poseTick,f.completed);assert.equal(f.skin,BigInt(f.completed)<120n||BigInt(f.completed)>=240n?'on':'off');
   const oracle=f.poseTick==='0'?frame(rig,pure.frame()):frames.at(-1).post;
   assert.equal(oracle.tick,f.poseTick);assert.deepEqual(oracle.records,f.records);
   assert.deepEqual(oracle.bones.map(b=>({name:b.name,values:b.values.slice(0,13)})),f.bones);
  }
  steps.push({snapshot:f,preview:preview(b),status:status(b),outcome:failed?'error':'ok'});
 }
 let first=null;
 function compare(a,e,path='root',stage='snapshot'){
  if(a===null||e===null){assert.equal(a,e,path);return;}
  if(typeof a==='number'){
   assert.ok(Number.isFinite(a)&&Number.isFinite(e),path);const match=path.match(/\.values\.(\d+)$/);let field='clipTime';
   if(match){const n=Number(match[1]);field=path.includes('.records.')?(n===0?'rotation':n<3?'localTranslation':n===3?'angularVelocity':n<6?'linearVelocity':'anchor'):n<2?'localTranslation':n===2?'rotation':n<7?'scaleShear':n<11?'worldLinear':n<13?'worldTranslation':'tip';}
   const error=field==='rotation'?Math.abs(Math.atan2(Math.sin(a-e),Math.cos(a-e))):Math.abs(a-e),key=stage+'/'+field;
   if(!maxima[key]||error>maxima[key].error)maxima[key]={error,case:c.name,path};if(error>(limits[field]??0)&&!first)first={path,field,error,actual:a,expected:e};return;
  }
  if(Array.isArray(a)){assert.equal(a.length,e.length,path);a.forEach((v,i)=>compare(v,e[i],path+'.'+i,stage));return;}
  if(typeof a==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(e).sort(),path);for(const k of Object.keys(a))compare(a[k],e[k],path+'.'+k,stage);return;}
  assert.equal(a,e,path);
 }
 compare(steps,c.result.steps,'steps','published');compare(frames,c.result.frames,'ticks','audit');
 if(c.name.includes('/')){const perTick=frames.map(f=>f.post);if(groupings.has(c.rig))assert.deepEqual(perTick,groupings.get(c.rig));else groupings.set(c.rig,perTick);}
 rows.push({name:c.name,commands:steps.length,frames:frames.length,status:first?'DIVERGENCE':'PASS',first});traces.push({name:c.name,steps,frames});
}
await writeFile(resolve(out,'typescript-traces.json'),JSON.stringify(traces));await writeFile(resolve(out,'results.json'),JSON.stringify({limits,maxima,rows},null,2));console.log(JSON.stringify({cases:rows.length,commands:rows.reduce((n,r)=>n+r.commands,0),frames:rows.reduce((n,r)=>n+r.frames,0),maxima,failures:rows.filter(r=>r.first)},null,2));assert.ok(rows.every(r=>!r.first));
