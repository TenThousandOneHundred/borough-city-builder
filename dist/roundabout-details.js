import * as THREE from './vendor/three.module.js';
import {MARKING_HEIGHT} from './road-profile.js?v=144';
export function roundaboutIsland(road,w,j){
 const s=j.roundabout,points=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;points.push({x:j.x+Math.cos(a)*s.island,z:j.z+Math.sin(a)*s.island});}
 // Counterclockwise surface strips put the apron on the asphalt side and the
 // raised planting bed on the inside. Heights follow the same road surface.
 road.surface(w,points,[[-.3,.095],[-.27,.14],[0,.14],[.055,.21],[.12,.21]],road.v.mat('#b9b7aa'));
 const geometry=new THREE.CircleGeometry(s.island-.1,64);geometry.rotateX(-Math.PI/2);const p=geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i)+j.x,z=p.getZ(i)+j.z;p.setXYZ(i,x,road.height(w,x,z)+.205,z);}geometry.computeVertexNormals();const uv=geometry.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/3,p.getZ(i)/3);road.islandGrass ||= road.v.landscape?.material('grass',1,'#aab18a')||road.v.mat('#6e7949');const mesh=new THREE.Mesh(geometry,road.islandGrass);mesh.receiveShadow=true;road.group.add(mesh);
 // A thin inset soil border gives the island a defined edge without adding
 // trees that obscure approaching drivers or requiring extra model downloads.
 road.ribbon(w,points,.08,.14,road.v.mat('#746951'),.204);
 for(let i=0;i<j.arms.length;i++){const a=j.arms[i],b=j.arms[(i+1)%j.arms.length],start=Math.atan2(a.tz,a.tx);let end=Math.atan2(b.tz,b.tx);while(end<=start)end+=Math.PI*2;const angle=(start+end)/2,cx=j.x+Math.cos(angle)*s.ring,cz=j.z+Math.sin(angle)*s.ring,shape=new THREE.Shape([[-.12,.12],[0,.34],[.12,.12],[.045,.12],[.045,-.28],[-.045,-.28],[-.045,.12]].map(([x,f])=>new THREE.Vector2(cx+Math.cos(angle)*x+Math.sin(angle)*f,-cz-Math.sin(angle)*x+Math.cos(angle)*f))),g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let k=0;k<p.count;k++)p.setY(k,road.height(w,p.getX(k),p.getZ(k))+MARKING_HEIGHT);g.computeVertexNormals();const arrow=new THREE.Mesh(g,road.v.mat('#dedbd0'));road.group.add(arrow);road.marking(w,arrow);}

}
export function addYieldSign(view,group,p,y){
 view.box(group,p.x,y+.35,p.z,.025,.7,.025,'#89928e');
 for(const [r,offset,color]of [[.155,0,'#ad302c'],[.113,.004,'#f1eee1']]){const mesh=new THREE.Mesh(new THREE.CircleGeometry(r,3,-Math.PI/2),view.mat(color));mesh.position.set(p.x+p.tx*(.02+offset),y+.68,p.z+p.tz*(.02+offset));mesh.rotation.y=Math.atan2(p.tx,p.tz);mesh.castShadow=true;group.add(mesh);}
 const back=new THREE.Mesh(new THREE.CircleGeometry(.155,3,-Math.PI/2),view.mat('#89928e'));back.position.set(p.x+p.tx*.014,y+.68,p.z+p.tz*.014);back.rotation.y=Math.atan2(p.tx,p.tz)+Math.PI;group.add(back);
}
