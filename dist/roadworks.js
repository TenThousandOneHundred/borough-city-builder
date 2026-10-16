import {roadFinishData,configureRoadFinish} from './road-finish.js?v=73';
import {laneLayout} from './road-lanes.js?v=73';
import {roadGeometry,transitionWidth,junctionCorners,junctionCuts,clearRanges,clearSections,signalPlacements} from './road-junction-plan.js?v=73';
import {lotAccess} from './lot-access.js?v=73';
import {streetStations,atDistance,distanceSection,streetSurface,pavementMaterial} from './street-geometry.js?v=73';
import {signalPhase} from './junctions.js?v=73';
import {outsidePortals} from './traffic.js?v=73';
import {batchStatic} from './static-batch.js?v=73';
import * as THREE from './vendor/three.module.js';
import {floorHeight,groundHeight,wetness} from './landscape.js?v=73';
export class Roadworks{
constructor(v){this.v=v;this.group=new THREE.Group();v.scene.add(this.group);this.lamps=[];this.lampMaterial=new THREE.MeshStandardMaterial({color:'#e5e2ca',emissive:'#ffe2a0',emissiveIntensity:v.night?3:0,roughness:.3});this.walkMaterial=pavementMaterial();this.lightPoolMaterial=new THREE.MeshBasicMaterial({color:'#ffe0a0',transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending});this.lightPoolMaterial.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 poolUV;').replace('#include <uv_vertex>','#include <uv_vertex>\npoolUV=uv;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 poolUV;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=pow(max(0.,1.-length(poolUV*2.-1.)),1.8);');};this.lightPoolMaterial.customProgramCacheKey=()=> 'street-light-pool-v1';this.signalGroup=new THREE.Group();v.scene.add(this.signalGroup);}
clear(){this.group.traverse(o=>{if(o.geometry&&o.geometry!==this.v.unitBox)o.geometry.dispose()});this.group.clear();this.lamps=[];this.signalKey=null;}
height(w,x,z){return Math.max(.32,floorHeight(w,x,z))+.1+wetness(w,x,z)*1.2}
surface(w,points,profile,material){const stations=points[0]?.nx!==undefined?points:streetStations(points);if(stations.length<2)return null;const mesh=new THREE.Mesh(streetSurface(stations,profile,(x,z)=>this.height(w,x,z)),material);mesh.receiveShadow=true;this.group.add(mesh);return mesh;}
ribbon(w,points,width,offset,material,raise=.08,spec=null){const stations=points[0]?.nx!==undefined?points:streetStations(points);const mesh=this.surface(w,stations,p=>{const w=typeof width==='function'?width(p):width,o=typeof offset==='function'?offset(p):offset;return [[o-w*.5,raise],[o+w*.5,raise]];},material);if(mesh&&spec&&material.userData.roadFinish)roadFinishData(mesh.geometry,stations,width,spec);return mesh;}
curbs(w,points,width,walk,curb,base=.08,sidewalk=.42){
 for(const side of [-1,1]){const profile=p=>{const edge=(typeof width==='function'?width(p):width)*.5;const entries=[[edge,base],[edge+.045,base+.045],[edge+.11,base+.06],[edge+sidewalk,base+.06],[edge+sidewalk,base-.015]].map(([x,y])=>[x*side,y]);if(side<0)entries.reverse();return entries;};
  this.surface(w,points,profile,walk);this.ribbon(w,points,.055,p=>side*((typeof width==='function'?width(p):width)/2+.075),curb,base+.062);
 }
}
dash(w,stations,offset,color,period=1.6,length=.8,raise=.105,cuts=[]){for(let d=.25;d<stations.at(-1).distance;d+=period)for(const [a,b]of clearRanges(d,Math.min(d+length,stations.at(-1).distance),cuts)){const segment=distanceSection(stations,a,b);this.ribbon(w,segment,.028,offset,this.v.mat(color),raise);}}
sections(points,padding=0){const stations=streetStations(points),cuts=junctionCuts(stations,this.junctionPlan?.junctions||[],padding);return clearSections(stations,cuts);}
nearJunction(x,z,padding=0){return this.junctionPlan?.junctions.some(j=>Math.hypot(x-j.x,z-j.z)<j.radius+padding);}


line(w,points,width=.025,color='#e2ded0',offset=0){return this.ribbon(w,points,width,offset,this.v.mat(color),.105)}
build(w){this.clear();this.world=w;this.junctionPlan=roadGeometry(w,CityEngine);this.roadDescriptors=this.junctionPlan.roads;this.renderRoads=new Map(this.roadDescriptors.map(r=>[r.id,r]));const source=this.v.landscape.assets?.['asphalt-color'];if(!this.asphalt||this.asphaltSource!==source){if(this.asphalt){for(const key of ['map','normalMap','roughnessMap'])this.asphalt[key]?.dispose();this.asphalt.dispose();}this.asphalt=configureRoadFinish(this.v.landscape.material('asphalt',1.5,'#b4b9b6'));this.asphaltSource=source;}const asphalt=this.asphalt,walk=this.walkMaterial,curb=this.v.mat('#bec0b5');const roads=w.tiles.map((t,i)=>t.type==='road'?i:-1).filter(i=>i>=0);
for(let i of roads){if(w.tiles[i].pathIds?.length&&!w.tiles[i].legacyRoad)continue;const x=(i%48+.5)*4-96,z=(Math.floor(i/48)+.5)*4-96,t=w.tiles[i],near=CityEngine.neighbors(i).filter(n=>w.tiles[n].type==='road'),dirs=near.map(n=>({x:(n%48-i%48),z:(Math.floor(n/48)-Math.floor(i/48))})),wide=t.roadWidth===2,width=wide?3.15:2.45;let points=[];
if(dirs.length===2&&dirs[0].x*dirs[1].x+dirs[0].z*dirs[1].z===0){const a=new THREE.Vector3(x+dirs[0].x*2,0,z+dirs[0].z*2),b=new THREE.Vector3(x+dirs[1].x*2,0,z+dirs[1].z*2);for(let s=0;s<=12;s++){const f=s/12,q=1-f;points.push({x:q*q*a.x+2*q*f*x+f*f*b.x,z:q*q*a.z+2*q*f*z+f*f*b.z})}}
else if(dirs.length<=2){let d=dirs.find(p=>p.x!==0)||dirs[0]||{x:1,z:0};const horizontal=d.x!==0;for(let j=0;j<=4;j++)points.push({x:x+(horizontal?j-2:0),z:z+(horizontal?0:j-2)})}
if(points.length){this.ribbon(w,points,width,0,asphalt,.08,{width,lanes:wide?4:2,oneway:!!CityEngine.ROADS[t.roadType]?.oneway});for(const section of this.sections(points))this.curbs(w,section,width,walk,curb);const stations=streetStations(points),cuts=junctionCuts(stations,this.junctionPlan.junctions,1.2);for(const lane of laneLayout({width,lanes:wide?4:2,oneway:!!CityEngine.ROADS[t.roadType]?.oneway}).dividers)this.dash(w,stations,lane.offset,lane.center?'#d4cba8':'#dfded3',1.6,.8,.105,cuts);}
else{for(const d of dirs)this.ribbon(w,[{x,z},{x:x+d.x*2,z:z+d.z*2}],width,0,asphalt,.08);}

if(t.ground==='water'){const y=this.height(w,x,z);this.v.box(this.group,x,y-.2,z,4,.55,wide?3.6:3.1,'#8b9491');let vertical=dirs.some(d=>d.z)&&!dirs.some(d=>d.x);for(let side of [-1,1]){this.v.box(this.group,x+(vertical?side*1.7:0),y+.45,z+(vertical?0:side*1.7),vertical?.06:4,.08,vertical?4:.06,'#a3a8a2');for(let a of [-1.5,0,1.5])this.v.box(this.group,x+(vertical?side*1.7:a),y+.22,z+(vertical?a:side*1.7),.05,.5,.05,'#a3a8a2')}if(i%2===0){this.v.box(this.group,x,y/2-1,z,.55,y+2,.65,'#9a9a8f')}}

if(i%5===0&&t.ground!=='water'&&!this.nearJunction(x,z,1.5)){let horizontal=dirs.some(d=>d.x),lx=x+(horizontal?0:1.8),lz=z+(horizontal?1.8:0),y=this.height(w,lx,lz);this.lamp(lx,y,lz,horizontal)}
}
for(const path of w.roadPaths||[])this.path(w,path,asphalt,walk,curb);
for(const junction of this.junctionPlan.junctions)this.sharedJunction(w,junction,junction.arms.every(a=>a.spec===CityEngine.ROADS.gravel)?this.v.mat('#928875'):asphalt,walk,curb);
for(const portal of outsidePortals(w))this.outside(w,portal,asphalt);this.batchStats=batchStatic(this.group,this.v.unitBox);this.night(this.v.night);}
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
const sections=clearSections(stations,junctionCuts(stations,this.junctionPlan?.junctions||[])),cuts=junctionCuts(stations,this.junctionPlan?.junctions||[],1.2);
if(!spec.sidewalk)this.ribbon(w,points,p=>widthAt(p)+.35,0,this.v.mat('#a39f8b'),.04);
this.ribbon(w,points,widthAt,0,path.type==='gravel'?this.v.mat('#928875'):asphalt,.08,spec);
for(const section of sections){if(spec.sidewalk)this.curbs(w,section,widthAt,walk,curb,.08,.38);else if(path.type!=='gravel')for(const side of [-1,1])this.ribbon(w,section,.04,p=>side*(widthAt(p)/2-.12),this.v.mat('#e0dfd0'),.105);}
if(spec.median)for(const section of clearSections(stations,junctionCuts(stations,this.junctionPlan?.junctions||[],1.1)))this.surface(w,section,p=>{let scale=1;for(const t of tapers||[])if(!t.median)scale=Math.min(scale,Math.max(0,(t.end?stations.at(-1).distance-p.distance:p.distance)/2));return [[-.16*scale,.09],[-.13*scale,.09+.07*scale],[.13*scale,.09+.07*scale],[.16*scale,.09]];},curb);
const laneCuts=[...cuts,...(tapers||[]).map(t=>t.end?[stations.at(-1).distance-t.length,stations.at(-1).distance]:[0,t.length])];
if(path.type!=='gravel')for(const lane of laneLayout(spec).dividers)this.dash(w,stations,lane.offset,lane.center?'#d4cba8':'#e0ded2',2.4,1.25,.105,laneCuts);
for(let distance=3;distance<stations.at(-1).distance-1;distance+=12){const p=atDistance(stations,distance),dx=p.tx,dz=p.tz;if(this.nearJunction(p.x,p.z,1.5))continue;
 if(spec.sidewalk)this.lamp(p.x-dz*(widthAt(p)/2+.25),this.height(w,p.x,p.z),p.z+dx*(widthAt(p)/2+.25),Math.abs(dx)>Math.abs(dz),{x:dz,z:-dx});
 if(wetness(w,p.x,p.z)>.3)this.v.box(this.group,p.x,this.height(w,p.x,p.z)/2-1,p.z,.4,this.height(w,p.x,p.z)+2,.4,'#9a9a8f');
 if(spec.oneway)for(const side of [-1,1])this.ribbon(w,[{x:p.x-dx*.4-dz*side*.22,z:p.z-dz*.4+dx*side*.22},p],.07,0,this.v.mat('#dedbc9'),.105);
 if(spec.green){this.treeWell(w,p,width);}
}
}
treeWell(w,p,width){const x=p.x+p.tz*(width/2+.25),z=p.z-p.tx*(width/2+.25),y=this.height(w,x,z);this.v.box(this.group,x,y+.16,z,.4,.04,.4,'#595d51');
 // Trees use the landscape vegetation batches and retain their full nearby models.
}

sharedJunction(w,j,asphalt,walk,curb){
 const corners=junctionCorners(j),outline=corners.flatMap(c=>c.points),shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(p.x,-p.z))),geometry=new THREE.ShapeGeometry(shape,1);geometry.rotateX(-Math.PI/2);
 const positions=geometry.attributes.position,uv=geometry.attributes.uv;
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);positions.setY(i,this.height(w,x,z)+.082);uv.setXY(i,x,z);}
 geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,asphalt);mesh.receiveShadow=true;this.group.add(mesh);
 for(const c of corners)if(c.sidewalk){this.surface(w,c.points,[[-.38,.14],[-.11,.14],[-.045,.125],[0,.08]],walk);this.ribbon(w,c.points,.055,-.075,curb,.142);}
 if(j.arms.length<3)return;
 for(const arm of j.arms){if(!arm.spec.sidewalk)continue;const normal={x:-arm.tz,z:arm.tx},at=(d,offset)=>({x:j.x+arm.tx*d+normal.x*offset,z:j.z+arm.tz*d+normal.z*offset});
  const span=arm.width-.25,stripes=Math.max(3,Math.floor(span/.28));
  for(let k=0;k<stripes;k++){const offset=-span/2+(k+.5)*span/stripes;this.ribbon(w,[at(j.radius+.12,offset),at(j.radius+.72,offset)],.12,0,this.v.mat('#dedbd0'),.106);}
  if(!arm.spec.oneway||arm.sign<0){const a=at(j.radius+1.02,-arm.width/2+.15),b=at(j.radius+1.02,arm.spec.oneway?arm.width/2-.15:-.05);this.ribbon(w,[a,b],.065,0,this.v.mat('#dedbd0'),.106);}
 }
}

syncSignals(traffic){const placements=signalPlacements(this.junctionPlan?.junctions||[],traffic.junctions.items),key=placements.map(p=>[p.x,p.z,p.tx,p.tz,p.controller].join(':')).join(';');if(key===this.signalKey)return;this.signalKey=key;this.v.disposeGroup(this.signalGroup);this.signalEntries=[];this.signalBulbs?.material.dispose();this.signalBulbs?.dispose();this.signalBulbs=null;if(!placements.length)return;
const dummy=new THREE.Object3D(),geometry=new THREE.SphereGeometry(.03,6,4),material=new THREE.MeshBasicMaterial({color:'#ffffff'}),bulbs=new THREE.InstancedMesh(geometry,material,placements.length*3);let instance=0;
for(const p of placements){const {x,z}=p,y=this.height(this.world,x,z)+.14;this.v.box(this.signalGroup,x,y+.6,z,.03,1.2,.03,'#555d58');const head=this.v.box(this.signalGroup,x,y+1.1,z,.10,.27,.10,'#202b28');head.rotation.y=Math.atan2(p.tx,p.tz);const entry={axis:p.axis,indices:[]};for(let k=0;k<3;k++){dummy.position.set(x+p.tx*.06,y+1.18-k*.08,z+p.tz*.06);dummy.updateMatrix();bulbs.setMatrixAt(instance,dummy.matrix);bulbs.setColorAt(instance,new THREE.Color('#304139'));entry.indices.push(instance++);}this.signalEntries.push(entry);}
batchStatic(this.signalGroup,this.v.unitBox);this.signalGroup.add(bulbs);this.signalBulbs=bulbs;this.signalPhaseKey=null;this.updateSignals(traffic);}

updateSignals(traffic){if(!this.signalBulbs)return;const policy=traffic.world.trafficPolicy||'signals',key=policy+':'+signalPhase(traffic.time,'x')+':'+signalPhase(traffic.time,'z');if(key===this.signalPhaseKey)return;this.signalPhaseKey=key;const colors=['#ff4938','#ffc64d','#42f6a4'];for(const entry of this.signalEntries){const phase=policy==='stop'?'red':signalPhase(traffic.time,entry.axis),on=['red','amber','green'].indexOf(phase);entry.indices.forEach((i,k)=>this.signalBulbs.setColorAt(i,new THREE.Color(k===on?colors[k]:'#22312c')));}this.signalBulbs.instanceColor.needsUpdate=true;}
lamp(x,y,z,horizontal,inward){const direction=inward||{x:horizontal?0:-1,z:horizontal?-1:0},yaw=Math.atan2(-direction.z,direction.x),g=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.055,3,8),this.v.mat('#757d7c'));pole.position.set(x,y+1.5,z);g.add(pole);const arm=this.v.box(g,x+direction.x*.25,y+3,z+direction.z*.25,.6,.035,.045,'#7e8784');arm.rotation.y=yaw;const bulb=new THREE.Mesh(new THREE.BoxGeometry(.31,.035,.13),this.lampMaterial);bulb.position.set(x+direction.x*.55,y+2.98,z+direction.z*.55);bulb.rotation.y=yaw;g.add(bulb);pole.castShadow=true;this.group.add(g);this.lamps.push(bulb);if(this.world){const cx=x+direction.x*.9,cz=z+direction.z*.9,geometry=new THREE.CircleGeometry(2.4,24);geometry.rotateX(-Math.PI/2);const pos=geometry.attributes.position;for(let i=0;i<pos.count;i++){const xx=cx+pos.getX(i),zz=cz+pos.getZ(i);pos.setXYZ(i,xx,this.height(this.world,xx,zz)+.24,zz);}geometry.computeVertexNormals();const pool=new THREE.Mesh(geometry,this.lightPoolMaterial);this.group.add(pool);}}
night(on){this.lampMaterial.emissiveIntensity=on?3:0;for(const mesh of this.group.children)if(mesh.material===this.lightPoolMaterial)mesh.visible=on;}
}
