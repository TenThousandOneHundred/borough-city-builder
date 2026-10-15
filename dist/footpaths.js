import * as THREE from './vendor/three.module.js';
import {streetStations,streetSurface,pavementMaterial} from './street-geometry.js?v=65';
import {floorHeight} from './landscape.js?v=65';
import {batchStatic} from './static-batch.js?v=65';
const material=pavementMaterial();
export function buildFootpaths(world,group){
 for(const path of world.walkPaths||[]){const points=CityEngine.sampleRoad(path.controls).map(p=>({x:(p.x+.5)*4-96,z:(p.y+.5)*4-96}));
  const geometry=streetSurface(streetStations(points),[[-.325,.055],[.325,.055]],(x,z)=>floorHeight(world,x,z));
  const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;group.add(mesh);
 }
 // Preserve all curve samples and terrain detail while submitting spatial pavement batches.
 if(group.children.length)batchStatic(group);
}
