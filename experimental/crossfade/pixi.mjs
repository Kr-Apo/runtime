import {Texture,ImageSource} from 'pixi.js';
import {BoundedPixiView} from '../dynamic-weighted-pixi/adapter.mjs';
import {ApplicationActor,defaultPlacement} from '../continuous-playback/actor.mjs';
import {loadAsset} from '../integration-pilot/assets.mjs';
// Optional diagnostics in the reused G1 view identify real GL objects, not logical meshes.
const bufferIDs=new WeakMap();let nextBufferID=0;
globalThis.__g1BufferID??=(buffer=>{if(!bufferIDs.has(buffer))bufferIDs.set(buffer,++nextBufferID);return bufferIDs.get(buffer);});

export const loadPixiAsset = options => loadAsset({...options,crossfade:true,
    createPage:image=>new Texture({source:new ImageSource({resource:image,alphaMode:'premultiply-alpha-on-upload',resolution:1,scaleMode:'linear',autoGenerateMipmaps:false})}),
    deletePage:texture=>texture.destroy(true)});

export function createPixiActor({asset,renderer,stage,clip,skinEvents,placement=defaultPlacement()}) {
    return new ApplicationActor({asset,clip,skinEvents,placement,crossfade:true,createView:(binding,acceptedFrame)=>{
        const view=new BoundedPixiView({native:asset.rig,pages:asset.pages,binding,acceptedFrame,crossfade:true,renderer,width:640,height:480});
        stage.addChild(view.surface); return view;
    }});
}
