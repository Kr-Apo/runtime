/** Controller/IPC costs only. No renderer benchmark or disabled validation. */
import{readFileSync,writeFileSync}from'node:fs';import{performance}from'node:perf_hooks';import{createSupervisor}from'./supervisor.mjs';
const cfg=JSON.parse(readFileSync(process.argv[2])),m=JSON.parse(readFileSync(cfg.manifest)),e=m.entries.find(e=>e.id==='simple-fault_at_20'),rows=[];let s;
try{
 s=await createSupervisor(cfg);
 for(let i=0;i<8;i++){
  const id='profile-'+i,args={qualificationId:e.id,history:'bulk',instanceId:id,nativeBytes:readFileSync(e.native),request:e.expected};let t=performance.now();const ticket=s.authorize(args),authorizationMs=performance.now()-t;t=performance.now();const c=await s.start(ticket,id),creationMs=performance.now()-t,rpcs=[];
  while(!(await c.observe()).complete){let t=performance.now();const command=await c.next();rpcs.push({method:'next',ms:performance.now()-t});t=performance.now();await c.execute(command);rpcs.push({method:'execute',ms:performance.now()-t});}
  const metrics=await c.diagnostics();t=performance.now();await c.observe();rpcs.push({method:'observe',ms:performance.now()-t});t=performance.now();await c.dispose();const destructionMs=performance.now()-t;
  rows.push({iteration:i,warmup:i===0,authorizationMs,creationMs,destructionMs,rpcs,browser:metrics});
 }
 writeFileSync(cfg.out+'/PROFILE.json',JSON.stringify({identity:s.identity(),rows,supervisor:s.costs(),scope:'Same exact short bulk history and all validations. Initial proof recomputation distinguished from seal-rechecked cached authorization. Browser audit/copy times are quantized; zero is not free. dispatchMs/coreInclusiveMs include native execution; controlOnlyMs subtracts native simulation for the dispatch segment after envelope checks. RPC includes IPC, queue and browser/controller work; no renderer or GPU performance claim.'},null,2));
}finally{await s?.close();}
