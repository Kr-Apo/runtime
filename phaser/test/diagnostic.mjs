import { parseRig, PhaserRig } from "@ankhimate/phaser-runtime";

// Deliberately synthetic renderer probes, separate from byte-identical real exports.
const result = { name: "diagnostic", time: 0, failures: [], checks: [] };
const check = (pass, message, actual) => { result.checks.push({pass:!!pass,message,actual});if(!pass)result.failures.push(message); };
const attachment = texture => ({ type:"region",texture,x:0,y:0,rotation:0,scale_x:1,scale_y:1,width:64,height:64,pivot_x:0.5,pivot_y:0.5,uv:[0,0,1,1],sequence:null });
function data(version, slots, texture, animation) {
  return parseRig({format:"ankhimate-runtime",context_version:1,format_version:version,name:"renderer-probe",fps:60,
    bones:[{name:"root",parent:-1,length:1,x:0,y:0,rotation:0,scaleX:1,scaleY:1,shearX:0,shearY:0,inheritRotation:true,inheritScale:true,inheritReflect:true}],
    slots:slots.map(([name,color])=>({name,bone:"root",attachment:"quad",color,blend:"normal"})),
    drawOrder:slots.map(([name])=>name),defaultSkin:"default",skins:[{name:"default",attachments:slots.map(([slot])=>({slot,name:"quad",attachment:attachment(texture)}))}],
    constraints:[],constraintOrder:[],animations:{probe:{duration:1,looping:true,bones:[],slots:[],drawOrder:[],events:[],deform:[],ik:[],transform:[],...animation}},
    atlas:{pages:[{file:"synthetic",width:4,height:4}],regions:[{name:texture,page:0,x:0,y:0,width:4,height:4,original_width:4,original_height:4,offset_x:0,offset_y:0,rotated:false}]}});
}
try {
  let scene;
  const game = new Phaser.Game({type:Phaser.WEBGL,width:320,height:180,parent:"game",backgroundColor:"#28323d",banner:false,audio:{noAudio:true},render:{preserveDrawingBuffer:true},scene:{create(){scene=this;}}});
  while(!scene) await new Promise(r=>requestAnimationFrame(r));
  const frame = () => new Promise(r=>game.events.once("postrender",r));
  const texture=scene.textures.createCanvas("pattern-page",4,4);
  ["#ff0000","#00ff00","#0000ff","#ffff00"].forEach((color,i)=>{texture.context.fillStyle=color;texture.context.fillRect((i%2)*2,Math.floor(i/2)*2,2,2);});texture.refresh();
  const white=scene.textures.createCanvas("white-page",4,4);white.context.fillStyle="#ffffff";white.context.fillRect(0,0,4,4);white.refresh();
  const pixels = () => {const c=document.createElement("canvas");c.width=320;c.height=180;const context=c.getContext("2d");context.drawImage(game.canvas,0,0);return context.getImageData(0,0,320,180).data;};
  const pixel = (p,x,y) => [...p.slice((y*320+x)*4,(y*320+x)*4+3)];
  const near = (a,b) => a.every((v,i)=>Math.abs(v-b[i])<=3);
  const uv = new PhaserRig(scene,data(2,[["pattern","ffffffff"]],"pattern"),{pageTextureKeys:["pattern-page"]});uv.root.setPosition(80,90);
  const alpha = new PhaserRig(scene,data(2,[["red","ff000080"],["blue","0000ff80"]],"white",{drawOrder:[{time:0.5,offsets:[{slot:"red",offset:1}]}]}),{pageTextureKeys:["white-page"]});alpha.root.setPosition(240,90).setScale(0.75);
  alpha.play("probe");await frame();
  let p=pixels();
  for(const [x,y,color] of [[64,74,[255,0,0]],[96,74,[0,255,0]],[64,106,[0,0,255]],[96,106,[255,255,0]]]) check(near(pixel(p,x,y),color),`UV quadrant ${x},${y}`,pixel(p,x,y));
  const sourceOver=(color,bg)=>color.map((v,i)=>v*(128/255)+bg[i]*(127/255));
  const redThenBlue=sourceOver([0,0,255],sourceOver([255,0,0],[40,50,61]));
  check(near(pixel(p,240,90),redThenBlue),"vertex alpha and initial overlapping triangles",pixel(p,240,90));
  alpha.player.seek(0.75);alpha.update(0);await frame();p=pixels();
  const blueThenRed=sourceOver([255,0,0],sourceOver([0,0,255],[40,50,61]));
  check(near(pixel(p,240,90),blueThenRed),"animated draw order changes the actual Container rendering",pixel(p,240,90));
  alpha.destroy();uv.destroy();
  for(const version of [1,2]) {
    const bone=version===1?{name:"root",translate:[{time:0,x:0,y:0,curve:"linear"},{time:1,x:10,y:20,curve:"linear"}]}:{name:"root",translate_x:[{time:0,value:0,curve:"linear"},{time:1,value:10,curve:"linear"}],translate_y:[{time:0,value:0,curve:"linear"},{time:1,value:20,curve:"linear"}]};
    const rig=new PhaserRig(scene,data(version,[["pattern","ffffffff"]],"pattern",{bones:[bone]}),{pageTextureKeys:["pattern-page"]});rig.root.setPosition(80,90);rig.play("probe");rig.player.seek(0.5);const pose=rig.update(0);await frame();
    check(Math.abs(pose.bones[0].world.tx-5)<0.00001&&Math.abs(pose.bones[0].world.ty-10)<0.00001,`v${version} animated translation`);
    p=pixels();check(near(pixel(p,69,64),[255,0,0])&&near(pixel(p,69,96),[0,0,255]),`v${version} projected orientation and placement`);
    rig.destroy();
  }
  result.phaser=Phaser.VERSION;
  const ext=game.renderer.gl.getExtension("WEBGL_debug_renderer_info");result.gpu=ext?game.renderer.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):"WebGL";
} catch(error) {result.failures.push(error.stack??String(error));}
result.pass=result.failures.length===0;window.__result=result;document.querySelector("#result").textContent=JSON.stringify(result,null,2);
