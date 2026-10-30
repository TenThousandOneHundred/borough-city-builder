import * as THREE from './vendor/three.module.js';

// A completed building changes its ground support, not the road network.
// Borrow immutable pavement/bridge plans while privately preparing new terrain
// and access paths. Shared road resources are never disposed by this owner.
export function borrowRoadsForTerrain(roads,world){
 const planner=Object.assign(Object.create(Object.getPrototypeOf(roads)),roads,{
  world,group:new THREE.Group(),signalGroup:new THREE.Group(),
  earthworks:null,earthworkKey:null,earthworkInputKey:null,lotPickSurface:null,
  lotGrades:new Map(),lotWorldKey:undefined,accessGroup:null,accessSurfaces:null,
  earthworkRegionCache:{cells:roads.earthworkRegionCache?.cells||new Map()}
 });
 let transferred=false;
 const discardAccess=group=>{if(!group)return;group.traverse(o=>o.geometry?.dispose());group.removeFromParent();group.clear();};
 return {planner,
  adopt(){
   roads.earthworks?.dispose();roads.lotPickSurface?.geometry.dispose();discardAccess(roads.accessGroup);
   for(const key of ['earthworks','earthworkKey','earthworkInputKey','earthworkRegionCache','lotGrades','lotWorldKey','lotPickSurface','accessGroup','accessSurfaces','accessRevision'])roads[key]=planner[key];
   transferred=true;return roads;
  },
  dispose(){if(transferred)return;planner.earthworks?.dispose();planner.lotPickSurface?.geometry.dispose();discardAccess(planner.accessGroup);}
 };
}
