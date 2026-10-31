import './map-grid.js?v=170';
const G=globalThis.BoroughGrid;
import {finishBuild} from './build-scheduler.js?v=170';
import {highwayEdges} from './highway-edges.js?v=170';
import {highwayBarriers} from './highway-barriers.js?v=170';
import {PedestrianSignals,signalHousing,signalPole} from './pedestrian-signals.js?v=170';
import {pedestrianCrossings,rampStations,rampAmount} from './pedestrian-network.js?v=170';
import {roundaboutIsland,addYieldSign} from './roundabout-details.js?v=170';
import {planBridges,bridgeHeight} from './bridge-spans.js?v=170';
import {planRoadGrades} from './road-grades.js?v=170';
import {createRoadEarthworksSteps} from './road-earthworks.js?v=170';
import {gradeLotsSteps,lotPickSurface,lotGradingKey} from './lot-grading.js?v=170';
import {visualParcels} from './parcels.js?v=170';
import {bridgeGeometry} from './bridge-geometry.js?v=170';
import {approachMarkings,arrowPolygons} from './road-markings.js?v=170';
import {roadFinishData,configureRoadFinish,ROAD_TEXTURE_REPEAT} from './road-finish.js?v=170';
import {laneLayout,travelHalfWidth} from './road-lanes.js?v=170';
import {roadGeometry,transitionWidth,junctionCorners,junctionCuts,clearRanges,clearSections,signalPlacements} from './road-junction-plan.js?v=170';
import {lotAccess} from './lot-access.js?v=170';
import {streetStations,atDistance,distanceSection,streetSurfaceSteps,pavementMaterial} from './street-geometry.js?v=170';
import {signalPhase,junctionPolicy} from './junctions.js?v=170';
import {addStopSign,stopSignMaterial} from './stop-sign.js?v=170';
import {outsidePortals} from './traffic.js?v=170';
import {batchStatic,batchStaticSteps} from './static-batch.js?v=170';
import * as THREE from './vendor/three.module.js';
import {floorHeight,groundHeight,wetness} from './landscape.js?v=170';
import {unifyPavementSteps} from './road-pavement.js?v=170';
import {RoadSurfaceIndex} from './road-surface-index.js?v=170';
import {annotatePaintRibbon,fitPaintRibbon,createPaintMaterial,PAINT_MAX_EXPANSION} from './road-paint.js?v=170';
import {ASPHALT_HEIGHT,JUNCTION_HEIGHT,SIDEWALK_HEIGHT,MARKING_HEIGHT,PAINT_CLEARANCE,kerbProfile,kerbCap} from './road-profile.js?v=170';
export class Roadworks{
constructor(v){this.v=v;this.group=new THREE.Group();v.scene.add(this.group);this.lamps=[];this.lampMaterial=new THREE.MeshStandardMaterial({color:'#e5e2ca',emissive:'#ffe2a0',emissiveIntensity:v.night?3:0,roughness:.3});this.walkMaterial=pavementMaterial();this.lightPoolMaterial=new THREE.MeshBasicMaterial({color:'#ffe0a0',transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending});this.lightPoolMaterial.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 poolUV;').replace('#include <uv_vertex>','#include <uv_vertex>\npoolUV=uv;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 poolUV;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=pow(max(0.,1.-length(poolUV*2.-1.)),1.8);');};this.lightPoolMaterial.customProgramCacheKey=()=> 'street-light-pool-v1';this.signalGroup=new THREE.Group();v.scene.add(this.signalGroup);}
clear(){this.lotPickSurface?.geometry.dispose();this.lotPickSurface=null;this.lotGrades=new Map();this.lotWorldKey=undefined;this.earthworks?.dispose();for(const mesh of [...(this.earthworkSurfaces||[]),...(this.earthworkStructures||[])])mesh.geometry.dispose();this.earthworks=null;this.earthworkSurfaces=[];this.earthworkStructures=[];this.earthworkKey=null;this.earthworkInputKey=null;this.gradePlan=null;this.group.traverse(o=>{if(o.geometry&&o.geometry!==this.v.unitBox)o.geometry.dispose()});this.group.clear();for(const material of this.paintMaterials?.values()||[])material.dispose();this.paintMaterials?.clear();this.lamps=[];this.pendingLamps=[];this.finishingLamps=false;this.signalKey=null;this.bridgePlan=null;this.bridgeStats=null;this.pavementStats=null;this.surfaces=new RoadSurfaceIndex();this.markingMeshes=[];this.markingStats={before:0,after:0};}
dispose(){this.clear();this.pedestrianSignals?.dispose();this.signalBulbs?.material.dispose();for(const group of [this.group,this.signalGroup,this.accessGroup]){if(!group)continue;group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry&&o.geometry!==this.v.unitBox)o.geometry.dispose();});group.removeFromParent();group.clear();}for(const material of [this.lampMaterial,this.walkMaterial,this.lightPoolMaterial,this.asphalt]){if(!material)continue;for(const key of ['map','normalMap','roughnessMap'])if(material[key]&&!Object.values(this.v.landscape.assets||{}).includes(material[key]))material[key].dispose();material.dispose();}}
baseHeight(w,x,z){return Math.max(.32,floorHeight(w,x,z))+.1+wetness(w,x,z)*1.2}
naturalDatum(w,x,z){return this.baseHeight(w,x,z)-.16;}
height(w,x,z){return (this.world===w?(this.gradePlan?.resolveBridgeJunction?.(x,z)??bridgeHeight(this.bridgePlan,x,z)??this.gradePlan?.sampleDatum(x,z)):null)??this.naturalDatum(w,x,z)}
surfaceHeight(x,z,kind){return this.surfaces?.sample(x,z,kind)??null;}
drivingHeight(w,x,z){return (this.world===w?this.surfaceHeight(x,z,'asphalt'):null)??this.height(w,x,z)+ASPHALT_HEIGHT;}
finalizePavement(){return finishBuild(this.finalizePavementSteps());}
*finalizePavementSteps(){
 const strips=[],patches=[];this.group.traverse(mesh=>{if(mesh.userData.roadSurface==='asphalt')(mesh.userData.roadJunction?patches:strips).push(mesh);});
 this.pavementStats=yield* unifyPavementSteps(strips,patches);
 // Clipping replaces geometry. Rebuild the copied triangle index before paint,
 // vehicles, and footway consumers can query the final visible surface.
 this.surfaces=new RoadSurfaceIndex();
 this.group.traverse(mesh=>{if(mesh.userData.roadSurface)this.surfaces.add(mesh.geometry,mesh.userData.roadSurface);});
 for(const mesh of [...strips,...patches])if(!mesh.geometry.attributes.position.count)mesh.removeFromParent();
}
walkingHeight(w,x,z){const road=this.surfaceHeight(x,z),access=this.accessSurfaces?.sample(x,z),surface=road===null?access:access==null?road:Math.max(road,access);if(surface!=null)return surface;const i=Math.floor((z+G.half)/4)*G.n+Math.floor((x+G.half)/4);return w.tiles[i]?.type==='road'?this.height(w,x,z)+ASPHALT_HEIGHT:Math.max(.2,this.v.landscape?.renderHeight?.(w,x,z)??groundHeight(w,x,z))+.08;}
paintHeight(w,x,z){return (this.surfaceHeight(x,z,'asphalt')??this.height(w,x,z)+JUNCTION_HEIGHT)+PAINT_CLEARANCE;}
surface(...args){return finishBuild(this.surfaceSteps(...args));}
*surfaceSteps(w,points,profile,material,kind=null){const stations=points[0]?.nx!==undefined?points:streetStations(points);if(stations.length<2)return null;const mesh=new THREE.Mesh(yield* streetSurfaceSteps(stations,profile,(x,z)=>this.height(w,x,z)),material);mesh.receiveShadow=true;this.group.add(mesh);if(kind){this.surfaces ||= new RoadSurfaceIndex();this.surfaces.add(mesh.geometry,kind);mesh.userData.roadSurface=kind;}return mesh;}
ribbon(w,points,width,offset,material,raise=ASPHALT_HEIGHT,spec=null,kind=null){const stations=points[0]?.nx!==undefined?points:streetStations(points);const mesh=this.surface(w,stations,p=>{const w=typeof width==='function'?width(p):width,o=typeof offset==='function'?offset(p):offset;return [[o-w*.5,raise],[o+w*.5,raise]];},material,kind||(spec||material.userData.roadFinish?'asphalt':null));if(mesh&&spec&&material.userData.roadFinish)roadFinishData(mesh.geometry,stations,width,spec);return mesh;}
conformMarking(w,geometry){
 const p=geometry.attributes.position,uv=geometry.attributes.uv,paint=geometry.attributes.roadPaint,index=geometry.index,sourceCount=index?.count||p.count;
 for(let i=0;i<p.count;i++)p.setY(i,this.paintHeight(w,p.getX(i),p.getZ(i)));
 if(paint)fitPaintRibbon(geometry);
 // A narrow paint triangle can cross two pavement planes even when its own
 // vertices match perfectly. Split only those triangles, at build time, with
 // a fixed depth bound; flat roads retain every original triangle.
 let positions=null,texcoords=null,paintcoords=null,sourceOffset=0;
 const read=i=>({p:[p.getX(i),p.getY(i),p.getZ(i)],uv:uv?[uv.getX(i),uv.getY(i)]:null,paint:paint?[paint.getX(i),paint.getY(i),paint.getZ(i),paint.getW(i)]:null});
 const emit=v=>{positions.push(...v.p);if(uv)texcoords.push(...v.uv);if(paint)paintcoords.push(...v.paint);};
 // Most paint needs no refinement. Keep its original buffers instead of
 // flattening every triangle into temporary arrays that would be discarded.
 const beginOutput=()=>{positions=[];texcoords=[];paintcoords=[];for(let i=0;i<sourceOffset;i++)emit(read(index?index.getX(i):i));};
 // Sharp bridge/terrain crests may require deeper local refinement. The
 // per-mesh split budget still caps output at 64 times its original triangles.
 let splitsRemaining=sourceCount/3*21;
 const midpoint=(a,b)=>{const x=Math.fround((a.p[0]+b.p[0])/2),z=Math.fround((a.p[2]+b.p[2])/2);return {p:[x,this.paintHeight(w,x,z),z],uv:null,paint:null};};
 const interpolate=(out,a,b)=>{if(uv)out.uv=[(a.uv[0]+b.uv[0])/2,(a.uv[1]+b.uv[1])/2];if(paint)out.paint=a.paint.map((v,i)=>(v+b.paint[i])/2);};
 const triangle=(a,b,c,depth)=>{
  if(depth<6&&splitsRemaining>0){
   const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a),x=(a.p[0]+b.p[0]+c.p[0])/3,z=(a.p[2]+b.p[2]+c.p[2])/3;
   const error=Math.max(Math.abs(ab.p[1]-(a.p[1]+b.p[1])/2),Math.abs(bc.p[1]-(b.p[1]+c.p[1])/2),Math.abs(ca.p[1]-(c.p[1]+a.p[1])/2),Math.abs(this.paintHeight(w,x,z)-(a.p[1]+b.p[1]+c.p[1])/3));
   if(error>.0008){if(!positions)beginOutput();interpolate(ab,a,b);interpolate(bc,b,c);interpolate(ca,c,a);splitsRemaining--;triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);return;}
  }
  if(positions){emit(a);emit(b);emit(c);}
 };
 for(sourceOffset=0;sourceOffset<sourceCount;sourceOffset+=3)triangle(...[0,1,2].map(k=>read(index?index.getX(sourceOffset+k):sourceOffset+k)),0);
 if(positions){geometry.setIndex(null);geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));if(uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(texcoords,2));if(paint){geometry.setAttribute('roadPaint',new THREE.Float32BufferAttribute(paintcoords,4));geometry.userData.roadPaintPairs=false;}geometry.deleteAttribute('normal');}else p.needsUpdate=true;
 this.markingStats ||= {before:0,after:0};this.markingStats.before+=sourceCount/3;this.markingStats.after+=positions?positions.length/9:sourceCount/3;
 geometry.computeVertexNormals();geometry.computeBoundingSphere();if(paint)geometry.boundingSphere.radius+=PAINT_MAX_EXPANSION;
}
marking(w,mesh){if(mesh){if(mesh.geometry.attributes.roadPaint){this.paintMaterials ||= new Map();const source=mesh.material;let material=this.paintMaterials.get(source);if(!material){material=createPaintMaterial(source);this.paintMaterials.set(source,material);}mesh.material=material;}mesh.userData.roadMarking=true;(this.markingMeshes ||= []).push(mesh);if(!this.building)this.conformMarking(w,mesh.geometry);}return mesh;}
paint(w,points,width,offset,material){const mesh=this.ribbon(w,points,width,offset,material,MARKING_HEIGHT);if(mesh)annotatePaintRibbon(mesh.geometry);return this.marking(w,mesh);}
curbs(...args){return finishBuild(this.curbsSteps(...args));}
*curbsSteps(w,points,width,walk,curb,base=ASPHALT_HEIGHT,sidewalk=.42){
 const stations=rampStations(points,this.crossings||[],width);
 for(const side of [-1,1]){const drop=p=>{const edge=(typeof width==='function'?width(p):width)*.5;return rampAmount(this.crossings||[],{x:p.x+p.nx*edge*side,z:p.z+p.nz*edge*side});};
  const edge=p=>(typeof width==='function'?width(p):width)*.5;
  yield* this.surfaceSteps(w,stations,p=>kerbProfile(edge(p),sidewalk,drop(p),side,base),walk,'sidewalk');yield* this.surfaceSteps(w,stations,p=>kerbCap(edge(p),drop(p),side,base),curb,'kerb');
 }
}

dash(...args){return finishBuild(this.dashSteps(...args));}
*dashSteps(w,stations,offset,color,period=1.6,length=.8,raise=MARKING_HEIGHT,cuts=[],visible=null){for(let d=.25;d<stations.at(-1).distance;d+=period){yield;for(const [a,b]of clearRanges(d,Math.min(d+length,stations.at(-1).distance),cuts)){const segment=distanceSection(stations,a,b);for(const part of visible?visible(segment):[segment])this.paint(w,part,.028,offset,this.v.mat(color));}}}
sections(points,padding=0){const stations=streetStations(points),cuts=junctionCuts(stations,this.junctionPlan?.junctions||[],padding);return clearSections(stations,cuts);}
legacyPoints(id,points){
 const planned=this.gradePlan?.stationsFor(id);if(!planned)return points;
 const stations=streetStations(points),merged=stations.map(p=>({x:p.x,z:p.z,d:p.distance}));
 // Legacy descriptors can run in the reverse direction and use fewer samples
 // than their rendered strips. Retain those samples while inserting grade joins.
 for(const p of planned){if(merged.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<1e-6))continue;let best=Infinity,d=0;
  for(let i=1;i<stations.length;i++){const a=stations[i-1],b=stations[i],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;if(!length)continue;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/length)),error=(p.x-a.x-dx*t)**2+(p.z-a.z-dz*t)**2;if(error<best){best=error;d=a.distance+(b.distance-a.distance)*t;}}
  if(best<1e-8)merged.push({x:p.x,z:p.z,d});
 }
 return merged.sort((a,b)=>a.d-b.d).map(({x,z})=>({x,z}));
}
markingCuts(stations,padding){const cuts=[...junctionCuts(stations,this.junctionPlan?.junctions||[],padding),...junctionCuts(stations,(this.crossings||[]).filter(c=>c.stop!==undefined).map(c=>({...c.center,radius:.65})))].sort((a,b)=>a[0]-b[0]),merged=[];for(const c of cuts){const last=merged.at(-1);if(last&&c[0]<=last[1])last[1]=Math.max(last[1],c[1]);else merged.push(c);}return merged;}

nearJunction(x,z,padding=0){return this.junctionPlan?.junctions.some(j=>Math.hypot(x-j.x,z-j.z)<j.radius+padding);}


line(w,points,width=.025,color='#e2ded0',offset=0){return this.paint(w,points,width,offset,this.v.mat(color))}
build(w){return finishBuild(this.buildSteps(w));}
*buildSteps(w){if(this.world!==w)this.earthworkRegionCache={cells:new Map()};this.clear();this.building=true;this.world=w;this.heightRevision=(this.heightRevision||0)+1;this.junctionPlan=roadGeometry(w,CityEngine);yield;this.crossings=pedestrianCrossings(w,this.junctionPlan);this.crossingKey=(w.transit?.lines||[]).map(l=>l.id+':'+l.stops.join(',')).join(';');this.roadDescriptors=this.junctionPlan.roads;this.renderRoads=new Map(this.roadDescriptors.map(r=>[r.id,r]));this.bridgePlan=planBridges(this.roadDescriptors.map(r=>({...r,widthAt:p=>transitionWidth(r,this.junctionPlan.tapers.get(r.id)||[],p.distance)})),(x,z)=>{const gx=Math.floor((x+G.half)/4),gy=Math.floor((z+G.half)/4);return wetness(w,x,z)>.08||(gx>=0&&gy>=0&&gx<G.n&&gy<G.n&&w.tiles[gy*G.n+gx].ground==='water');},(x,z)=>this.baseHeight(w,x,z),(x,z)=>floorHeight(w,x,z));yield;this.gradePlan=planRoadGrades(this.junctionPlan,this.bridgePlan,(x,z)=>this.naturalDatum(w,x,z));const sources=['color','normal','rough'].map(slot=>this.v.landscape.assets?.['road-asphalt-'+slot]);if(!this.asphalt||sources.some((source,i)=>this.asphaltSources?.[i]!==source)){if(this.asphalt){for(const key of ['map','normalMap','roughnessMap'])this.asphalt[key]?.dispose();this.asphalt.dispose();}this.asphalt=configureRoadFinish(this.v.landscape.material('road-asphalt',ROAD_TEXTURE_REPEAT,sources[0]?'#ffffff':'#55585b'));if(sources[0])this.asphalt.color.multiplyScalar(1.55);this.asphaltSources=sources;}const asphalt=this.asphalt,walk=this.walkMaterial,curb=this.v.mat('#bec0b5');const roads=w.tiles.map((t,i)=>t.type==='road'?i:-1).filter(i=>i>=0);
for(let i of roads){yield;if(w.tiles[i].pathIds?.length&&!w.tiles[i].legacyRoad)continue;const x=(i%G.n+.5)*4-G.half,z=(Math.floor(i/G.n)+.5)*4-G.half,t=w.tiles[i],near=globalThis.BoroughRoadTypes.legacyNeighbors(w,i),dirs=near.map(n=>({x:(n%G.n-i%G.n),z:(Math.floor(n/G.n)-Math.floor(i/G.n))})),wide=t.roadWidth===2,width=wide?3.15:2.45;let points=[];
if(dirs.length===2&&dirs[0].x*dirs[1].x+dirs[0].z*dirs[1].z===0){const a=new THREE.Vector3(x+dirs[0].x*2,0,z+dirs[0].z*2),b=new THREE.Vector3(x+dirs[1].x*2,0,z+dirs[1].z*2);for(let s=0;s<=12;s++){const f=s/12,q=1-f;points.push({x:q*q*a.x+2*q*f*x+f*f*b.x,z:q*q*a.z+2*q*f*z+f*f*b.z})}}
else if(dirs.length<=2){const shape=this.renderRoads.get('grid/'+i);if(shape){const a=shape.stations[0],b=shape.stations.at(-1),x0=Math.min(a.x,b.x),z0=Math.min(a.z,b.z),dx=Math.abs(b.x-a.x),dz=Math.abs(b.z-a.z);for(let j=0;j<=4;j++)points.push({x:x0+dx*j/4,z:z0+dz*j/4});}}
if(points.length){points=this.legacyPoints('grid/'+i,points);this.ribbon(w,points,width,0,asphalt,.08,{width,lanes:wide?4:2,oneway:!!CityEngine.ROADS[t.roadType]?.oneway});for(const section of this.sections(points))yield* this.curbsSteps(w,section,width,walk,curb);const stations=streetStations(points),cuts=this.markingCuts(stations,1.2);for(const lane of laneLayout({width,lanes:wide?4:2,oneway:!!CityEngine.ROADS[t.roadType]?.oneway}).dividers)this.dash(w,stations,lane.offset,lane.center?'#d4cba8':'#dfded3',1.6,.8,.105,cuts);}
else{for(let k=0;k<dirs.length;k++){const d=dirs[k];this.ribbon(w,this.legacyPoints('grid/'+i+'/'+k,[{x,z},{x:x+d.x*2,z:z+d.z*2}]),width,0,asphalt,.08);}}



if(i%5===0&&t.ground!=='water'&&!this.nearJunction(x,z,1.5)){let horizontal=dirs.some(d=>d.x),lx=x+(horizontal?0:1.8),lz=z+(horizontal?1.8:0),y=this.height(w,lx,lz);this.lamp(lx,y,lz,horizontal)}
}
this.highwayEdges=highwayEdges(this.roadDescriptors.map(r=>({...r,widthAt:p=>transitionWidth(r,this.junctionPlan.tapers.get(r.id)||[],p.distance)})));
for(const path of w.roadPaths||[]){yield;yield* this.pathSteps(w,path,asphalt,walk,curb);}
for(const junction of this.junctionPlan.junctions){yield;this.sharedJunction(w,junction,junction.arms.every(a=>a.spec===CityEngine.ROADS.gravel)?this.v.mat('#928875'):asphalt,walk,curb);}
for(const crossing of this.crossings)if(crossing.stop!==undefined)this.paintCrossing(w,crossing);this.buildApproachMarkings(w);for(const portal of outsidePortals(w))yield* this.outsideSteps(w,portal,asphalt);yield* this.finalizePavementSteps();yield;this.buildBridges(w);yield;this.buildHighwayBarriers(w);yield* this.captureEarthworkSurfacesSteps();yield* this.syncEarthworksSteps(w);yield* this.finalizeLampsSteps();for(const mesh of this.markingMeshes){yield;this.conformMarking(w,mesh.geometry);}this.building=false;this.markingMeshes=[];this.batchStats=yield* batchStaticSteps(this.group,this.v.unitBox);this.night(this.v.night);}
buildHighwayBarriers(w){
 const roads=this.roadDescriptors.filter(r=>!r.legacy).map(r=>({...r,stations:this.gradePlan?.stationsFor(r.id)||r.stations,widthAt:p=>transitionWidth(r,this.junctionPlan.tapers.get(r.id)||[],p.distance)}));
 for(const road of roads)road.visibleSections=(points,side)=>this.highwayEdges.sections(road.id,points,p=>side*(road.widthAt(p)/2-.025));
 const result=highwayBarriers(roads,this.junctionPlan.junctions,(x,z)=>this.height(w,x,z),(x,z)=>bridgeHeight(this.bridgePlan,x,z)!=null);
 this.barrierStats={runs:result.runs,posts:result.posts,triangles:result.geometry?.attributes.position.count/3||0};
 if(result.geometry){const mesh=new THREE.Mesh(result.geometry,this.v.mat('#89928f'));mesh.castShadow=true;mesh.receiveShadow=true;this.group.add(mesh);}
}
buildBridges(w){
 const {geometries,piers,contact}=bridgeGeometry(this.bridgePlan,(x,z)=>this.height(w,x,z),(x,z)=>groundHeight(w,x,z),this.junctionPlan.junctions,this.group.children.filter(mesh=>mesh.userData.roadSurface==='asphalt').map(mesh=>mesh.geometry),span=>this.gradePlan?.bridgeStations?.(span)??span.points);let triangles=0;
 for(const [name,geometry]of Object.entries(geometries)){const material=this.v.mat(name==='metal'?'#7e8784':'#969c96'),mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.earthworkCover=name==='concrete';this.group.add(mesh);triangles+=geometry.attributes.position.count/3;}
 this.bridgeStats={spans:this.bridgePlan.spans.length,piers,triangles,contact};
}
captureEarthworkSurfaces(){return finishBuild(this.captureEarthworkSurfacesSteps());}
*captureEarthworkSurfacesSteps(){
 this.group.updateMatrixWorld(true);
 this.earthworkSurfaces=[];this.earthworkStructures=[];
 // These retained surfaces support terrain planning and picking only. Shading
 // attributes remain in the visible batches instead of being copied twice.
 const sources=[];this.group.traverse(mesh=>{if(mesh.userData.earthworkCover||['asphalt','sidewalk'].includes(mesh.userData.roadSurface))sources.push(mesh);});
 for(const mesh of sources){yield;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',mesh.geometry.attributes.position.clone());if(mesh.geometry.index)geometry.setIndex(mesh.geometry.index.clone());geometry.computeBoundingSphere();const copy=new THREE.Mesh(geometry,mesh.material);copy.matrix.copy(mesh.matrixWorld);copy.matrixAutoUpdate=false;copy.updateMatrixWorld(true);copy.userData.roadSurface=mesh.userData.roadSurface;copy.userData.earthworkCover=!!mesh.userData.earthworkCover;(mesh.userData.earthworkCover?this.earthworkStructures:this.earthworkSurfaces).push(copy);}
}
syncEarthworks(w){return finishBuild(this.syncEarthworksSteps(w));}
*syncEarthworksSteps(w){
 if(this.world!==w||!this.earthworkSurfaces?.length)return false;
 this.lotWorldKey=lotGradingKey(w);const lots=yield* gradeLotsSteps(w,this);this.lotGrades=lots.grades;const parcels=roadProtectedParcels(w).filter(p=>!lots.grades.has(p.id)),lotKey=JSON.stringify([...lots.grades].map(([id,g])=>[id,g.base,g.points])),revision='|'+lotKey+'|'+(w.elevationRevision||0),inputKey=JSON.stringify(parcels)+revision;
 if(this.earthworks&&this.earthworkInputKey===inputKey)return false;
 // A distant building cannot alter this road's maximum construction corridor.
 // Use the unconstrained footprint, so demolishing a nearby lot still restores
 // any shoulder which that lot previously prevented from extending outward.
 const relevant=plan=>plan?.mayAffectProtectedParcel?parcels.filter(p=>plan.mayAffectProtectedParcel(p.polygon)):parcels;
 const protectedParcels=relevant(this.earthworks),key=JSON.stringify(protectedParcels)+revision;
 if(this.earthworks&&this.earthworkKey===key){this.earthworkInputKey=inputKey;return false;}
 this.earthworks?.dispose();this.earthworks=yield* createRoadEarthworksSteps({world:w,surfaces:[...this.earthworkSurfaces,...lots.surfaces],structuralSurfaces:this.earthworkStructures,bridgePlan:this.bridgePlan,groundHeight,wetness,protectedParcels,regionCache:this.earthworkRegionCache});this.earthworkKey=JSON.stringify(relevant(this.earthworks))+revision;this.earthworkInputKey=inputKey;this.lotPickSurface?.geometry.dispose();this.lotPickSurface=this.earthworks.stats.fallback?null:lotPickSurface(lots.surfaces,this.walkMaterial);return true;
}
buildAccess(world,buildings){return finishBuild(this.buildAccessSteps(world,buildings));}
*buildAccessSteps(world,buildings,{hidden=false,height=(w,x,z)=>Math.max(.2,this.v.landscape?.renderHeight?.(w,x,z)??groundHeight(w,x,z))}={}){
 if(!this.accessGroup){this.accessGroup=new THREE.Group();this.v.scene.add(this.accessGroup);}
 this.accessGroup.visible=!hidden;
 this.accessGroup.traverse(o=>o.geometry?.dispose());this.accessGroup.clear();this.accessSurfaces=new RoadSurfaceIndex();this.accessRevision=(this.accessRevision||0)+1;
 for(const root of buildings.values()){
  yield;const plan=root.userData.plan;if(!plan||!root.userData.asset)continue;
  const geometry=lotAccess(world,plan,root.position.y,CityEngine,height,(w,x,z)=>this.height(w,x,z),(x,z)=>this.surfaceHeight(x,z,'sidewalk'));if(!geometry)continue;
  const mesh=new THREE.Mesh(geometry,this.walkMaterial);mesh.receiveShadow=true;this.accessGroup.add(mesh);this.accessSurfaces.add(geometry,'access');
 }
 this.accessStats=yield* batchStaticSteps(this.accessGroup,this.v.unitBox);
}
outside(...args){return finishBuild(this.outsideSteps(...args));}
*outsideSteps(w,p,asphalt){const points=[];for(let d=0;d<=280;d+=4)points.push({x:p.x+p.dx*d,z:p.z+p.dz*d});const tile=w.tiles[p.id],source=CityEngine.ROADS[tile.roadType]||CityEngine.ROADS.street,spec=tile.pathIds?.length?source:{...source,width:tile.roadWidth===2?3.15:2.45,lanes:tile.roadWidth===2?4:2,median:false,shoulder:0,limitedAccess:false},stations=streetStations(points);this.ribbon(w,points,spec.width,0,asphalt,.08,spec);yield;for(const lane of laneLayout(spec).dividers)yield* this.dashSteps(w,stations,lane.offset,lane.center?'#e4d9a2':'#e3e2d6',2.4,1.25,.105);if(spec.median)this.surface(w,points,[[-.16,.09],[-.13,.16],[.13,.16],[.16,.09]],this.v.mat('#bec0b5'));for(const side of [-1,1]){yield;this.line(w,points,.045,'#e3e2d6',side*(spec.limitedAccess?travelHalfWidth(spec):spec.width/2-.12));}yield;
 const x=p.x+p.dx*8+p.dz*2.8,z=p.z+p.dz*8-p.dx*2.8,y=this.height(w,x,z);this.v.box(this.group,x,y+2,z,.08,4,.08,'#747d79');
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#164f43';c.fillRect(0,0,512,128);c.strokeStyle='#ffffff';c.lineWidth=6;c.strokeRect(5,5,502,118);c.fillStyle='#ffffff';c.font='bold 34px sans-serif';c.textAlign='center';c.fillText('OUTSIDE CONNECTION',256,54);c.font='27px sans-serif';c.fillText('Regional highway  ↔',256,97);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(5,1.25),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));sign.position.set(x,y+4,z);sign.rotation.y=p.dx?Math.PI/2:0;this.group.add(sign);}
path(w,path,asphalt,walk,curb){return finishBuild(this.pathSteps(w,path,asphalt,walk,curb));}
*pathSteps(w,path,asphalt,walk,curb){const spec=CityEngine.ROADS[path.type],planned=this.renderRoads?.get(path.id),points=this.gradePlan?.stationsFor(path.id)||planned?.stations||CityEngine.sampleRoad(path.controls).map(p=>({x:(p.x+.5)*4-G.half,z:(p.y+.5)*4-G.half})),stations=this.gradePlan?.stationsFor(path.id)||planned?.stations||streetStations(points),width=spec.width;
if(stations.length<2)return;
const tapers=this.junctionPlan?.tapers?.get(path.id),widthAt=p=>tapers?transitionWidth(planned,tapers,p.distance):width;
const sections=clearSections(stations,junctionCuts(stations,this.junctionPlan?.junctions||[])),cuts=this.markingCuts(stations,1.2);
if(!spec.sidewalk)this.ribbon(w,points,p=>widthAt(p)+.35,0,this.v.mat('#a39f8b'),.04);
yield;this.ribbon(w,points,widthAt,0,path.type==='gravel'?this.v.mat('#928875'):asphalt,.08,spec);
for(const section of sections){yield;if(spec.sidewalk)yield* this.curbsSteps(w,section,widthAt,walk,curb,.08,.38);else if(path.type!=='gravel')for(const side of [-1,1]){const offset=p=>side*(spec.limitedAccess?travelHalfWidth(spec,widthAt(p)):widthAt(p)/2-.12);for(const visible of spec.limitedAccess&&this.highwayEdges?this.highwayEdges.sections(path.id,section,offset):[section])this.paint(w,visible,.04,offset,this.v.mat('#e0dfd0'));}}
if(spec.median)for(const section of clearSections(stations,this.markingCuts(stations,1.1)))this.surface(w,section,p=>{let scale=1;for(const t of tapers||[])if(!t.median)scale=Math.min(scale,Math.max(0,(t.end?stations.at(-1).distance-p.distance:p.distance)/2));return [[-.16*scale,.09],[-.13*scale,.09+.07*scale],[.13*scale,.09+.07*scale],[.16*scale,.09]];},curb);
const laneCuts=[...cuts,...(tapers||[]).map(t=>t.end?[stations.at(-1).distance-t.length,stations.at(-1).distance]:[0,t.length])];
if(path.type!=='gravel')for(const lane of laneLayout(spec).dividers)yield* this.dashSteps(w,stations,lane.offset,lane.center?'#d4cba8':'#e0ded2',2.4,1.25,.105,laneCuts,spec.limitedAccess&&this.highwayEdges?segment=>this.highwayEdges.sections(path.id,segment,()=>lane.offset,true):null);
for(let distance=3;distance<stations.at(-1).distance-1;distance+=12){const p=atDistance(stations,distance),dx=p.tx,dz=p.tz;if(this.nearJunction(p.x,p.z,1.5))continue;
 if(spec.sidewalk)this.lamp(p.x-dz*(widthAt(p)/2+.25),this.height(w,p.x,p.z),p.z+dx*(widthAt(p)/2+.25),Math.abs(dx)>Math.abs(dz),{x:dz,z:-dx});
 if(spec.oneway&&!spec.limitedAccess)for(const side of [-1,1])this.paint(w,[{x:p.x-dx*.4-dz*side*.22,z:p.z-dz*.4+dx*side*.22},p],.07,0,this.v.mat('#dedbc9'));
 if(spec.green){this.treeWell(w,p,width);}
}
}
treeWell(w,p,width){const x=p.x+p.tz*(width/2+.25),z=p.z-p.tx*(width/2+.25),y=this.surfaceHeight(x,z)??this.height(w,x,z)+SIDEWALK_HEIGHT;this.v.box(this.group,x,y+.02,z,.4,.04,.4,'#595d51');
 // Trees use the landscape vegetation batches and retain their full nearby models.
}


buildApproachMarkings(w){
 const positions=[];
 for(const arrow of approachMarkings(this.roadDescriptors,this.junctionPlan.junctions))for(const polygon of arrowPolygons(arrow.turns)){
  const vertices=polygon.map(([x,z])=>{x*=arrow.width/.8;return{x:arrow.center.x-arrow.tz*x+arrow.tx*z,z:arrow.center.z+arrow.tx*x+arrow.tz*z};});
  for(let i=1;i<vertices.length-1;i++){
   const triangle=[vertices[0],vertices[i],vertices[i+1]],a=triangle[0],b=triangle[1],c=triangle[2];if((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)>0)triangle.reverse();
   for(const p of triangle)positions.push(p.x,this.height(w,p.x,p.z)+MARKING_HEIGHT,p.z);
  }
 }
 if(!positions.length)return;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,this.v.mat('#dedbd0'));mesh.receiveShadow=true;this.group.add(mesh);this.marking(w,mesh);
}

sharedJunction(w,j,asphalt,walk,curb){
 const corners=junctionCorners(j),outline=corners.flatMap(c=>c.points),shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(p.x,-p.z))),geometry=new THREE.ShapeGeometry(shape,1);geometry.rotateX(-Math.PI/2);
 const positions=geometry.attributes.position,uv=geometry.attributes.uv;
 // The resolved bridge junction and its clipped approach ribbons form one
 // pavement. An overlap lift would turn their thin seam triangles into ridges.
 const surfaceOffset=this.gradePlan?.junctions.get(j)?.resolvedPlane?ASPHALT_HEIGHT:JUNCTION_HEIGHT;
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);positions.setY(i,this.height(w,x,z)+surfaceOffset);uv.setXY(i,x,z);}
 geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,asphalt);mesh.receiveShadow=true;this.group.add(mesh);this.surfaces ||= new RoadSurfaceIndex();this.surfaces.add(geometry,'asphalt');mesh.userData.roadSurface='asphalt';mesh.userData.roadJunction=true;
 for(let i=0;i<corners.length;i++){const c=corners[i];if(!c.sidewalk)continue;
  // Only the rendered sweep gets analytic endpoint tangents. Shared junction
  // paths and pedestrian graph samples remain exactly as authored.
  const source=streetStations(c.points),a=j.arms[i],b=j.arms[(i+1)%j.arms.length];
  for(const [p,tx,tz]of [[source[0],-a.tx,-a.tz],[source.at(-1),b.tx,b.tz]])Object.assign(p,{tx,tz,nx:-tz,nz:tx});
  const crossings=this.crossings||pedestrianCrossings(w,{junctions:[j],roads:[]}),stations=rampStations(source,crossings,.8),drop=p=>rampAmount(crossings,p);
  const width=arm=>(this.renderRoads?.get(arm.roadId)?.legacy||String(arm.roadId).startsWith('grid/'))?.42:.38,start=width(a),end=width(b),total=stations.at(-1).distance;
  this.surface(w,stations,p=>kerbProfile(0,start+(end-start)*p.distance/(total||1),drop(p),-1).slice(1),walk,'sidewalk');
  this.surface(w,stations,p=>kerbCap(0,drop(p),-1),curb,'kerb');
 }
 if(j.roundabout)roundaboutIsland(this,w,j);
 if(j.arms.length<3)return;
 for(const crossing of pedestrianCrossings(w,{junctions:[j],roads:[]}))this.paintCrossing(w,crossing);
}
paintCrossing(w,c){const arm=c.arm,at=(d,offset)=>({x:c.center.x+arm.tx*d-arm.tz*offset,z:c.center.z+arm.tz*d+arm.tx*offset}),span=arm.width-.25,stripes=Math.max(3,Math.floor(span/.28));
 for(let k=0;k<stripes;k++){const offset=-span/2+(k+.5)*span/stripes;this.paint(w,[at(-.3,offset),at(.3,offset)],.12,0,this.v.mat('#dedbd0'));}
 for(const direction of c.stop!==undefined?(arm.spec.oneway?[-1]:[-1,1]):[1]){if(arm.spec.oneway&&arm.sign>0)continue;const a=at(direction*.6,-direction*(arm.width/2-.15)),b=at(direction*.6,arm.spec.oneway?direction*(arm.width/2-.15):-direction*.05);if(c.junction?.roundabout){for(let k=0;k<4;k++){const u=k/4,v=(k+.55)/4;this.paint(w,[{x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u},{x:a.x+(b.x-a.x)*v,z:a.z+(b.z-a.z)*v}],.08,0,this.v.mat('#dedbd0'));}}else this.paint(w,[a,b],.065,0,this.v.mat('#dedbd0'));}

}

syncSignals(traffic){
 this.signalPolicies=traffic.world.junctionControls;this.signalDefault=traffic.world.trafficPolicy;
 const placements=signalPlacements(this.junctionPlan?.junctions||[],traffic.junctions.items).map(p=>({...p,policy:junctionPolicy(traffic.world,p.controller)}));
 const key=placements.map(p=>[p.x,p.z,p.tx,p.tz,p.controller,p.policy].join(':')).join(';');if(key===this.signalKey)return;
 this.signalKey=key;this.pedestrianSignals?.dispose();this.v.disposeGroup(this.signalGroup);this.signalEntries=[];this.signalBulbs?.material.dispose();this.signalBulbs?.dispose();this.signalBulbs=null;
 this.controlStats={signals:0,stops:0};if(!placements.length)return;
 const lights=placements.filter(p=>p.policy==='signals'),dummy=new THREE.Object3D();
 const bulbs=lights.length?new THREE.InstancedMesh(new THREE.CylinderGeometry(.025,.025,.006,12).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:'#ffffff'}),lights.length*3):null;let instance=0;
 for(const p of placements){const {x,z}=p,y=this.surfaceHeight(x,z)??this.height(this.world,x,z)+SIDEWALK_HEIGHT;
  if(p.policy==='roundabout'){addYieldSign(this.v,this.signalGroup,p,y);continue;}
  if(p.policy==='stop'){this.stopMaterial ||= stopSignMaterial();addStopSign(this.v,this.signalGroup,p,y,this.stopMaterial);this.controlStats.stops++;continue;}
  this.controlStats.signals++;signalPole(this.v,this.signalGroup,x,y,z,1.2);const head=signalHousing(this.v,this.signalGroup,x,y+1.1,z,.10,.27,.10,Math.atan2(p.tx,p.tz));const entry={axis:p.axis,controller:p.controller,indices:[]};
  for(let k=0;k<3;k++){const bezel=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,.025,12,1,true).rotateX(Math.PI/2),this.v.mat('#1b2522'));bezel.position.set(x+p.tx*.06,y+1.18-k*.08,z+p.tz*.06);bezel.rotation.y=head.rotation.y;this.signalGroup.add(bezel);dummy.position.set(x+p.tx*.054,y+1.18-k*.08,z+p.tz*.054);dummy.rotation.y=head.rotation.y;dummy.updateMatrix();bulbs.setMatrixAt(instance,dummy.matrix);bulbs.setColorAt(instance,new THREE.Color('#304139'));entry.indices.push(instance++);}this.signalEntries.push(entry);
 }
 this.pedestrianSignals=new PedestrianSignals(this.v,this.signalGroup,traffic.world,pedestrianCrossings(traffic.world,this.junctionPlan||{junctions:[],roads:[]}),(x,z)=>this.height(this.world,x,z),(x,z)=>this.surfaceHeight(x,z));batchStatic(this.signalGroup,this.v.unitBox);for(const mesh of this.pedestrianSignals.meshes)this.signalGroup.add(mesh);if(bulbs)this.signalGroup.add(bulbs);this.signalBulbs=bulbs;this.signalPhaseKey=null;this.updateSignals(traffic);
}

updateSignals(traffic){
 // Policy edits rebuild only the small signs group, even while paused. Road
 // geometry, vehicles and routing are retained; normal frames compare references.
 if(this.signalPolicies!==traffic.world.junctionControls||this.signalDefault!==traffic.world.trafficPolicy){this.syncSignals(traffic);return;}
 if(!this.signalBulbs)return;const key=signalPhase(traffic.time,'x')+':'+signalPhase(traffic.time,'z');if(key===this.signalPhaseKey)return;this.signalPhaseKey=key;
 const colors=['#ff4938','#ffc64d','#42f6a4'];for(const entry of this.signalEntries){const on=['red','amber','green'].indexOf(signalPhase(traffic.time,entry.axis));entry.indices.forEach((i,k)=>this.signalBulbs.setColorAt(i,new THREE.Color(k===on?colors[k]:'#22312c')));}this.signalBulbs.instanceColor.needsUpdate=true;this.pedestrianSignals?.update(traffic.world,traffic.time);
}

finalizeLamps(){return finishBuild(this.finalizeLampsSteps());}
*finalizeLampsSteps(){
 const pending=this.pendingLamps||[];this.pendingLamps=[];
 // Build one temporary spatial index of the final receiving triangles. A fan
 // joining bridge vertices to ground vertices would slice through the deck.
 const bins=new Map(),oversized=[],point=new THREE.Vector3();this.group.updateMatrixWorld(true);
 if(pending.length)this.group.traverse(mesh=>{
  if(!mesh.userData.earthworkCover&&!['asphalt','sidewalk'].includes(mesh.userData.roadSurface))return;
  const geometry=mesh.geometry,p=geometry.attributes.position,index=geometry.index,count=index?.count??p.count;
  const read=i=>{point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);return [point.x,point.y,point.z];};
  for(let i=0;i+2<count;i+=3){
   const vertices=[0,1,2].map(k=>read(index?index.getX(i+k):i+k)),[a,b,c]=vertices;
   if(Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))<1e-10)continue;
   const x0=Math.floor(Math.min(a[0],b[0],c[0])/4),x1=Math.floor(Math.max(a[0],b[0],c[0])/4),z0=Math.floor(Math.min(a[2],b[2],c[2])/4),z1=Math.floor(Math.max(a[2],b[2],c[2])/4);
   if((x1-x0+1)*(z1-z0+1)>4096){oversized.push(vertices);continue;}
   for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(vertices);}
  }
 });
 this.lampSurfaceIndex={bins,oversized};this.finishingLamps=true;
 try{for(const args of pending){yield;this.lamp(...args);}}finally{this.finishingLamps=false;this.lampSurfaceIndex=null;}
}
lamp(x,y,z,horizontal,inward){
 if(this.building&&!this.finishingLamps){(this.pendingLamps ||= []).push([x,y,z,horizontal,inward?{...inward}:undefined]);return;}
 y=this.surfaceHeight(x,z)??y;
 const direction=inward||{x:horizontal?0:-1,z:horizontal?-1:0},yaw=Math.atan2(-direction.z,direction.x),g=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.055,3,8),this.v.mat('#757d7c'));pole.position.set(x,y+1.5,z);g.add(pole);const arm=this.v.box(g,x+direction.x*.25,y+3,z+direction.z*.25,.6,.035,.045,'#7e8784');arm.rotation.y=yaw;const bulb=new THREE.Mesh(new THREE.BoxGeometry(.31,.035,.13),this.lampMaterial);bulb.position.set(x+direction.x*.55,y+2.98,z+direction.z*.55);bulb.rotation.y=yaw;g.add(bulb);pole.castShadow=true;this.group.add(g);this.lamps.push(bulb);
 if(this.world){
  const cx=x+direction.x*.9,cz=z+direction.z*.9,radius=2.4,positions=[],uv=[];
  if(this.lampSurfaceIndex){
   const {bins,oversized}=this.lampSurfaceIndex,candidates=new Set(oversized),border=Array.from({length:24},(_,i)=>[cx+Math.cos(i/24*Math.PI*2)*radius,cz+Math.sin(i/24*Math.PI*2)*radius]);
   for(let bx=Math.floor((cx-radius)/4);bx<=Math.floor((cx+radius)/4);bx++)for(let bz=Math.floor((cz-radius)/4);bz<=Math.floor((cz+radius)/4);bz++)for(const triangle of bins.get(bx+','+bz)||[])candidates.add(triangle);
   for(const triangle of candidates){
    // Cells include triangles beyond the pool. Reject their exact bounds before
    // clipping; all retained vertices still use the original interpolation.
    const [ta,tb,tc]=triangle;
    if(Math.max(ta[0],tb[0],tc[0])<cx-radius||Math.min(ta[0],tb[0],tc[0])>cx+radius||Math.max(ta[2],tb[2],tc[2])<cz-radius||Math.min(ta[2],tb[2],tc[2])>cz+radius)continue;
    let polygon=triangle;
    // Clip in plan view, interpolating Y on the source triangle. Every emitted
    // face stays on one actual pavement plane, including kerb bevels and crests.
    for(let edge=0;edge<border.length&&polygon.length>=3;edge++){
     const a=border[edge],b=border[(edge+1)%border.length],distance=p=>(b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
     let inside=0;for(const p of polygon)if(distance(p)>=0)inside++;
     if(inside===polygon.length)continue;
     if(inside===0){polygon=[];break;}
     const out=[];
     let previous=polygon.at(-1),dp=distance(previous);
     for(const current of polygon){const dc=distance(current);if((dp<0&&dc>=0)||(dp>=0&&dc<0)){const t=dp/(dp-dc);out.push(previous.map((value,k)=>value+(current[k]-value)*t));}if(dc>=0)out.push(current);previous=current;dp=dc;}
     polygon=out;
    }
    for(let i=1;i+1<polygon.length;i++){
     const a=polygon[0],b=polygon[i],c=polygon[i+1];if(Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))<1e-10)continue;
     for(const p of [a,b,c]){positions.push(p[0],p[1]+PAINT_CLEARANCE,p[2]);uv.push(.5+(p[0]-cx)/(2*radius),.5-(p[2]-cz)/(2*radius));}
    }
   }
  }
  let geometry;
  if(positions.length){geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.userData.projectedRoadPool=true;}
  else{
   // Unindexed standalone lamps retain the released projection. Never join a
   // bridge's height to far-below terrain in a single translucent triangle.
   geometry=new THREE.CircleGeometry(radius,24);geometry.rotateX(-Math.PI/2);const pos=geometry.attributes.position;
   for(let i=0;i<pos.count;i++){const xx=cx+pos.getX(i),zz=cz+pos.getZ(i);pos.setXYZ(i,xx,this.height(this.world,xx,zz)+.24,zz);}
  }
  geometry.computeVertexNormals();const pool=new THREE.Mesh(geometry,this.lightPoolMaterial);this.group.add(pool);
 }
}
night(on){this.lampMaterial.emissiveIntensity=on?3:0;for(const mesh of this.group.children)if(mesh.material===this.lightPoolMaterial)mesh.visible=on;}
}

function roadProtectedParcels(world){
 const result=[],parcels=visualParcels(world),polygon=f=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>{u*=f.width/2;v*=f.depth/2;const c=Math.cos(f.angle||0),s=Math.sin(f.angle||0);return {x:f.cx+u*c+v*s,z:f.cz-u*s+v*c};});
 for(let i=0;i<world.tiles.length;i++){
  const tile=world.tiles[i];if((!tile.type||tile.type==='road'||tile.type==='path')&&!tile.construction)continue;
  if(tile.facilityOwner!==undefined&&tile.facilityOwner!==i||tile.zoneOwner!==undefined&&tile.zoneOwner!==i)continue;
  const parcel=parcels.get(i);if(parcel&&parcel.owner!==i)continue;
  const width=parcel?.width||1,depth=parcel?.depth||1,frame=parcel?.oriented||{cx:(i%G.n+.5)*4-G.half+(width-1)*2,cz:(Math.floor(i/G.n)+.5)*4-G.half+(depth-1)*2,width:width*4,depth:depth*4,angle:0};
  result.push({id:String(i),polygon:polygon(frame)});
 }
 for(const [id,parcel]of Object.entries(world.development?.parcels||{}))if(parcel.occupant)result.push({id,polygon:polygon(parcel.frame)});
 return result;
}

roadProtectedParcels=G.bind(roadProtectedParcels);
Roadworks=G.bindClass(Roadworks);
