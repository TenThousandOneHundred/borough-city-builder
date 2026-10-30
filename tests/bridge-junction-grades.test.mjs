import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';
import {Roadworks} from '../dist/roadworks.js';
import {roadGeometry} from '../dist/road-junction-plan.js';
import {atDistance} from '../dist/street-geometry.js';
import {bridgeHeight,bridgeWidth} from '../dist/bridge-spans.js';
import {RoadSurfaceIndex} from '../dist/road-surface-index.js';
import {groundHeight,terrainColor} from '../dist/landscape.js';
import {terrainMeshes} from '../dist/terrain-mesh.js';

globalThis.CityEngine=E;
const MAX_GRADE=.25,HEIGHT_EPS=2e-4;
let world,roads,view,junction,asphalt=[],concrete=[],saved,routes;

function triangles(mesh){
 mesh.updateWorldMatrix(true,false);const p=mesh.geometry.attributes.position,index=mesh.geometry.index,out=[],point=new THREE.Vector3();
 for(let i=0;i<(index?.count??p.count);i+=3){const v=[];for(let k=0;k<3;k++){point.fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld);v.push(point.toArray());}out.push(v);}return out;
}
function plane([a,b,c]){
 const dx=b[0]-a[0],dz=b[2]-a[2],ex=c[0]-a[0],ez=c[2]-a[2],den=dx*ez-dz*ex;
 if(Math.abs(den)<1e-10)return null;const dy=b[1]-a[1],ey=c[1]-a[1];return {den,gx:(dy*ez-dz*ey)/den,gz:(dx*ey-dy*ex)/den};
}
function concreteTop(x,z){
 let y=null;
 for(const t of concrete){const [a,b,c]=t.v;if(x<t.x0-1e-6||x>t.x1+1e-6||z<t.z0-1e-6||z>t.z1+1e-6)continue;
  const u=((x-a[0])*(c[2]-a[2])-(z-a[2])*(c[0]-a[0]))/t.den,v=((b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0]))/t.den;
  if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6){const h=a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);y=y===null?h:Math.max(y,h);}
 }return y;
}

before(()=>{
 world=E.createWorld('Bridge junction grade regression','river',23);
 // Preserve the photographed Edition 132 crossing lengths and probe locations.
 world.landformVersion=2;
 for(const tile of world.tiles)Object.assign(tile,{type:null,level:0,tree:false});world.roadPaths=[];world.money=1e7;
 for(const [type,controls]of [['avenue',[{x:10,y:24},{x:22,y:18},{x:40,y:24}]],['street',[{x:32,y:10},{x:32,y:35}]]])assert.equal(E.buildRoadPath(world,controls,type).ok,true);
 world.roadPaths.forEach((p,i)=>{const old=p.id;p.id='junction-regression-'+i;for(const tile of world.tiles)if(tile.pathIds)tile.pathIds=tile.pathIds.map(id=>id===old?p.id:id);});
 saved=JSON.stringify(world);routes=JSON.stringify(roadGeometry(world,E));const materials=new Map();
 view={scene:new THREE.Scene(),unitBox:new THREE.BoxGeometry(),night:false,materials,
  mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color}));return materials.get(color);},
  box(group,x,y,z,w,h,d,color){const mesh=new THREE.Mesh(this.unitBox,this.mat(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);return mesh;},
  landscape:{assets:{},material:()=>new THREE.MeshStandardMaterial()}};
 roads=new Roadworks(view);roads.build(world);
 junction=roads.junctionPlan.junctions.find(j=>Math.abs(j.x-34)<.01);assert.ok(junction,'the fixture retains the actual curved avenue/street junction');
 for(const mesh of roads.earthworkSurfaces)if(mesh.userData.roadSurface==='asphalt')asphalt.push(...triangles(mesh));
 for(const mesh of roads.earthworkStructures)for(const v of triangles(mesh)){const p=plane(v);if(!p||p.den>=0)continue;concrete.push({v,den:p.den,x0:Math.min(...v.map(p=>p[0])),x1:Math.max(...v.map(p=>p[0])),z0:Math.min(...v.map(p=>p[2])),z1:Math.max(...v.map(p=>p[2]))});}
 assert.equal(roads.earthworks.stats.fallback,false,'this ordinary bridge layout must build real terrain support');
});
after(()=>{
 roads?.clear();roads?.lampMaterial.dispose();roads?.walkMaterial.dispose();roads?.lightPoolMaterial.dispose();roads?.asphalt?.dispose();view?.unitBox.dispose();for(const material of view?.materials.values()||[])material.dispose();
});

test('the rendered river junction has drivable faces across the former bridge selector seam',t=>{
 // A 25% rise/run ceiling is deliberately looser than the planner's4% local
 // junction target and12% ordinary approach target. It rejects a road-height
 // selector cliff without prescribing any particular elevation or triangle ID.
 let checked=0,worst={grade:0},worstEdge={excess:0};
 for(const v of asphalt){const x=v.reduce((sum,p)=>sum+p[0]/3,0),z=v.reduce((sum,p)=>sum+p[2]/3,0);if(Math.hypot(x-junction.x,z-junction.z)>junction.radius+.7)continue;
  const p=plane(v);if(!p)continue;checked++;
  // Plane gradients are ill-conditioned only for submillimetre Float32
  // slivers. Their actual edges are still checked with a height tolerance.
  const longest=Math.max(...v.map((a,i)=>Math.hypot(a[0]-v[(i+1)%3][0],a[2]-v[(i+1)%3][2])));
  if(Math.abs(p.den)>longest*1e-4){const grade=Math.hypot(p.gx,p.gz);if(grade>worst.grade)worst={grade,vertices:v};}
  for(let i=0;i<3;i++){const a=v[i],b=v[(i+1)%3],length=Math.hypot(a[0]-b[0],a[2]-b[2]),rise=Math.abs(a[1]-b[1]),excess=rise-MAX_GRADE*length;if(excess>worstEdge.excess)worstEdge={a,b,length,rise,excess};}
 }
 assert.ok(checked>30,'the test covers real junction and approach triangles');assert.ok(worst.grade<=MAX_GRADE+.002,`rendered junction grade exceeds25%: ${JSON.stringify(worst)}`);assert.ok(worstEdge.excess<=HEIGHT_EPS,`road face contains a steep step: ${JSON.stringify(worstEdge)}`);t.diagnostic(JSON.stringify({asphaltTriangles:checked,maxGrade:worst.grade}));
});

test('the walking surface at the former abutment corner has no height-selection cliff',t=>{
 // This line runs through the broad walking part of the eastern footway,
 // one metre beyond the kerb, avoiding intentional bevel and vertical faces.
 const arm=junction.arms.find(a=>Math.abs(a.tx)<.01&&a.tz>.9),x=junction.x+arm.width/2+.2,start=junction.z+junction.radius-.14,end=junction.z+junction.radius-.01;
 let previous=null,worst=0,probes=0;
 for(let z=start;z<=end+1e-8;z+=.01){const y=roads.surfaceHeight(x,z,'sidewalk');assert.notEqual(y,null,'the known corner walking strip remains present');if(previous){const grade=Math.abs(y-previous.y)/(z-previous.z);worst=Math.max(worst,grade);}previous={y,z};probes++;}
 assert.ok(probes>=12);assert.ok(worst<=MAX_GRADE+.002,`corner sidewalk still has a vertical grade change: ${worst}`);t.diagnostic(JSON.stringify({sidewalkProbes:probes,maxGrade:worst}));
});

test('the corrected bridge pavement and footways remain supported by actual concrete',t=>{
 const span=roads.bridgePlan.spans.find(s=>s.roads.includes('junction-regression-0'));assert.ok(span);let deck=0,walk=0,worstDeck=0,worstWalk=0;
 // Probe both sides of the bridge/junction handoff. The deck normally ends
 // .02world below asphalt; its top sits .005 below the footway's .05-thick
 // outer slab. Allow another .02 for interpolated curved-sweep contact.
 for(let d=span.start+.15;d<Math.min(span.end,span.start+10);d+=.2){const p=atDistance(span.points,d);
  for(const u of [-.65,0,.65]){const x=p.x+p.nx*u,z=p.z+p.nz*u,top=concreteTop(x,z),road=roads.surfaceHeight(x,z,'asphalt');assert.notEqual(road,null);assert.notEqual(top,null,'concrete must support the road handoff');const gap=road-top;worstDeck=Math.max(worstDeck,gap);assert.ok(gap>=.015&&gap<=.04,`bridge deck contact gap: ${JSON.stringify({x,z,gap})}`);deck++;}
  for(const side of [-1,1]){const u=side*(bridgeWidth(span.points,d)/2+.2),x=p.x+p.nx*u,z=p.z+p.nz*u,top=concreteTop(x,z),foot=roads.surfaceHeight(x,z,'sidewalk');if(foot===null)continue;assert.notEqual(top,null,'bridge footway requires structural support');const gap=foot-.05-top;worstWalk=Math.max(worstWalk,gap);assert.ok(gap>=-.015&&gap<=.025,`bridge footway support gap: ${JSON.stringify({x,z,gap})}`);walk++;}
 }
 assert.ok(deck>100&&walk>20,'the actual concrete and both footways receive dense coverage');assert.equal(JSON.stringify(world),saved);assert.equal(JSON.stringify(roadGeometry(world,E)),routes,'grading must leave saved horizontal routes unchanged');
 t.diagnostic(JSON.stringify({deckProbes:deck,footwayProbes:walk,maxDeckGap:worstDeck,maxFootwayBottomGap:worstWalk}));
});

test('the same street keeps its separate northern and southern crossings outside the junction correction',t=>{
 const spans=roads.bridgePlan.spans.filter(s=>s.roads.includes('junction-regression-1'));assert.equal(spans.length,2);let probes=0,vertices=0,worst=0;
 for(const span of spans)for(let d=span.start+.5;d<span.end-.5;d+=1.5){const p=atDistance(span.points,d);for(const u of [-.65,0,.65]){
  const x=p.x+p.nx*u,z=p.z+p.nz*u,base=bridgeHeight(roads.bridgePlan,x,z);assert.notEqual(base,null);assert.equal(roads.height(world,x,z),base,'remote bridge heights remain exactly unchanged');probes++;
 }}
 // Compare authored/finalized vertices, not arbitrary triangle-interior
 // points: a linear mesh intentionally interpolates the curved crossfall.
 for(const triangle of asphalt)for(const [x,y,z]of triangle){if(Math.abs(x-34)>1.3||!spans.some(s=>z>s.points[0].z+.5&&z<s.points.at(-1).z-.5))continue;const base=bridgeHeight(roads.bridgePlan,x,z);assert.notEqual(base,null);const difference=Math.abs(y-base-.08);worst=Math.max(worst,difference);assert.ok(difference<HEIGHT_EPS,`an unrelated crossing vertex moved: ${JSON.stringify({x,z,difference})}`);vertices++;}
 assert.ok(probes>100&&vertices>100);t.diagnostic(JSON.stringify({unrelatedBridgeProbes:probes,unrelatedBridgeVertices:vertices,maxVertexDifference:worst}));
});

test('the real abutment coping clears its grass shelf and stays below overlapping pavement',t=>{
 const {ground,far}=terrainMeshes(world,groundHeight,terrainColor),positions=ground.attributes.position.array.slice(),indices=ground.index.array.slice();let result;
 try{
  roads.earthworks.beginApplication();result=roads.earthworks.applyToGeometry(ground);const soil=new RoadSurfaceIndex(),walls=new RoadSurfaceIndex();soil.add(result.replacement);walls.add(result.walls);
  // These are the actual green/white ledge ray-hit coordinates. The previous
  // soil and cap differed by less than .00001world, visibly fighting for depth.
  let probes=0,minClearance=Infinity;
  for(const dx of [0,.005,.01])for(const dz of [-.005,0,.005]){const x=35.66717+dx,z=-3.61250+dz,earth=soil.sample(x,z),cap=walls.sample(x,z);assert.notEqual(earth,null,`soil shelf at ${x},${z}`);assert.notEqual(cap,null,`concrete cap at ${x},${z}`);const clearance=cap-earth;minClearance=Math.min(minClearance,clearance);assert.ok(clearance>.002&&clearance<.01,`the coping must physically clear the soil: ${JSON.stringify({x,z,clearance})}`);probes++;}
  const p=result.walls.attributes.position,n=result.walls.attributes.normal;let checked=0,overlapping=0;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);if(n.getY(i)<.4||x<35||x>38||z< -4.5||z>3)continue;checked++;const surface=roads.surfaceHeight(x,z);if(surface===null)continue;overlapping++;assert.ok(p.getY(i)<surface-.001,'the raised rim cannot break through an overlapping driving or walking surface');}
  assert.ok(checked>100);assert.deepEqual(ground.attributes.position.array,positions);assert.deepEqual(ground.index.array,indices);t.diagnostic(JSON.stringify({copingProbes:probes,minClearance,capVerticesChecked:checked,overlappingPavementVertices:overlapping}));
 }finally{result?.replacement.dispose();result?.walls?.dispose();ground.dispose();far.dispose();}
});
