(function(root){
'use strict';
const G=typeof module!=='undefined'?require('./map-grid.js'):root.BoroughGrid;
const P=typeof module!=='undefined'?require('./progression.js'):root.BoroughProgression;
const DISTRICT=24,COST=2,REWARDS=[0,2,2,3,3,4,4],EXTRA_LARGE_REWARDS=[0,2,4,4,6,6,8];
const columns=w=>G.size(w)/DISTRICT;
const start=w=>Math.floor(G.size(w)/2/DISTRICT)*columns(w);
// Keep existing-city receipts unchanged; larger regions earn enough for all 15 purchases.
const rewards=w=>G.size(w)===96?EXTRA_LARGE_REWARDS:REWARDS;
const reward=(w,level)=>rewards(w)[level]||0;
const earned=(level,w)=>rewards(w).slice(0,level+1).reduce((a,b)=>a+b,0);
function initialize(w){const n=columns(w);w.land={version:1,owned:P.active(w)?[start(w)]:Array.from({length:n*n},(_,i)=>i),merits:0,awarded:0,free:P.active(w)?0:n*n-1};}
function ownsCell(w,x,y){const n=G.size(w);if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=n||y>=n)return false;return !w.land||w.land.owned.includes(Math.floor(y/DISTRICT)*columns(w)+Math.floor(x/DISTRICT));}
function ownsPoint(w,x,z,padding=0){const n=G.size(w),h=n*2;if(Math.abs(x)>h||Math.abs(z)>h)return false;const clamp=v=>Math.max(0,Math.min(n-.00001,v));for(const dx of [-padding,padding])for(const dz of [-padding,padding])if(!ownsCell(w,clamp((x+dx+h)/4),clamp((z+dz+h)/4)))return false;return true;}
function ownsFrame(w,f){const c=Math.abs(Math.cos(f.angle||0)),s=Math.abs(Math.sin(f.angle||0)),x=(f.width*c+f.depth*s)/2,z=(f.width*s+f.depth*c)/2,h=G.size(w)*2;
 for(let yy=Math.floor((f.cz-z+h)/4);yy<=Math.floor((f.cz+z+h-.0001)/4);yy++)for(let xx=Math.floor((f.cx-x+h)/4);xx<=Math.floor((f.cx+x+h-.0001)/4);xx++)if(!ownsCell(w,xx,yy))return false;return true;
}
function adjacent(w,id){const n=columns(w),x=id%n,y=Math.floor(id/n);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>a>=0&&b>=0&&a<n&&b<n&&w.land.owned.includes(b*n+a));}
function quoteMany(w,ids){
 if(!w.land)return {ok:false,reason:'This city already owns all its land.'};
 const n=columns(w);if(!Array.isArray(ids)||!ids.length)return {ok:false,reason:'Select land tiles on the map.'};
 if(new Set(ids).size!==ids.length||!ids.every(id=>Number.isInteger(id)&&id>=0&&id<n*n))return {ok:false,reason:'Choose valid, distinct map tiles.'};
 if(ids.some(id=>w.land.owned.includes(id)))return {ok:false,reason:'Already owned.'};
 const cost=ids.length*COST;if(w.land.merits<cost)return {ok:false,cost,reason:'Earn more merits by reaching city milestones.'};return {ok:true,cost};
}
function quote(w,id){return quoteMany(w,[id]);}
function buyMany(w,ids){const q=quoteMany(w,ids);if(!q.ok)return q;w.land.owned.push(...ids);w.land.owned.sort((a,b)=>a-b);w.land.merits-=q.cost;return q;}
function buy(w,id){return buyMany(w,[id]);}
function award(w){if(!w.land||!P.active(w))return 0;const level=w.progression.level,amount=earned(level,w)-earned(w.land.awarded,w);if(amount>0){w.land.merits+=amount;w.land.awarded=level;}return amount;}
function valid(w){const l=w.land;if(l===undefined)return true;const n=columns(w);if(!l||l.version!==1||!Array.isArray(l.owned)||!l.owned.length||l.owned.length>n*n||new Set(l.owned).size!==l.owned.length||!l.owned.every(i=>Number.isInteger(i)&&i>=0&&i<n*n)||!l.owned.includes(start(w))||!Number.isSafeInteger(l.merits)||l.merits<0||!Number.isInteger(l.awarded)||l.awarded<0||l.awarded>6)return false;
 if(!Number.isInteger(l.free??0)||(l.free??0)<0||(l.free??0)>l.owned.length-1)return false;
 if(!P.active(w))return l.owned.length===n*n&&l.merits===0&&l.awarded===0;
 if(l.awarded>w.progression.level||l.merits!==earned(l.awarded,w)-COST*(l.owned.length-1-(l.free||0)))return false;
 return true;
}
const api={DISTRICT,COST,REWARDS,reward,columns,start,earned,initialize,ownsCell,ownsPoint,ownsFrame,adjacent,quote,quoteMany,buy,buyMany,award,valid};root.BoroughLand=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
