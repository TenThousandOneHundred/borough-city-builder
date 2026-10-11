import * as THREE from './vendor/three.module.js';
// Decorative sidewalk pedestrians; population and simulation remain engine-owned.
export class StreetLife{
 constructor(view){this.v=view;this.group=new THREE.Group();view.scene.add(this.group);this.elapsed=0;this.parts=[];this.people=[];this.dummy=new THREE.Object3D();}
 build(world){for(const m of this.parts){m.geometry.dispose();m.material.dispose();}this.group.clear();this.parts=[];this.people=[];
  for(let i=0;i<world.tiles.length&&this.people.length<90;i++){
   const t=world.tiles[i];if(t.type!=='road'||t.ground!=='land'||i%3!==0)continue;
   const neighbors=CityEngine.neighbors(i),roads=neighbors.filter(j=>world.tiles[j].type==='road');
   if(roads.length!==2||roads[0]+roads[1]!==2*i||!neighbors.some(j=>world.tiles[j].type&&world.tiles[j].type!=='road'))continue;
   const horizontal=Math.abs(roads[0]-i)===1;
   this.people.push({x:(i%48+.5)*4-96,z:(Math.floor(i/48)+.5)*4-96,horizontal,side:i%2?1:-1,phase:i*.717});
  }
  const count=this.people.length;
  const defs=[new THREE.CapsuleGeometry(.036,.105,3,5),new THREE.SphereGeometry(.033,7,5),new THREE.CylinderGeometry(.018,.016,.13,5),new THREE.CylinderGeometry(.018,.016,.13,5)];
  defs.forEach((geometry,k)=>{const material=new THREE.MeshStandardMaterial({color:k===1?'#b59c80':k>1?'#34404a':'#b7c2c4',roughness:.9});const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.castShadow=true;this.group.add(mesh);this.parts.push(mesh);if(k===0)this.people.forEach((p,i)=>mesh.setColorAt(i,new THREE.Color(['#687988','#a08362','#4a6467','#969993','#8f6860'][i%5])));});this.update(0);
 }
 update(dt){if(!this.parts.length||!this.v.running&&dt>0)return;if(this.v.running)this.elapsed+=dt*(this.v.simSpeed||1);const d=this.dummy;
  this.people.forEach((p,i)=>{const time=this.elapsed*.25+p.phase,along=Math.sin(time)*1.45,x=p.x+(p.horizontal?along:p.side*1.52),z=p.z+(p.horizontal?p.side*1.52:along),height=this.v.roadworks.height(this.v.world,x,z)+.08;
   this.parts.forEach((mesh,k)=>{d.rotation.set(0,p.horizontal?Math.PI/2:0,0);d.position.set(x,height+(k===0?.19:k===1?.305:.068),z);if(k>1){const offset=k===2?-.026:.026;if(p.horizontal)d.position.z+=offset;else d.position.x+=offset;d.rotation.x=Math.sin(time*9+(k===2?0:Math.PI))*.23;}d.scale.setScalar(1);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);});
  });this.parts.forEach(m=>m.instanceMatrix.needsUpdate=true);
 }
}
