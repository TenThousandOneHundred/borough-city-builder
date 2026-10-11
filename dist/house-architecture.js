// Detached houses have separate wings, hip roofs, dormers and street-facing bays.
export function buildHouse(b,p,m,block,gable,plant){
 const roof=m('roof'),trim=m('concrete'),metal=m('metal'),glass=m('glass'),wall=m(p.style%2?'plaster':'masonry');
 const hip=(x,z,w,d,y,h)=>{const a=x-w/2,c=x+w/2,f=z-d/2,g=z+d/2,r=Math.min(w,d)*.23;
  const u=[x-r,y+h,z],v=[x+r,y+h,z];
  b.quad([a,y,g],[c,y,g],v,u,roof);b.quad([c,y,f],[a,y,f],u,v,roof);
  b.quad([a,y,f],[a,y,g],u,[a,y,f],roof);b.quad([c,y,g],[c,y,f],v,[c,y,g],roof);
  for(const zz of [f,g])b.box(x,y-.015,zz,w,.045,.065,metal);
 };
 const wide=p.style===0||p.style===3,ww=wide?2.45:1.8+p.variation*.35,dd=wide?1.65:2.05,x=-.18,z=-.35,h=block(x,z,ww,dd,p.floors);
 if(p.style%3===1)gable(x,z,ww+.22,dd+.22,h,.68);else hip(x,z,ww+.25,dd+.25,h,.55);
 // Secondary roof and recessed garage: distinct family silhouettes.
 if(!wide){const wingX=.95,wingZ=.14,wh=block(wingX,wingZ,.9,1.42,1);hip(wingX,wingZ,1.06,1.59,wh,.32);b.box(wingX,.31,.867,.72,.59,.025,m('wood'));for(let j=0;j<5;j++)b.box(wingX,.1+j*.105,.89,.7,.015,.016,trim);}
 else{const ph=block(-.64,.7,.75,.82,1);gable(-.64,.7,.86,.98,ph,.34);}
 // Bay window has three glass faces, trim and a small hip roof.
 if(p.style>1){b.box(x-.42,.39,z+dd/2+.12,.64,.6,.33,trim);b.box(x-.42,.41,z+dd/2+.3,.55,.43,.015,glass);for(const s of [-1,1])b.box(x-.42+s*.325,.41,z+dd/2+.1,.015,.43,.3,glass);hip(x-.42,z+dd/2+.1,.77,.5,.7,.18);}
 // Dormers rise out of the roof plane and carry their own gables.
 if(p.floors>1&&p.style!==4)for(const dx of [-.46,.4]){b.box(x+dx,h+.23,z+dd*.23,.42,.38,.5,wall);b.box(x+dx,h+.25,z+dd*.23+.26,.25,.26,.022,glass);gable(x+dx,z+dd*.23,.5,.59,h+.43,.18);}
 b.box(x+.4,.35,z+dd/2+.055,.28,.68,.09,m('wood'));
 b.box(x+.4,.04,1.24,.62,.08,1.05,trim);b.box(x+.4,.83,1.03,.8,.055,.75,roof);
 for(const s of [-1,1])b.box(x+.4+s*.34,.43,1.34,.034,.78,.034,trim);
 b.box(x-.6,h+.28,z-.5,.15,.75,.21,wall);b.box(x-.6,h+.66,z-.5,.19,.045,.25,trim);
 for(const side of [-1,1]){b.cylinder(x+side*ww*.49,0,z-dd*.49,.015,h,metal,6);for(let i=0;i<8;i++)b.box(side*1.86,.16,-1.6+i*.39,.027,.32,.03,m('wood'));b.box(side*1.86,.24,-.25,.025,.024,3,m('wood'));}
 b.box(1.16,.015,1.2,.86,.03,1.48,m('paving'));
 for(let j=0;j<5;j++)plant(-1.3+j*.4,0,1.75,.35,.25);
 // Small garden furniture, terrace slats and curb-side mailbox.
 b.box(-.8,.018,-1.68,1.32,.035,.45,m('wood'));for(let j=0;j<10;j++)b.box(-1.38+j*.13,.04,-1.68,.012,.015,.45,metal);
 b.cylinder(-.8,.04,-1.63,.11,.15,metal,10);b.cylinder(-.8,.19,-1.63,.22,.025,m('wood'),18);
 b.box(.62,.16,1.76,.022,.32,.025,metal);b.box(.62,.34,1.76,.12,.1,.16,metal);
}
