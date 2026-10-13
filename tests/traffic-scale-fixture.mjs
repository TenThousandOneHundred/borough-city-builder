import {createRequire} from 'node:module';
import {Traffic} from '../dist/traffic.js';
const E=createRequire(import.meta.url)('../dist/engine.js');
export function simulation(count,linear=false){
 const w=E.createWorld('Traffic scale','plains',123);for(const t of w.tiles){t.type=null;t.level=0;}
 for(let n=0;n<48;n++){w.tiles[24*48+n].type='road';w.tiles[n*48+24].type='road';}
 const traffic=new Traffic(w,E);traffic.trips=[];
 if(linear)traffic.spatial={reset(){},move(){},corridor(){return traffic.agents;}};
 for(let i=0;i<count;i++){
  const column=i%16,row=Math.floor(i/16),x=column*12-90,z=row*3-70,turn=i%7===0;
  const points=turn?[{x,z},{x,z:z+15},{x:x+12,z:z+20},{x:x+12,z:z+40}]:[{x,z},{x,z:z+80}];
  Object.assign(traffic.addAgent(),{active:true,phase:'resident',points,segment:0,distance:0,x,z,heading:0,length:i%11===0?2.6:.9,kind:i%11===0?'bus':'car',hold:i%71===0});
 }
 return traffic;
}
