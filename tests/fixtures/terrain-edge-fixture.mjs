import {createHash} from 'node:crypto';
import E from '../../dist/engine.js';
import * as T from '../../dist/vendor/three.module.js';
import {groundHeight,wetness} from '../../dist/landscape.js';
import {world,harness} from './road-build-view.mjs';
export function terrainEdgeFixture(kind){
 const w=world();w.roadPaths=[];for(const t of w.tiles)t.type=null;
 const routes=kind==='curved'?[[[7,12],[17,35],[39,16]],[[8,34],[27,8],[41,35]]]:[12,24,36].map(y=>[[6,y],[42,y]]);
 for(const path of routes){const result=E.buildRoadPath(w,path.map(([x,y])=>({x,y})),'avenue');if(!result.ok)throw Error(result.reason);}
 const v=harness(w);v.refresh(true);const surfaces=v.roadworks.earthworks.surfaceSnapshot,g=new T.PlaneGeometry(192,192,kind==='curved'?128:192,kind==='curved'?128:192);g.rotateX(-Math.PI/2);
 const p=g.attributes.position,colors=[];for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,groundHeight(w,x,z));colors.push(.4+x*.001,.5+z*.001,.6);}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();
 return {options:{world:w,surfaces,groundHeight,wetness},geometry:g,cleanup(){g.dispose();v.roadworks.dispose();v.cleanup();}};
}
export function terrainFingerprint(plan,result){
 const hash=createHash('sha256'),add=a=>hash.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));add(result.indices);
 for(const geometry of [result.replacement,result.walls]){if(!geometry){hash.update('none');continue;}for(const [name,a]of Object.entries(geometry.attributes)){hash.update(name);add(a.array);}if(geometry.index)add(geometry.index.array);}
 hash.update(JSON.stringify(result.stats));const queries=[];for(let x=-80;x<=80;x+=5)for(let z=-80;z<=80;z+=5)queries.push([plan.sample(x,z),plan.contains(x,z)]);hash.update(JSON.stringify(queries));return hash.digest('hex');
}
