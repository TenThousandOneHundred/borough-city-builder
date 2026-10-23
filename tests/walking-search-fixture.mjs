const E=globalThis.CityEngine||(await import('../dist/engine.js')).default;
export function walkingDistrict(){
 const world=E.createWorld('Pedestrian route comparison','plains',123);world.id='walking-route-fixture';
 for(const t of world.tiles)Object.assign(t,{type:null,level:0,people:0,ground:'land'});
 for(let y=0;y<48;y++)for(let x=0;x<48;x++){
  const t=world.tiles[y*48+x];
  if(y%6===0||x%8===0)Object.assign(t,{type:'road',level:1,roadType:'street'});
  else if(y%6===1)Object.assign(t,{type:x%2?'residential':'commercial',density:'low',level:1,people:x%2?6:0});
 }
 const addresses=world.tiles.flatMap((t,i)=>t.type==='residential'||t.type==='commercial'?[i]:[]);
 const pairs=addresses.slice(0,120).map((a,i)=>[a,addresses[(i*43+75)%addresses.length]]);
 return {world,pairs};
}
