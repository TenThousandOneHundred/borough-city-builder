import {PedestrianSignals,signalHousing,signalPole} from './pedestrian-signals.js?v=124';
import {pedestrianCrossings,rampStations,rampAmount} from './pedestrian-network.js?v=124';
import {roundaboutIsland,addYieldSign} from './roundabout-details.js?v=124';
import {planBridges,bridgeHeight} from './bridge-spans.js?v=124';
import {bridgeGeometry} from './bridge-geometry.js?v=124';
import {approachMarkings,arrowPolygons} from './road-markings.js?v=124';
import {roadFinishData,configureRoadFinish} from './road-finish.js?v=124';
import {laneLayout} from './road-lanes.js?v=124';
import {roadGeometry,transitionWidth,junctionCorners,junctionCuts,clearRanges,clearSections,signalPlacements} from './road-junction-plan.js?v=124';
import {lotAccess} from './lot-access.js?v=124';
import {streetStations,atDistance,distanceSection,streetSurface,pavementMaterial} from './street-geometry.js?v=124';
import {signalPhase,junctionPolicy} from './junctions.js?v=124';
import {addStopSign,stopSignMaterial} from './stop-sign.js?v=124';
import {outsidePortals} from './traffic.js?v=124';
import {batchStatic} from './static-batch.js?v=124';
import * as THREE from './vendor/three.module.js';
import {floorHeight,groundHeight,wetness} from './landscape.js?v=124';
export class Roadworks{
constructor(v){this.v=v;this.group=new THREE.Group();v.scene.add(this.group);this.lamps=[];this.lampMaterial=new THREE.MeshStandardMaterial({color:'#e5e2ca',emissive:'#ffe2a0',emissiveIntensity:v.night?3:0,roughness:.3});this.walkMaterial=pavementMaterial();this.lightPoolMaterial=new THREE.MeshBasicMaterial({color:'#ffe0a0',transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending});this.lightPoolMaterial.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 poolUV;').replace('#include <uv_vertex>','#include <uv_vertex>\npoolUV=uv;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 poolUV;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=pow(max(0.,1.-length(poolUV*2.-1.)),1.8);');};this.lightPoolMaterial.customProgramCacheKey=()=> 'street-light-pool-v1';this.signalGroup=new THREE.Group();v.scene.add(this.signalGroup);}
clear(){this.group.traverse(o=>{if(o.geometry&&o.geometry!==this.v.unitBox)o.geometry.dispose()});this.group.clear();this.lamps=[];this.signalKey=null;this.bridgePlan=null;this.bridgeStats=null;}
baseHeight(w,x,z){return Math.max(.32,floorHeight(w,x,z))+.1+wetness(w,x,z)*1.2}
height(w,x,z){return (this.world===w?bridgeHeight(this.bridgePlan,x,z):null)??this.baseHeight(w,x,z)}
surface(w,points,profile,material){const stations=points[0]?.nx!==undefined?points:streetStations(points);if(stations.length<2)return null;const mesh=new THREE.Mesh(streetSurface(stations,profile,(x,z)=>this.height(w,x,z)),material);mesh.receiveShadow=true;this.group.add(mesh);return mesh;}
ribbon(w,points,width,offset,material,raise=.08,spec=null){const stations=points[0]?.nx!==undefined?points:streetStations(points);const mesh=this.surface(w,stations,p=>{const w=typeof width==='function'?width(p):width,o=typeof offset==='function'?offset(p):offset;return [[o-w*.5,raise],[o+w*.5,raise]];},material);if(mesh&&spec&&material.userData.roadFinish)roadFinishData(mesh.geometry,stations,width,spec);return mesh;}
curbs(w,points,width,walk,curb,base=.08,sidewalk=.42){
 const stations=rampStations(points,this.crossings||[],width);
 for(const side of [-1,1]){const drop=p=>{const edge=(typeof width==='function'?width(p):width)*.5;return rampAmount(this.crossings||[],{x:p.x+p.nx*edge*side,z:p.z+p.nz*edge*side});};
  const profile=p=>{const edge=(typeof width==='function'?width(p):width)*.5,r=drop(p),entries=[[edge,base],[edge+.045,base+.045-.037*r],[edge+.11,base+.06-.048*r],[edge+sidewalk,base+.06],[edge+sidewalk,base-.015]].map(([x,y])=>[x*side,y]);if(side<0)entries.reverse();return entries;};
  this.surface(w,stations,profile,walk);this.surface(w,stations,p=>{const edge=(typeof width==='function'?width(p):width)/2+.075,h=base+.062-.043*drop(p);return [[side*edge-.0275,h],[side*edge+.0275,h]];},curb);
 }
}

dash(w,stations,offset,color,period=1.6,length=.8,raise=.105,cuts=[]){for(let d=.25;d<stations.at(-1).distance;d+=period)for(const [a,b]of clearRanges(d,Math.min(d+length,stations.at(-1).distance),cuts)){const segment=distanceSection(stations,a,b);this.ribbon(w,segment,.028,offset,this.v.mat(color),raise);}}
sections(points,padding=0){const stations=streetStations(points),cuts=junctionCuts(stations,this.junctionPlan?.junctions||[],padding);return clearSections(stations,cuts);}
markingCuts(stations,padding){const cuts=[...junctionCuts(stations,this.junctionPlan?.junctions||[],padding),...junctionCuts(stations,(this.crossings||[]).filter(c=>c.stop!==undefined).map(c=>({...c.center,radius:.65})))].sort((a,b)=>a[0]-b[0]),merged=[];for(const c of cuts){const last=merged.at(-1);if(last&&c[0]<=last[1])last[1]=Math.max(last[1],c[1]);else merged.push(c);}return merged;}

nearJunction(x,z,padding=0){return this.junctionPlan?.junctions.some(j=>Math.hypot(x-j.x,z-j.z)<j.radius+padding);}


line(w,points,width=.025,color='#e2ded0',offset=0){return this.ribbon(w,points,width,offset,this.v.mat(color),.105)}
build(w){this.clear();this.world=w;this.heightRevision=(this.heightRevision||0)+1;this.junctionPlan=roadGeometry(w,CityEngine);this.crossings=pedestrianCrossings(w,this.junctionPlan);this.crossingKey=(w.transit?.lines||[]).map(l=>l.id+':'+l.stops.join(',')).join(';');this.roadDescriptors=this.junctionPlan.roads;this.renderRoads=new Map(this.roadDescriptors.map(r=>[r.id,r]));this.bridgePlan=planBridges(this.roadDescriptors.map(r=>({...r,widthAt:p=>transitionWidth(r,this.junctionPlan.tapers.get(r.id)||[],p.distance)})),(x,z)=>{const gx=Math.floor((x+96)/4),gy=Math.floor((z+96)/4);return wetness(w,x,z)>.08||(gx>=0&&gy>=0&&gx<48&&gy<48&&w.tiles[gy*48+gx].ground==='water');},(x,z)=>this.baseHeight(w,x,z));const source=this.v.landscape.assets?.['asphalt-color'];if(!this.asphalt||this.asphaltSource!==source){if(this.asphalt){for(const key of ['map','normalMap','roughnessMap'])this.asphalt[key]?.dispose();this.asphalt.dispose();}this.asphalt=configureRoadFinish(this.v.landscape.material('asphalt',1.5,'#b4b9b6'));this.asphaltSource=source;}const asphalt=this.asphalt,walk=this.walkMaterial,curb=this.v.mat('#bec0b5');const roads=w.tiles.map((t,i)=>t.type==='road'?i:-1).filter(i=>i>=0);
for(let i of roads){if(w.tiles[i].pathIds?.length&&!w.tiles[i].legacyRoad)continue;const x=(i%48+.5)*4-96,z=(Math.floor(i/48)+.5)*4-96,t=w.tiles[i],near=CityEngine.neighbors(i).filter(n=>w.tiles[n].type==='road'),dirs=near.map(n=>({x:(n%48-i%48),z:(Math.floor(n/48)-Math.floor(i/48))})),wide=t.roadWidth===2,width=wide?3.15:2.45;let points=[];
if(dirs.length===2&&dirs[0].x*dirs[1].x+dirs[0].z*dirs[1].z===0){const a=new THREE.Vector3(x+dirs[0].x*2,0,z+dirs[0].z*2),b=new THREE.Vector3(x+dirs[1].x*2,0,z+dirs[1].z*2);for(let s=0;s<=12;s++){const f=s/12,q=1-f;points.push({x:q*q*a.x+2*q*f*x+f*f*b.x,z:q*q*a.z+2*q*f*z+f*f*b.z})}}
else if(dirs.length<=2){let d=dirs.find(p=>p.x!==0)||dirs[0]||{x:1,z:0};const horizontal=d.x!==0;for(let j=0;j<=4;j++)points.push({x:x+(horizontal?j-2:0),z:z+(horizontal?0:j-2)})}
if(points.length){this.ribbon(w,points,width,0,asphalt,.08,{width,lanes:wide?4:2,oneway:!!CityEngine.ROADS[t.roadType]?.oneway});for(const section of this.sections(points))this.curbs(w,section,width,walk,curb);const stations=streetStations(points),cuts=this.markingCuts(stations,1.2);for(const lane of laneLayout({width,lanes:wide?4:2,oneway:!!CityEngine.ROADS[t.roadType]?.oneway}).dividers)this.dash(w,stations,lane.offset,lane.center?'#d4cba8':'#dfded3',1.6,.8,.105,cuts);}
else{for(const d of dirs)this.ribbon(w,[{x,z},{x:x+d.x*2,z:z+d.z*2}],width,0,asphalt,.08);}



if(i%5===0&&t.ground!=='water'&&!this.nearJunction(x,z,1.5)){let horizontal=dirs.some(d=>d.x),lx=x+(horizontal?0:1.8),lz=z+(horizontal?1.8:0),y=this.height(w,lx,lz);this.lamp(lx,y,lz,horizontal)}
}
for(const path of w.roadPaths||[])this.path(w,path,asphalt,walk,curb);
for(const junction of this.junctionPlan.junctions)this.sharedJunction(w,junction,junction.arms.every(a=>a.spec===CityEngine.ROADS.gravel)?this.v.mat('#928875'):asphalt,walk,curb);
for(const crossing of this.crossings)if(crossing.stop!==undefined)this.paintCrossing(w,crossing);this.buildBridges(w);this.buildApproachMarkings(w);for(const portal of outsidePortals(w))this.outside(w,portal,asphalt);this.batchStats=batchStatic(this.group,this.v.unitBox);this.night(this.v.night);}
buildBridges(w){
 const {geometries,piers}=bridgeGeometry(this.bridgePlan,(x,z)=>this.height(w,x,z),(x,z)=>groundHeight(w,x,z),this.junctionPlan.junctions);let triangles=0;
 for(const [name,geometry]of Object.entries(geometries)){const material=this.v.mat(name==='metal'?'#7e8784':'#969c96'),mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;this.group.add(mesh);triangles+=geometry.attributes.position.count/3;}
 this.bridgeStats={spans:this.bridgePlan.spans.length,piers,triangles};
}
buildAccess(world,buildings){
 if(!this.accessGroup){this.accessGroup=new THREE.Group();this.v.scene.add(this.accessGroup);}
 this.accessGroup.traverse(o=>o.geometry?.dispose());this.accessGroup.clear();
 for(const root of buildings.values()){
  const plan=root.userData.plan;if(!plan||!root.userData.asset)continue;
  const geometry=lotAccess(world,plan,root.position.y,CityEngine,floorHeight,(w,x,z)=>this.height(w,x,z));if(!geometry)continue;
  const mesh=new THREE.Mesh(geometry,this.walkMaterial);mesh.receiveShadow=true;this.accessGroup.add(mesh);
 }
 this.accessStats=batchStatic(this.accessGroup,this.v.unitBox);
}
outside(w,p,asphalt){const points=[];for(let d=0;d<=280;d+=4)points.push({x:p.x+p.dx*d,z:p.z+p.dz*d});const tile=w.tiles[p.id],source=CityEngine.ROADS[tile.roadType]||CityEngine.ROADS.street,spec=tile.pathIds?.length?source:{...source,width:tile.roadWidth===2?3.15:2.45,lanes:tile.roadWidth===2?4:2,median:false},stations=streetStations(points);this.ribbon(w,points,spec.width,0,asphalt,.08,spec);for(const lane of laneLayout(spec).dividers)this.dash(w,stations,lane.offset,lane.center?'#e4d9a2':'#e3e2d6',2.4,1.25,.105);if(spec.median)this.surface(w,points,[[-.16,.09],[-.13,.16],[.13,.16],[.16,.09]],this.v.mat('#bec0b5'));for(const side of [-1,1])this.line(w,points,.045,'#e3e2d6',side*(spec.width/2-.12));
 const x=p.x+p.dx*8+p.dz*2.8,z=p.z+p.dz*8-p.dx*2.8,y=this.height(w,x,z);this.v.box(this.group,x,y+2,z,.08,4,.08,'#747d79');
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#164f43';c.fillRect(0,0,512,128);c.strokeStyle='#ffffff';c.lineWidth=6;c.strokeRect(5,5,502,118);c.fillStyle='#ffffff';c.font='bold 34px sans-serif';c.textAlign='center';c.fillText('OUTSIDE CONNECTION',256,54);c.font='27px sans-serif';c.fillText('Regional highway  ↔',256,97);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(5,1.25),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));sign.position.set(x,y+4,z);sign.rotation.y=p.dx?Math.PI/2:0;this.group.add(sign);}
path(w,path,asphalt,walk,curb){const spec=CityEngine.ROADS[path.type],planned=this.renderRoads?.get(path.id),points=planned?.stations||CityEngine.sampleRoad(path.controls).map(p=>({x:(p.x+.5)*4-96,z:(p.y+.5)*4-96})),stations=planned?.stations||streetStations(points),width=spec.width;
if(stations.length<2)return;
const tapers=this.junctionPlan?.tapers?.get(path.id),widthAt=p=>tapers?transitionWidth(planned,tapers,p.distance):width;
const sections=clearSections(stations,junctionCuts(stations,this.junctionPlan?.junctions||[])),cuts=this.markingCuts(stations,1.2);
if(!spec.sidewalk)this.ribbon(w,points,p=>widthAt(p)+.35,0,this.v.mat('#a39f8b'),.04);
this.ribbon(w,points,widthAt,0,path.type==='gravel'?this.v.mat('#928875'):asphalt,.08,spec);
for(const section of sections){if(spec.sidewalk)this.curbs(w,section,widthAt,walk,curb,.08,.38);else if(path.type!=='gravel')for(const side of [-1,1])this.ribbon(w,section,.04,p=>side*(widthAt(p)/2-.12),this.v.mat('#e0dfd0'),.105);}
if(spec.median)for(const section of clearSections(stations,this.markingCuts(stations,1.1)))this.surface(w,section,p=>{let scale=1;for(const t of tapers||[])if(!t.median)scale=Math.min(scale,Math.max(0,(t.end?stations.at(-1).distance-p.distance:p.distance)/2));return [[-.16*scale,.09],[-.13*scale,.09+.07*scale],[.13*scale,.09+.07*scale],[.16*scale,.09]];},curb);
const laneCuts=[...cuts,...(tapers||[]).map(t=>t.end?[stations.at(-1).distance-t.length,stations.at(-1).distance]:[0,t.length])];
if(path.type!=='gravel')for(const lane of laneLayout(spec).dividers)this.dash(w,stations,lane.offset,lane.center?'#d4cba8':'#e0ded2',2.4,1.25,.105,laneCuts);
for(let distance=3;distance<stations.at(-1).distance-1;distance+=12){const p=atDistance(stations,distance),dx=p.tx,dz=p.tz;if(this.nearJunction(p.x,p.z,1.5))continue;
 if(spec.sidewalk)this.lamp(p.x-dz*(widthAt(p)/2+.25),this.height(w,p.x,p.z),p.z+dx*(widthAt(p)/2+.25),Math.abs(dx)>Math.abs(dz),{x:dz,z:-dx});
 if(spec.oneway)for(const side of [-1,1])this.ribbon(w,[{x:p.x-dx*.4-dz*side*.22,z:p.z-dz*.4+dx*side*.22},p],.07,0,this.v.mat('#dedbc9'),.105);
 if(spec.green){this.treeWell(w,p,width);}
}
}
treeWell(w,p,width){const x=p.x+p.tz*(width/2+.25),z=p.z-p.tx*(width/2+.25),y=this.height(w,x,z);this.v.box(this.group,x,y+.16,z,.4,.04,.4,'#595d51');
 // Trees use the landscape vegetation batches and retain their full nearby models.
}


buildApproachMarkings(w){
 const positions=[];
 for(const arrow of approachMarkings(this.roadDescriptors,this.junctionPlan.junctions))for(const polygon of arrowPolygons(arrow.turns)){
  const vertices=polygon.map(([x,z])=>{x*=arrow.width/.8;return{x:arrow.center.x-arrow.tz*x+arrow.tx*z,z:arrow.center.z+arrow.tx*x+arrow.tz*z};});
  for(let i=1;i<vertices.length-1;i++){
   const triangle=[vertices[0],vertices[i],vertices[i+1]],a=triangle[0],b=triangle[1],c=triangle[2];if((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)>0)triangle.reverse();
   for(const p of triangle)positions.push(p.x,this.height(w,p.x,p.z)+.107,p.z);
  }
 }
 if(!positions.length)return;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,this.v.mat('#dedbd0'));mesh.receiveShadow=true;this.group.add(mesh);
}

sharedJunction(w,j,asphalt,walk,curb){
 const corners=junctionCorners(j),outline=corners.flatMap(c=>c.points),shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(p.x,-p.z))),geometry=new THREE.ShapeGeometry(shape,1);geometry.rotateX(-Math.PI/2);
 const positions=geometry.attributes.position,uv=geometry.attributes.uv;
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);positions.setY(i,this.height(w,x,z)+.082);uv.setXY(i,x,z);}
 geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,asphalt);mesh.receiveShadow=true;this.group.add(mesh);
 for(const c of corners)if(c.sidewalk){const stations=rampStations(c.points,this.crossings||pedestrianCrossings(w,{junctions:[j],roads:[]}),.8),drop=p=>rampAmount(this.crossings||pedestrianCrossings(w,{junctions:[j],roads:[]}),p);this.surface(w,stations,p=>[[-.38,.14],[-.11,.14-.048*drop(p)],[-.045,.125-.037*drop(p)],[0,.08]],walk);this.surface(w,stations,p=>[[-.1025,.142-.043*drop(p)],[-.0475,.142-.043*drop(p)]],curb);}
 if(j.roundabout)roundaboutIsland(this,w,j);
 if(j.arms.length<3)return;
 for(const crossing of pedestrianCrossings(w,{junctions:[j],roads:[]}))this.paintCrossing(w,crossing);
}
paintCrossing(w,c){const arm=c.arm,at=(d,offset)=>({x:c.center.x+arm.tx*d-arm.tz*offset,z:c.center.z+arm.tz*d+arm.tx*offset}),span=arm.width-.25,stripes=Math.max(3,Math.floor(span/.28));
 for(let k=0;k<stripes;k++){const offset=-span/2+(k+.5)*span/stripes;this.ribbon(w,[at(-.3,offset),at(.3,offset)],.12,0,this.v.mat('#dedbd0'),.106);}
 for(const direction of c.stop!==undefined?(arm.spec.oneway?[-1]:[-1,1]):[1]){if(arm.spec.oneway&&arm.sign>0)continue;const a=at(direction*.6,-direction*(arm.width/2-.15)),b=at(direction*.6,arm.spec.oneway?direction*(arm.width/2-.15):-direction*.05);if(c.junction?.roundabout){for(let k=0;k<4;k++){const u=k/4,v=(k+.55)/4;this.ribbon(w,[{x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u},{x:a.x+(b.x-a.x)*v,z:a.z+(b.z-a.z)*v}],.08,0,this.v.mat('#dedbd0'),.106);}}else this.ribbon(w,[a,b],.065,0,this.v.mat('#dedbd0'),.106);}

}

syncSignals(traffic){
 this.signalPolicies=traffic.world.junctionControls;this.signalDefault=traffic.world.trafficPolicy;
 const placements=signalPlacements(this.junctionPlan?.junctions||[],traffic.junctions.items).map(p=>({...p,policy:junctionPolicy(traffic.world,p.controller)}));
 const key=placements.map(p=>[p.x,p.z,p.tx,p.tz,p.controller,p.policy].join(':')).join(';');if(key===this.signalKey)return;
 this.signalKey=key;this.pedestrianSignals?.dispose();this.v.disposeGroup(this.signalGroup);this.signalEntries=[];this.signalBulbs?.material.dispose();this.signalBulbs?.dispose();this.signalBulbs=null;
 this.controlStats={signals:0,stops:0};if(!placements.length)return;
 const lights=placements.filter(p=>p.policy==='signals'),dummy=new THREE.Object3D();
 const bulbs=lights.length?new THREE.InstancedMesh(new THREE.CylinderGeometry(.025,.025,.006,12).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:'#ffffff'}),lights.length*3):null;let instance=0;
 for(const p of placements){const {x,z}=p,y=this.height(this.world,x,z)+.14;
  if(p.policy==='roundabout'){addYieldSign(this.v,this.signalGroup,p,y);continue;}
  if(p.policy==='stop'){this.stopMaterial ||= stopSignMaterial();addStopSign(this.v,this.signalGroup,p,y,this.stopMaterial);this.controlStats.stops++;continue;}
  this.controlStats.signals++;signalPole(this.v,this.signalGroup,x,y,z,1.2);const head=signalHousing(this.v,this.signalGroup,x,y+1.1,z,.10,.27,.10,Math.atan2(p.tx,p.tz));const entry={axis:p.axis,controller:p.controller,indices:[]};
  for(let k=0;k<3;k++){const bezel=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,.025,12,1,true).rotateX(Math.PI/2),this.v.mat('#1b2522'));bezel.position.set(x+p.tx*.06,y+1.18-k*.08,z+p.tz*.06);bezel.rotation.y=head.rotation.y;this.signalGroup.add(bezel);dummy.position.set(x+p.tx*.054,y+1.18-k*.08,z+p.tz*.054);dummy.rotation.y=head.rotation.y;dummy.updateMatrix();bulbs.setMatrixAt(instance,dummy.matrix);bulbs.setColorAt(instance,new THREE.Color('#304139'));entry.indices.push(instance++);}this.signalEntries.push(entry);
 }
 this.pedestrianSignals=new PedestrianSignals(this.v,this.signalGroup,traffic.world,pedestrianCrossings(traffic.world,this.junctionPlan||{junctions:[],roads:[]}),(x,z)=>this.height(this.world,x,z));batchStatic(this.signalGroup,this.v.unitBox);for(const mesh of this.pedestrianSignals.meshes)this.signalGroup.add(mesh);if(bulbs)this.signalGroup.add(bulbs);this.signalBulbs=bulbs;this.signalPhaseKey=null;this.updateSignals(traffic);
}

updateSignals(traffic){
 // Policy edits rebuild only the small signs group, even while paused. Road
 // geometry, vehicles and routing are retained; normal frames compare references.
 if(this.signalPolicies!==traffic.world.junctionControls||this.signalDefault!==traffic.world.trafficPolicy){this.syncSignals(traffic);return;}
 if(!this.signalBulbs)return;const key=signalPhase(traffic.time,'x')+':'+signalPhase(traffic.time,'z');if(key===this.signalPhaseKey)return;this.signalPhaseKey=key;
 const colors=['#ff4938','#ffc64d','#42f6a4'];for(const entry of this.signalEntries){const on=['red','amber','green'].indexOf(signalPhase(traffic.time,entry.axis));entry.indices.forEach((i,k)=>this.signalBulbs.setColorAt(i,new THREE.Color(k===on?colors[k]:'#22312c')));}this.signalBulbs.instanceColor.needsUpdate=true;this.pedestrianSignals?.update(traffic.world,traffic.time);
}

lamp(x,y,z,horizontal,inward){const direction=inward||{x:horizontal?0:-1,z:horizontal?-1:0},yaw=Math.atan2(-direction.z,direction.x),g=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.055,3,8),this.v.mat('#757d7c'));pole.position.set(x,y+1.5,z);g.add(pole);const arm=this.v.box(g,x+direction.x*.25,y+3,z+direction.z*.25,.6,.035,.045,'#7e8784');arm.rotation.y=yaw;const bulb=new THREE.Mesh(new THREE.BoxGeometry(.31,.035,.13),this.lampMaterial);bulb.position.set(x+direction.x*.55,y+2.98,z+direction.z*.55);bulb.rotation.y=yaw;g.add(bulb);pole.castShadow=true;this.group.add(g);this.lamps.push(bulb);if(this.world){const cx=x+direction.x*.9,cz=z+direction.z*.9,geometry=new THREE.CircleGeometry(2.4,24);geometry.rotateX(-Math.PI/2);const pos=geometry.attributes.position;for(let i=0;i<pos.count;i++){const xx=cx+pos.getX(i),zz=cz+pos.getZ(i);pos.setXYZ(i,xx,this.height(this.world,xx,zz)+.24,zz);}geometry.computeVertexNormals();const pool=new THREE.Mesh(geometry,this.lightPoolMaterial);this.group.add(pool);}}
night(on){this.lampMaterial.emissiveIntensity=on?3:0;for(const mesh of this.group.children)if(mesh.material===this.lightPoolMaterial)mesh.visible=on;}
}
