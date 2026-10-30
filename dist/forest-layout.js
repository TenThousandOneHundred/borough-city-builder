(function(root){
'use strict';
// A shared, continuous woodland field crosses the playable-map boundary.
// Tree ownership still lives on saved cells, so cleared land never regrows here.
const smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
function hash(x,z,seed){let v=Math.imul(x,374761393)+Math.imul(z,668265263)+seed*31;v=Math.imul(v^(v>>>13),1274126177);return((v^(v>>>16))>>>0)/4294967295;}
function noise(x,z,seed){const a=Math.floor(x),b=Math.floor(z),u=smooth(x-a),v=smooth(z-b);return mix(mix(hash(a,b,seed),hash(a+1,b,seed),u),mix(hash(a,b+1,seed),hash(a+1,b+1,seed),u),v);}
function field(w,x,z){
 const warpX=(noise(x/110,z/110,w.seed+201)-.5)*30,warpZ=(noise(x/110,z/110,w.seed+307)-.5)*30;
 return noise((x+warpX)/62,(z+warpZ)/62,w.seed+401)*.74+noise(x/19,z/19,w.seed+503)*.26;
}
function initialize(w,n){
 const count=w.tiles.filter(t=>t.tree&&!t.type).length,half=n*2,rank=[];
 for(let i=0;i<w.tiles.length;i++){
  const t=w.tiles[i];t.tree=false;if(t.ground!=='land'||t.type)continue;
  const x=(i%n+.5)*4-half,z=(Math.floor(i/n)+.5)*4-half;
  // Feather the edges of groves without introducing a visible grid pattern.
  rank.push({i,score:field(w,x,z)+(hash(i,613,w.seed)-.5)*.14});
 }
 rank.sort((a,b)=>b.score-a.score||a.i-b.i);
 for(const r of rank.slice(0,count))w.tiles[r.i].tree=true;
 w.forest={version:1,threshold:rank[Math.min(count,rank.length)-1]?.score??1};
}
function tree(w,x,z,key,street=false){
 const stand=noise(x/43,z/43,w.seed+809),pine=stand>(w.terrain==='highlands'?.39:w.terrain==='plains'?.73:.58);
 const age=hash(key,821,w.seed),mature=4.8+noise(x/31,z/31,w.seed+827)*1.7;
 const height=age<.13?2.7+age*7:mature*(.86+age*.28);
 return [x,z,height,key%4,street,pine?'pine':'broadleaf'];
}
function pair(w,x,z,key){
 const angle=hash(key,839,w.seed)*Math.PI*2,dx=Math.cos(angle)*1.04,dz=Math.sin(angle)*1.04;
 const jx=(hash(key,853,w.seed)-.5)*.9,jz=(hash(key,857,w.seed)-.5)*.9;
 return [tree(w,x+jx+dx,z+jz+dz,key*2),tree(w,x+jx-dx,z+jz-dz,key*2+1)];
}
function valid(f){return f===undefined||!!f&&f.version===1&&Number.isFinite(f.threshold)&&f.threshold>=-.07&&f.threshold<=1.07;}
const api={hash,field,initialize,tree,pair,valid,FAR_LIMIT:1360};root.BoroughForest=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
