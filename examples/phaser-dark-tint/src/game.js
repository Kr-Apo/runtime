import { parseRig, PhaserRig } from "@ankhimate/phaser-runtime";

const stats=window.darkTintExample={ready:false,frames:0,playbackMs:0,eventCount:0,loops:0,clip:"pulse",x:400,errors:[],resources:null};
const fail=error=>{stats.errors.push(String(error?.stack??error));const target=document.querySelector("#error");target.hidden=false;target.textContent=String(error);};
window.addEventListener("error",e=>fail(e.error??e.message));window.addEventListener("unhandledrejection",e=>fail(e.reason));
async function main(){
  const response=await fetch("assets/skeleton.json");if(!response.ok)throw new Error("Export introuvable");
  const raw=await response.json(),data=parseRig(raw);
  new Phaser.Game({type:Phaser.WEBGL,parent:"game",width:800,height:460,transparent:true,banner:false,audio:{noAudio:true},render:{preserveDrawingBuffer:true},scene:{
    preload(){this.load.on("loaderror",file=>fail(`Texture absente : ${file.key}`));raw.atlas.pages.forEach((p,i)=>this.load.image(`page-${i}`,`assets/${p.file}`));},
    create(){try{
      this.makeRig=()=>{const rig=new PhaserRig(this,data,{pageTextureKeys:raw.atlas.pages.map((_,i)=>`page-${i}`)});rig.root.setPosition(stats.x,210).setScale(0.9);rig.play(stats.clip);return rig;};
      this.rig=this.makeRig();this.keys=this.input.keyboard.addKeys({left:"LEFT",right:"RIGHT",change:"SPACE"});
      this.choose=name=>{this.rig.crossFade(name,0.25);stats.clip=name;for(const clip of ["pulse","alternate"])document.querySelector(`#${clip}`).setAttribute("aria-pressed",String(clip===name));};
      for(const clip of ["pulse","alternate"])document.querySelector(`#${clip}`).addEventListener("click",()=>this.choose(clip));
      document.querySelector("#restart").addEventListener("click",()=>{this.rig.player.seek(0);this.rig.update(0);});this.choose("pulse");
      // Test hook exercises real public object lifetimes, never patches a rig/export.
      window.darkTintChurn=()=>{for(let i=0;i<30;i++){this.rig.destroy();this.rig=this.makeRig();}return this.children.length;};
      stats.ready=true;
    }catch(error){fail(error);}},
    update(_time,delta){if(!stats.ready)return;try{
      const previous=this.rig.player.time;const pose=this.rig.update(delta);stats.frames++;stats.playbackMs+=delta;
      stats.eventCount+=this.rig.player.events.filter(e=>e.name==="step").length;if(this.rig.player.time<previous)stats.loops++;
      if(Phaser.Input.Keyboard.JustDown(this.keys.change))this.choose(stats.clip==="pulse"?"alternate":"pulse");
      const direction=Number(this.keys.right.isDown)-Number(this.keys.left.isDown);stats.x=Math.max(100,Math.min(700,stats.x+direction*delta*0.2));this.rig.root.x=stats.x;
      const renderer=this.sys.game.renderer;
      stats.resources={pipelines:renderer.pipelines.pipelines.size,buffers:renderer.glBufferWrappers.length,programs:renderer.glProgramWrappers.length,textures:renderer.glTextureWrappers.length,sceneObjects:this.children.length,meshes:this.rig.root.list.filter(v=>v.visible).length};
      stats.hasDark=pose.slots.some(s=>s.dark_color?.[3]>0);
      document.querySelector("#status").textContent=`${stats.clip} · ${this.rig.player.time.toFixed(2)} s · événements : ${stats.eventCount} · ${raw.atlas.pages.length} pages · ${stats.resources.meshes} meshes`;
    }catch(error){stats.ready=false;fail(error);}}
  }});
}
main().catch(fail);
