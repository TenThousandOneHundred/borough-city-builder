import {constructionGridSteps} from './construction-grid.js?v=147';
import {groundCoverSteps} from './ground-cover.js?v=147';
import {groundHeight,wetness} from './landscape.js?v=147';
import * as THREE from './vendor/three.module.js';
import {changedRoadCells} from './road-frontage.js?v=147';
import {Roadworks} from './roadworks.js?v=147';
import {scheduleBuild} from './build-scheduler.js?v=147';

// Build an invisible replacement. The visible city and its traffic remain live
// until both road meshes and fitted terrain are ready for one synchronous swap.
export function prepareRoadRefresh(view,{schedule=scheduleBuild}={}){
 if(view.roadRefreshJob)return view.roadRefreshJob.promise;
 const world=view.world,revision=world.roadEditRevision||0,snapshot=structuredClone(world),old=view.roadworks,next=new Roadworks(view),terrain=[],bases=view.landscape.terrainBases||[];
 // Retain the already uploaded asphalt textures through the atomic swap.
 const sources=['color','normal','rough'].map(slot=>view.landscape.assets?.['road-asphalt-'+slot]),sharedAsphalt=old.asphalt&&sources.every((source,i)=>old.asphaltSources?.[i]===source)?old.asphalt:null;
 if(sharedAsphalt){next.asphalt=sharedAsphalt;next.asphaltSources=old.asphaltSources;}
 next.world=snapshot;next.heightRevision=old.heightRevision;next.accessRevision=old.accessRevision;
 next.earthworkRegionCache={cells:old.earthworkRegionCache?.cells||new Map()};
 next.group.visible=false;next.signalGroup.visible=false;
 const stats={slices:0,maxSliceMs:0,swapMs:0},started=performance.now();
 const job={force:false,promise:null};view.roadRefreshJob=job;view.onRoadBuildStatus?.(true);
 const cancelled=()=>view.roadRefreshJob!==job||view.world!==world||(world.roadEditRevision||0)!==revision||view.landscape.terrainBases!==bases;
 const onSlice=ms=>{stats.slices++;stats.maxSliceMs=Math.max(stats.maxSliceMs,ms);};
 const layout=changedRoadCells(snapshot.tiles).keys,pathsKey=JSON.stringify(snapshot.roadPaths);
 let adopted=false,cover=null,grid=null;
 job.promise=(async()=>{
  try{
   await schedule(next.buildSteps(snapshot),{cancelled,onSlice});
   const plan=next.earthworks;plan?.beginApplication();
   for(const base of bases){
    // Borrow immutable terrain attributes, with original indices and colors.
    // No clone of the entire landscape or live GPU buffer is required.
    const source=base.mesh.geometry,geometry=new THREE.BufferGeometry();geometry.attributes={...source.attributes};geometry.setIndex(new THREE.BufferAttribute(base.indices,1));geometry.setDrawRange(base.drawRange.start,base.drawRange.count);
    if(base.mesh===view.landscape.ground&&view.landscape.baseColors)geometry.setAttribute('color',new THREE.BufferAttribute(view.landscape.baseColors,source.attributes.color.itemSize));
    if(plan){const result=plan.applyToGeometrySteps?await schedule(plan.applyToGeometrySteps(geometry),{cancelled,onSlice}):plan.applyToGeometry(geometry);terrain.push({base,result});}
   }
   if(view.landscape.cover||view.landscape.developmentPending){const height=(w,x,z)=>{const y=plan?.sample(x,z);return Number.isFinite(y)?y:groundHeight(w,x,z);},wet=(w,x,z)=>plan?.excluded(x,z)?1:wetness(w,x,z,height);cover=await schedule(groundCoverSteps(view,snapshot,height,wet),{cancelled,onSlice});}
   grid=await schedule(constructionGridSteps((x,z)=>{const y=plan?.sample(x,z);return Math.max(.2,Number.isFinite(y)?y:groundHeight(snapshot,x,z));}),{cancelled,onSlice});
   // Retain the live materials until replacement programs have acquired their
   // references. Disposing them first evicts otherwise reusable GPU programs.
   // Compile with the same render target, lighting and fog as the city pass.
   if(view.renderer?.compileAsync){
    const target=view.renderer.getRenderTarget(),programStart=performance.now();
    let ready;
    try{if(view.graphics?.enabled)view.renderer.setRenderTarget(view.graphics.target);const objects=new THREE.Group();objects.children=[next.group,...(cover?[cover]:[])];ready=view.renderer.compileAsync(objects,view.camera,view.scene);}
    finally{view.renderer.setRenderTarget(target);}
    await ready;stats.programMs=performance.now()-programStart;
   }
   if(cancelled()||changedRoadCells(world.tiles,layout).changed.length||JSON.stringify(world.roadPaths)!==pathsKey)throw new DOMException('Road preparation cancelled','AbortError');
   view.roadRefreshJob=null;next.world=world;next.group.visible=true;next.signalGroup.visible=true;view.roadworks=next;adopted=true;
   const swapStart=performance.now();if(next.asphalt===old.asphalt)old.asphalt=null;old.dispose();
   view.refresh(job.force,{roads:next,terrain,cover,grid});
   next.night(view.night);stats.swapMs=performance.now()-swapStart;stats.totalMs=performance.now()-started;view.lastRoadBuildStats=stats;
   return true;
  }catch(error){if(error.name!=='AbortError')throw error;return false;}
  finally{
   if(!adopted){grid?.dispose();cover?.userData.dispose?.();if(next.asphalt===sharedAsphalt)next.asphalt=null;next.dispose();for(const {result}of terrain){result.replacement?.dispose();result.walls?.dispose();}}
   if(view.roadRefreshJob===job)view.roadRefreshJob=null;
   if(!view.roadRefreshJob)view.onRoadBuildStatus?.(false);
  }
 })();return job.promise;
}
