// Additional landscapes share one signed shoreline and relief field between
// simulation, terrain rendering and the map-selection previews.
(function(root){
'use strict';
if(root.BoroughMapTerrain){if(typeof module!=='undefined')module.exports=root.BoroughMapTerrain;return;}
const TYPES=['lake','delta','highlands','bay'],N=129,EXTENT=128,STEP=2,cache=new Map();
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function noise(x,z,seed){const hash=(a,b)=>{let n=Math.imul(a,374761393)+Math.imul(b,668265263)+Math.imul(seed,31);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};const a=Math.floor(x),b=Math.floor(z),u=ease(x-a),v=ease(z-b);return(hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;}
function shape(type,seed,x,z){
 const phase=seed%97/97*Math.PI*2,warp=(noise(x*.025,z*.025,seed+31)-.5)*5;
 let distance=100,relief=0;
 if(type==='lake'){
  distance=(Math.hypot((x-39+warp)/43,(z-9)/58)-1)*43;
  relief=2+noise(x*.018,z*.018,seed+93)*7+5*ease((Math.abs(z)-55)/40);
 }else if(type==='delta'){
  const split=ease((z+18)/90),center=22+Math.sin(z*.035+phase)*5;
  const left=center-split*26,right=center+split*29;
  distance=Math.min(Math.abs(x-left)-5,Math.abs(x-right)-4,81-z+Math.max(0,10-x)*1.3);
  relief=.8+noise(x*.026,z*.026,seed+93)*1.8+2*ease((-z-50)/55);
 }else if(type==='highlands'){
  distance=Math.abs(x-(38+Math.sin(z*.035+phase)*9))-3.5;
  const ridge=Math.exp(-(((z+54+Math.sin(x*.02)*10)/24)**2))+.8*Math.exp(-(((z-60+Math.cos(x*.025)*9)/23)**2));
  relief=ridge*(19+noise(x*.03,z*.03,seed+93)*15)+noise(x*.02,z*.02,seed+113)*2;
 }else if(type==='bay'){
  const coast=48+Math.sin(z*.026+phase)*12;
  const cove=(Math.hypot((x-39+warp)/53,(z-30)/43)-1)*43;
  distance=Math.min(coast-x,cove);
  relief=2+9*ease((Math.abs(z-25)-25)/45)+noise(x*.024,z*.024,seed+93)*5;
 }
 // The entry road and first neighborhood remain dry for every seed.
 const start=Math.min(-12-x,18-Math.abs(z-2));
 distance=Math.max(distance,start);
 return {distance,relief:relief*ease((distance-2)/14)};
}
function field(type,seed){const key=type+':'+seed;if(cache.has(key))return cache.get(key);const distance=new Float32Array(N*N),relief=new Float32Array(N*N);for(let z=0;z<N;z++)for(let x=0;x<N;x++){const v=shape(type,seed,x*STEP-EXTENT,z*STEP-EXTENT),i=z*N+x;distance[i]=v.distance;relief[i]=v.relief;}const result={distance,relief};cache.set(key,result);if(cache.size>8)cache.delete(cache.keys().next().value);return result;}
function sample(type,seed,x,z,key){if(Math.abs(x)>=EXTENT||Math.abs(z)>=EXTENT)return shape(type,seed,x,z)[key];const values=field(type,seed)[key],gx=(x+EXTENT)/STEP,gz=(z+EXTENT)/STEP,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*N+ix;return(values[i]*(1-u)+values[i+1]*u)*(1-v)+(values[i+N]*(1-u)+values[i+N+1]*u)*v;}
const api={TYPES,isNew:type=>TYPES.includes(type),distance:(type,seed,x,z)=>sample(type,seed,x,z,'distance'),relief:(type,seed,x,z)=>sample(type,seed,x,z,'relief')};root.BoroughMapTerrain=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
