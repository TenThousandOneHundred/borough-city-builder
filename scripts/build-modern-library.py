"""Bake original modern architecture as a self-contained, material-batched GLB.
Dimensions are metres. Facades have inset glazing, floor slabs and mullions;
setbacks, balconies and rooftop plant are geometry rather than painted boxes.
No commercial-game assets or dependencies are used.
"""
import math, json, struct, pathlib, io
from PIL import Image, ImageDraw, ImageFont
from collections import defaultdict
ROOT=pathlib.Path(__file__).resolve().parents[1]
materials=[
 ('modern-concrete',[.43,.45,.42,1],0,.84),
 ('modern-glass',[.10,.18,.21,1],.68,.18),
 ('modern-frame',[.10,.13,.14,1],.6,.35),
 ('modern-roof',[.42,.44,.42,1],0,.93),
 ('modern-wood',[.39,.29,.19,1],0,.8),
 ('modern-leaves',[.22,.31,.16,1],0,1),
 ('modern-recess',[.09,.12,.14,1],0,.9),
 ('modern-blind',[.47,.45,.39,1],0,.94),
 ('modern-glass-occupied',[.10,.18,.21,1],.68,.18),
 ('modern-brick',[.88,.86,.82,1],0,.9),
 ('modern-painted',[.84,.86,.83,1],0,.78),
 ('modern-shop-glass',[.55,.65,.66,.38],.1,.18),
 ('modern-shop-sign',[1,1,1,1],0,.82),
]
CONCRETE,GLASS,FRAME,ROOF,WOOD,LEAVES,RECESS,BLIND,OCCUPIED,BRICK,PAINT,SHOP_GLASS,SIGN=range(len(materials))
models=[]
class Model:
 def __init__(self,name,category,floors,building=None):
  self.name,self.category,self.floors=name,category,floors;self.building=building;self.site=False;self.houseForm=None;self.roofForm=None;self.detail=False;self.gardens=[];self.streetFronts=[];self.parts=defaultdict(lambda:{'p':[],'n':[],'uv':[],'c':[],'i':[],'far':[]})
 def quad(self,a,b,c,d,mat,color=(1,1,1),uvs=None):
  part=self.parts[mat];start=len(part['p'])//3;u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];length=math.sqrt(sum(x*x for x in n))
  if length<1e-8:return
  n=[x/length for x in n]
  uw=math.sqrt(sum(t*t for t in u))/2 if mat==BRICK else 1;vh=math.dist(b,c)/2 if mat==BRICK else 1
  for pos,uv in zip([a,b,c,d],uvs or [(0,0),(uw,0),(uw,vh),(0,vh)]):part['p']+=list(pos);part['n']+=n;part['uv']+=list(uv);part['c']+=list(color)
  indices=[start,start+1,start+2]+([start,start+2,start+3] if a!=d else [])
  part['i']+=indices
  if not self.detail:part['far']+=indices
 def box(self,x,y,z,w,h,d,mat=CONCRETE,color=(1,1,1)):
  a,b=x-w/2,x+w/2;c,e=y,y+h;f,g=z-d/2,z+d/2
  for q in [((a,c,g),(b,c,g),(b,e,g),(a,e,g)),((b,c,f),(a,c,f),(a,e,f),(b,e,f)),((b,c,g),(b,c,f),(b,e,f),(b,e,g)),((a,c,f),(a,c,g),(a,e,g),(a,e,f)),((a,e,g),(b,e,g),(b,e,f),(a,e,f))]:self.quad(*q,mat,color)
 def ring(self,w,d,bevel=.7,x=0,z=0):
  # Counterclockwise viewed from above. Bevels soften corners without expensive curves.
  r=min(bevel,w/3,d/3);return [(x+a,z+b) for a,b in [(-w/2+r,-d/2),(w/2-r,-d/2),(w/2,-d/2+r),(w/2,d/2-r),(w/2-r,d/2),(-w/2+r,d/2),(-w/2,d/2-r),(-w/2,-d/2+r)]]
 def surface(self,points,y,mat,color=(1,1,1)):
  cx=sum(p[0] for p in points)/len(points);cz=sum(p[1] for p in points)/len(points)
  for a,b in zip(points,points[1:]+points[:1]):self.quad((cx,y,cz),(b[0],y,b[1]),(a[0],y,a[1]),(cx,y,cz),mat,color)
 def band(self,points,y,h,mat=CONCRETE,color=(1,1,1)):
  for a,b in zip(points,points[1:]+points[:1]):self.quad((b[0],y,b[1]),(a[0],y,a[1]),(a[0],y+h,a[1]),(b[0],y+h,b[1]),mat,color)
  self.surface(points,y+h,mat,color)
 def shell(self,w,d,floors,x=0,z=0,y=0,bevel=.7,balconies=False,curtain=False,oval=False,tint=(1,1,1),cladding=CONCRETE,windowWidth=None):
  points=([(x+w/2*math.cos(j*math.tau/32),z+d/2*math.sin(j*math.tau/32)) for j in range(32)] if oval else self.ring(w,d,bevel,x,z))
  fh=3.2;top=y+floors*fh
  # Recessed dark walls sit behind individual panes and facade structure.
  for side,(a,b) in enumerate(zip(points,points[1:]+points[:1])):
   dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz);tx,tz=dx/length,dz/length;nx,nz=tz,-tx
   def p(u,v,out=0):return (a[0]+tx*u+nx*out,v,a[1]+tz*u+nz*out)
   if windowWidth and length<.5:
    self.quad(p(length,y),p(0,y),p(0,top),p(length,top),cladding,tint);continue
   front=nz>.9 and length>3 and y==0
   shop=front and self.category=='commercial'
   # Ground-floor shop windows have shallow rooms behind real glazing.
   # Upper windows retain their existing opaque/reflected glazing and detail.
   if not shop or floors>1:self.quad(p(length,y+fh if shop else y,-.1),p(0,y+fh if shop else y,-.1),p(0,top,-.1),p(length,top,-.1),RECESS)
   bays=max(1,round(length/(1.6 if curtain else 3.4 if windowWidth else 2.6)));bay=length/bays
   for f in range(floors):
    level=y+f*fh;retail=shop and f==0;bottom=.12 if retail else .32 if curtain else .75;upper=.55 if retail else .13 if curtain else .38
    for lo,hi in [(level,level+bottom),(level+fh-upper,level+fh)]:self.quad(p(length,lo,.025),p(0,lo,.025),p(0,hi,.025),p(length,hi,.025),FRAME if curtain else cladding,(1,1,1) if curtain else tint)
    for j in range(bays):
     margin=.045 if curtain else max(.24,(bay-windowWidth)/2) if windowWidth else .24;l=j*bay+margin;r=(j+1)*bay-margin;shade=.74+((j*17+f*31+side*11)%19)/65
     door=front and f==0 and (j%3==1 if retail else j==bays//2)
     sill=.08 if door else bottom
     if retail:
      self.shop_room(p,l,r,level,fh-upper,j,door)
      material=SHOP_GLASS
     else:material=OCCUPIED if (j*17+f*31+side*11)%4==1 else GLASS
     # A door overlays the low sill band so the opening reaches its threshold.
     self.quad(p(r,level+sill,.035 if door else -.035),p(l,level+sill,.035 if door else -.035),p(l,level+fh-upper,.035 if door else -.035),p(r,level+fh-upper,.035 if door else -.035),material,(shade,shade,min(1,shade+.04)))
     if door:
      centre=(l+r)/2
      self.streetFronts.append({'kind':'shop' if retail else 'entrance','position':list(p(centre,level+.08,.08)),'normal':[nx,nz],'width':r-l})
      for u in [l,r,centre]:self.quad(p(u+.035,level+.08,.085),p(u-.035,level+.08,.085),p(u-.035,level+fh-upper,.085),p(u+.035,level+fh-upper,.085),FRAME)
      self.quad(p(r,level+.08,.12),p(l,level+.08,.12),p(l,level+.08,-.02),p(r,level+.08,-.02),CONCRETE)
      self.detail=True
      for u in [centre-.14,centre+.14]:self.quad(p(u+.02,level+1,.13),p(u-.02,level+1,.13),p(u-.02,level+1.5,.13),p(u+.02,level+1.5,.13),CONCRETE)
      self.detail=False
     if retail and j%3==0:
      sl=j*bay+margin;sr=min(bays,j+3)*bay-margin
      band=abs(sum(ord(c) for c in self.name)+j//3)%4;v0=(band+.06)/4;v1=(band+.94)/4
      self.quad(p(sl,level+3.1,.02),p(sr,level+3.1,.02),p(sr,level+3.1,.85),p(sl,level+3.1,.85),FRAME)
      for u in [sl,sr]:self.quad(p(u,level+2.73,.02),p(u,level+2.73,.85),p(u,level+3.1,.85),p(u,level+3.1,.02),FRAME)
      self.quad(p(sr,level+2.73,.86),p(sl,level+2.73,.86),p(sl,level+3.08,.86),p(sr,level+3.08,.86),SIGN,uvs=[(0,v1),(1,v1),(1,v0),(0,v0)])
     if (j*17+f*31+side*11)%9<2 and f>0:
      blindtop=level+fh-upper;blindbottom=blindtop-(fh-bottom-upper)*.36
      self.quad(p(r,blindbottom,-.026),p(l,blindbottom,-.026),p(l,blindtop,-.026),p(r,blindtop,-.026),BLIND,(shade,shade,shade))
     # Shallow recess returns make window openings read in direct sunlight.
     if not curtain and not door:
      self.detail=True
      self.quad(p(l,level+bottom-.07,.14),p(r,level+bottom-.07,.14),p(r,level+bottom,-.07),p(l,level+bottom,-.07),CONCRETE,tint)
      self.quad(p(r,level+fh-upper,.03),p(l,level+fh-upper,.03),p(l,level+fh-upper,-.07),p(r,level+fh-upper,-.07),CONCRETE,tint)
      self.detail=False
      for u,sign in [(l,-1),(r,1)]:self.quad(p(u,level+bottom,.03),p(u,level+bottom,-.07),p(u,level+fh-upper,-.07),p(u,level+fh-upper,.03),CONCRETE,(.78,.79,.76))
    if balconies and length>5 and f>0 and side%2==0:
     # Slabs and framed balcony panels project from selected faces, not all faces.
     l=.45;r=length-.45;out=1.05;h=level+.12
     self.quad(p(l,h,.02),p(r,h,.02),p(r,h,out),p(l,h,out),CONCRETE)
     self.quad(p(r,h,out),p(l,h,out),p(l,h+.12,out),p(r,h+.12,out),CONCRETE)
     self.quad(p(r,h+.15,out-.04),p(l,h+.15,out-.04),p(l,h+1.0,out-.04),p(r,h+1.0,out-.04),GLASS,(.72,.77,.78))
     self.quad(p(r,h+1.0,out),p(l,h+1.0,out),p(l,h+1.07,out),p(r,h+1.07,out),FRAME)
     self.detail=True
     for edge in [l,r]:self.quad(p(edge,h+.15,.06),p(edge,h+.15,out),p(edge,h+1,out),p(edge,h+1,.06),GLASS)
     for j in range(1,bays):
      u=j*bay;self.quad(p(u,h+.12,.04),p(u,h+.12,out),p(u,h+1.55,out),p(u,h+1.55,.04),FRAME,(.72,.75,.73))
     self.detail=False
   self.detail=False
   # Continuous narrow mullions do not duplicate geometry at every floor.
   for j in range(bays+1):
    u=j*bay;half=.045 if curtain else max(.22,(bay-windowWidth)/2) if windowWidth else .22;l=max(0,u-half);r=min(length,u+half)
    self.quad(p(r,y,.06),p(l,y,.06),p(l,top,.06),p(r,top,.06),FRAME if curtain else cladding,(1,1,1) if curtain else tint)
  # A raised, hollow parapet has an inner face and coping instead of a
  # solid cap. The membrane remains below its rim and catches roof shadows.
  inner=[(x+(px-x)*max(0,1-.5/w),z+(pz-z)*max(0,1-.5/d)) for px,pz in points]
  self.surface(inner,top+.04,ROOF)
  for i,(a,b) in enumerate(zip(points,points[1:]+points[:1])):
   c,e=inner[i],inner[(i+1)%len(inner)]
   self.quad((b[0],top,b[1]),(a[0],top,a[1]),(a[0],top+.65,a[1]),(b[0],top+.65,b[1]),cladding,tint)
   self.quad((c[0],top,c[1]),(e[0],top,e[1]),(e[0],top+.65,e[1]),(c[0],top+.65,c[1]),CONCRETE,tint)
   self.quad((a[0],top+.65,a[1]),(c[0],top+.65,c[1]),(e[0],top+.65,e[1]),(b[0],top+.65,b[1]),CONCRETE,tint)
  return top
 def shop_room(self,p,l,r,y,top,variant,door=False):
  # An opaque room back survives in distant topology; small furniture can drop.
  warm=[(.68,.64,.53),(.57,.63,.59),(.64,.59,.53),(.52,.60,.65)][variant%4]
  self.quad(p(r,y+.1,-.9),p(l,y+.1,-.9),p(l,y+top,-.9),p(r,y+top,-.9),RECESS,warm)
  for u in [l,r]:
   corners=[p(u,y+.1,-.03),p(u,y+.1,-.9),p(u,y+top,-.9),p(u,y+top,-.03)]
   self.quad(*(corners[::-1] if u==l else corners),RECESS,warm)
  self.quad(p(l,y+.1,-.9),p(r,y+.1,-.9),p(r,y+.1,-.02),p(l,y+.1,-.02),WOOD)
  self.quad(p(r,y+top,-.9),p(l,y+top,-.9),p(l,y+top,-.02),p(r,y+top,-.02),PAINT)
  if door:return
  self.detail=True
  for h in [.65,1.25,1.85]:
   self.quad(p(r-.12,y+h,-.67),p(l+.12,y+h,-.67),p(l+.12,y+h+.09,-.67),p(r-.12,y+h+.09,-.67),WOOD)
   for n in range(3):
    u=l+(n+.5)*(r-l)/3;w=min(.24,(r-l)/5)
    self.quad(p(u+w/2,y+h+.09,-.7),p(u-w/2,y+h+.09,-.7),p(u-w/2,y+h+.36,-.7),p(u+w/2,y+h+.36,-.7),PAINT,[(.68,.42,.28),(.35,.51,.48),(.78,.71,.48)][n])
  self.detail=False
 def plant(self,x,y,z,w,d):
  self.box(x,y,z,w,.45,d,CONCRETE)
  large=min(w,d)>=1.5
  self.box(x,y+.45,z,w-.15,.08 if large else .45,d-.15,LEAVES)
  if large:self.gardens.append({'x':x,'y':y+.53,'z':z,'w':w-.3,'d':d-.3})
 def cylinder(self,x,y,z,r,h,mat,sides=12):
  ring=[(x+r*math.cos(i*math.tau/sides),z+r*math.sin(i*math.tau/sides)) for i in range(sides)]
  self.band(ring,y,h,mat)
 def roofwork(self,x,y,z,w=5,d=3):
  self.box(x,y+.12,z,w,1.2,d,FRAME)
  self.detail=True
  for sx in [-.25,.25]:
   r=min(w*.19,d*.35);cx=x+w*sx
   self.cylinder(cx,y+1.32,z,r,.12,CONCRETE)
   self.cylinder(cx,y+1.445,z,r*.8,.015,RECESS)
   for angle in [0,math.pi/3,2*math.pi/3]:
    dx,dz=math.cos(angle)*r*.7,math.sin(angle)*r*.7
    self.quad((cx-dx,y+1.47,z-dz),(cx-dz*.12,y+1.47,z+dx*.12),(cx+dx,y+1.47,z+dz),(cx+dz*.12,y+1.47,z-dx*.12),FRAME)
  self.detail=False
  self.box(x+w*.7,y,z,w*.3,1.1,d*.4,CONCRETE)
 def terrace(self,x,y,z,w=8,d=5):
  self.box(x,y+.05,z,w,.08,d,WOOD,(.85,.89,.9))
  for dx in [-w/2+.4,w/2-.4]:
   self.plant(x+dx,y+.14,z,.65,d-1)
  # Light pergola casts broken shadows over benches and tables.
  self.detail=True
  for dx in [-w*.32,w*.32]:
   for dz in [-d*.33,d*.33]:self.box(x+dx,y+.14,z+dz,.12,2.4,.12,FRAME)
  for i in range(7):self.box(x-w*.4+i*w*.8/6,y+2.54,z,.12,.12,d*.85,WOOD)
  for dz in [-1,1]:self.box(x,y+.6,z+dz,w*.4,.15,.45,WOOD)
  self.box(x,y+.14,z,.15,.85,.15,FRAME);self.box(x,y+.99,z,1.6,.10,1.2,WOOD)
  self.detail=False
 def entrance(self,z,x=0):
  self.box(x,3.0,z,3.6,.12,2.3,FRAME);self.box(x,0,z-.5,3.8,.18,2.1,CONCRETE)
  for sx in [-1.5,1.5]:self.box(x+sx,0,z+.5,.10,3,.10,FRAME)
 def finish(self):models.append(self)

# Domestic architecture has smaller, individually framed openings, pitched
# roof planes and human-scale covered entries. Dimensions remain in metres.
def dwelling(name,w,d,floors,form='detached',roof='gable',tint=(.85,.88,.80),brick=False,siding=False,porch=True):
 m=Model(name,'residential-low',floors);m.houseForm=form;m.roofForm=roof
 domestic_block(m,w,d,floors,tint=tint,brick=brick,siding=siding,paired=form=='semi',attached=form=='terrace')
 pitched_roof(m,0,0,w,d,floors*2.85,2.1 if floors==1 else 2.7,hip=min(w,d)*.23 if roof=='hip' else 0,tint=(.82,.83,.79) if brick else (.74,.78,.79),attached=form=='terrace')
 if porch:
  for front in list(m.streetFronts):covered_entry(m,front['position'][0],d/2+.95,3.1,1.9)
 # Chimney, vent cap and rainwater pipes break the silhouette at realistic scale.
 m.box(-w*.26,floors*2.85+1.1,-d*.26,.65,2.0,.75,BRICK)
 m.box(-w*.26,floors*2.85+3.1,-d*.26,.82,.14,.92,CONCRETE)
 return m

def domestic_block(m,w,d,floors,x=0,z=0,tint=(.8,.84,.78),brick=False,siding=False,paired=False,attached=False):
 h=floors*2.85;cladding=BRICK if brick else PAINT
 points=[(x-w/2,z-d/2),(x+w/2,z-d/2),(x+w/2,z+d/2),(x-w/2,z+d/2)]
 m.box(x,0,z,w if attached else w+.10,.16,d+.10,CONCRETE,(.8,.8,.75))
 for side,(a,b) in enumerate(zip(points,points[1:]+points[:1])):
  dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz);tx,tz=dx/length,dz/length;nx,nz=tz,-tx;front=nz>.9
  def p(u,y,out=0):return(a[0]+tx*u+nx*out,y,a[1]+tz*u+nz*out)
  def panel(l,r,lo,hi):
   if hi<=lo or r<=l:return
   if not siding:m.quad(p(r,lo,.02),p(l,lo,.02),p(l,hi,.02),p(r,hi,.02),cladding,tint);return
   n=max(1,math.ceil((hi-lo)/.19))
   for k in range(n):
    y0=lo+(hi-lo)*k/n;y1=lo+(hi-lo)*(k+1)/n;c=tuple(v*(.96+(k*13+side*7)%9*.008) for v in tint)
    m.quad(p(r,y0,.04),p(l,y0,.04),p(l,y1,.015),p(r,y1,.015),PAINT,c)
  if attached and abs(nx)>.9:
   m.quad(p(length,0),p(0,0),p(0,h),p(length,h),cladding,tint);continue
  bays=max(2,round(length/3.2));bay=length/bays
  for f in range(floors):
   base=f*2.85
   for j in range(bays):
    door=front and f==0 and (j in [0,bays-1] if paired else j==bays//2)
    centre=(j+.5)*bay;opening=1.0 if door else min(1.45,bay-.65);l=centre-opening/2;r=centre+opening/2;lo=base+(.08 if door else .86);hi=base+(2.2 if door else 2.28)
    panel(j*bay,l,base,base+2.85);panel(r,(j+1)*bay,base,base+2.85);panel(l,r,base,lo);panel(l,r,hi,base+2.85)
    m.quad(p(r,lo,-.12),p(l,lo,-.12),p(l,hi,-.12),p(r,hi,-.12),WOOD if door else OCCUPIED if (j+side+f)%4==0 else GLASS,(.75,.79,.79))
    for u in [l,r]:m.quad(p(u,lo,.035),p(u,lo,-.12),p(u,hi,-.12),p(u,hi,.035),CONCRETE,(.70,.72,.69))
    for u in [l-.055,r+.055]:m.quad(p(u+.055,lo-.055,.065),p(u-.055,lo-.055,.065),p(u-.055,hi+.055,.065),p(u+.055,hi+.055,.065),PAINT)
    for y in [lo-.055,hi+.055]:m.quad(p(r+.11,y-.055,.07),p(l-.11,y-.055,.07),p(l-.11,y+.055,.07),p(r+.11,y+.055,.07),PAINT)
    if door:
     m.streetFronts.append({'kind':'entrance','position':list(p(centre,.08,.08)),'normal':[nx,nz],'width':opening})
     m.quad(p(r-.15,1.12,-.09),p(r-.20,1.12,-.09),p(r-.20,1.25,-.09),p(r-.15,1.25,-.09),FRAME)
     m.quad(p(r-.15,1.35,-.10),p(l+.15,1.35,-.10),p(l+.15,2.02,-.10),p(r-.15,2.02,-.10),GLASS)
    else:
     # Central sash and projecting sill remain separate from recessed glass.
     m.quad(p(centre+.022,lo,-.06),p(centre-.022,lo,-.06),p(centre-.022,hi,-.06),p(centre+.022,hi,-.06),PAINT)
     m.quad(p(r,base+1.52,-.06),p(l,base+1.52,-.06),p(l,base+1.565,-.06),p(r,base+1.565,-.06),PAINT)
     m.detail=True;m.quad(p(l-.14,lo-.08,.19),p(r+.14,lo-.08,.19),p(r+.14,lo-.08,-.04),p(l-.14,lo-.08,-.04),CONCRETE);m.detail=False
 return h

def pitched_roof(m,x,z,w,d,y,rise,hip=0,tint=(.78,.81,.82),gutters=True,attached=False):
 W=w-.12 if attached else w+.7;D=d+.7;a=(x-W/2,y,z+D/2);b=(x+W/2,y,z+D/2);c=(x+W/2,y,z-D/2);e=(x-W/2,y,z-D/2);rf=(x,y+rise,z+D/2-hip);rb=(x,y+rise,z-D/2+hip)
 def facet(q):
  # Roof texture coordinates use physical distance, not one image per roof.
  u=math.dist(q[0],q[1])/2;v=math.dist(q[1],q[2])/2;m.quad(*q,ROOF,tint,uvs=[(0,0),(u,0),(u,v),(0,v)])
 facet([a,rf,rb,e]);facet([b,c,rb,rf])
 if hip:facet([a,b,rf,a]);facet([c,e,rb,c])
 else:
  # Solid gable ends support the two roof planes beneath the overhang.
  front=z+d/2;back=z-d/2
  m.quad((x-w/2,y,front),(x+w/2,y,front),(x,y+rise,front),(x-w/2,y,front),PAINT,(.78,.80,.74))
  m.quad((x+w/2,y,back),(x-w/2,y,back),(x,y+rise,back),(x+w/2,y,back),PAINT,(.78,.80,.74))
 # Fascia boards and a ridge cap are retained at all distances.
 for side in [-1,1]:m.box(x+side*W/2,y-.13,z,.12,.18,D,PAINT,(.75,.78,.74))
 m.box(x,y+rise-.025,z,.15,.12,max(.15,D-2*hip),ROOF,tint)
 # Overlapping courses follow the roof slope. They drop from distant topology,
 # while the full roof planes, ridge, windows and walls remain unchanged.
 m.detail=True
 for side in [-1,1]:
  rows=max(4,round(math.hypot(W/2,rise)/.24))
  for k in range(1,rows):
   t=k/rows;xx=x+side*W/2*(1-t);yy=y+rise*t+.018;z0=z-D/2+hip*t;z1=z+D/2-hip*t
   course=[(xx,yy,z0),(xx,yy,z1),(xx+side*.032,yy-.008,z1),(xx+side*.032,yy-.008,z0)]
   m.quad(*(course if side>0 else course[::-1]),ROOF,tuple(v*.7 for v in tint))
 if gutters and not attached:
  for side in [-1,1]:
   m.box(x+side*(W/2+.035),y-.05,z,.10,.10,D,FRAME)
   m.cylinder(x+side*(w/2+.07),.06,z-d/2+.20,.045,max(.1,y-.11),FRAME,6)
 m.detail=False

def covered_entry(m,x,z,w,d):
 m.box(x,.025,z,w,.14,d,WOOD,(.85,.9,.87))
 for dx in [-w/2+.16,w/2-.16]:m.box(x+dx,.16,z+d/2-.16,.14,2.4,.14,PAINT)
 pitched_roof(m,x,z,w,d,2.62,.7,hip=0,tint=(.74,.78,.79),gutters=False)
 for k in range(2):m.box(x,.02+k*.055,z+d/2+.18-k*.14,1.35,.055,.28,CONCRETE)

def dormer(m,x,z,y):
 m.box(x,y,z,1.8,1.45,2.2,PAINT,(.73,.78,.74));m.box(x,y+.35,z+1.11,1.04,.87,.035,GLASS);m.box(x,y+.33,z+1.14,1.19,.075,.09,PAINT)
 for dx in [-.56,.56]:m.box(x+dx,y+.33,z+1.15,.08,.98,.10,PAINT)
 m.box(x,y+1.26,z+1.15,1.19,.08,.1,PAINT);pitched_roof(m,x,z,1.8,2.2,y+1.45,.65,gutters=False)

m=dwelling('gabled-garden-cottage',8.4,10.4,1,tint=(.72,.81,.80),siding=True);m.finish()
m=dwelling('hipped-brick-bungalow',11,10,1,roof='hip',tint=(.90,.74,.60),brick=True);m.finish()
m=dwelling('dormer-detached-home',8.5,11,2,tint=(.90,.85,.72),siding=True);dormer(m,-2.2,1,6.6);m.finish()
m=dwelling('covered-porch-family-home',10,10.8,2,tint=(.70,.78,.84),siding=True,porch=False);covered_entry(m,-1.7,6.1,6.6,2.4);m.finish()
m=dwelling('cross-gable-family-home',8.2,10,2,tint=(.85,.78,.67),brick=True);domestic_block(m,5,6,1,x=5,z=-1,tint=(.79,.81,.74));pitched_roof(m,5,-1,5,6,2.85,1.6);m.finish()
m=dwelling('brick-paired-homes',12,11,2,form='semi',roof='hip',tint=(.88,.67,.54),brick=True);m.finish()
m=dwelling('narrow-gabled-townhouse',6.6,12,2,form='terrace',tint=(.76,.77,.73),brick=True);dormer(m,-1.5,1,6.65);m.finish()
m=dwelling('garden-wing-bungalow',9,10,1,tint=(.83,.86,.77),siding=True);domestic_block(m,5,7,1,x=5.5,z=-1.5,tint=(.7,.76,.78),siding=True);pitched_roof(m,5.5,-1.5,5,7,2.85,1.5,hip=1.1);m.finish()

m=Model('glass-podium-offices','office',21);h=m.shell(25,21,3,curtain=True);h=m.shell(16,14,18,x=-2,z=-1,y=h,bevel=2,curtain=True);m.roofwork(-2,h,-1);m.plant(9,9.85,6,3,4);m.entrance(11);m.finish()
m=Model('stepped-concrete-offices','office',18);h=m.shell(24,20,3);h=m.shell(21,17,7,y=h,curtain=True);h=m.shell(16,13,5,x=-2,y=h,curtain=True);h=m.shell(11,9,3,x=-3,y=h,curtain=True);m.roofwork(-3,h,0,4,2);m.plant(8,32.3,4,2,5);m.entrance(10.5);m.finish()
m=Model('elliptic-glass-offices','office',19);h=m.shell(23,19,2,bevel=3);h=m.shell(19,15,17,y=h,curtain=True,oval=True);m.roofwork(0,h,0);m.entrance(10);m.finish()
m=Model('slender-glass-offices','office',23);h=m.shell(11,13,23,bevel=1.3,curtain=True);m.roofwork(0,h,0,4,2);m.entrance(7);m.finish()
m=Model('garden-terrace-residences','residential',9);h=m.shell(24,18,4,balconies=True);m.plant(9,h+.3,4,2,7);h=m.shell(18,15,3,x=-2,y=h,balconies=True);m.plant(4,h+.3,3,2,5);h=m.shell(12,11,2,x=-4,y=h);m.roofwork(-4,h,0,3,2);m.entrance(10);m.finish()
m=Model('balcony-podium-residences','residential',17);h=m.shell(22,19,3,curtain=True);h=m.shell(14,13,14,x=-1,y=h,bevel=1.2,balconies=True);m.roofwork(-1,h,0);m.plant(8,9.9,5,2,4);m.entrance(10);m.finish()
m=Model('split-wing-residences','residential',10);h=m.shell(10,20,7,x=-6,balconies=True);m.roofwork(-6,h,0,3,2);h=m.shell(11,13,10,x=5,z=-3,balconies=True);m.roofwork(5,h,-3,3,2);m.shell(8,7,2,x=4,z=7,curtain=True);m.plant(5,6.7,7,5,3);m.entrance(11,-5);m.finish()
m=Model('courtyard-concrete-residences','residential',6);m.shell(8,24,6,x=-8);m.shell(8,24,5,x=8);h=m.shell(8,8,4,z=-8);m.roofwork(0,h,-8,3,2);m.plant(0,0,0,5,8);m.entrance(12,-8);m.finish()
# Purpose-built compact-apartment blocks: narrow repeated dwelling bays,
# opaque balcony fronts, distinct stair cores and shared entrances. These use
# the same material palette/LOD pipeline as the city instead of new textures.
def lowrent_block(name,width,depth,floors,tint):
 m=Model(name,'residential',floors,building='lowrent')
 # Two staggered wings form a sheltered entrance court at street level.
 wing=width*.56; offset=(width-wing)/2
 for x,z in [(-offset,-depth*.18),(offset,depth*.18)]:
  h=m.shell(wing,depth*.58,1,x=x,z=z,bevel=.15,tint=(.65,.45,.32),cladding=BRICK,windowWidth=1.4)
  h=m.shell(wing,depth*.58,floors-1,x=x,z=z,y=h,bevel=.15,tint=tint,cladding=PAINT,windowWidth=1.4)
  # Solid balcony screens, privacy partitions and metal handrails read as
  # small separate flats rather than a continuous glass office facade.
  front=z+depth*.29
  for floor in range(1,floors):
   y=floor*3.2+.10
   for bay in range(max(2,int(wing/4))):
    span=wing/max(2,int(wing/4));bx=x-wing/2+(bay+.5)*span
    m.box(bx,y,front+.7,span-.35,.14,1.4,CONCRETE,(.82,.82,.75))
    m.box(bx,y+.14,front+1.34,span-.35,.72,.10,PAINT,tint)
    m.detail=True
    m.box(bx,y+1.05,front+1.34,span-.35,.045,.045,FRAME)
    for side in [-1,1]:
     m.box(bx+side*(span-.35)/2,y+.14,front+.7,.07,1.15,1.4,PAINT,tint)
     m.box(bx+side*(span-.35)/2,y+.86,front+1.34,.045,.19,.045,FRAME)
    m.detail=False
  m.roofwork(x,h,z,3.2,2.2)
 # Projecting stair/elevator core and roof access make a legible silhouette.
 m.shell(4.2,5,floors+1,x=0,z=-depth*.23,bevel=.1,tint=(.64,.67,.65),cladding=PAINT,windowWidth=.9)
 m.entrance(depth*.47,offset)
 m.plant(-width*.32,0,depth*.45,3.2,1.2)
 m.box(-width*.17,.42,depth*.45,2.2,.16,.55,CONCRETE)
 m.finish()
lowrent_block('lowrent-staggered-slab',26,18,6,(.78,.79,.69))
lowrent_block('lowrent-court-block',40,28,8,(.74,.79,.81))

m=Model('linear-balcony-apartments','residential',6);h=m.shell(21,11,6,balconies=True);m.roofwork(0,h,0,4,2);m.entrance(6);m.finish()
# A compact brick courtyard walk-up: two pitched wings enclose a usable
# garden rather than repeating the flat-roof balcony slab silhouette.
m=Model('small-courtyard-apartments','residential',4)
h=m.shell(7,17,4,x=-4.5,bevel=.12,tint=(.70,.48,.34),cladding=BRICK,windowWidth=1.35)
back=m.shell(9,7,3,x=3.5,z=-5,bevel=.12,tint=(.84,.74,.58),cladding=PAINT,windowWidth=1.3)
pitched_roof(m,-4.5,0,7,17,h,2.6,hip=2,tint=(.53,.56,.59))
pitched_roof(m,3.5,-5,9,7,back,2.1,hip=1.4,tint=(.56,.58,.60))
# Chimneys and the roof silhouette remain in the distant model.
for z in [-5,4]:m.box(-5,h+1,z,.75,2.1,.9,BRICK,(.62,.40,.29))
m.box(3.4,.03,4,8.5,.1,8.8,CONCRETE,(.75,.72,.65))
m.plant(4.8,0,3,3.4,4.5)
m.entrance(8.7,-4.5)
# Courtyard seating and a slim pergola create a recognizable shared garden.
m.detail=True
for z in [1,6]:
 m.box(1.6,.4,z,1.8,.12,.5,WOOD);m.box(1.6,.55,z-.22,1.8,.65,.08,WOOD)
 for x in [.95,2.25]:m.box(x,0,z,.08,.4,.4,FRAME)
for x in [5.8,7.4]:
 for z in [-.5,6.5]:m.box(x,0,z,.10,2.5,.10,WOOD)
for z in [-.5,1,2.5,4,5.5,6.5]:m.box(6.6,2.5,z,2.1,.14,.16,WOOD)
m.detail=False
# Blinds are painted panels too: preserve every vertex and its base color
# while sharing the existing painted-surface material instead of another draw.
blind=m.parts.pop(BLIND);paint=m.parts[PAINT];offset=len(paint['p'])//3
for key in ['p','n','uv']:paint[key]+=blind[key]
paint['c'] += [value*materials[BLIND][1][i%3]/materials[PAINT][1][i%3] for i,value in enumerate(blind['c'])]
for key in ['i','far']:paint[key]+=[i+offset for i in blind[key]]
m.finish()
# Compact street buildings fit 16-metre frontages at authored scale. Distinct
# materials and rooflines avoid reusing the courtyard block on every small lot.
m=Model('brick-neighborhood-walkup','residential',3);h=m.shell(12,11,3,bevel=.18,tint=(.72,.43,.29),cladding=BRICK)
m.box(0,h-.25,0,12.4,.28,11.4,CONCRETE,(.78,.72,.60));m.box(0,h,0,11.6,.16,10.6,ROOF)
m.roofwork(-2,h,-2,2.5,1.5);m.entrance(5.7);m.finish()
m=Model('narrow-balcony-apartments','residential',5);h=m.shell(10,23,4,bevel=.3,balconies=True,tint=(.70,.77,.73),cladding=PAINT)
h=m.shell(8,17,1,z=-2,y=h,bevel=.3,tint=(.68,.58,.44),cladding=BRICK);m.roofwork(0,h,-3,2.8,1.8);m.plant(0,12.95,8.5,6,1.5);m.entrance(12);m.finish()
m=Model('stepped-midrise-apartments','residential',8);h=m.shell(18,14,5,balconies=True);h=m.shell(12,11,3,x=-2,y=h,balconies=True);m.plant(6,16.3,3,2,4);m.roofwork(-2,h,0,3,2);m.entrance(8);m.finish()
m=Model('corner-retail-gallery','commercial',3);h=m.shell(24,18,2,curtain=True);h=m.shell(14,12,1,x=-4,z=-2,y=h,curtain=True);m.plant(8,6.7,3,3,5);m.roofwork(-4,h,-2,4,2);m.entrance(10);m.finish()
m=Model('neighborhood-mixed-use','commercial',5);h=m.shell(18,12,1,curtain=True);h=m.shell(17,11,4,y=h,balconies=True);m.roofwork(0,h,0,4,2);m.entrance(7);m.finish()
m=Model('modern-courtyard-house','residential-low',2);h=m.shell(8,10,2,x=-3);m.shell(5,6,1,x=3,z=-2,curtain=True);m.box(3,0,4,4,.15,5,WOOD);m.plant(5,0,6,1,3);m.roofwork(-3,h,-2,1,.8);m.entrance(5.5,-3);m.finish()
m=Model('modern-rowhouse','residential-low',3);h=m.shell(7,11,3,balconies=True);m.box(-2,0,5.55,.8,9.3,.16,WOOD);m.plant(2,0,6,1,2);m.roofwork(0,h,-2,1.2,1);m.entrance(6);m.finish()

# Perimeter blocks use actual metre-sized wings around an open courtyard.
# Their larger footprint fills consolidated zones without enlarging windows.
def courtyard(name,category,floors,w=46,d=32,tint=(.86,.83,.74)):
 m=Model(name,category,floors)
 cladding=CONCRETE if category=='office' else BRICK
 # Separate wings leave a planted, ground-level central court; no solid podium.
 h=m.shell(w,9,floors,z=-(d-9)/2,bevel=.35,tint=tint,cladding=cladding)
 m.shell(w,9,floors-1,z=(d-9)/2,bevel=.35,tint=tint,balconies=category=='residential',cladding=cladding)
 m.shell(9,d-18,floors-1,x=-(w-9)/2,bevel=.35,tint=tint,cladding=cladding)
 m.shell(9,d-18,floors-2,x=(w-9)/2,bevel=.35,tint=tint,cladding=cladding)
 m.roofwork(-w*.28,h,-(d-9)/2,5,2)
 m.terrace(-w*.23,(floors-1)*3.2,(d-9)/2,10,5)
 m.terrace(w*.23,(floors-1)*3.2,(d-9)/2,10,5)
 m.roofwork((w-9)/2,(floors-2)*3.2,0,4,2)
 # The rear roof has clear space opposite its mechanical plant.
 m.plant(w*.23,h+.06,-(d-9)/2,min(10,w*.25),4.5)
 for x in [-w*.22,w*.22]:
  m.plant(x,0,0,5,5)
  m.entrance(d/2+.35,x)
 # Benches and walkways make the courtyard read as usable shared space.
 m.box(0,.02,0,w-18,.08,1.8,ROOF)
 for x in [-6,6]:m.box(x,.45,3,3,.18,.6,WOOD)
 return m
m=courtyard('perimeter-garden-apartments','residential',6);m.finish()
m=courtyard('perimeter-terrace-residences','residential',9,48,34,tint=(.95,.72,.55));m.finish()
m=courtyard('perimeter-tower-residences','residential',10,46,32,tint=(.72,.80,.82));h=m.shell(14,9,5,x=-12,z=-11.5,y=32,curtain=True);m.roofwork(-12,h,-11.5,4,2);m.floors=15;m.finish()
m=courtyard('perimeter-mixed-use','commercial',6,44,30,tint=(.86,.67,.51))
# Street-level canopies run along the retail frontage, leaving entrances between.
# Individual sign-fronted canopies are generated with each storefront bay.
m.finish()
m=courtyard('perimeter-campus-offices','office',10,44,32,tint=(.72,.76,.73));m.finish()

# Compact urban service facilities fit the game's existing owned lots. These
# are distinct complete models, selected by the saved catalogue ID.
def civic(name,category,floors):
 return Model('civic-'+name,category,floors,building=name)
def health_sign(m,x,y,z):
 m.box(x,y,z,1.8,1.8,.12,PAINT,(.12,.32,.62))
 for dx in [-.48,.48]:m.box(x+dx,y+.3,z+.075,.2,1.2,.045,PAINT)
 m.box(x,y+.82,z+.075,1.1,.2,.045,PAINT)
def shutter(m,x,z,w=3):
 m.box(x,0,z,w,2.7,.12,FRAME)
 for i in range(12):m.box(x,.12+i*.21,z+.08,w-.16,.17,.04,PAINT,(.65,.67,.64))
 m.box(x,1.6,z+.12,w-.35,.42,.04,GLASS)
def canopy(m,x,z,w=4):
 m.box(x,2.85,z,w,.18,2,FRAME)
 for dx in [-w/2+.16,w/2-.16]:m.box(x+dx,0,z+.7,.14,2.85,.14,PAINT)
 m.box(x,.02,z,w+.3,.1,2.3,ROOF)

m=civic('clinic','hospital',2);h=m.shell(13,11,2,cladding=PAINT);m.roofwork(-2,h,-2,3,2);canopy(m,0,6);health_sign(m,4,3.5,5.6);m.plant(-5,.05,7,2,2);m.finish()
m=civic('hospital','hospital',6);h=m.shell(15,13,2,cladding=PAINT);m.shell(12,10,4,x=-1,z=-1,y=h,cladding=PAINT);m.roofwork(-1,19.2,-1,4,2);canopy(m,-2,7);health_sign(m,5,3.5,6.6);m.box(4,3,7,5,.2,1.8,PAINT,(.15,.35,.58));m.finish()
m=civic('wellness','hospital',1);h=m.shell(7,13,1,x=-3,cladding=BRICK);m.shell(6,7,1,x=3,z=-3,curtain=True);m.roofwork(-3,h,-2,2,1.5);canopy(m,-3,7);health_sign(m,-3,1.2,6.6);m.plant(4,0,4,3,3);m.finish()

m=civic('elementary','school',2);h=m.shell(5,14,2,x=-5,cladding=BRICK);m.shell(10,5,2,x=2,z=-4.5,cladding=BRICK);m.roofwork(-5,h,-3,2,2);canopy(m,-4,7.5);m.box(2,.02,3,8,.08,6,PAINT,(.28,.40,.34));
for x in [-1.5,5.5]:m.box(x,.12,3,.06,.015,5,PAINT)
for z in [.5,5.5]:m.box(2,.12,z,7,.015,.06,PAINT)
m.plant(6,0,-.5,2,2);m.finish()
m=civic('highschool','school',3);h=m.shell(15,8,3,z=-3,cladding=BRICK);m.shell(8,7,2,x=-3,z=4,cladding=PAINT);m.roofwork(3,h,-3,3,2);canopy(m,-3,8);m.box(5,.05,4,3,.12,5,ROOF);m.plant(5,0,7,3,2);m.finish()
m=civic('college','school',4);h=m.shell(8,15,4,x=-4,cladding=BRICK);m.shell(7,8,3,x=3,z=-3,curtain=True);m.roofwork(-4,h,-3,3,2);canopy(m,-3,8);m.plant(4,0,4,3,4);m.finish()

m=civic('police','police',2);h=m.shell(14,11,2,cladding=PAINT);m.roofwork(-3,h,-2,3,2);canopy(m,0,6);m.box(0,3.05,5.65,10,.55,.12,PAINT,(.12,.25,.45));m.box(4,0,6,2,.15,1.6,ROOF);m.finish()
m=civic('headquarters','police',5);h=m.shell(15,13,2,cladding=PAINT);m.shell(10,10,3,x=-2,z=-1,y=h,curtain=True);m.roofwork(-2,16,-1,3,2);canopy(m,0,7);m.box(0,3.05,6.65,11,.55,.12,PAINT,(.12,.25,.45));m.cylinder(-5,16.1,-3,.07,3,FRAME);m.finish()

m=civic('fire','fire',2);h=m.shell(15,12,1,cladding=BRICK);m.shell(5,9,1,x=-5,z=-1,y=h,cladding=BRICK)
for x in [-1.5,3.5]:shutter(m,x,6.1,3.7)
m.box(1,2.85,6.25,10,.26,.12,PAINT,(.65,.10,.055));m.roofwork(-5,6.4,-2,2,2);m.box(1,.02,7.3,11,.1,2,ROOF);m.finish()
m=civic('rescue','fire',4);h=m.shell(16,12,1,cladding=BRICK);m.shell(5,7,3,x=-5,z=-2,y=h,cladding=PAINT)
for x in [-1,4]:shutter(m,x,6.1,3.7)
m.box(1.5,2.85,6.25,11,.26,.12,PAINT,(.65,.10,.055));m.roofwork(-5,12.8,-2,2,2);m.box(1.5,.02,7.3,11,.1,2,ROOF);m.finish()

# Full-sized facilities retain metre-scale storeys, windows and entrances.
# Each saved civic site selects one complete campus rather than scaled-up doors.
def campus(name,category,floors):
 m=Model('site-'+name,category,floors,building=name);m.site=True;return m
def court(m,x,z,w,d):
 m.box(x,.04,z,w,.1,d,PAINT,(.25,.38,.34))
 for dx in [-w/2+.5,w/2-.5]:m.box(x+dx,.145,z,.08,.015,d-1,PAINT)
 for dz in [-d/2+.5,0,d/2-.5]:m.box(x,.145,z+dz,w-1,.015,.08,PAINT)
 # Basketball supports preserve human scale.
 for dz in [-d/2+1,d/2-1]:
  m.box(x,0,z+dz,.12,3,.12,FRAME);m.box(x,2.5,z+dz,1.8,.9,.08,PAINT)
def parking(m,x,z,count):
 m.box(x,.02,z,count*2.6,.08,5.5,ROOF)
 for n in range(count+1):m.box(x-count*1.3+n*2.6,.105,z,.08,.012,5.1,PAINT)

m=campus('clinic','hospital',2);h=m.shell(25,17,2,z=-3,cladding=PAINT);m.shell(8,8,1,x=-8,z=9,curtain=True);canopy(m,0,6,6);health_sign(m,8,3.5,5.6);m.roofwork(-5,h,-5);m.plant(10,0,10,4,5);parking(m,-3,15,6);m.finish()
m=campus('hospital','hospital',7)
h=m.shell(58,24,2,z=4,cladding=PAINT);m.shell(43,15,5,x=-5,z=-7,y=h,cladding=PAINT);m.shell(15,20,3,x=22,z=-12,cladding=PAINT)
m.shell(15,9,1,x=-16,z=20,curtain=True);canopy(m,-16,25,10);canopy(m,18,17,9);health_sign(m,25,4,16.1)
for x in [-17,-3,10]:m.roofwork(x,22.4,-8,5,3)
m.box(18,.03,23,20,.1,10,ROOF);parking(m,-16,-24,11);m.plant(-33,0,4,4,12);m.plant(32,0,19,4,8);m.finish()
m=campus('wellness','hospital',1);m.shell(10,26,1,x=-10,z=-2,cladding=BRICK);m.shell(19,10,1,x=4,z=-10,curtain=True);m.shell(8,9,1,x=10,z=0,cladding=PAINT);canopy(m,-10,12,6);health_sign(m,-10,1.1,11.1);m.plant(0,0,3,5,6);m.terrace(7,.02,10,8,5);parking(m,-6,16,4);m.roofwork(-10,3.2,-8,3,2);m.finish()

m=campus('elementary','school',2);h=m.shell(43,11,2,z=-10,cladding=BRICK);m.shell(10,22,2,x=-17,z=5,cladding=BRICK);m.shell(14,18,1,x=17,z=3,cladding=PAINT);canopy(m,-17,17,6);court(m,0,8,14,16);m.plant(0,0,-1,5,2);m.roofwork(-9,h,-10,5,3);m.finish()
m=campus('highschool','school',3);h=m.shell(63,14,3,z=-16,cladding=BRICK);m.shell(13,27,2,x=-25,z=4,cladding=BRICK);m.shell(20,27,2,x=24,z=4,cladding=PAINT);m.shell(14,8,1,x=-3,z=-5,curtain=True);canopy(m,-3,0,7);court(m,-1,13,20,20);m.roofwork(-16,h,-17);m.roofwork(23,6.4,3,6,3);m.plant(-29,0,23,6,4);m.plant(29,0,23,6,4);m.finish()
m=campus('college','school',5);h=m.shell(15,44,5,x=-34,z=-1,cladding=BRICK);m.shell(45,13,4,x=-4,z=-17,curtain=True);m.shell(22,27,3,x=30,z=-8,cladding=PAINT);m.shell(14,16,2,x=27,z=14,cladding=BRICK);m.shell(10,8,1,x=-24,z=15,curtain=True);canopy(m,-24,20,7);m.box(-2,.02,5,30,.08,3,ROOF)
for x in [-13,5]:m.plant(x,0,10,6,9);m.terrace(x,.02,21,8,4)
for x,y,z in [(-34,16,-12),(-10,12.8,-17),(30,9.6,-12)]:m.roofwork(x,y,z,5,3)
m.finish()

m=campus('police','police',2);h=m.shell(26,19,2,z=-5,cladding=PAINT);m.shell(12,6,1,z=7,curtain=True);canopy(m,0,11,6);m.box(0,3.1,4.65,18,.55,.12,PAINT,(.12,.25,.45));m.roofwork(-6,h,-7);parking(m,0,16,9);m.plant(-15,0,7,3,7);m.finish()
m=campus('headquarters','police',6);h=m.shell(43,27,2,z=-2,cladding=PAINT);m.shell(25,18,4,x=-7,z=-6,y=h,curtain=True);m.shell(14,12,1,x=11,z=17,curtain=True);canopy(m,11,24,9);m.box(11,3.1,23.2,12,.55,.12,PAINT,(.12,.25,.45));m.roofwork(-10,19.2,-7,6,3);m.cylinder(-16,19.8,-11,.1,5,FRAME);parking(m,0,-23,14);m.plant(-20,0,19,5,8);m.finish()

m=campus('fire','fire',2);h=m.shell(29,21,1,z=-3,cladding=BRICK);m.shell(8,18,1,x=-10,z=-4,y=h,cladding=BRICK)
for x in [-2,3,8]:shutter(m,x,7.6,4)
m.box(3,2.85,7.75,15,.26,.12,PAINT,(.65,.10,.055));m.box(3,.02,13,19,.1,9,ROOF);canopy(m,-10,8,4);m.roofwork(-10,6.4,-6,3,2);m.plant(-14,0,12,2,4);m.finish()
m=campus('rescue','fire',5);h=m.shell(47,22,1,z=-4,cladding=BRICK);m.shell(10,16,2,x=-17,z=-6,y=h,cladding=PAINT);m.shell(7,7,5,x=19,z=-9,cladding=BRICK)
for x in [-7,-2,3,8,13]:shutter(m,x,7.1,4)
m.box(3,2.85,7.25,25,.26,.12,PAINT,(.65,.10,.055));m.box(3,.02,12.5,30,.1,9,ROOF);canopy(m,-17,8,6);m.roofwork(-17,9.6,-7,4,2);m.plant(-24,0,12,3,6);m.finish()

# Each model has one primitive per material, with vertex colour variation.
doc={'asset':{'version':'2.0','generator':'Borough original modern architecture'},'extensionsUsed':['KHR_mesh_quantization'],'extensionsRequired':['KHR_mesh_quantization'],'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[{'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':metal,'roughnessFactor':rough}} for name,color,metal,rough in materials],'buffers':[{'byteLength':0}],'bufferViews':[],'accessors':[]}
binary=bytearray()
doc['images']=[];doc['textures']=[];doc['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]
for file in ['asphalt-color.jpg','brick-color.jpg','brick-normal.jpg','brick-rough.jpg']:
 while len(binary)%4:binary.append(0)
 raw=(ROOT/'dist/assets'/file).read_bytes()
 if file.startswith('brick-'):
  image=Image.open(io.BytesIO(raw));image.thumbnail((512,512),Image.Resampling.LANCZOS);buffer=io.BytesIO();image.save(buffer,format='JPEG',quality=90,optimize=True);raw=buffer.getvalue()
 start=len(binary);binary.extend(raw)
 doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(raw)})
 doc['images'].append({'mimeType':'image/jpeg','bufferView':len(doc['bufferViews'])-1})
 doc['textures'].append({'source':len(doc['images'])-1,'sampler':0})
doc['materials'][ROOF]['pbrMetallicRoughness']['baseColorTexture']={'index':0}
doc['materials'][BRICK]['pbrMetallicRoughness'].update(baseColorTexture={'index':1},metallicRoughnessTexture={'index':3})
doc['materials'][BRICK]['normalTexture']={'index':2,'scale':.4}

# A small original sign atlas is shared by every shopfront.
signs=Image.new('RGB',(512,256));draw=ImageDraw.Draw(signs)
try:font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',36)
except OSError:font=ImageFont.load_default(size=36)
for row,(label,color) in enumerate([('MARKET','#3e514b'),('CAFE','#675342'),('BOOKS','#485b6a'),('STUDIO','#625b52')]):
 draw.rectangle((0,row*64,512,(row+1)*64),fill=color)
 draw.text((256,row*64+32),label,font=font,anchor='mm',fill='#e8e4d7',stroke_width=0)
buffer=io.BytesIO();signs.save(buffer,format='PNG',optimize=True);raw=buffer.getvalue()
while len(binary)%4:binary.append(0)
start=len(binary);binary.extend(raw);doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(raw)})
doc['images'].append({'mimeType':'image/png','bufferView':len(doc['bufferViews'])-1});doc['textures'].append({'source':len(doc['images'])-1,'sampler':0})
doc['materials'][SIGN]['pbrMetallicRoughness']['baseColorTexture']={'index':len(doc['textures'])-1}
doc['materials'][SHOP_GLASS].update(alphaMode='BLEND',doubleSided=False)

def pack_normal(values):
 while len(binary)%4:binary.append(0)
 start=len(binary)
 for i in range(0,len(values),3):binary.extend(struct.pack('<bbbb',*[round(max(-1,min(1,v))*127) for v in values[i:i+3]],0))
 doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(binary)-start,'byteStride':4})
 doc['accessors'].append({'bufferView':len(doc['bufferViews'])-1,'componentType':5120,'normalized':True,'count':len(values)//3,'type':'VEC3'})
 return len(doc['accessors'])-1

def pack(values,kind,component=5126):
 while len(binary)%4:binary.append(0)
 width={'VEC4':4,'VEC3':3,'VEC2':2,'SCALAR':1}[kind];start=len(binary);fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[component];binary.extend(struct.pack('<'+fmt*len(values),*values));doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':len(binary)-start});entry={'bufferView':len(doc['bufferViews'])-1,'componentType':component,'count':len(values)//width,'type':kind}
 if component==5121:entry['normalized']=True
 if kind=='VEC3':entry.update(min=[min(values[i::3]) for i in range(3)],max=[max(values[i::3]) for i in range(3)])
 doc['accessors'].append(entry);return len(doc['accessors'])-1
for model in models:
 primitives=[]
 for mat,part in sorted(model.parts.items()):
  primitives.append({'attributes':{'POSITION':pack(part['p'],'VEC3'),'NORMAL':pack_normal(part['n']),'TEXCOORD_0':pack(part['uv'],'VEC2'),'COLOR_0':pack([v for i in range(0,len(part['c']),3) for v in [*[round(max(0,min(1,c))*255) for c in part['c'][i:i+3]],255]],'VEC4',5121)},'indices':pack(part['i'],'SCALAR',5123 if max(part['i'])<65536 else 5125),'material':mat})
 doc['meshes'].append({'name':model.name,'primitives':primitives});doc['scenes'][0]['nodes'].append(len(doc['nodes']));doc['nodes'].append({'name':model.name,'mesh':len(doc['meshes'])-1,'extras':{'category':model.category,'building':model.building,'site':model.site,'houseForm':model.houseForm,'roofForm':model.roofForm,'floors':model.floors,'family':'modern','gardens':model.gardens,'streetFronts':model.streetFronts,'source':'Borough original geometry'}})
while len(binary)%4:binary.append(0)
doc['buffers'][0]['byteLength']=len(binary);data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*((-len(data))%4)
glb=struct.pack('<III',0x46546c67,2,12+8+len(data)+8+len(binary))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(binary),0x004e4942)+binary
out=ROOT/'dist/assets/buildings/modern.glb';out.write_bytes(glb)
print(json.dumps({'models':len(models),'triangles':sum(len(p['i'])//3 for m in models for p in m.parts.values()),'bytes':len(glb),'output':str(out)}))

# Author distant topology by omitting only sub-pixel sills, fan blades and
# terrace furniture. Windows, wall openings, balcony fronts and silhouettes
# retain their exact triangles; no generic simplifier can seal their openings.
lod_path=ROOT/'dist/assets/buildings/lod.json';lod_bin=ROOT/'dist/assets/buildings/lod.bin'
lod=json.loads(lod_path.read_text());modern_names={m.name for m in models}
lod={name:entry for name,entry in lod.items() if name not in modern_names}
end=0
for entries in lod.values():
 for entry in entries:
  for a in [*entry.get('attributes',{}).values(),entry['index']]:end=max(end,a['offset']+a['count']*4)
data=bytearray(lod_bin.read_bytes()[:end])
for model in models:
 entries=[]
 for mat,part in sorted(model.parts.items()):
  entries.append({'sharedAttributes':True,'index':{'offset':len(data),'count':len(part['far'])}})
  data.extend(struct.pack('<'+'I'*len(part['far']),*part['far']))
 lod[model.name]=entries
lod_path.write_text(json.dumps(lod,separators=(',',':')));lod_bin.write_bytes(data)
print(json.dumps({'distantTriangles':sum(len(p['far'])//3 for m in models for p in m.parts.values()),'lodBytes':len(data)}))
