(function(root){
'use strict';
// Two points describe a line. An odd list describes connected quadratics:
// [start, handle, end, handle, end, ...]. Bounds belong to the caller.
function validControls(controls){return Array.isArray(controls)&&(controls.length===2||controls.length>=3&&controls.length<=65&&controls.length%2===1)&&controls.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));}
function legacySample(controls,density){const out=[],steps=Math.max(2,Math.ceil(controls.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-controls[i].x,p.y-controls[i].y),0)*density));for(let i=0;i<=steps;i++){const t=i/steps,u=1-t,a=controls[0],b=controls[1],c=controls[2];out.push(c?{x:u*u*a.x+2*u*t*b.x+t*t*c.x,y:u*u*a.y+2*u*t*b.y+t*t*c.y}:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})}return out;}
function sample(controls,density=10){
 if(!validControls(controls)||!Number.isFinite(density)||density<=0)return [];
 if(controls.length<=3)return legacySample(controls,density);
 const points=[];for(let i=0;i<controls.length-2;i+=2){const part=legacySample(controls.slice(i,i+3),density);for(let j=points.length?1:0;j<part.length;j++)points.push(part[j]);}return points;
}
function joinPieces(pieces){
 if(!Array.isArray(pieces)||!pieces.length||pieces.length>32||pieces.some(p=>!validControls(p)||p.length>3))return null;
 if(pieces.length===1)return pieces[0].map(p=>({x:p.x,y:p.y}));
 const controls=[];
 for(const piece of pieces){
  const a=piece[0],b=piece.at(-1),last=controls.at(-1);if(last&&(last.x!==a.x||last.y!==a.y))return null;
  if(!controls.length)controls.push({x:a.x,y:a.y});
  const handle=piece.length===3?piece[1]:{x:(a.x+b.x)/2,y:(a.y+b.y)/2};controls.push({x:handle.x,y:handle.y},{x:b.x,y:b.y});
 }return controls;
}
const api={validControls,sample,joinPieces};root.BoroughRoadCurves=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
