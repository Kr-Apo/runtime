/** Independent Decimal/Rust reference plus real Phaser batch buffer verification. */
import assert from 'node:assert/strict';
import {geometry as geometryR2} from '../bounded-pixi/measure.mjs';
export function geometry(actual,reference,snapshot,rig,placement) {
    // R2's mathematical/UV-domain checks run on the immutable logical draw geometry.
    // Phaser GPU storage is expanded screen-space batching, inspected separately below.
    const result=geometryR2(actual,reference,snapshot,rig,placement);let submittedVertices=0,maxGPUWorld=0,maxGPURust=0,maxScreen=0,maxUV=0;
    for(const b of actual.buffers) {
        const m=b.worldTransform,det=m.a*m.d-m.b*m.c;assert(Math.abs(det)>1e-12);
        assert(b.submitted.length>0,'No actual GPU triangle submission for '+b.slot);
        const expected=b.expandedVertices,ref=reference.draws.find(r=>r.slot===b.slot),region=ref.region,page=rig.atlas.pages[ref.page];let cursor=0;
        for(const batch of b.submitted) {
            assert(batch.actualGPUReadback&&batch.uploadedBytesEqual);assert.equal(batch.mode,4);assert.equal(batch.count*2,batch.positions.length);
            for(let i=0;i<batch.count;i++) {
                const x=batch.positions[i*2],y=batch.positions[i*2+1],u=batch.uvs[i*2],v=batch.uvs[i*2+1];
                // Phaser can cull whole offscreen Faces. Find the next corresponding expanded vertex in native order.
                while(cursor<expected.length&& (Math.abs(expected[cursor].tu-u)>1e-6||Math.abs(expected[cursor].tv-v)>1e-6))cursor++;
                assert(cursor<expected.length,'Unknown submitted UV/triangle');const e=expected[cursor++];
                assert.equal(x,Math.fround(e.tx));assert.equal(y,Math.fround(e.ty));assert.equal(u,Math.fround(e.tu));assert.equal(v,Math.fround(e.tv));
                const localX=(m.d*(x-m.tx)-m.c*(y-m.ty))/det,localY=(-m.b*(x-m.tx)+m.a*(y-m.ty))/det;
                const sourceUV=[(u*page.width-region.x-.5+region.offset_x)/(region.original_width-1),(v*page.height-region.y-.5+region.offset_y)/(region.original_height-1)];
                let oraclePoint;
                for(let j=0;j<ref.indices.length;j+=3){const ids=ref.indices.slice(j,j+3),[a,b,c]=ids.map(k=>ref.sourceUV[k]),cross=(p,q,t)=>(q[0]-p[0])*(t[1]-p[1])-(q[1]-p[1])*(t[0]-p[0]),den=cross(a,b,c);if(Math.abs(den)<1e-12)continue;const y=cross(a,sourceUV,c)/den,z=cross(a,b,sourceUV)/den,weights=[1-y-z,y,z];if(weights.every(w=>w>=-2e-5)){oraclePoint=[0,1].map(k=>weights.reduce((s,w,n)=>s+w*ref.positions[ids[n]*2+k],0));break;}}
                assert(oraclePoint,'Actual GPU vertex outside native Rust triangle');maxGPURust=Math.max(maxGPURust,Math.abs(localX-oraclePoint[0]),Math.abs(localY-oraclePoint[1]));
                maxGPUWorld=Math.max(maxGPUWorld,Math.abs(localX-e.x),Math.abs(localY+e.y));
                maxScreen=Math.max(maxScreen,Math.abs(x-e.tx),Math.abs(y-e.ty));maxUV=Math.max(maxUV,Math.abs(u-e.u),Math.abs(v-e.v));submittedVertices++;
            }
        }
    }
    result.phaserGPU={submittedVertices,maxGPUWorld,maxGPURust,maxScreen,maxUV,limits:{world:.01,screen:.0001,uv:1e-6},uploadByteDifference:0};
    if(maxGPUWorld>.01||maxGPURust>.01||maxScreen>.0001||maxUV>1e-6)result.status='FAIL';
    return result;
}
