import fs from 'node:fs';
import E from '../dist/engine.js';
import {MAPS} from '../dist/map-catalog.js';
import {groundHeight,wetness} from '../dist/landscape.js';
import Forest from '../dist/forest-layout.js';
import {supportsTree} from '../dist/tree-placement.js';
const folder=new URL('../references/map-preview-data/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
const size=384,stats={};
for(const map of MAPS)for(const mapSize of [48,72]){
 const half=mapSize*2,extent=mapSize*4,key=map.id+(mapSize===72?'-large':'');
 const world=E.createWorld(map.name,map.id,map.seed,{mapSize}),data=new Float32Array(size*size*2),trees=[];
 for(let row=0;row<size;row++)for(let col=0;col<size;col++){
  const x=-half+extent*col/(size-1),z=-half+extent*row/(size-1),i=(row*size+col)*2;
  data[i]=groundHeight(world,x,z);data[i+1]=wetness(world,x,z);
 }
 for(let i=0;i<world.tiles.length;i++)if(world.tiles[i].tree&&world.tiles[i].ground==='land'){
  const cx=(i%mapSize+.5)*4-half,cz=(Math.floor(i/mapSize)+.5)*4-half;
  for(const [x,z]of Forest.pair(world,cx,cz,i))if(supportsTree(world,x,z,groundHeight)&&wetness(world,x,z)<.18)trees.push({x,z,height:groundHeight(world,x,z)});
 }
 stats[key]={seed:map.seed,land:Math.round(world.tiles.filter(t=>t.ground==='land').length/world.tiles.length*100)};
 fs.writeFileSync(new URL(key+'.bin',folder),Buffer.from(data.buffer));
 fs.writeFileSync(new URL(key+'.json',folder),JSON.stringify({size,trees,seed:map.seed,extent}));
 console.log(map.name,stats[key]);
}
fs.writeFileSync(new URL('../dist/map-preview-stats.js',import.meta.url),'// Generated from the playable maps by scripts/sample-map-previews.mjs.\nexport const MAP_STATS='+JSON.stringify(stats,null,2)+';\n');
