/** Independent geometry comparison; no renderer skinning is imported here. */
import assert from 'node:assert/strict';
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function bary(p,a,b,c){const det=cross(a,b,c);if(Math.abs(det)<1e-12)return null;const v=cross(a,p,c)/det,w=cross(a,b,p)/det;return[1-v-w,v,w];}
function areaIntersection(ps,rect){const points=[];for(const p of ps)if(p[0]>=rect[0][0]&&p[0]<=rect[2][0]&&p[1]>=rect[0][1]&&p[1]<=rect[2][1])points.push(p);for(const p of rect)if(bary(p,...ps)?.every(x=>x>=-1e-12))points.push(p);
 for(let i=0;i<3;i++)for(let j=0;j<4;j++){const p=ps[i],q=ps[(i+1)%3],a=rect[j],b=rect[(j+1)%4],dx=q[0]-p[0],dy=q[1]-p[1],ex=b[0]-a[0],ey=b[1]-a[1],det=dx*ey-dy*ex;if(Math.abs(det)<1e-12)continue;const t=((a[0]-p[0])*ey-(a[1]-p[1])*ex)/det,u=((a[0]-p[0])*dy-(a[1]-p[1])*dx)/det;if(t>=0&&t<=1&&u>=0&&u<=1)points.push([p[0]+t*dx,p[1]+t*dy]);}
 const sorted=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),h=[];for(const p of sorted){while(h.length>=2&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}const lower=h.length;for(const p of sorted.toReversed().slice(1)){while(h.length>lower&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}if(h.length>1)h.pop();return Math.abs(h.reduce((s,p,i)=>s+p[0]*h[(i+1)%h.length][1]-p[1]*h[(i+1)%h.length][0],0))/2;
}
function matrix(p){const m=q=>{const c=Math.cos(q.rotation),s=Math.sin(q.rotation);return{a:c*q.scaleX,b:s*q.scaleX,c:-s*q.scaleY,d:c*q.scaleY,tx:q.x,ty:q.y};};const a=m(p.parent),b=m(p);return{a:a.a*b.a+a.c*b.b,b:a.b*b.a+a.d*b.b,c:a.a*b.c+a.c*b.d,d:a.b*b.c+a.d*b.d,tx:a.a*b.tx+a.c*b.ty+a.tx,ty:a.b*b.tx+a.d*b.ty+a.ty};}
/** Locate in independent Rust UV triangles. Float32 UV error is bounded in UV units,
 * not barycentrics (which are ill-conditioned on near-zero-area fragments). */
export function locate(r,p){let best=null;for(let j=0;j<r.indices.length;j+=3){const ids=r.indices.slice(j,j+3),tri=ids.map(i=>r.sourceUV[i]);let weights=bary(p,...tri),distance=0;
 if(!weights?.every(w=>w>=0)){let closest=Infinity;for(let e=0;e<3;e++){const a=tri[e],b=tri[(e+1)%3],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0,q=[a[0]+t*dx,a[1]+t*dy],d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<closest){closest=d;weights=[0,0,0];weights[e]=1-t;weights[(e+1)%3]=t;}}distance=closest;}
 if(!best||distance<best.distance)best={distance,ids,weights,world:[0,1].map(k=>weights.reduce((sum,w,n)=>sum+w*r.positions[ids[n]*2+k],0))};if(distance===0)break;
 }return best;}
export function geometry(actual,reference,snapshot,rig,placement){
 const max={boneLinear:0,boneTranslation:0,localTranslation:0,rotation:0,scaleShear:0,contribution:0,world:0,bufferWorld:0,gpu:0,uv:0,area:0,camera:0};let winding=0,vertices=0,terms=0;
 assert.deepEqual(actual.buffers.map(b=>b.slot),reference.draws.map(d=>d.slot));const bones=snapshot.preview?.bones??snapshot.frame.bones;
 for(const b of bones){const r=reference.bones.find(r=>r.name===b.name),w=b.world;[w.a,w.b,w.c,w.d,w.tx,w.ty].forEach((v,i)=>{const f=i<4?'boneLinear':'boneTranslation';max[f]=Math.max(max[f],Math.abs(v-r.world[i]));});[b.x,b.y,b.rotation,b.scaleX,b.scaleY,b.shearX,b.shearY].forEach((v,i)=>{const f=i<2?'localTranslation':i===2?'rotation':'scaleShear',d=i===2?Math.abs(Math.atan2(Math.sin(v-r.local[i]),Math.cos(v-r.local[i]))):Math.abs(v-r.local[i]);max[f]=Math.max(max[f],d);});}
 for(const b of actual.buffers){const own=actual.view.draws.find(d=>d.slot===b.slot),r=reference.draws.find(d=>d.slot===b.slot),region=r.region,page=rig.atlas.pages[r.page];
  assert.deepEqual(b.positions,own.positions);assert.deepEqual(b.uvs,own.uvs);assert.deepEqual(b.indices,own.indices);
  if(own.raw){for(let i=0;i<own.raw.world.length;i++)max.world=Math.max(max.world,Math.abs(own.raw.world[i]-r.rawWorld.flat()[i]));for(let i=0;i<own.raw.contributions.length;i++){const a=own.raw.contributions[i],e=r.contributions[i];assert.equal(a.terms.length,e.terms.length);assert.equal(a.fallback,e.fallback);for(let j=0;j<a.terms.length;j++){assert.equal(a.terms[j].bone,e.terms[j].bone);for(let k=0;k<2;k++)max.contribution=Math.max(max.contribution,Math.abs(a.terms[j].world[k]-e.terms[j].world[k]));terms++;}}}
  const uvs=[];for(let i=0;i<b.uvs.length;i+=2){const u=(b.uvs[i]*page.width-region.x-.5+region.offset_x)/(region.original_width-1),v=(b.uvs[i+1]*page.height-region.y-.5+region.offset_y)/(region.original_height-1);uvs.push([u,v]);const found=locate(r,[u,v]);assert(found&&found.distance<=1e-6,'submitted UV outside Rust cut coverage: '+found?.distance);max.uv=Math.max(max.uv,found.distance);for(let k=0;k<2;k++)max.bufferWorld=Math.max(max.bufferWorld,Math.abs(b.positions[i+k]-found.world[k]));vertices++;}
  const full=region.offset_x===0&&region.offset_y===0&&region.width===region.original_width&&region.height===region.original_height;// Clipping can emit different zero-area fragments at f32/double boundaries.
  // Compare submitted UV-domain coverage and independently interpolated world positions below, not vertex ordinals.
  const x0=Math.max(0,(region.offset_x-1)/(region.original_width-1)),x1=Math.min(1,(region.offset_x+region.width)/(region.original_width-1)),y0=Math.max(0,(region.offset_y-1)/(region.original_height-1)),y1=Math.min(1,(region.offset_y+region.height)/(region.original_height-1)),rect=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];let expectedArea=0,actualArea=0;
  // G1: UVs cross a Float32 GPU boundary. Full untrimmed reference coverage
  // must cross the SAME boundary independently, not use the actual buffer.
  // World/influence/camera comparisons and every historical limit are unchanged.
  const expectedUV=full?r.sourceUV.map((_,i)=>[(Math.fround(r.uvs[2*i])*page.width-region.x-.5+region.offset_x)/(region.original_width-1),(Math.fround(r.uvs[2*i+1])*page.height-region.y-.5+region.offset_y)/(region.original_height-1)]):r.sourceUV;
  for(let t=0;t<r.indices.length;t+=3)expectedArea+=full?Math.abs(cross(...r.indices.slice(t,t+3).map(k=>expectedUV[k])))/2:areaIntersection(r.indices.slice(t,t+3).map(k=>expectedUV[k]),rect);
  for(let t=0;t<b.indices.length;t+=3){const tri=b.indices.slice(t,t+3),ps=tri.map(k=>uvs[k]),centroid=[0,1].map(k=>ps.reduce((s,p)=>s+p[k]/3,0));const parent=locate(r,centroid);assert(parent&&parent.distance<=1e-6,'triangle outside Rust coverage');const signed=cross(...ps),expected=cross(...parent.ids.map(k=>r.sourceUV[k]));if(Math.abs(signed)>1e-10&&Math.abs(expected)>1e-10&&Math.sign(signed)!==Math.sign(expected))winding++;actualArea+=Math.abs(signed)/2;}
  max.area=Math.max(max.area,Math.abs(actualArea-expectedArea));const cam=matrix(placement);for(const k of Object.keys(cam))max.camera=Math.max(max.camera,Math.abs(cam[k]-b.worldTransform[k]));
 }
 const limits={boneLinear:.0001,boneTranslation:.01,localTranslation:.01,rotation:.001,scaleShear:.0001,contribution:.01,world:.01,bufferWorld:.01,gpu:0,uv:1e-6,area:1e-6,camera:.0001};const status=Object.entries(limits).every(([k,l])=>max[k]<=l)&&winding===0?'PASS':'FAIL';return{status,max,limits,winding,vertices,terms};
}
