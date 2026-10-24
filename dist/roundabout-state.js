(function(root){
'use strict';
// Saved footprints are also used by zoning and placement without importing the
// renderer or allocating a road plan on each brush movement.
const SIZES={small:{name:'Small',island:.75,cost:600},medium:{name:'Medium',island:1.5,cost:1200},large:{name:'Large',island:2.4,cost:2200}};
const key=j=>'junction/'+Math.round(j.x*10000)+'/'+Math.round(j.z*10000);
function shape(j,size){const spec=SIZES[size];if(!spec)return null;const lane=Math.max(1.5,...j.arms.map(a=>a.width/2));return {size,x:j.x,z:j.z,island:spec.island,outer:spec.island+.3+lane,ring:spec.island+.3+lane/2,radius:spec.island+.3+lane+1.05};}
function circles(w){return Object.values(w.roundabouts||{}).map(s=>({...s,island:SIZES[s.size].island,ring:(SIZES[s.size].island+.3+s.outer)/2,radius:s.outer+1.05}));}
function intersects(c,f,padding=.5){const dx=c.x-f.cx,dz=c.z-f.cz,co=Math.cos(f.angle||0),si=Math.sin(f.angle||0),x=Math.max(0,Math.abs(dx*co-dz*si)-(f.width||4)/2),z=Math.max(0,Math.abs(dx*si+dz*co)-(f.depth||4)/2);return x*x+z*z<(c.outer+padding)**2;}
function blocked(w,f,padding=.5){if(!w.roundabouts)return false;for(const id in w.roundabouts)if(intersects(w.roundabouts[id],f,padding))return true;return false;}
function hits(w,points,padding=1.5){return points.some(p=>blocked(w,{cx:(p.x+.5)*4-96,cz:(p.y+.5)*4-96,width:.01,depth:.01},padding));}
function valid(value){return value===undefined||!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length<=128&&Object.entries(value).every(([id,s])=>s&&Object.hasOwn(SIZES,s.size)&&[s.x,s.z,s.outer].every(Number.isFinite)&&Math.abs(s.x)<90&&Math.abs(s.z)<90&&id===key(s)&&s.outer>=SIZES[s.size].island+1.8-1e-8&&s.outer<=SIZES[s.size].island+2.7+1e-8);}
function quote(w,junctions,id,size,engine){
 const j=junctions.find(j=>key(j)===id),previous=w.roundabouts?.[id];
 if(size==='none')return previous?{ok:w.money>=50,reason:w.money<50?'Not enough funds':'',id,size,cost:50,shape:{...previous,radius:previous.outer+1.05}}:{ok:false,reason:'This intersection has no roundabout.'};
 if(!j||j.arms.length<3||!Object.hasOwn(SIZES,size))return {ok:false,reason:'Choose a junction with at least three connecting streets.'};
 const s=shape(j,size),q={id,size,shape:s,cost:SIZES[size].cost,ok:true};
 const fail=reason=>({...q,ok:false,reason});
 if(previous?.size===size)return fail('This size is already installed.');
 if(Object.keys(w.roundabouts||{}).length>=128&&!previous)return fail('Roundabout limit reached.');
 if(j.arms.some(a=>!a.spec.sidewalk||a.spec.oneway))return fail('Use two-way streets with sidewalks. Highways, gravel and one-way arms need a normal junction.');
 if(Math.abs(j.x)+s.radius+1>=96||Math.abs(j.z)+s.radius+1>=96||Math.abs(j.x)>=90||Math.abs(j.z)>=90)return fail('Keep the entire roundabout inside city limits.');
 for(let i=0;i<j.arms.length;i++){const a=j.arms[i],b=j.arms[(i+1)%j.arms.length],gap=(Math.atan2(b.tz,b.tx)-Math.atan2(a.tz,a.tx)+Math.PI*2)%(Math.PI*2);if(gap<Math.asin(a.width/2/s.outer)+Math.asin(b.width/2/s.outer)+.18)return fail('These connecting roads meet too closely. Try a larger roundabout.');}
 if(junctions.some(other=>other!==j&&Math.hypot(other.x-j.x,other.z-j.z)<s.radius+(other.roundabout?.radius||other.radius)+1))return fail('Too close to another intersection.');
 for(let i=0;i<w.tiles.length;i++){const t=w.tiles[i],f={cx:(i%48+.5)*4-96,cz:(Math.floor(i/48)+.5)*4-96,width:4,depth:4};if(!intersects(s,f,.55))continue;if(t.ground!=='land')return fail('Roundabouts need dry land.');if(t.walkPathIds?.length||t.type==='path')return fail('A pedestrian path occupies the site.');if(t.type&&t.type!=='road'||t.construction||t.zoneOwner!==undefined)return fail('An existing building or construction site occupies this space.');}
 if((w.transit?.lines||[]).some(line=>line.stops.some(i=>Math.hypot((i%48+.5)*4-96-j.x,(Math.floor(i/48)+.5)*4-96-j.z)<s.radius+2)))return fail('Move the bus stop clear of this intersection first.');
 for(const p of Object.values(w.development?.parcels||{}))if(p.occupant&&intersects(s,p.frame,.55))return fail('An existing lot occupies this space.');
 // Use terrain edits when present; the browser additionally checks sampled
 // natural ground heights through the same quotation before enabling Build.
 if(w.money<q.cost)return fail('Not enough funds');return q;
}
function apply(w,junctions,id,size,engine){const q=quote(w,junctions,id,size,engine);if(!q.ok)return q;const all={...w.roundabouts};if(size==='none')delete all[id];else{const s=q.shape;all[id]={size,x:s.x,z:s.z,outer:s.outer};}if(Object.keys(all).length)w.roundabouts=all;else delete w.roundabouts;w.money-=q.cost;w.roadEditRevision=(w.roadEditRevision||0)+1;w.walkRevision=(w.walkRevision||0)+1;if(w.development)w.development.revision++;for(let i=0;i<w.tiles.length;i++){const x=(i%48+.5)*4-96,z=(Math.floor(i/48)+.5)*4-96;if(Math.hypot(x-q.shape.x,z-q.shape.z)<q.shape.radius+2)w.tiles[i].tree=false;}return q;}
const api={SIZES,key,shape,circles,intersects,blocked,hits,valid,quote,apply};root.BoroughRoundabouts=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
