import {borrowRoadsForTerrain} from './terrain-refresh-plan.js?v=170';
import {lotGradingKey} from './lot-grading.js?v=170';
import {geometryUploadSteps} from './geometry-upload.js?v=170';
import {constructionGridSteps} from './construction-grid.js?v=170';
import {groundCoverSteps} from './ground-cover.js?v=170';
import {groundHeight,wetness} from './landscape.js?v=170';
import * as THREE from './vendor/three.module.js';
import {changedRoadCells} from './road-frontage.js?v=170';
import {Roadworks} from './roadworks.js?v=170';
import {reuseRoadGeometry} from './road-junction-plan.js?v=170';
import {scheduleBuild} from './build-scheduler.js?v=170';

// Build an invisible replacement. The visible city and its traffic remain live
// until both road meshes and fitted terrain are ready for one synchronous swap.
export function prepareRoadRefresh(view,{schedule=scheduleBuild,reason='roads'}={}){
 if(view.roadRefreshJob)return view.roadRefreshJob.promise;
 const world=view.world,revision=world.roadEditRevision||0,snapshot=structuredClone(world),old=view.roadworks,borrowed=reason==='terrain'&&old.world===world&&old.earthworkSurfaces?.length?borrowRoadsForTerrain(old,snapshot):null,next=borrowed?.planner||new Roadworks(view),terrain=[],bases=view.landscape.terrainBases||[];
 // Retain the already uploaded asphalt textures through the atomic swap.
 const sources=['color','normal','rough'].map(slot=>view.landscape.assets?.['road-asphalt-'+slot]),sharedAsphalt=old.asphalt&&sources.every((source,i)=>old.asphaltSources?.[i]===source)?old.asphalt:null;
 if(sharedAsphalt){next.asphalt=sharedAsphalt;next.asphaltSources=old.asphaltSources;}
 next.world=snapshot;next.heightRevision=old.heightRevision;next.accessRevision=old.accessRevision;
 next.earthworkRegionCache={cells:old.earthworkRegionCache?.cells||new Map()};
 next.group.visible=false;next.signalGroup.visible=false;
 const stats={slices:0,maxSliceMs:0,swapMs:0,reusedRoadMeshes:!!borrowed},started=performance.now();
 const job={force:false,promise:null};view.roadRefreshJob=job;view.onRoadBuildStatus?.(true,reason);
 const cancelled=()=>view.roadRefreshJob!==job||view.world!==world||(world.roadEditRevision||0)!==revision||view.landscape.terrainBases!==bases;
 const onSlice=ms=>{stats.slices++;stats.maxSliceMs=Math.max(stats.maxSliceMs,ms);};
 // Separate short phases too: otherwise their last and first slices stack
 // in one frame even though each phase individually respects its budget.
 const sliceOptions={cancelled,onSlice,yieldBefore:true};
 const layout=changedRoadCells(snapshot.tiles).keys,pathsKey=JSON.stringify(snapshot.roadPaths);
 // Only reuse scenery when occupancy and tree inputs still match the snapshot.
 const treeKey=w=>[w.elevationRevision,w.development?.revision,w.tiles.map(t=>[t.type,t.zone,t.tree,t.ground].join('/')).join(';'),JSON.stringify(w.development?.parcels)].join('|');
 const treesKey=treeKey(snapshot),buildingInputs=new Map([...view.buildings].map(([id,root])=>[id,{root,plan:root.userData.plan,position:root.position.toArray().join(',')}]));
 const zoneMode=view.zoneOverlayMode?.(),zoneInputs=view.roadZoning||view.zoning||view.overlay==='zones'?view.zoneOverlayInputs?.(snapshot):null;
 let adopted=false,cover=null,grid=null,treePlan=null,zones=null;
 job.promise=(async()=>{
  try{
   await schedule(borrowed?next.syncEarthworksSteps(snapshot):next.buildSteps(snapshot),sliceOptions);
   const plan=next.earthworks,height=(w,x,z)=>{const y=plan?.sample(x,z);return Number.isFinite(y)?y:groundHeight(w,x,z);};plan?.beginApplication();
   for(const base of bases){
    // Borrow immutable terrain attributes, with original indices and colors.
    // No clone of the entire landscape or live GPU buffer is required.
    const source=base.mesh.geometry,geometry=new THREE.BufferGeometry();geometry.attributes={...source.attributes};geometry.setIndex(new THREE.BufferAttribute(base.indices,1));geometry.setDrawRange(base.drawRange.start,base.drawRange.count);
    if(base.mesh===view.landscape.ground&&view.landscape.baseColors)geometry.setAttribute('color',new THREE.BufferAttribute(view.landscape.baseColors,source.attributes.color.itemSize));
    if(plan){const result=plan.applyToGeometrySteps?await schedule(plan.applyToGeometrySteps(geometry),sliceOptions):plan.applyToGeometry(geometry);terrain.push({base,result});}
   }
   if(view.landscape.cover||view.landscape.developmentPending){const wet=(w,x,z)=>plan?.excluded(x,z)?1:wetness(w,x,z,height);cover=await schedule(groundCoverSteps(view,snapshot,height,wet),sliceOptions);}
   if(view.landscape.treePlanSteps)treePlan=await schedule(view.landscape.treePlanSteps(snapshot,{roads:next,earthworks:!!plan,height,excluded:(x,z)=>!!plan?.excluded(x,z)}),sliceOptions);
   if(zoneInputs!==null&&view.zoneOverlaySteps)zones=await schedule(view.zoneOverlaySteps(snapshot,{height:(x,z)=>Math.max(.2,height(snapshot,x,z))}),sliceOptions);
   await schedule(next.buildAccessSteps(snapshot,new Map([...buildingInputs].map(([id,input])=>[id,input.root])),{hidden:true,height:(w,x,z)=>Math.max(.2,height(w,x,z))}),sliceOptions);
   grid=await schedule(constructionGridSteps((x,z)=>Math.max(.2,height(snapshot,x,z))),sliceOptions);
   // Retain the live materials until replacement programs have acquired their
   // references. Disposing them first evicts otherwise reusable GPU programs.
   // Compile with the same render target, lighting and fog as the city pass.
   if(view.renderer?.compileAsync){
    const target=view.renderer.getRenderTarget(),programStart=performance.now();
    let ready;
    try{if(view.graphics?.enabled)view.renderer.setRenderTarget(view.graphics.target);const objects=new THREE.Group();objects.children=[next.group,next.accessGroup,...(cover?[cover]:[]),...(zones?[zones]:[])];ready=view.renderer.compileAsync(objects,view.camera,view.scene);}
    finally{view.renderer.setRenderTarget(target);}
    await ready;stats.programMs=performance.now()-programStart;
   }
   const uploads=[];for(const group of [next.group,next.accessGroup,cover,zones])group?.traverse(o=>{if(o.geometry)uploads.push(o);});
   for(const {base,result}of terrain){uploads.push({geometry:result.replacement,material:base.mesh.material});if(result.walls)uploads.push({geometry:result.walls,material:view.landscape.retainingMaterial()});}
   await schedule(geometryUploadSteps(view.renderer,uploads,view.scene),sliceOptions);
   await schedule((function*(){})(),sliceOptions);
   if(cancelled()||changedRoadCells(world.tiles,layout).changed.length||JSON.stringify(world.roadPaths)!==pathsKey)throw new DOMException('Road preparation cancelled','AbortError');
   view.roadRefreshJob=null;next.world=world;next.group.visible=true;next.signalGroup.visible=true;const swapStart=performance.now();view.roadworks=borrowed?borrowed.adopt():next;adopted=true;
   if(!borrowed){if(next.asphalt===old.asphalt)old.asphalt=null;old.dispose();}
   const accessMatches=buildings=>buildings.size===buildingInputs.size&&[...buildings].every(([id,root])=>{const input=buildingInputs.get(id);return input?.root===root&&input.plan===root.userData.plan&&input.position===root.position.toArray().join(',');});
   if(treePlan&&treesKey===treeKey(world))view.landscape.preparedTreePlan=treePlan;
   stats.reusedJunctionPlan=reuseRoadGeometry(snapshot,world,globalThis.CityEngine);
   if(zones&&(zoneMode!==view.zoneOverlayMode()||zoneInputs!==view.zoneOverlayInputs(world))){view.disposeZoneOverlay(zones);zones=null;}
   stats.preparedZoneOverlay=!!zones;
   view.refresh(job.force,{roads:view.roadworks,terrain,cover,grid,zones,accessMatches,lotGradingKey:lotGradingKey(snapshot)});
   view.landscape.preparedTreePlan=null;next.accessGroup.visible=true;
   view.roadworks.night(view.night);stats.swapMs=performance.now()-swapStart;stats.totalMs=performance.now()-started;view.lastRoadBuildStats=stats;
   return true;
  }catch(error){if(error.name!=='AbortError')throw error;return false;}
  finally{
   if(zones)view.disposeZoneOverlay(zones);
   if(view.landscape.preparedTreePlan===treePlan)view.landscape.preparedTreePlan=null;
   if(!adopted){grid?.dispose();cover?.userData.dispose?.();if(borrowed)borrowed.dispose();else{if(next.asphalt===sharedAsphalt)next.asphalt=null;next.dispose();}for(const {result}of terrain){result.replacement?.dispose();result.walls?.dispose();}}
   if(view.roadRefreshJob===job)view.roadRefreshJob=null;
   if(!view.roadRefreshJob)view.onRoadBuildStatus?.(false);
  }
 })();return job.promise;
}
