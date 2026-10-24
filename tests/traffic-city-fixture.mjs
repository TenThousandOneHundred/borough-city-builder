import E from '../dist/engine.js';
import {Traffic} from '../dist/traffic.js';
import {Residents} from '../dist/residents.js';
import {Transit} from '../dist/transit.js';

// A connected grid with occupied homes, jobs, shops and actual resident routines.
export function trafficCity({TrafficClass=Traffic,rows=7,agents=512}={}){
 const world=E.createWorld('City traffic benchmark','plains',321);world.id='traffic-city-benchmark';
 for(const tile of world.tiles)Object.assign(tile,{type:null,level:0,people:0,ground:'land'});
 for(let y=6;y<6+rows*6;y+=6)for(let x=0;x<48;x++)Object.assign(world.tiles[y*48+x],{type:'road',roadType:'street',level:1});
 for(let x=6;x<46;x+=6)for(let y=6;y<7+(rows-1)*6;y++)Object.assign(world.tiles[y*48+x],{type:'road',roadType:'street',level:1});
 for(let y=7;y<7+rows*6;y+=6)for(let x=2;x<46;x++){
  if(world.tiles[y*48+x].type)continue;
  const type=x%3?'residential':x%2?'commercial':'office';
  Object.assign(world.tiles[y*48+x],{type,level:3,people:type==='residential'?24:0,density:'medium'});
 }
 const traffic=new TrafficClass(world,E);traffic.residentsEnabled=true;
 for(let n=0;n<agents;n++)traffic.addAgent();
 const transit=new Transit(world,traffic),residents=new Residents(world,traffic,transit);
 return {world,traffic,transit,residents,step(dt=.05){traffic.update(dt);transit.update(dt);residents.update(dt);}};
}
