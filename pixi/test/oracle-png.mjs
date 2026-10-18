import {unzlibSync} from 'fflate';

/** Trusted Rust oracle PNGs only: RGBA8, noninterlaced. No Canvas PMA round trip. */
export function decodeOraclePng(bytes) {
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),ids=[];let width,height;
 if(![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw Error('Oracle is not PNG');
 for(let p=8;p<bytes.length;){const n=view.getUint32(p),name=String.fromCharCode(...bytes.subarray(p+4,p+8)),data=bytes.subarray(p+8,p+8+n);if(data.length!==n)throw Error('Truncated oracle PNG');
  if(name==='IHDR'){width=new DataView(data.buffer,data.byteOffset).getUint32(0);height=new DataView(data.buffer,data.byteOffset).getUint32(4);if(data[8]!==8||data[9]!==6||data[10]!==0||data[11]!==0||data[12]!==0)throw Error('Oracle requires noninterlaced RGBA8 PNG');}
  if(name==='IDAT')ids.push(data);p+=12+n;if(name==='IEND')break;
 }
 const compressed=new Uint8Array(ids.reduce((n,id)=>n+id.length,0));let cursor=0;for(const id of ids){compressed.set(id,cursor);cursor+=id.length;}
 const raw=unzlibSync(compressed),stride=width*4,rgba=new Uint8Array(stride*height);if(raw.length!==(stride+1)*height)throw Error('Invalid oracle PNG dimensions');
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const start=y*stride,source=y*(stride+1),filter=raw[source];if(filter>4)throw Error('Invalid oracle PNG filter');
  for(let x=0;x<stride;x++){const a=x>=4?rgba[start+x-4]:0,b=y?rgba[start+x-stride]:0,c=y&&x>=4?rgba[start+x-stride-4]:0;
   rgba[start+x]=(raw[source+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;
  }
 }
 return {width,height,rgba};
}
