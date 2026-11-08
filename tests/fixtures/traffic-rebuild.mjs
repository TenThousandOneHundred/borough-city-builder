import E from '../../dist/engine.js';
export function addRoad(w,controls,type){const result=E.buildRoadPath(w,controls,type);if(!result.ok)throw Error(result.reason);const path=result.path,old=path.id,id="test-road-"+w.roadPaths.length;path.id=id;for(const i of path.tiles)w.tiles[i].pathIds=w.tiles[i].pathIds.map(p=>p===old?id:p);return result;}
export function rebuildCity(size=48,{populated=true,oneway=false}={}){
 const w=E.createWorld('Rebuild oracle','plains',431,{mapSize:size});w.money=1e8;w.mode='sandbox';for(const t of w.tiles)Object.assign(t,{type:null,ground:'land',level:0,people:0});w.roadPaths=[];
 for(const y of [12,24,36])addRoad(w,[{x:0,y},{x:size-1,y}],oneway&&y===24?'oneway':'street');
 for(const x of [8,24,40])addRoad(w,[{x,y:8},{x,y:40}],'street');
 if(populated)for(const [x,y,type]of [[6,11,'commercial'],[26,23,'residential'],[38,35,'industrial']])Object.assign(w.tiles[y*size+x],{type,level:2,people:type==='residential'?18:0});
 return w;
}
export function trafficResult(t){
 const trace=cells=>({cells:[...cells],sources:cells.sources,joins:cells.joins,positions:cells.positions});
 return {graph:[...t.graph],positions:[...t.positions],samples:[...t.samples].map(([id,s])=>[id,s.samples,[...s.mapping],s.spec]),portals:t.portals,junctions:t.junctions.items.map(({id,x,z,radius,roundabout})=>({id,x,z,radius,roundabout})),trips:t.trips.map(({destination,kind,inbound,outbound,cells,roads})=>({destination,kind,inbound,outbound,cells:cells.map(trace),roads:[...roads]}))};
}
export {E};
