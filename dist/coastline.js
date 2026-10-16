// A shared signed coast field keeps tile water, rendered shorelines and inland
// shelves in agreement. Positive values are inland, negative values are sea.
(function(root){
'use strict';
// Classic engine scripts and ES renderer imports share the same field cache.
if(root.BoroughCoastline){if(typeof module!=='undefined')module.exports=root.BoroughCoastline;return;}
const fields=new Map(),N=129,STEP=2,EXTENT=128;
function noise(x,z,seed){const hash=(a,b)=>{let n=Math.imul(a,374761393)+Math.imul(b,668265263)+Math.imul(seed,31);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};const a=Math.floor(x),b=Math.floor(z);let u=x-a,v=z-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return(hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;}
function shape(seed,x,z){
 const phase=(seed%997)/997*Math.PI*2;
 const warpX=(noise(x*.025,z*.025,seed+817)-.5)*9,warpZ=(noise(x*.019,z*.019,seed+919)-.5)*9;
 const px=x+warpX,pz=z+warpZ;
 const shore=12+12*Math.sin(pz*.035+phase)+8*Math.sin(pz*.079-phase*.7);
 const mainland=shore-px;
 const island=(cx,cz,rx,rz)=>Math.min(rx,rz)*(1-Math.hypot((px-cx)/rx,(pz-cz)/rz));
 const north=Math.min(Math.max(island(65,-43,25,31),island(49,-59,14,15)),Math.hypot((px-78)*.8,(pz+21)*1.15)-9);
 const south=Math.min(Math.max(island(77,48,21,27),island(62,61,14,15)),Math.hypot((px-62)*1.15,(pz-36)*.8)-8);
 const coves=(noise(px*.065,pz*.065,seed+1103)-.5)*7;
 return Math.max(mainland,north,south)+coves;
}
function field(seed){if(fields.has(seed))return fields.get(seed);const values=new Float32Array(N*N);for(let z=0;z<N;z++)for(let x=0;x<N;x++)values[z*N+x]=shape(seed,x*STEP-EXTENT,z*STEP-EXTENT);fields.set(seed,values);if(fields.size>8)fields.delete(fields.keys().next().value);return values;}
function distance(seed,x,z){if(Math.abs(x)>=EXTENT||Math.abs(z)>=EXTENT)return shape(seed,x,z);const values=field(seed),gx=(x+EXTENT)/STEP,gz=(z+EXTENT)/STEP,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*N+ix;return(values[i]*(1-u)+values[i+1]*u)*(1-v)+(values[i+N]*(1-u)+values[i+N+1]*u)*v;}
const api={distance};root.BoroughCoastline=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
