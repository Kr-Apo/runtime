import {MAX_SAMPLE_TICK} from '@ankhimate/runtime';

const need=(ok,message)=>{if(!ok)throw Error('Integration manifest: '+message);};
/** Companion application recipe, not native v2 or a Q1 certificate. */
export async function loadIntegrationManifest({source,loadAsset,signal}) {
    const url=new URL(source,location.href);
    need(['http:','https:'].includes(url.protocol),'HTTP(S) source required');
    signal?.throwIfAborted();const response=await fetch(url,{signal,credentials:'omit'});
    need(response.ok,`HTTP ${response.status}`);const m=await response.json();
    need(m&&m.schema==='ankhimate.application/1'&&typeof m.native==='string'&&m.native.length&&typeof m.clip==='string','schema/native/clip');
    need(Object.keys(m).every(k=>['schema','native','clip','skinEvents'].includes(k)),'unknown property');
    const native=new URL(m.native,url),base=new URL('.',url);
    need(native.origin===base.origin&&native.pathname.startsWith(base.pathname)&&!native.search&&!native.hash,'native must stay inside manifest directory');
    const events=m.skinEvents;
    if(events!==undefined){
        need(Array.isArray(events)&&events.length>0&&events[0].tick===0,'calendar origin');let previous=-1;
        for(const e of events){need(e&&Object.keys(e).sort().join(',')==='skin,tick'&&Number.isSafeInteger(e.tick)&&e.tick>previous&&e.tick<=Number(MAX_SAMPLE_TICK)&&typeof e.skin==='string','ordered absolute SkinEvents in native domain');previous=e.tick;}
    }
    const asset=await loadAsset({source:native.href,signal});
    try{
        need(Object.hasOwn(asset.rig.animations,m.clip),'unknown clip');
        const skinEvents=events?.map(e=>({tick:BigInt(e.tick),skin:e.skin}))??[{tick:0n,skin:asset.rig.defaultSkin}];
        need(skinEvents.every(e=>asset.rig.skins.some(s=>s.name===e.skin)),'unknown skin');
        return{asset,clip:m.clip,skinEvents,manifestURL:url.href,calendarSource:events?'external absolute companion events':'native default skin',looping:asset.rig.animations[m.clip].looping};
    }catch(error){asset.destroy();throw error;}
}
