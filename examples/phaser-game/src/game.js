import { parseRig, PhaserRig } from "@ankhimate/phaser-runtime";

// Passive telemetry for the reproducible soak test; gameplay uses public APIs only.
const stats = window.ankhimateExample = {
  ready:false,frames:0,playbackMs:0,wallMs:0,eventCount:0,loopWraps:0,
  clip:"",x:200,score:0,errors:[],texturesReady:false,visibleMeshes:0,
};
const fail = error => {
  const message=String(error?.message??error);stats.errors.push(message);
  const target=document.querySelector("#error");target.hidden=false;target.textContent=`Le jeu ne peut pas continuer : ${message}`;
  document.querySelector("#loading").textContent="Chargement interrompu.";
};
window.addEventListener("error",event=>fail(event.error??event.message));
window.addEventListener("unhandledrejection",event=>fail(event.reason));

async function main() {
  const names=["walker","tagged_rig"];
  const raw=await Promise.all(names.map(async name=>{
    const response=await fetch(`assets/${name}/skeleton.json`);
    if(!response.ok)throw new Error(`Export ${name} introuvable (${response.status}).`);
    return response.json();
  }));
  const rigs=raw.map(parseRig);
  new Phaser.Game({
    type:Phaser.WEBGL,width:960,height:560,parent:"game",backgroundColor:"#1b2c39",banner:false,
    audio:{noAudio:true},render:{preserveDrawingBuffer:true},
    scene:{
      preload(){
        this.load.on("loaderror",file=>fail(`Texture introuvable : ${file.key}`));
        raw.forEach((data,i)=>data.atlas.pages.forEach((page,p)=>this.load.image(`${names[i]}-${p}`,`assets/${names[i]}/${page.file}`)));
      },
      create(){
        if(stats.errors.length)return;
        try {
          const pageKeys=raw.map((data,i)=>data.atlas.pages.map((_,p)=>`${names[i]}-${p}`));
          stats.texturesReady=pageKeys.flat().every(key=>this.textures.exists(key));
          if(!stats.texturesReady)throw new Error("Un atlas n’a pas été chargé.");
          const background=this.add.graphics().lineStyle(1,0x2c4350,0.55);
          for(let x=0;x<960;x+=48)background.lineBetween(x,0,x,560);
          for(let y=0;y<560;y+=48)background.lineBetween(0,y,960,y);
          this.add.rectangle(480,526,960,68,0x152a32);
          this.add.rectangle(480,492,960,2,0x577279);
          this.add.text(34,28,"LE PARCOURS DU RIG",{fontFamily:"sans-serif",fontSize:"12px",color:"#9dbcc8"});
          this.add.text(676,86,"PSD importé → export natif",{fontFamily:"sans-serif",fontSize:"12px",color:"#9dbcc8"});
          this.hero=new PhaserRig(this,rigs[0],{pageTextureKeys:pageKeys[0]});
          this.hero.root.setPosition(200,340).setDepth(10);
          this.psd=new PhaserRig(this,rigs[1],{pageTextureKeys:pageKeys[1]});
          this.psd.root.setPosition(780,278).setScale(0.35).setDepth(5);
          this.clips=Object.keys(rigs[0].animations);
          if(this.clips.length<2)throw new Error("Cet exemple demande deux clips dans walker.");
          this.hero.play(this.clips[0]);
          this.psd.play(Object.keys(rigs[1].animations)[0]);
          this.keys=this.input.keyboard.addKeys({left:"LEFT",right:"RIGHT",a:"A",d:"D",change:"SPACE"});
          this.stars=[120,300,440,580,700].map(x=>this.add.star(x,464,5,6,13,0xefcc7d).setDepth(1));
          this.manualDirection=0;
          for(const [id,direction] of [["left",-1],["right",1]]) {
            const button=document.getElementById(id);
            button.addEventListener("pointerdown",event=>{button.setPointerCapture(event.pointerId);this.manualDirection=direction;});
            button.addEventListener("pointerup",()=>{this.manualDirection=0;});
            button.addEventListener("pointercancel",()=>{this.manualDirection=0;});
          }
          const choose=name=>{
            this.hero.crossFade(name,0.25);
            document.querySelectorAll("#animations button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.clip===name)));
          };
          const controls=document.querySelector("#animations");
          for(const name of this.clips){const button=document.createElement("button");button.textContent=name;button.dataset.clip=name;button.addEventListener("click",()=>choose(name));controls.append(button);}
          choose(this.clips[0]);this.choose=choose;
          document.querySelector("#restart").addEventListener("click",()=>{
            this.hero.root.x=200;this.stars.forEach(star=>star.setVisible(true));stats.score=0;
            document.querySelector("#score").textContent="Éclats : 0 / 5";
          });
          stats.visibleMeshes=[...this.hero.root.list,...this.psd.root.list].filter(object=>object.type==="Mesh"&&object.visible).length;
          this.started=performance.now();this.lastClip=this.hero.player.animation;this.lastTime=0;
          stats.ready=true;document.querySelector("#loading").hidden=true;
        } catch(error){fail(error);}
      },
      update(_time,delta){
        if(!stats.ready||stats.errors.length)return;
        try {
          const direction=this.manualDirection||Number(this.keys.right.isDown||this.keys.d.isDown)-Number(this.keys.left.isDown||this.keys.a.isDown);
          this.hero.root.x=Phaser.Math.Clamp(this.hero.root.x+direction*180*delta/1000,90,710);
          if(Phaser.Input.Keyboard.JustDown(this.keys.change))this.choose(this.clips[(this.clips.indexOf(this.hero.player.animation)+1)%this.clips.length]);
          const pose=this.hero.update(delta);this.psd.update(delta);
          if(pose.bones.some(bone=>Object.values(bone.world).some(value=>!Number.isFinite(value))))throw new Error("Pose non finie.");
          for(const event of this.hero.player.events){
            stats.eventCount++;stats.lastEvent={name:event.name,string:event.string??"",int:event.int??0};
            document.querySelector("#events").textContent=`Pas reçus : ${stats.eventCount} · ${event.name} ${event.string??""}`;
          }
          const clip=this.hero.player.animation,time=this.hero.player.time;
          if(clip===this.lastClip&&time<this.lastTime)stats.loopWraps++;
          this.lastClip=clip;this.lastTime=time;
          for(const star of this.stars)if(star.visible&&Math.abs(star.x-this.hero.root.x)<22){star.setVisible(false);stats.score++;document.querySelector("#score").textContent=stats.score===5?"5 / 5 · Parcours terminé !":`Éclats : ${stats.score} / 5`;}
          Object.assign(stats,{frames:stats.frames+1,playbackMs:stats.playbackMs+delta,wallMs:performance.now()-this.started,clip,x:this.hero.root.x});
        }catch(error){fail(error);}
      },
    },
  });
}
main().catch(fail);
