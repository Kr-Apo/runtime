/** Trusted R2 launcher. Owns authority and creates sessions; no supplied consumer/provider. */
import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import{createSupervisor}from'../dynamic-skin-bounded/supervisor.mjs';import{createGraphicsHost}from'./host.mjs';
export async function createBoundedBench(cfg){
 const anchorBytes=readFileSync(cfg.anchorPath);if(createHash('sha256').update(anchorBytes).digest('hex')!==cfg.anchorSHA256)throw Error('R2 independent anchor');const anchor=JSON.parse(anchorBytes),manifest=JSON.parse(readFileSync(anchor.manifest.path)),entries=new Map(manifest.entries.map(e=>[e.id,structuredClone(e)]));
 const authority=await createSupervisor(cfg);let graphics,closed=false,cleanup;try{graphics=await createGraphicsHost(cfg);}catch(e){await authority.close();throw e;}
 return Object.freeze({
  async create(qualificationId,history,instanceId,placement,{fault=false}={}){
   const e=entries.get(qualificationId);if(!e)throw Error('G1 accepts only exact Q1 dynamic qualifications');const input={qualificationId,history,instanceId,nativeBytes:readFileSync(e.native),request:e.expected},ticket=authority.authorize(input),session=await authority.start(ticket,instanceId);
   try{const view=await graphics.bind(session,e,placement,{fault});return Object.freeze({session,view});}catch(error){await session.dispose();throw error;}
  },
  identity(){return authority.identity();},costs(){return authority.costs();},
  graphics(){return graphics;},
  async close(){if(closed)return cleanup;closed=true;try{try{cleanup=await graphics.call('dispose');}catch(e){cleanup={explicitCleanupFailed:String(e)};}finally{await graphics.close();}}finally{await authority.close();}return cleanup;}
 });
}
