// Bake surface variation into the existing colour buffer at asset load time.
// This adds no shader work, textures, geometry, draws or per-frame updates.
export function bakeRoofFinish(geometry,material){
 const planted=material.name==='modern-leaves';
 if(!planted&&material.name!=='modern-roof')return;
 const color=geometry.attributes.color,position=geometry.attributes.position,normal=geometry.attributes.normal;
 if(!color||!position||!normal)return;
 material.userData.roofFinish=true;
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
  if(planted){
   const patch=.5+.5*Math.sin(x*1.7+Math.sin(z*2.1))*Math.sin(z*1.3);
   // Sedum, mature leaves and exposed soil have muted, uneven tones.
   color.setXYZ(i,color.getX(i)*(.32+.17*patch),color.getY(i)*(.39+.17*patch),color.getZ(i)*(.22+.12*patch));
  }else if(normal.getY(i)>.94&&y>3.5){
   const weather=.89+.07*Math.sin(x*.7)*Math.sin(z*.43);
   color.setXYZ(i,color.getX(i)*weather,color.getY(i)*weather,color.getZ(i)*weather);
  }
 }
 color.needsUpdate=true;
}
