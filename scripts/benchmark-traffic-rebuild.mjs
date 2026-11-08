import {performance} from 'node:perf_hooks';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {rebuildCity,addRoad,E} from '../tests/fixtures/traffic-rebuild.mjs';
const moduleUrl=process.argv[2]?pathToFileURL(resolve(process.argv[2])):new URL('../dist/traffic.js',import.meta.url),source=await readFile(moduleUrl,'utf8');
const {Traffic}=await import(moduleUrl),{roadGeometry}=await import(new URL(source.match(/from '(\.\/road-junction-plan\.js[^']*)'/)[1],moduleUrl));
class Measured extends Traffic {search(...args){this.searchCount=(this.searchCount||0)+1;return super.search(...args)}}
const results=[];
for(const size of [48,72,96])for(const populated of [false,true]){
 const times=[],searches=[];let trips,nodes;
 for(let run=0;run<18;run++){
  const w=rebuildCity(size,{populated}),t=new Measured(w,E);addRoad(w,[{x:17,y:7},{x:17,y:41}],'avenue');roadGeometry(w,E);t.searchCount=0;
  const start=performance.now();t.rebuild(w);const ms=performance.now()-start;
  if(run>=3){times.push(ms);searches.push(t.searchCount)}trips=t.trips.length;nodes=t.graph.size;
 }
 times.sort((a,b)=>a-b);results.push({size,populated,trips,nodes,medianMs:times[7],p95Ms:times[14],searches:[...new Set(searches)]});
}
console.log(JSON.stringify(results,null,2));
