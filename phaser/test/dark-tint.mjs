import { parseRig, PhaserRig } from "@ankhimate/phaser-runtime";

const query = new URL(location.href).searchParams;
const filtered = query.has("filtered"), clip = query.get("clip") ?? "pulse";
const sample = Number(query.get("sample") ?? 0), opaque = query.has("opaque");
const result = { filtered, clip, sample, opaque, checks: [], failures: [] };
const check = (condition, message, details) => { result.checks.push({message,pass:!!condition,details}); if(!condition)result.failures.push(message); };
const imagePixels = async url => {
  const image = new Image(); image.src = url; await image.decode();
  const canvas = document.createElement("canvas"); canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(image,0,0);
  return {width:image.width,height:image.height,data:ctx.getImageData(0,0,image.width,image.height).data};
};
try {
  const base=`./fixtures/${filtered ? "dark_tint_filtered" : "dark_tint"}/`;
  const [raw, reference] = await Promise.all([fetch(`${base}skeleton.json`).then(r=>r.json()),fetch(`${base}reference.json`).then(r=>r.json())]);
  const time=sample/4, scale=reference.scale??1, origin=reference.origin;
  const rigData=parseRig(raw);
  const cpu=await imagePixels(`${base}cpu-${clip}-${opaque?"opaque":"clear"}-${sample}.png`);
  const pages=await Promise.all(raw.atlas.pages.map(p=>imagePixels(`${base}${p.file}`)));
  let scene;
  const game=new Phaser.Game({type:Phaser.WEBGL,parent:"game",width:640,height:384,banner:false,
    transparent:!opaque,backgroundColor:opaque?"#203040":"#000000",audio:{noAudio:true},
    render:{preserveDrawingBuffer:true,antialias:false,roundPixels:false},
    scene:{
      preload(){raw.atlas.pages.forEach((p,i)=>this.load.image(`dark-${i}`,`${base}${p.file}`));},
      create(){scene=this;try {
        // MSAA is disabled for deterministic coverage, but explicitly exercise
        // LINEAR texture filtering (Phaser otherwise couples these settings).
        raw.atlas.pages.forEach((_,i)=>this.textures.get(`dark-${i}`).setFilter(Phaser.Textures.FilterMode.LINEAR));
        this.rig=new PhaserRig(this,rigData,{pageTextureKeys:raw.atlas.pages.map((_,i)=>`dark-${i}`)});
        this.rig.root.setPosition(...origin).setScale(scale);this.rig.play(clip);this.rig.player.seek(time);this.pose=this.rig.update(0);
      }catch(error){result.failures.push(error.stack??String(error));}this.ready=true;}
    }});
  await new Promise(done=>{const poll=()=>scene?.ready?done():requestAnimationFrame(poll);poll();});
  await new Promise(done=>game.events.once("postrender",done));
  if(!scene.rig)throw new Error("Rig unavailable");
  const gl=game.renderer.gl, gpuPixels=new Uint8Array(640*384*4);
  gl.readPixels(0,0,640,384,gl.RGBA,gl.UNSIGNED_BYTE,gpuPixels);
  const pixel=(x,y)=>Array.from(gpuPixels.subarray(((383-y)*640+x)*4,((383-y)*640+x)*4+4));
  const cpuPixel=(x,y)=>{const i=(y*640+x)*4,a=cpu.data[i+3];return [0,1,2].map(c=>Math.round(cpu.data[i+c]*a/255)).concat(a);};
  const extension=gl.getExtension("WEBGL_debug_renderer_info");
  result.gpu=extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  result.phaser=Phaser.VERSION;result.context=gl.getContextAttributes();result.time=time;
  check(game.renderer.type===Phaser.WEBGL,"real WebGL readPixels framebuffer");
  check(raw.atlas.pages.length===4,"four native atlas pages");
  check(scene.rig.root.list.filter(v=>v.visible).length===15,"regions and mesh loaded without missing resources");
  const dx=(clip==="pulse"?1:-1)*4*time;
  const flatSlots=reference.normalSlots.filter(s=>!["edge","under"].includes(s.name));
  let maxRgb=0,maxAlpha=0,compared=0;
  for(const slot of flatSlots) {
    const x=Math.floor(origin[0]+(slot.center[0]+dx)*scale),y=Math.floor(origin[1]-slot.center[1]*scale);
    for(let sy=y-4;sy<=y+4;sy++)for(let sx=x-4;sx<=x+4;sx++) {
      const actual=pixel(sx,sy),expected=cpuPixel(sx,sy);
      maxRgb=Math.max(maxRgb,...[0,1,2].map(c=>Math.abs(actual[c]-expected[c])));
      maxAlpha=Math.max(maxAlpha,Math.abs(actual[3]-expected[3]));compared++;
    }
  }
  result.cpu={compared,maxPremultipliedRgbError:maxRgb,maxAlphaError:maxAlpha};
  check(maxRgb<=2&&maxAlpha<=1,"flat normal regions, mesh and reordered overlap: CPU PMA RGB <=2/255, alpha <=1/255",result.cpu);
  check(scene.pose.slots.find(s=>s.name==="switch").attachment===(clip==="pulse"&&time>=0.5?"red":"art"),"attachment/page switches at authored times");
  const transparentX=Math.floor(origin[0]+(240+dx)*scale),transparentY=Math.floor(origin[1]-32*scale);
  check(pixel(transparentX,transparentY).every((v,i)=>v===(opaque?[32,48,64,255]:[0,0,0,0])[i]),"dark tint never makes transparent texels opaque");

  // Independent PMA bilinear oracle at the actual WebGL pixel centers. The CPU
  // maps u to (width-1), while GPU samplers map u to width-.5; do not alter UVs.
  const region=raw.atlas.regions.find(r=>r.name==="edge"),page=pages[region.page];
  const slot=scene.pose.slots.find(s=>s.name==="edge"),dark=raw.slots.find(s=>s.name==="edge").dark_color;
  const left=origin[0]+(144+dx-32)*scale,top=origin[1]-(32+32)*scale;
  const samplePma=(tx,ty)=>{
    const ix=Math.floor(tx),iy=Math.floor(ty),fx=tx-ix,fy=ty-iy;
    const texel=(x,y)=>{x=Math.max(0,Math.min(page.width-1,x));y=Math.max(0,Math.min(page.height-1,y));const i=(y*page.width+x)*4,a=page.data[i+3];return [0,1,2].map(c=>Math.round(page.data[i+c]*a/255)/255).concat(a/255);};
    const a=texel(ix,iy),b=texel(ix+1,iy),c=texel(ix,iy+1),d=texel(ix+1,iy+1);
    return a.map((v,i)=>(v*(1-fx)+b[i]*fx)*(1-fy)+(c[i]*(1-fx)+d[i]*fx)*fy);
  };
  let edgeRgb=0,edgeAlpha=0,cpuEdgeRgb=0,cpuEdgeAlpha=0,edgeCount=0;
  for(let y=Math.ceil(top+4);y<Math.floor(top+64*scale-4);y++)for(let x=Math.ceil(left+4);x<Math.floor(left+64*scale-4);x++) {
    const texel=samplePma(region.x+(x+0.5-left)/scale-0.5,region.y+(y+0.5-top)/scale-0.5);
    const alpha=texel[3]*Math.floor(slot.color[3]*255)/255;
    const expected=[0,1,2].map(c=>{
      const src=(texel[c]*slot.color[c]+(texel[3]-texel[c])*dark[c]*dark[3])*Math.floor(slot.color[3]*255)/255;
      return Math.round(255*Math.max(0,Math.min(1,src+(opaque?[32,48,64][c]/255*(1-alpha):0))));
    }).concat(Math.round(255*(alpha+(opaque?1-alpha:0))));
    const actual=pixel(x,y),rust=cpuPixel(x,y);
    edgeRgb=Math.max(edgeRgb,...[0,1,2].map(c=>Math.abs(actual[c]-expected[c])));
    edgeAlpha=Math.max(edgeAlpha,Math.abs(actual[3]-expected[3]));
    cpuEdgeRgb=Math.max(cpuEdgeRgb,...[0,1,2].map(c=>Math.abs(actual[c]-rust[c])));
    cpuEdgeAlpha=Math.max(cpuEdgeAlpha,Math.abs(actual[3]-rust[3]));edgeCount++;
  }
  result.filter={pixels:edgeCount,maxGpuOraclePmaRgb:edgeRgb,maxGpuOracleAlpha:edgeAlpha,maxCpuPmaRgb:cpuEdgeRgb,maxCpuAlpha:cpuEdgeAlpha};
  check(edgeRgb<=2&&edgeAlpha<=1,"PMA bilinear transparent border oracle RGB <=2/255, alpha <=1/255",result.filter);
  check(cpuEdgeRgb<=4&&cpuEdgeAlpha<=3,"CPU/GPU alpha-ramp sampling convention difference bounded: PMA RGB <=4/255, alpha <=3/255",result.filter);
  // Blend modes retain Phaser's documented equations. These probes qualify an
  // opaque background only, not Rust parity for non-Normal compositions.
  if(opaque)for(const [i,name] of ["add","multiply","screen"].entries()) {
    const s=scene.pose.slots.find(s=>s.name===name),d=raw.slots.find(s=>s.name===name).dark_color;
    const a=128/255*s.color[3],tex=[64,128,192].map(c=>Math.round(c*128/255)/255);
    const src=tex.map((c,j)=>(c*s.color[j]+(128/255-c)*d[j]*d[3])*s.color[3]);
    const dest=[32,48,64].map(c=>c/255);
    const expected=src.map((c,j)=>Math.round(Math.max(0,Math.min(1,name==="add"?c+dest[j]:name==="multiply"?c*dest[j]+dest[j]*(1-a):c+dest[j]*(1-c)))*255));
    const actual=pixel(Math.floor(origin[0]+(-240+96*i+dx)*scale),Math.floor(origin[1]+96*scale));
    check(expected.every((c,j)=>Math.abs(c-actual[j])<=2),`${name}: Phaser blend equation on opaque background`,{expected,actual});
  }
  window.__game=game;
}catch(error){result.failures.push(error.stack??String(error));}
result.pass=result.failures.length===0;window.__result=result;document.querySelector("#result").textContent=JSON.stringify(result,null,2);
