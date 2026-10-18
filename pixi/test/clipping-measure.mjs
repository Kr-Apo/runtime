// Independent measurements use Rust-authored positions/UVs, never the adapter clipping helper.
export function expectedVertex(u,v,a,positions){let best=Infinity,bestPoint;
 for(let t=0;t<a.triangles.length;t+=3){const ids=a.triangles.slice(t,t+3),p=ids.map(i=>[a.uvs[i*2],a.uvs[i*2+1]]);
  const det=(p[1][1]-p[2][1])*(p[0][0]-p[2][0])+(p[2][0]-p[1][0])*(p[0][1]-p[2][1]);if(Math.abs(det)<1e-12)continue;
  const b0=((p[1][1]-p[2][1])*(u-p[2][0])+(p[2][0]-p[1][0])*(v-p[2][1]))/det,b1=((p[2][1]-p[0][1])*(u-p[2][0])+(p[0][0]-p[2][0])*(v-p[2][1]))/det,b2=1-b0-b1;
  const outside=Math.max(0,-b0,-b1,-b2);if(outside<best){best=outside;bestPoint=[0,1].map(axis=>ids.reduce((sum,id,j)=>sum+positions[id*2+axis]*[b0,b1,b2][j],0));}
 }return best<=1e-5?bestPoint:undefined;
}
export function triangleArea(p,indices){let sum=0;for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3).map(k=>[p[2*k],p[2*k+1]]);sum+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;}return sum;}
export function geometryErrors(instance,raw,oracle,skin){let position=0,area=0,uv=0,containment=0,vertices=0;const order=[];
 for(const slot of oracle.slots){const m=instance.root.children.find(m=>m.label===slot.name),indices=slot.clipped_indices;
  if(!indices.length){if(m?.visible)throw Error(`${slot.name}: fully masked content visible`);continue;}
  if(!m?.visible)throw Error(`${slot.name}: expected content not visible`);order.push(slot.name);
  const e=raw.skins.find(s=>s.name===skin)?.attachments.find(e=>e.slot===slot.name&&e.name===slot.attachment)??raw.skins.find(s=>s.name===raw.defaultSkin).attachments.find(e=>e.slot===slot.name&&e.name===slot.attachment),a=e.attachment,r=raw.atlas.regions.find(r=>r.name===a.texture),page=raw.atlas.pages[r.page];
  const source={uvs:slot.uvs,triangles:slot.indices};
  for(let i=0;i<m.geometry.positions.length/2;i++){
   const actual=[m.geometry.positions[2*i],-m.geometry.positions[2*i+1]];
   const expectedUV=expectedVertex(actual[0],actual[1],{uvs:slot.positions,triangles:slot.indices},slot.uvs);if(!expectedUV)throw Error(`${slot.name}: clipped vertex outside Rust source geometry`);
   const u=r.original_width===1?expectedUV[0]:(m.geometry.uvs[2*i]*page.width-r.x-0.5+r.offset_x)/(r.original_width-1),v=r.original_height===1?expectedUV[1]:(m.geometry.uvs[2*i+1]*page.height-r.y-0.5+r.offset_y)/(r.original_height-1),p=expectedVertex(u,v,source,slot.positions);if(!p)throw Error(`${slot.name}: UV outside Rust source triangles`);
   position=Math.max(position,Math.abs(p[0]-m.geometry.positions[2*i]),Math.abs(p[1]+m.geometry.positions[2*i+1]));vertices++;
   containment=Math.max(containment,distanceToTriangles(actual,slot.clipped_positions,indices));
   uv=Math.max(uv,Math.abs((r.x+0.5+expectedUV[0]*(r.original_width-1)-r.offset_x)/page.width-m.geometry.uvs[2*i]),Math.abs((r.y+0.5+expectedUV[1]*(r.original_height-1)-r.offset_y)/page.height-m.geometry.uvs[2*i+1]));
  }
  if(r.width===r.original_width&&r.height===r.original_height)area=Math.max(area,Math.abs(triangleArea([...m.geometry.positions], [...m.geometry.indices])-triangleArea(slot.clipped_positions,indices)));
 }
 const actual=instance.root.children.filter(m=>m.visible).map(m=>m.label);if(JSON.stringify(actual)!==JSON.stringify(order))throw Error(`draw scope/order ${actual} != ${order}`);
 return {position,area,uv,containment,vertices};
}

function distanceToTriangles(p,positions,indices){let best=Infinity;for(let j=0;j<indices.length;j+=3){const t=indices.slice(j,j+3).map(k=>[positions[2*k],positions[2*k+1]]),cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);const c=t.map((a,i)=>cross(a,t[(i+1)%3],p));if(c.some(v=>v!==0)&&(!c.some(v=>v<0)||!c.some(v=>v>0)))return 0;
 for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],dx=b[0]-a[0],dy=b[1]-a[1],n=dx*dx+dy*dy,u=n?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/n)):0;best=Math.min(best,Math.hypot(p[0]-a[0]-u*dx,p[1]-a[1]-u*dy));}}return best;}
