import {floorHeight} from './landscape.js?v=74';
import * as THREE from './vendor/three.module.js';
// Gameplay pedestrians mirror saved simulation agents. Only the menu uses ambient walkers.
export class StreetLife{
 constructor(view){this.v=view;this.group=new THREE.Group();view.scene.add(this.group);this.elapsed=0;this.parts=[];this.people=[];this.dummy=new THREE.Object3D();}
 build(world){this.world=world;this.lastTime=null;this.poses=[];this.heights=new WeakMap();for(const m of this.parts){m.geometry.dispose();m.material.dispose();}this.group.clear();this.parts=[];this.people=[];
  for(let i=0;this.v.menu&&i<world.tiles.length&&this.people.length<90;i++){
   const t=world.tiles[i];if(t.type!=='road'||t.ground!=='land'||i%3!==0)continue;
   const neighbors=CityEngine.neighbors(i),roads=neighbors.filter(j=>world.tiles[j].type==='road');
   if(roads.length!==2||roads[0]+roads[1]!==2*i||!neighbors.some(j=>world.tiles[j].type&&world.tiles[j].type!=='road'))continue;
   const horizontal=Math.abs(roads[0]-i)===1;
   this.people.push({x:(i%48+.5)*4-96,z:(Math.floor(i/48)+.5)*4-96,horizontal,side:i%2?1:-1,phase:i*.717});
  }
  const count=this.v.menu?this.people.length:1024;
  const defs=[new THREE.CapsuleGeometry(.036,.105,3,5),new THREE.SphereGeometry(.033,7,5),new THREE.CylinderGeometry(.018,.016,.13,5),new THREE.CylinderGeometry(.018,.016,.13,5)];
  defs.forEach((geometry,k)=>{const material=new THREE.MeshStandardMaterial({color:k===1?'#b59c80':k>1?'#34404a':'#b7c2c4',roughness:.9});const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.castShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(mesh);this.parts.push(mesh);if(k===0)Array.from({length:count}).forEach((p,i)=>mesh.setColorAt(i,new THREE.Color(['#687988','#a08362','#4a6467','#969993','#8f6860'][i%5])));});this.update(0);
 }
 update(dt){if(!this.v.menu){this.updateResidents();return;}if(!this.parts.length||!this.v.running&&dt>0)return;if(this.v.running)this.elapsed+=dt*(this.v.simSpeed||1);const d=this.dummy;
  this.people.forEach((p,i)=>{const time=this.elapsed*.25+p.phase,along=Math.sin(time)*1.45,x=p.x+(p.horizontal?along:p.side*1.52),z=p.z+(p.horizontal?p.side*1.52:along),height=this.v.roadworks.height(this.v.world,x,z)+.08;
   this.parts.forEach((mesh,k)=>{d.rotation.set(0,p.horizontal?Math.PI/2:0,0);d.position.set(x,height+(k===0?.19:k===1?.305:.068),z);if(k>1){const offset=k===2?-.026:.026;if(p.horizontal)d.position.z+=offset;else d.position.x+=offset;d.rotation.x=Math.sin(time*9+(k===2?0:Math.PI))*.23;}d.scale.setScalar(1);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);});
  });this.parts.forEach(m=>m.instanceMatrix.needsUpdate=true);
 }
 updateResidents(){if(!this.parts.length)return;const v=this.v,d=this.dummy,camera=v.camera;
  this.frustum ||= new THREE.Frustum();this.projection ||= new THREE.Matrix4();this.sphere ||= new THREE.Sphere(new THREE.Vector3(),.5);
  if(camera){camera.updateMatrixWorld();const key=camera.matrixWorld.elements.join(',')+camera.projectionMatrix.elements.join(',');if(key!==this.lastCamera){this.lastCamera=key;this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);}}
  let count=0;const time=this.world.citizens?.time||0,dirty=this.parts.map(()=>({first:Infinity,last:0}));this.lastMatrixWrites=0;this.lastHeightSamples=0;
  const draw=(r,state)=>{if(count>=1024)return;const x=state.x,z=state.z;if(camera&&(x-camera.position.x)**2+(z-camera.position.z)**2>110*110)return;
   const i=Math.floor((z+96)/4)*48+Math.floor((x+96)/4),road=this.world.tiles[i]?.type==='road';
   const revision=this.world.elevationRevision||0,ground=this.world.tiles[i]?.ground,previous=this.heights.get(state);let y;if(previous&&previous.x===x&&previous.z===z&&previous.road===road&&previous.ground===ground&&previous.revision===revision)y=previous.y;else{y=road?v.roadworks.height(this.world,x,z)+.08:floorHeight(this.world,x,z)+.08;this.heights.set(state,{x,z,road,ground,revision,y});this.lastHeightSamples++;}
   this.sphere.center.set(x,y+.2,z);if(camera&&!this.frustum.intersectsSphere(this.sphere))return;
   const heading=state.heading||0,walking=state.phase!=='wait'&&r.activity!=='Waiting for walking access',swing=walking?Math.sin(time*8+r.id)*.3:0;
   const pose=this.poses[count],same=pose&&pose.x===x&&pose.y===y&&pose.z===z&&pose.heading===heading;
   this.parts.forEach((mesh,k)=>{if(same&&(k<2||pose.swing===swing))return;d.rotation.set(0,heading,0);d.position.set(x,y+(k===0?.19:k===1?.305:.068),z);if(k>1){const offset=k===2?-.026:.026;d.position.x+=Math.cos(heading)*offset;d.position.z-=Math.sin(heading)*offset;d.rotation.x=k===2?swing:-swing;}d.scale.setScalar(1);d.updateMatrix();mesh.setMatrixAt(count,d.matrix);dirty[k].first=Math.min(dirty[k].first,count*16);dirty[k].last=(count+1)*16;this.lastMatrixWrites++;});if(!same||pose.swing!==swing)this.poses[count]={x,y,z,heading,swing};count++;
  };
  for(const entry of v.transit?.walking.active.values()||[])if(entry.r.walk)draw(entry.r,entry.r.walk);
  for(const r of v.transit?.passengers.values()||[])if(r.transit&&r.transit.phase!=='ride')draw(r,r.transit);
  for(let k=0;k<this.parts.length;k++){const mesh=this.parts[k],range=dirty[k];mesh.count=count;mesh.frustumCulled=false;if(range.last<=range.first)continue;const attribute=mesh.instanceMatrix;for(const pending of attribute.updateRanges){range.first=Math.min(range.first,pending.start);range.last=Math.max(range.last,pending.start+pending.count);}attribute.clearUpdateRanges();attribute.addUpdateRange(range.first,range.last-range.first);attribute.needsUpdate=true;}
 }

}
