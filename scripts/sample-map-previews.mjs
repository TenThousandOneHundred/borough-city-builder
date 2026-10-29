import fs from 'node:fs';
import E from '../dist/engine.js';
import {MAPS} from '../dist/map-catalog.js';
import {groundHeight,wetness} from '../dist/landscape.js';
const folder=new URL('../references/map-preview-data/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
const size=384,stats={};
for(const map of MAPS){
 const world=E.createWorld(map.name,map.id,map.seed),data=new Float32Array(size*size*2),trees=[];
 for(let row=0;row<size;row++)for(let col=0;col<size;col++){
  const x=-96+192*col/(size-1),z=-96+192*row/(size-1),i=(row*size+col)*2;
  data[i]=groundHeight(world,x,z);data[i+1]=wetness(world,x,z);
 }
 for(let i=0;i<world.tiles.length;i++)if(world.tiles[i].tree&&world.tiles[i].ground==='land'){
  const x=(i%48+.5)*4-96,z=(Math.floor(i/48)+.5)*4-96,height=groundHeight(world,x,z);
  const slope=Math.max(Math.abs(groundHeight(world,x+1,z)-height),Math.abs(groundHeight(world,x,z+1)-height));
  if(slope<.65&&wetness(world,x,z)<.1)trees.push({x,z,height});
 }
 stats[map.id]={seed:map.seed,land:Math.round(world.tiles.filter(t=>t.ground==='land').length/world.tiles.length*100)};
 fs.writeFileSync(new URL(map.id+'.bin',folder),Buffer.from(data.buffer));
 fs.writeFileSync(new URL(map.id+'.json',folder),JSON.stringify({size,trees,seed:map.seed}));
 console.log(map.name,stats[map.id]);
}
fs.writeFileSync(new URL('../dist/map-preview-stats.js',import.meta.url),'// Generated from the playable maps by scripts/sample-map-previews.mjs.\nexport const MAP_STATS='+JSON.stringify(stats,null,2)+';\n');
