import {parseRig,validateWeightedFfdRig,validateAnimatedSlotsRig,validateEventRig,validateSlotsEventsRig,validateComposedFfdRig,validateLinkedMeshRig,validateLinkedFfdRig,validateMixingRig} from '@ankhimate/runtime';
import {validateSource} from '../dynamic-weighted-pixi/geometry.mjs';
import {replayPage} from '/phaser/replay-load.js';
const freeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};

/** Caller-owned shared pages. Native E1 data stays detached from the input bytes. */
export async function loadAsset({source,signal,createPage,deletePage,weightedFfd=false,animatedSlots=false,animationEvents=false,clipping=false,linkedMeshes=false,crossfade=false,interruptible=false}) {
    if(typeof interruptible!=='boolean'||interruptible&&!crossfade)throw Error('interruptible requires crossfade');
    if(typeof crossfade!=='boolean'||crossfade&&(linkedMeshes||clipping||weightedFfd&&(animatedSlots||animationEvents)&&!(animatedSlots&&animationEvents)||animationEvents&&!animatedSlots))throw Error('Explicit crossfade-only asset mode');
    if(typeof linkedMeshes!=='boolean' ||linkedMeshes&&(!animatedSlots||animationEvents||clipping))throw Error('Linked+slots only, optional FFD');
    if(typeof weightedFfd!=='boolean'||typeof animatedSlots!=='boolean'||typeof animationEvents!=='boolean'||weightedFfd&&animationEvents&&!(crossfade&&animatedSlots))throw Error('One explicit channel mode required');
    if(typeof clipping!=='boolean'||clipping&&(!animatedSlots||animationEvents))throw Error('Explicit clipping+slots only');
    const url=new URL(source,location.href);
    if (!['http:','https:'].includes(url.protocol)) throw Error('Use HTTP(S) for native exports');
    signal?.throwIfAborted();
    const response=await fetch(url,{signal,credentials:'omit'});
    if (!response.ok) throw Error(`Native JSON HTTP ${response.status}`);
    const bytes=await response.arrayBuffer(),nativeSHA256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
    const parsed=parseRig(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));if(weightedFfd&&!animatedSlots&&!crossfade)validateWeightedFfdRig(parsed,Object.keys(parsed.animations)[0]);
    if(crossfade)validateMixingRig(parsed,Object.keys(parsed.animations)[0],animatedSlots,animationEvents,weightedFfd);else if(linkedMeshes)(weightedFfd?validateLinkedFfdRig:validateLinkedMeshRig)(parsed,Object.keys(parsed.animations)[0]);else if(weightedFfd&&animatedSlots)validateComposedFfdRig(parsed,Object.keys(parsed.animations)[0],undefined,clipping);else if(animatedSlots&&animationEvents)validateSlotsEventsRig(parsed,Object.keys(parsed.animations)[0]);else{if(animatedSlots)validateAnimatedSlotsRig(parsed,Object.keys(parsed.animations)[0],undefined,clipping);if(animationEvents)validateEventRig(parsed,Object.keys(parsed.animations)[0]);}
    const rig=freeze(validateSource(parsed,crossfade?{crossfade:true,...(interruptible?{interruptible:true}:{}),...(animatedSlots?{animatedSlots:true}:{}),...(animationEvents?{animationEvents:true}:{}),...(weightedFfd?{weightedFfd:true}:{})}:linkedMeshes?{linkedMeshes:true,animatedSlots:true,...(weightedFfd?{weightedFfd:true}:{})}:weightedFfd&&animatedSlots?{weightedFfd:true,animatedSlots:true,...(clipping?{clipping:true}:{})}:clipping?{animatedSlots:true,clipping:true}:animatedSlots&&animationEvents?{animatedSlots:true,animationEvents:true}:weightedFfd?{weightedFfd:true}:animatedSlots?{animatedSlots:true}:animationEvents?{animationEvents:true}:undefined)),pages=new Map();
    let borrowers=0,disposed=false;
    try {
        for (const page of rig.atlas.pages) {
            const pageURL=new URL(page.file,url),base=new URL('.',url);
            if (pageURL.origin!==base.origin || !pageURL.pathname.startsWith(base.pathname) || pageURL.search || pageURL.hash) throw Error('Atlas must remain inside source directory');
            const image=await replayPage(pageURL,page,signal ?? new AbortController().signal);
            signal?.throwIfAborted(); const resource=createPage(image,page); pages.set(page.index,resource);
        }
        signal?.throwIfAborted();
    } catch(error) { for(const resource of pages.values()) deletePage(resource); throw error; }
    return {rig,pages,nativeSHA256,
        acquire(){if(disposed)throw Error('Asset destroyed');borrowers++;},
        release(){if(borrowers<=0)throw Error('Asset borrower underflow');borrowers--;},
        resources(){return{borrowers,disposed,pages:pages.size,nativeSHA256};},
        destroy(){if(disposed)return;if(borrowers)throw Error('Destroy actors before their asset');for(const resource of pages.values())deletePage(resource);pages.clear();disposed=true;}
    };
}
