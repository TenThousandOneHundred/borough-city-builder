import './map-grid.js?v=165';
import './map-terrain.js?v=165';
import './coastline.js?v=165';
import {terrainNoise} from './terrain-field.js?v=165';
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

// Version three is a continuous regional landform, not a staircase of narrow
// shelves cut by a special starting-road trench. Old saves keep their fields.
export function regionalRelief(world,x,z,water,shoreDistance){
 if(water>=.12)return 0;
 const half=globalThis.BoroughGrid.size(world)*2,seed=world.seed;
 const edge=1-ease((Math.max(Math.abs(x),Math.abs(z))-(half+14))/90);
 if(!edge)return 0;
 const maps=globalThis.BoroughMapTerrain,rolling=terrainNoise(x*.011,z*.011,seed+419),broad=terrainNoise(x*.004,z*.004,seed+311);
 let distance=1000;
 if(maps.isNew(world.terrain))distance=shoreDistance??maps.distance(world.terrain,seed,x,z);
 else if(world.terrain==='islands')distance=globalThis.BoroughCoastline.distance(seed,x,z);
 else if(world.terrain==='river'){
  const gx=(x+half)/4-.5,gz=(z+half)/4-.5;
  distance=Math.abs(gx-(34+Math.sin(gz/7+seed%9)*3))*4-13;
 }
 const bank=ease((distance-3)/(world.terrain==='highlands'?30:65));
 let height;
 switch(world.terrain){
  case 'river': height=1.2+rolling*1.1+ease((distance-30)/110)*(4+broad*3);break;
  case 'lake': height=1.6+rolling*3.5+3*ease((Math.abs(z+(broad-.5)*14)-half*.65)/(half*.7));break;
  case 'bay': height=2+rolling*2+6*ease((Math.abs(z-20)-half*.35)/(half*.65));break;
  case 'highlands':{
   const bend=(broad-.5)*20,width=half*.32;
   const north=Math.exp(-(((z+half*.9+bend)/width)**2)),south=Math.exp(-(((z-half*.9-bend)/width)**2));
   height=(north+south*.92)*(25+rolling*5)+rolling*1.2;break;
  }
  case 'delta': height=.35+rolling*1.1+2*ease((-z-half*.45)/(half*.7));break;
  case 'islands': height=1.8+rolling*3+ease((distance-45)/90)*(2+broad*2);break;
  default: height=.6+rolling*2.5;
 }
 return height*bank*edge*(1-ease(water/.12));
}
