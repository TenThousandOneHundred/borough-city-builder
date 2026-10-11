import * as THREE from './vendor/three.module.js';
// Street architecture built from continuous floor outlines, not scaled boxes.
export function footprint(kind,w,d){
 const x=w/2,z=d/2,points=[];
 if(kind==='L')return [[-x,-z],[x,-z],[x,-z+d*.42],[-x+w*.43,-z+d*.42],[-x+w*.43,z],[-x,z]];
 if(kind==='U')return [[-x,-z],[x,-z],[x,z],[x-w*.27,z],[x-w*.27,-z+d*.32],[-x+w*.27,-z+d*.32],[-x+w*.27,z],[-x,z]];
 if(kind==='ellipse'){for(let i=0;i<40;i++){const a=i*Math.PI/20;points.push([Math.cos(a)*x,Math.sin(a)*z]);}return points;}
 const r=kind==='round'?Math.min(w,d)*.28:Math.min(w,d)*.085,steps=kind==='round'?8:1;
 for(let c=0;c<4;c++){const a=c*Math.PI/2,cx=(c===0||c===3?1:-1)*(x-r),cz=(c<2?1:-1)*(z-r);for(let j=0;j<=steps;j++){const t=a+j/steps*Math.PI/2;points.push([cx+Math.cos(t)*r,cz+Math.sin(t)*r]);}}
 return points;
}
export function buildUrban(b,p,m,roofwork){
 const fh=.64,W=p.lotWidth,D=p.lotDepth,style=p.style,office=p.type==='office';
 const wall=m(style===1||style===4?'masonry':'plaster'),trim=m('concrete'),metal=m('metal'),glass=m('glass'),dark=m('recess'),roof=m('roof');
 const kind=office?['chamfer','L','round','U','chamfer','ellipse'][style]:['U','L','chamfer','round','L','chamfer'][style];
 const w=W-.52,d=D-.62,shape=footprint(kind,w,d),height=p.floors*fh;
 function plate(poly,y,h,mat){
  const triangles=THREE.ShapeUtils.triangulateShape(poly.map(v=>new THREE.Vector2(...v)),[]);
  for(const t of triangles){const a=poly[t[0]],c=poly[t[1]],e=poly[t[2]];b.quad([a[0],y+h,a[1]],[e[0],y+h,e[1]],[c[0],y+h,c[1]],[a[0],y+h,a[1]],mat);}
  for(let j=0;j<poly.length;j++){const a=poly[j],c=poly[(j+1)%poly.length];b.quad([a[0],y,a[1]],[a[0],y+h,a[1]],[c[0],y+h,c[1]],[c[0],y,c[1]],mat);}
 }
 // Edge-local geometry keeps mullions and window bays constant in size on curves.
 function edge(poly,j){const a=poly[j],c=poly[(j+1)%poly.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;return {length,at:(t,y,n=0)=>[a[0]+ux*t+uz*n,y,a[1]+uz*t-ux*n]};}
 function panel(e,t0,t1,y0,y1,n,mat,color){b.quad(e.at(t0,y0,n),e.at(t0,y1,n),e.at(t1,y1,n),e.at(t1,y0,n),mat,color);}
 function beam(e,t,y,n,width,h,depth,mat){const a=t-width/2,c=t+width/2,lo=y-h/2,hi=y+h/2,f=n-depth/2,g=n+depth/2;
  panel(e,a,c,lo,hi,g,mat);b.quad(e.at(c,lo,f),e.at(c,hi,f),e.at(a,hi,f),e.at(a,lo,f),mat);
  b.quad(e.at(a,hi,g),e.at(a,hi,f),e.at(c,hi,f),e.at(c,hi,g),mat);
  b.quad(e.at(a,lo,f),e.at(a,hi,f),e.at(a,hi,g),e.at(a,lo,g),mat);b.quad(e.at(c,lo,g),e.at(c,hi,g),e.at(c,hi,f),e.at(c,lo,f),mat);
 }
 let previous=shape,top=shape;
 for(let f=0;f<p.floors;f++){
  const ratio=f/p.floors,tier=style===4?(ratio>.78?.67:ratio>.5?.83:1):style===2&&office?1-ratio*.15:1;
  top=shape.map(([x,z])=>[x*tier,z*tier]);const y=f*fh;
  if(f===0||top[0][0]!==previous[0][0])plate(previous,y-.035,.035,roof);
  const curtain=office&&(style===2||style===5)||f===0&&p.type!=='residential';
  for(let j=0;j<top.length;j++){
   const e=edge(top,j),bays=Math.max(1,Math.round(e.length/(curtain?.49:.62))),bw=e.length/bays;
   panel(e,0,e.length,y,y+fh,-.045,dark);
   beam(e,e.length/2,y+.06,0,e.length,.12,.11,curtain?metal:wall);
   beam(e,e.length/2,y+fh-.05,0,e.length,.1,.11,curtain?metal:wall);
   for(let k=0;k<bays;k++){
    const center=(k+.5)*bw,ww=bw*(curtain?.94:.72),low=y+(curtain?.085:.17),hi=y+fh-.10;
    let hash=Math.imul(f+23,73856093)^Math.imul(k+j*59+7,19349663)^p.seed;hash=Math.imul(hash^(hash>>>13),1274126177);const rnd=((hash^(hash>>>16))>>>0)/4294967296;
    const tint=.69+rnd*.31,pane=p.night&&rnd<.23?m('lit'):glass;
    panel(e,center-ww/2,center+ww/2,low,hi,-.015,pane,[tint,tint,tint]);
    beam(e,k*bw,y+fh/2,.003,curtain?.02:bw-ww,fh,.13,curtain?metal:wall);
    if(!curtain){
     beam(e,center,low-.02,.045,ww+.04,.035,.13,trim);
     beam(e,center,(low+hi)/2,.015,.012,hi-low,.035,metal);
     if(rnd>.75)panel(e,center-ww/2,center+ww/2,hi-(hi-low)*(.2+rnd*.35),hi,-.007,m('blind'));
     if(style===1||style===4){beam(e,center,hi+.035,.055,ww+.1,.065,.14,trim);}
    }
    // Cantilevered balconies with glazed railings, varied by apartment family.
    if(!office&&f>0&&style!==0&&(k+j)%3===0&&bw>.34){
     beam(e,center,y+.02,.18,bw*.87,.055,.43,trim);
     beam(e,center,y+.26,.38,bw*.87,.018,.025,metal);
     panel(e,center-bw*.4,center+bw*.4,y+.07,y+.245,.38,m('balcony'));
     for(const s of [-1,1])beam(e,center+s*bw*.41,y+.15,.38,.012,.22,.022,metal);
    }
   }
   if((style===1||style===4)&&f%3===2)beam(e,e.length/2,y+fh-.012,.06,e.length,.045,.18,trim);
  }
  previous=top;
 }
 plate(top,height-.025,.045,roof);
 for(let j=0;j<top.length;j++){const e=edge(top,j);beam(e,e.length/2,height+.11,0,e.length,.2,.075,trim);beam(e,e.length/2,height+.22,0,e.length+.025,.025,.095,metal);}
 // Roof plant sits only inside the footprint, including L and U shaped wings.
 const inside=(x,z)=>{let yes=false;for(let i=0,j=top.length-1;i<top.length;j=i++){const a=top[i],c=top[j];if((a[1]>z)!==(c[1]>z)&&x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0])yes=!yes;}return yes;};
 let roofs=0;
 for(let z=-d*.35;z<d*.4;z+=.9)for(let x=-w*.33;x<w*.4;x+=1.15){if(!inside(x-.3,z-.3)||!inside(x+.3,z+.3)||!inside(x-.3,z+.3)||!inside(x+.3,z-.3))continue;
  if(roofs>=Math.max(2,Math.floor(w*d/9))||(Math.abs(x)>w*.25&&z>d*.05))continue;
  if(roofs++%3===0){b.box(x,height+.11,z,.5,.21,.58,metal);for(let i=0;i<2;i++){b.cylinder(x+(i-.5)*.22,height+.22,z,.09,.025,dark,16);for(let k=0;k<4;k++)b.box(x+(i-.5)*.22-.075+k*.05,height+.255,z,.008,.012,.14,metal);}b.box(x+.32,height+.07,z,.3,.12,.12,metal);}
  else if(roofs%3===0){b.box(x,height+.08,z,.56,.1,.48,m('solar'));for(let k=0;k<4;k++)b.box(x-.22+k*.145,height+.134,z,.008,.009,.46,trim);}
  else{b.box(x,height+.12,z,.46,.24,.56,metal);for(let k=0;k<5;k++)b.box(x,height+.04+k*.04,z+.285,.4,.012,.014,dark);}
 }
 // Entrances, bays and canopies on the nearest road-facing facade.
 let front=0;for(let j=1;j<shape.length;j++)if((shape[j][1]+shape[(j+1)%shape.length][1])>(shape[front][1]+shape[(front+1)%shape.length][1]))front=j;
 const e=edge(shape,front);beam(e,e.length/2,.43,.07,Math.min(.65,e.length*.6),.85,.13,dark);beam(e,e.length/2,.98,.27,Math.min(1.1,e.length*.85),.035,.62,metal);
 // Vertical facade fins and a roof-level mechanical screen give office profiles depth.
 if(office&&kind!=='U'&&kind!=='L'){const e=edge(top,0);for(let k=0;k<4;k++)beam(e,e.length/2,height+.08+k*.075,-.18,Math.min(1.6,e.length*.8),.035,.05,metal);}
 return {kind,outline:shape,height};
}
