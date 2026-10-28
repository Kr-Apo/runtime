/** Dynamic Chrome contract; no fixed N5 certificate can satisfy this profile. */
import{canonical,identity,hash,LIMITS,validateRequest,analyze as offlineAnalyze}from'./contract.mjs';
export{canonical,identity,hash};
export const CONTRACT='ankhimate.browser.dynamic-skins/1';
export const TOLERANCES=LIMITS;
export function trajectory(q){return Object.fromEntries(['asset','fixture','clip','horizon','simulation','initialization','histories','project','exportSettings'].map(k=>[k,structuredClone(q[k])]));}
export function valid(request,rig){if(request?.contract!==CONTRACT||!request.offline?.request)throw Error('Q1 dynamic Chrome contract required');validateRequest(request.offline.request,rig);if(canonical(trajectory(request.offline.request))!==canonical(request.trajectory)||!request.javascriptBuild?.sha256||!request.browserIdentity?.sha256||!request.rustReference?.sha256||request.rustReference.sourceRequestHash!==identity(request.offline.request))throw Error('Q1 browser identities');return request.trajectory;}
export function analyze(request,rig,rust,chrome,difference=()=>{}){
 try{valid(request,rig);}catch(error){return{status:'INVALID_INPUT',problems:[{code:'request',detail:String(error)}]};}
 if(chrome?.executionError)return{status:'INCOMPLETE_EVIDENCE',problems:[{code:'browser',detail:chrome.executionError}]};
 if(chrome?.contract!=='ankhimate.browser.dynamic-trace/1'||chrome.requestHash!==identity(request)||chrome.assetSHA256!==request.trajectory.asset.sha256||rust?.requestHash!==request.rustReference.sourceRequestHash)return{status:'INVALID_INPUT',problems:[{code:'request-evidence-binding',detail:'Dynamic Chrome/Rust hashes differ'}]};
 // Explicit comparison adapter after both original trace hashes have been checked.
 // The Chrome file retains its real browser requestHash; no file/certificate is rewritten.
 let a;try{a=offlineAnalyze(request.offline.request,rig,rust,{...chrome,requestHash:identity(request.offline.request)},difference);}catch(error){return{status:'INCOMPLETE_EVIDENCE',problems:[{code:'malformed-evidence',detail:String(error)}]};}
 return{...a,status:a.status==='QUALIFIED_DYNAMIC_BOUNDED'?'QUALIFIED_DYNAMIC_BROWSER_BOUNDED':a.status};
}
export function makeCertificate(request,result,proofs,differences){return{contract:CONTRACT,request,requestHash:identity(request),status:result.status,coverage:{origin:0,inclusiveHorizon:request.trajectory.horizon,ticks:result.verifiedTicks??[],...result.coverage},tolerances:TOLERANCES,maxima:result.maxima??{},firstViolation:result.firstViolation??null,violations:result.violations??0,nonfinite:result.nonfinite??[],equivalence:result.equivalence??null,problems:result.problems??[],proofs,differences,scope:'Exact native E1 immutable skin calendar; Rust/Node/Chrome CPU only, no renderer or unbounded guarantee',trust:'Unsigned local supervised evidence; independent expected request and approval bank required'};}
