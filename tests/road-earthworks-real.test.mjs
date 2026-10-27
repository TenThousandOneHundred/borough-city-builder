import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import FineZones from '../dist/fine-zoning-state.js';
import {Roadworks} from '../dist/roadworks.js';
import {RoadSurfaceIndex} from '../dist/road-surface-index.js';
import {groundHeight,terrainColor} from '../dist/landscape.js';
import {terrainMeshes} from '../dist/terrain-mesh.js';
import {atDistance} from '../dist/street-geometry.js';

globalThis.CityEngine=E;
function world(terrain){
 const w=E.createWorld('Road terrain comparison',terrain==='hills'?'plains':terrain,23);
 for(const t of w.tiles)Object.assign(t,{type:null,level:0,tree:false});w.roadPaths=[];w.money=1e7;
 if(terrain==='hills'){
  const elevation=[];for(let z=-96;z<=96;z+=2)for(let x=-96;x<=96;x+=2)elevation.push(2+9*Math.exp(-((x/50)**2)-((z+20)/24)**2)-groundHeight(w,x,z));
  w.elevation=elevation;w.elevationRevision=1;for(const t of w.tiles)t.ground='land';
 }
 const roads=terrain==='hills'?[['street',[{x:7,y:25},{x:23,y:21},{x:40,y:25}]]]:[['avenue',[{x:10,y:24},{x:22,y:18},{x:40,y:24}]],['street',[{x:32,y:10},{x:32,y:35}]]];
 for(const [type,controls]of roads)assert.equal(E.buildRoadPath(w,controls,type).ok,true);
 w.roadPaths.forEach((p,i)=>{const old=p.id;p.id='road-benchmark-'+i;for(const t of w.tiles)if(t.pathIds)t.pathIds=t.pathIds.map(id=>id===old?p.id:id);});
 const grid=FineZones.grid(w,E.ROADS);w.development=FineZones.create();FineZones.paint(w.development,grid,[...grid.keys()],'residential_low');
 return w;
}
function view(){
 const materials=new Map();return {scene:new THREE.Scene(),unitBox:new THREE.BoxGeometry(),night:false,materials,
  mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color}));return materials.get(color);},
  box(group,x,y,z,w,h,d,color){const mesh=new THREE.Mesh(this.unitBox,this.mat(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);return mesh;},
  landscape:{assets:{},material:()=>new THREE.MeshStandardMaterial()}};
}
function bytes(array){return new Uint8Array(array.buffer,array.byteOffset,array.byteLength).slice();}
function snapshot(g){return {attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,bytes(a.array)])),index:bytes(g.index.array),drawRange:{...g.drawRange}};}
function unchanged(g,before){
 assert.deepEqual(Object.keys(g.attributes),Object.keys(before.attributes));
 for(const [name,array]of Object.entries(before.attributes))assert.deepEqual(bytes(g.attributes[name].array),array,`${name} remains byte-identical`);
 assert.deepEqual(bytes(g.index.array),before.index,'natural terrain indices remain byte-identical');assert.deepEqual(g.drawRange,before.drawRange);
}

function retainingCoverage(r,result,natural){
 assert.ok(result.walls,'the actual hill cut has retaining walls');
 const material=new THREE.MeshBasicMaterial(),ray=new THREE.Raycaster(),origin=new THREE.Vector3(),direction=new THREE.Vector3(),buckets=new Map(),meshes=new Map(),positions=result.walls.attributes.position;let rays=0,sections=0;
 // Test-only broad phase keeps all probes practical. Indexed subsets share
 // the actual emitted vertex buffer; no wall is reconstructed or simplified.
 for(let i=0;i<positions.count;i+=3){const xs=[0,1,2].map(k=>positions.getX(i+k)),zs=[0,1,2].map(k=>positions.getZ(i+k));
  for(let x=Math.floor(Math.min(...xs)/4);x<=Math.floor(Math.max(...xs)/4);x++)for(let z=Math.floor(Math.min(...zs)/4);z<=Math.floor(Math.max(...zs)/4);z++){const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i,i+1,i+2);}
 }
 if(!result.walls.boundingSphere)result.walls.computeBoundingSphere();
 for(const [key,indices]of buckets){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',positions);geometry.setIndex(indices);geometry.boundingSphere=result.walls.boundingSphere.clone();const mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld(true);meshes.set(key,mesh);}
 const section=(x,z,nx,nz,low,high,label)=>{
  assert.ok(high-low>.15,label+' exercises a visible height discontinuity');
  const candidates=[];for(let bx=Math.floor((x-Math.abs(nx)*.22)/4);bx<=Math.floor((x+Math.abs(nx)*.22)/4);bx++)for(let bz=Math.floor((z-Math.abs(nz)*.22)/4);bz<=Math.floor((z+Math.abs(nz)*.22)/4);bz++){const mesh=meshes.get(bx+','+bz);if(mesh)candidates.push(mesh);}
  for(const fraction of [.25,.5,.75])for(const side of [-1,1]){
   const y=low+(high-low)*fraction;origin.set(x+nx*.22*side,y,z+nz*.22*side);direction.set(-nx*side,0,-nz*side);ray.set(origin,direction);ray.near=0;ray.far=.44;
   assert.ok(ray.intersectObjects(candidates,false).length>0,`${label}: missing retaining face at (${x},${y},${z}), side ${side}`);rays++;
  }sections++;
 };
 try{
  // This four-metre-long missing section was previously canceled by a
  // Float32-collapsed soil triangle. Use world coordinates, not triangle IDs.
  const x=(-19.93522834777832-19)/2,z=(-3.064771890640259-3.127897262573242)/2,dx=.93522834777832,dz=-.0631253719329834,length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length;
  const support=r.surfaceHeight(x+nx*.2,z+nz*.2,'sidewalk');assert.notEqual(support,null);const ground=natural.sample(x,z);assert.notEqual(ground,null);section(x,z,nx,nz,support-.05,ground,'previous hill wall gap');
  // Sample independent road cross-sections rather than using existing wall
  // vertices as the oracle: missing entire panels must also fail. Only tall
  // cuts/fills are selected; mild slopes correctly use an earth shoulder.
  for(const route of r.renderRoads.values())for(const side of [-1,1])for(let d=2;d<route.stations.at(-1).distance-2;d+=.25){
   const p=atDistance(route.stations,d),outer=route.spec.width/2+.38,nx=p.nx*side,nz=p.nz*side,x=p.x+nx*(outer+.12),z=p.z+nz*(outer+.12),support=r.surfaceHeight(p.x+nx*(outer-.05),p.z+nz*(outer-.05),'sidewalk'),ground=natural.sample(x,z);
   if(support===null||ground===null||Math.abs(support-.05-ground)<.35)continue;
   section(x,z,nx,nz,Math.min(support-.05,ground),Math.max(support-.05,ground),`hill perimeter at distance ${d}, side ${side}`);
  }
  assert.ok(sections>100,'both sides receive dense independent coverage');return {sections,rays};
 }finally{for(const mesh of meshes.values())mesh.geometry.dispose();material.dispose();}
}

test('real curved hill and river roads seal their opaque footprint without changing saved or natural terrain',t=>{
 // These are the browser review scenes, including authored elevation, curved
 // roads, the river junction and fine zoning. No custom road-height function
 // or synthetic rectangles can hide a disagreement between the final meshes.
 for(const name of ['hills','river']){
  const w=world(name),saved=JSON.stringify(w),v=view(),r=new Roadworks(v),{ground,far}=terrainMeshes(w,groundHeight,terrainColor),before=snapshot(ground),farBefore=snapshot(far);
  const copies=[];let result,kept;
  try{
   r.build(w);assert.ok(r.earthworks);r.earthworks.beginApplication();result=r.earthworks.applyToGeometry(ground);
   assert.ok(result.indices.length<ground.index.count);assert.ok(result.removedCoreArea>10,'the opaque core is removed rather than left intersecting its road');
   assert.ok(result.replacement.attributes.position.count>0);assert.equal(result.stats.applications,1);assert.equal(result.stats.fallback,false,'topology must succeed rather than silently restoring intersecting terrain');
   unchanged(ground,before);unchanged(far,farBefore);assert.equal(JSON.stringify(w),saved,'rendering cannot modify a save');
   const road=new RoadSurfaceIndex(),original=new RoadSurfaceIndex(),rendered=new RoadSurfaceIndex();original.add(ground);
   kept=ground.clone();kept.setIndex(new THREE.BufferAttribute(result.indices,1));rendered.add(kept);rendered.add(result.replacement);if(result.walls)rendered.add(result.walls);
   let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
   for(const mesh of r.earthworkSurfaces){
    if(mesh.userData.roadSurface!=='asphalt')continue;
    mesh.updateMatrixWorld(true);const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);copies.push(g);road.add(g);
    g.computeBoundingBox();minX=Math.min(minX,g.boundingBox.min.x);maxX=Math.max(maxX,g.boundingBox.max.x);minZ=Math.min(minZ,g.boundingBox.min.z);maxZ=Math.max(maxZ,g.boundingBox.max.z);
   }
   assert.ok(copies.length>0);let probes=0,originalBreakthroughs=0,coveredHoles=0,worst=-Infinity,worstPoint=null;
   // Reject only the *outer footprint*, not internal triangle seams. Samples
   // around a point also avoid counting a legitimate shoulder just beyond a
   // road edge as an asphalt intersection. Radius is 12.5 cm in game metres.
   const offsets=Array.from({length:8},(_,i)=>[.025*Math.cos(i*Math.PI/4),.025*Math.sin(i*Math.PI/4)]);
   const probe=(x,z)=>{
    const asphalt=road.sample(x,z);if(asphalt===null||offsets.some(([dx,dz])=>road.sample(x+dx,z+dz)===null))return;
    probes++;const old=original.sample(x,z),height=rendered.sample(x,z);if(old!==null&&old>asphalt+.002)originalBreakthroughs++;
    if(height===null){coveredHoles++;return;}const excess=height-asphalt;if(excess>worst){worst=excess;worstPoint={x,z,terrain:height,asphalt};}
   };
   // One-metre raster probes catch large original terrain faces; triangle
   // centroids and inset corners also cover narrow curved/junction slivers.
   for(let x=Math.ceil(minX/.2)*.2;x<maxX;x+=.2)for(let z=Math.ceil(minZ/.2)*.2;z<maxZ;z+=.2)probe(x,z);
   for(const g of copies){const p=g.attributes.position,index=g.index,count=index?.count??p.count;
    for(let i=0;i<count;i+=3)for(const weights of [[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]]){
     let x=0,z=0;for(let k=0;k<3;k++){const j=index?index.getX(i+k):i+k;x+=p.getX(j)*weights[k];z+=p.getZ(j)*weights[k];}probe(x,z);
    }
   }
   assert.ok(probes>4000,`${name} has dense actual-road coverage`);assert.ok(originalBreakthroughs>100,`${name} would expose natural terrain through the unchanged road without the cut`);assert.ok(coveredHoles>100,'sampling the emitted triangles must observe the hidden core omission');
   assert.ok(worst<=2e-4,`${name} terrain protrudes through opaque asphalt: ${JSON.stringify(worstPoint)}, excess ${worst}`);
   const retaining=name==='hills'?retainingCoverage(r,result,original):undefined;
   t.diagnostic(JSON.stringify({scene:name,probes,originalBreakthroughs,coveredHoles,maxTerrainAboveAsphalt:Number.isFinite(worst)?worst:null,removedCoreArea:result.removedCoreArea,retaining}));
  }finally{
   kept?.dispose();for(const g of copies)g.dispose();result?.replacement?.dispose();result?.walls?.dispose();ground.dispose();far.dispose();r.clear();r.lampMaterial.dispose();r.walkMaterial.dispose();r.lightPoolMaterial.dispose();v.unitBox.dispose();for(const material of v.materials.values())material.dispose();
  }
 }
});
