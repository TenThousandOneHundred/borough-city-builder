import * as THREE from '../dist/vendor/three.module.js';
import E from '../dist/engine.js';

export function zoningDistrict(){
 const world=E.createWorld('Zoning rendering benchmark','plains',8);world.money=1e7;
 for(const y of [6,14,32,40])E.buildRoadPath(world,[{x:3,y},{x:43,y}]);
 E.buildRoadPath(world,[{x:20,y:23},{x:32,y:18},{x:42,y:25}]);
 const layout=E.fineZoningLayout(world),cells=[...layout.values()];
 for(const zone of ['residential_low','residential_medium','commercial_low']){
  const number=['residential_low','residential_medium','commercial_low'].indexOf(zone);
  E.fineZoneCells(world,cells.filter(p=>Math.floor(p.col/4)%4===number).map(p=>p.id),zone);
 }
 return {world,cells:layout.size};
}
export function zoningView(Type,world){
 const view=Object.create(Type.prototype);Object.assign(view,{world,zoneGroup:new THREE.Group(),previewGroup:new THREE.Group(),zoning:true,overlay:'none',menu:false});return view;
}
