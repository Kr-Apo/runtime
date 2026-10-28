import {BoundedPhaserView} from '../dynamic-weighted-phaser/adapter.mjs';
import {ApplicationActor,defaultPlacement} from './actor.mjs';
import {loadAsset} from './assets.mjs';
let pageSerial=0;
export const loadPhaserAsset = ({game,...options}) => loadAsset({...options,
    createPage:image=>{
        if(!game.renderer?.gl || game.pendingDestroy)throw Error('Game destroyed during load');
        const key=`application-page-${pageSerial++}`,texture=game.textures.addImage(key,image);
        texture.setFilter(Phaser.Textures.FilterMode.LINEAR);return{key,texture,source:texture.source[0]};
    },
    deletePage:page=>{if(game.textures?.exists(page.key)&&game.textures.get(page.key)===page.texture)game.textures.remove(page.key);}});

export function createPhaserActor({asset,scene,clip,skinEvents,placement=defaultPlacement(),audit}) {
    return new ApplicationActor({asset,clip,skinEvents,placement,
        createView:binding=>new BoundedPhaserView({native:asset.rig,pages:asset.pages,binding,scene,width:640,height:480,audit}),
        lifecycle:destroy=>{scene.events.once('shutdown',destroy);scene.events.once('destroy',destroy);return()=>{scene.events.off('shutdown',destroy);scene.events.off('destroy',destroy);};}});
}
