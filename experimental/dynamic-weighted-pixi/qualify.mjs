import{readFileSync,writeFileSync,mkdirSync,openSync,writeSync,closeSync}from'node:fs';import{join}from'node:path';import{fileURLToPath}from'node:url';import assert from'node:assert/strict';
import{createBoundedBench}from'./bench.mjs';import{createGraphicsHost}from'./host.mjs';import{geometry}from'./measure.mjs';import{png,compare,policy}from'../../scripts/parity-pixels.mjs';
const cfg=JSON.parse(readFileSync(process.argv[2])),out=cfg.qualificationOut;mkdirSync(out);mkdirSync(join(out,'captures'));mkdirSync(join(out,'transcripts'));const bank=JSON.parse(readFileSync(cfg.manifest)),entries=bank.entries,rows=[],histories=[],refusals=[],boundaries=[];
const json=(p,x)=>writeFileSync(p,JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v,2));let authority,gfx;let captures=0;
const placement=c=>({x:300,y:330,scaleX:.9,scaleY:.9,rotation:0,parent:{x:0,y:0,scaleX:1,scaleY:1,rotation:0}});
try{
 authority=await createBoundedBench(cfg);gfx=authority.graphics();json(join(out,'IDENTITIES.json'),{numeric:authority.identity(),graphics:await gfx.call('identity')});
 for(const e of entries){const c=e.id.includes('-combined-')?'combined':'regions',clip=e.expected.trajectory.clip,rig=JSON.parse(readFileSync(e.native)),oracle=JSON.parse(readFileSync(join(cfg.out,'oracles',e.id+'.json')));
  for(const history of cfg.histories??['step','bulk','replay','reset']){
   const instanceId='r2-'+e.id+'-'+history,{session,view}=await authority.create(e.id,history,instanceId,placement(c)),seen=new Set(),fd=openSync(join(out,'transcripts',e.id+'-'+history+'.jsonl'),'wx');let commands=0,record;
   async function capture(label,preview=false,customPlacement=null,opaque=false){
    const result=preview?await view.preview():await view.present(),snapshot=result.snapshot,tick=Number(preview?snapshot.preview.tick:snapshot.frame.completed),reference=oracle.frames.find(f=>f.tick===tick&&f.preview===preview);assert(reference,'missing independent oracle');
    if(customPlacement)await gfx.call('present',{id:view.id,snapshot,placement:customPlacement});const actual=await view.inspect();for(const b of actual.buffers){const submitted=actual.submitted.find(d=>d.backTarget&&d.position?.buffer===b.positionGLId&&d.uv?.buffer===b.uvGLId&&d.index===b.indexGLId);assert(submitted,'No actual drawElements uses read-back buffers for '+b.slot);assert.equal(submitted.count,b.indices.length);}const measure=geometry(actual,reference,snapshot,rig,actual.placement),bytes=Buffer.from(await gfx.call('capture'),'base64'),control=Buffer.from(await gfx.call('control',[{character:c,reference,placement:actual.placement}]),'base64'),pixels=compare(bytes,control,640,480,opaque),stem=e.id+'-'+history+'-'+label;delete pixels.diff;
    const row={id:e.id,fixture:c,clip,history,label,tick,preview,opaque,requested:String(snapshot.frame.requested),completed:String(snapshot.frame.completed),backlog:String(snapshot.frame.backlog),sessionId:snapshot.sessionId,geometry:measure,pixels,placement:actual.placement,metrics:result.metrics,status:measure.status==='PASS'&&pixels.status==='PASS'?'PASS':'FAIL'};
    rows.push(row);json(join(out,'captures',stem+'.json'),{row,snapshot,actual,oracleReference:{file:e.id+'.json',tick,preview},numericEvidence:session.evidence()});writeFileSync(join(out,'captures',stem+'.rgba'),bytes);writeFileSync(join(out,'captures',stem+'-control.rgba'),control);writeFileSync(join(out,'captures',stem+'.png'),png(640,480,bytes));writeFileSync(join(out,'captures',stem+'-control.png'),png(640,480,control));captures++;
    json(join(out,'RESULTS.json'),{rows,histories,refusals,boundaries,pixelPolicy:policy});assert.equal(row.status,'PASS',JSON.stringify(row));return row;
   }
   try{
    await capture('origin');seen.add('0');
    while(!(await session.observe()).complete){const command=await session.next(),snapshot=await session.execute(command);commands++;writeSync(fd,JSON.stringify({envelope:command,snapshot},(_,v)=>typeof v==='bigint'?String(v):v)+'\n');const tick=Number(snapshot.frame.completed),H=e.expected.trajectory.horizon;
     const wanted=history==='step'?[...new Set([0,H,...e.expected.trajectory.initialization.skinSchedule.flatMap(x=>[x.tick-1,x.tick,x.tick+1]).filter(t=>t>=0&&t<=H)])]:[tick];
     if(command.command.op==='seek')await capture('qualified-preview',true);
     else if(command.command.op==='reset')await capture('reset-origin');
     else if(wanted.includes(tick)&&(history!=='step'||!seen.has(String(tick)))){await capture('tick'+tick+'-cursor'+snapshot.cursor);seen.add(String(tick));}
     else await view.present();
    }
    const end=await session.observe();assert.equal(end.frame.completed,BigInt(e.expected.trajectory.horizon));assert.equal(end.frame.backlog,0n);
    if(c==='regions'&&history==='step'){await gfx.call('background',true);await capture('opaque-background',false,null,true);await gfx.call('background',false);}
    if(c==='combined'&&history==='step')await capture('parent-nonuniform',false,{...placement(c),scaleX:.85,scaleY:1.14,rotation:-.12,parent:{x:25,y:-10,scaleX:1.07,scaleY:.91,rotation:.08}});
    const before=await session.observe(),next=await session.next();for(const command of [{op:'request',tick:e.expected.trajectory.horizon+1},{op:'pump',budget:1},{op:'seek',tick:e.expected.trajectory.horizon+1}]){await assert.rejects(session.execute({...next,command}));assert.deepEqual(await session.observe(),before);refusals.push({id:e.id,history,command,before,after:await session.observe()});}
    const copy=structuredClone(before);await gfx.call('mutation',{id:view.id,snapshot:copy});assert.deepEqual(await session.observe(),before);boundaries.push({id:e.id,history,rendererMutationCannotChangeNumeric:true,numericGraph:session.evidence().scripts});
    const d=await session.diagnostics();assert.equal(d.auditedCandidates,e.expected.trajectory.horizon*(history==='reset'?2:1));record={id:e.id,history,commands,audits:d.auditedCandidates,acceptedTicks:d.acceptedTicks,final:before,numericEvidence:session.evidence(),resources:(await view.inspect()).resources};histories.push(record);json(join(out,e.id+'-'+history+'-receipt.json'),record);
   }finally{closeSync(fd);await view.destroy();await session.dispose();}
   console.log(e.id,history,'PASS captures',captures);json(join(out,'RESULTS.json'),{rows,histories,refusals,boundaries,pixelPolicy:policy});
  }
 }
 json(join(out,'GRAPHICS-EVIDENCE.json'),await gfx.evidence());json(join(out,'N6-COSTS.json'),authority.costs());assert.deepEqual((await gfx.evidence()).errors,[]);console.log('QUALIFICATION COMPLETE',histories.length,'histories',captures,'captures');
}finally{json(join(out,'RESULTS.json'),{rows,histories,refusals,boundaries,pixelPolicy:policy});if(gfx)json(join(out,'GRAPHICS-EVIDENCE-FINAL.json'),await gfx.evidence());await authority?.close();}
