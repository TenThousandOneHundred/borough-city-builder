import {terrainNoise} from './terrain-field.js?v=43';
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Versioned relief belongs to the saved world: loading an older city cannot
// move its buildings or roads. Broad shelves retain usable development areas.
export function inlandRelief(world,x,z,water=0){
 if(world.landformVersion!==1)return 0;
 const edge=1-ease((Math.max(Math.abs(x),Math.abs(z))-110)/90);
 const valley=ease((Math.hypot(x+22,z-2)-30)/40),corridor=x<0?ease((Math.abs(z-2)-7)/18):1;
 if(edge===0||valley===0||corridor===0||water>=.12)return 0;
 const seed=world.seed,warp=(terrainNoise(x*.014,z*.014,seed+211)-.5)*12;
 const gx=(x+96)/4-.5,gz=(z+96)/4-.5;
 let distance;
 if(world.terrain==='river')distance=Math.abs(gx-(34+Math.sin(gz/7+seed%9)*3))*4-13;
 else if(world.terrain==='islands')distance=(.72-Math.sin(gx/7)-Math.cos(gz/8)-Math.sin((gx+gz)/9))*20;
 else distance=50;
 const coast=ease((distance+warp)/20),upper=ease((distance+warp-30)/28);
 const rolling=terrainNoise(x*.018,z*.018,seed+419);
 let height=world.terrain==='plains'?rolling*3.2:coast*2.8+upper*(3.8+rolling*3.2);
 // A broad starter valley includes the existing outside road and service area.
 return height*valley*corridor*edge*(1-ease(water/.12));
}
