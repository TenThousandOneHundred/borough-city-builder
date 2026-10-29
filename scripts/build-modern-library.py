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
 def metric_uvs(self,points,normal):
  # A shared world-space origin keeps neighbouring panels and raised ribs in
  # phase. An orthonormal face basis measures sloping roofs in metres too.
  n=list(normal);length=math.sqrt(sum(v*v for v in n));n=[v/length for v in n]
  dominant=max(range(3),key=lambda i:abs(n[i]))
  if n[dominant]<0:n=[-v for v in n]
  u=[n[2],0,-n[0]] if abs(n[1])<.5 else [n[1],-n[0],0]
  length=math.sqrt(sum(v*v for v in u));u=[v/length for v in u]
  v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]]
  if abs(n[1])>=.5:v=[-t for t in v]
  return [(sum(p[i]*u[i] for i in range(3)),sum(p[i]*v[i] for i in range(3))) for p in points]
 def quad(self,a,b,c,d,mat,color=(1,1,1),uvs=None):
  part=self.parts[mat];start=len(part['p'])//3;u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];length=math.sqrt(sum(x*x for x in n))
  if length<1e-8:return
  n=[x/length for x in n]
  if uvs is None and self.category=='industrial' and mat==PAINT:uvs=self.metric_uvs([a,b,c,d],n)
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
 def shell(self,w,d,floors,x=0,z=0,y=0,bevel=.7,balconies=False,curtain=False,oval=False,tint=(1,1,1),cladding=CONCRETE,windowWidth=None,framed=False,balconySides=None,openRail=False,baySpacing=None,balconyDoors=(),frameOut=.06,retailWidth=None,retailGroup=3,clothAwning=False,compactFar=False):
  points=([(x+w/2*math.cos(j*math.tau/32),z+d/2*math.sin(j*math.tau/32)) for j in range(32)] if oval else self.ring(w,d,bevel,x,z))
  fh=3.2;top=y+floors*fh
  # Recessed dark walls sit behind individual panes and facade structure.
  for side,(a,b) in enumerate(zip(points,points[1:]+points[:1])):
   dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz);tx,tz=dx/length,dz/length;nx,nz=tz,-tx
   def p(u,v,out=0):return (a[0]+tx*u+nx*out,v,a[1]+tz*u+nz*out)
   if (windowWidth or framed) and length<.5:
    self.quad(p(length,y),p(0,y),p(0,top),p(length,top),cladding,tint);continue
   front=nz>.9 and length>3 and y==0
   shop=front and self.category=='commercial'
   # Ground-floor shop windows have shallow rooms behind real glazing.
   # Upper windows retain their existing opaque/reflected glazing and detail.
   recess=-.25 if framed else -.1;glazing=-.16 if framed else -.035
   if not shop or floors>1:self.quad(p(length,y+fh if shop else y,recess),p(0,y+fh if shop else y,recess),p(0,top,recess),p(length,top,recess),RECESS)
   bays=max(1,round(length/(baySpacing or (1.6 if curtain else 3.4 if windowWidth else 2.6))));bay=length/bays
   # Adjacent flat wall strips above and below a floor boundary share one
   # coplanar panel. The facade envelope and every opening stay unchanged.
   bands=[]
   for f in range(floors):
    level=y+f*fh;retail=shop and f==0;bottom=.12 if retail else .32 if curtain else .75;upper=.55 if retail else .13 if curtain else .38
    for lo,hi in [(level,level+bottom),(level+fh-upper,level+fh)]:
     if bands and abs(bands[-1][1]-lo)<1e-8:bands[-1]=(bands[-1][0],hi)
     else:bands.append((lo,hi))
   for lo,hi in bands:
    if shop and retailWidth and lo<y+fh:
     split=min(hi,y+fh);self.quad(p(length,lo,.025),p(0,lo,.025),p(0,split,.025),p(length,split,.025),PAINT,(.70,.72,.68));lo=split
    if hi>lo:self.quad(p(length,lo,.025),p(0,lo,.025),p(0,hi,.025),p(length,hi,.025),FRAME if curtain else cladding,(1,1,1) if curtain else tint)
   for f in range(floors):
    level=y+f*fh;retail=shop and f==0;bottom=.12 if retail else .32 if curtain else .75;upper=.55 if retail else .13 if curtain else .38
    for j in range(bays):
     opening=retailWidth if retail and retailWidth else windowWidth
     margin=.045 if curtain else max(.24,(bay-opening)/2) if opening else .24;l=j*bay+margin;r=(j+1)*bay-margin;shade=.74+((j*17+f*31+side*11)%19)/65
     door=front and ((f==0 and (j%retailGroup==1 if retail else j==bays//2)) or (f>0 and j in balconyDoors))
     sill=.08 if door else bottom
     if retail:
      self.shop_room(p,l,r,level,fh-upper,j,door)
      material=SHOP_GLASS
     else:material=OCCUPIED if (j*17+f*31+side*11)%4==1 else GLASS
     # A door overlays the low sill band so the opening reaches its threshold.
     self.quad(p(r,level+sill,.035 if door else glazing),p(l,level+sill,.035 if door else glazing),p(l,level+fh-upper,.035 if door else glazing),p(r,level+fh-upper,.035 if door else glazing),material,(shade,shade,min(1,shade+.04)))
     if door:
      centre=(l+r)/2
      if f==0:self.streetFronts.append({'kind':'shop' if retail else 'entrance','position':list(p(centre,level+.08,.08)),'normal':[nx,nz],'width':r-l})
      for u in [l,r,centre]:self.quad(p(u+.035,level+.08,.085),p(u-.035,level+.08,.085),p(u-.035,level+fh-upper,.085),p(u+.035,level+fh-upper,.085),FRAME)
      self.quad(p(r,level+.08,.12),p(l,level+.08,.12),p(l,level+.08,-.02),p(r,level+.08,-.02),CONCRETE)
      self.detail=True
      for u in [centre-.14,centre+.14]:self.quad(p(u+.02,level+1,.13),p(u-.02,level+1,.13),p(u-.02,level+1.5,.13),p(u+.02,level+1.5,.13),CONCRETE)
      self.detail=False
     if retail and j%retailGroup==0:
      sl=j*bay+margin;sr=min(bays,j+retailGroup)*bay-margin
      band=abs(sum(ord(c) for c in self.name)+j//retailGroup)%4;v0=(band+.06)/4;v1=(band+.94)/4
      if clothAwning:
       # Shallow fabric canopies sit below separate wall-mounted shop signs.
       # Reuse paint and the existing sign atlas, including at a distance.
       fabric=(.80,.77,.64) if band%2 else (.24,.43,.39)
       self.quad(p(sl,level+2.65,.07),p(sr,level+2.65,.07),p(sr,level+2.36,1.05),p(sl,level+2.36,1.05),PAINT,fabric)
       self.quad(p(sr,level+2.24,1.05),p(sl,level+2.24,1.05),p(sl,level+2.36,1.05),p(sr,level+2.36,1.05),PAINT,fabric)
       for u in [sl,sr]:self.quad(p(u,level+2.36,.07),p(u,level+2.36,1.05),p(u,level+2.65,.07),p(u,level+2.36,.07),PAINT,fabric)
       self.quad(p(sr,level+2.78,.10),p(sl,level+2.78,.10),p(sl,level+3.12,.10),p(sr,level+3.12,.10),SIGN,uvs=[(0,v1),(1,v1),(1,v0),(0,v0)])
      else:
       self.quad(p(sl,level+3.1,.02),p(sr,level+3.1,.02),p(sr,level+3.1,.85),p(sl,level+3.1,.85),FRAME)
       for u in [sl,sr]:self.quad(p(u,level+2.73,.02),p(u,level+2.73,.85),p(u,level+3.1,.85),p(u,level+3.1,.02),FRAME)
       self.quad(p(sr,level+2.73,.86),p(sl,level+2.73,.86),p(sl,level+3.08,.86),p(sr,level+3.08,.86),SIGN,uvs=[(0,v1),(1,v1),(1,v0),(0,v0)])
     if (j*17+f*31+side*11)%9<2 and f>0:
      blindtop=level+fh-upper;blindbottom=blindtop-(fh-bottom-upper)*.36
      self.detail=compactFar
      self.quad(p(r,blindbottom,glazing+.009),p(l,blindbottom,glazing+.009),p(l,blindtop,glazing+.009),p(r,blindtop,glazing+.009),BLIND,(shade,shade,shade))
      self.detail=False
     # Shallow recess returns make window openings read in direct sunlight.
     if not curtain and not door:
      returnDepth=glazing-.035 if framed else -.07
      if framed:self.window_frame(p,l,r,level+bottom,level+fh-upper,frameOut)
      self.detail=True
      self.quad(p(l,level+bottom-.07,.14),p(r,level+bottom-.07,.14),p(r,level+bottom,returnDepth),p(l,level+bottom,returnDepth),CONCRETE,tint)
      self.quad(p(r,level+fh-upper,.03),p(l,level+fh-upper,.03),p(l,level+fh-upper,returnDepth),p(r,level+fh-upper,returnDepth),CONCRETE,tint)
      self.detail=False
      self.detail=compactFar
      for u,sign in [(l,-1),(r,1)]:self.quad(p(u,level+bottom,.03),p(u,level+bottom,returnDepth),p(u,level+fh-upper,returnDepth),p(u,level+fh-upper,.03),CONCRETE,(.78,.79,.76))
      self.detail=False
    if balconies and length>5 and f>0 and (side in balconySides if balconySides is not None else side%2==0):
     # Slabs and framed balcony panels project from selected faces, not all faces.
     l=.45;r=length-.45;out=1.05;h=level+.12
     self.quad(p(l,h,.02),p(r,h,.02),p(r,h,out),p(l,h,out),CONCRETE)
     self.quad(p(r,h,out),p(l,h,out),p(l,h+.12,out),p(r,h+.12,out),CONCRETE)
     if openRail:
      # Open metal balustrades let the recess behind the railing remain visible.
      # Posts and the continuous handrail are retained at distance.
      count=max(2,math.ceil((r-l)/.9))
      for k in range(count+1):
       u=l+(r-l)*k/count;self.quad(p(u+.025,h+.12,out),p(u-.025,h+.12,out),p(u-.025,h+1.0,out),p(u+.025,h+1.0,out),FRAME)
      self.quad(p(r,h+.18,out),p(l,h+.18,out),p(l,h+.23,out),p(r,h+.23,out),FRAME)
     else:self.quad(p(r,h+.15,out-.04),p(l,h+.15,out-.04),p(l,h+1.0,out-.04),p(r,h+1.0,out-.04),GLASS,(.72,.77,.78))
     self.quad(p(r,h+1.0,out),p(l,h+1.0,out),p(l,h+1.07,out),p(r,h+1.07,out),FRAME)
     self.detail=True
     for edge in [l,r]:
      if openRail:
       for depth in [.06,.55,out]:self.quad(p(edge,h+.15,depth-.025),p(edge,h+.15,depth+.025),p(edge,h+1.05,depth+.025),p(edge,h+1.05,depth-.025),FRAME)
       self.quad(p(edge,h+1.0,.06),p(edge,h+1.0,out),p(edge,h+1.07,out),p(edge,h+1.07,.06),FRAME)
      else:self.quad(p(edge,h+.15,.06),p(edge,h+.15,out),p(edge,h+1,out),p(edge,h+1,.06),GLASS)
     for j in range(1,bays):
      u=j*bay;self.quad(p(u,h+.12,.04),p(u,h+.12,out),p(u,h+1.55,out),p(u,h+1.55,.04),FRAME,(.72,.75,.73))
     self.detail=False
   self.detail=False
   # Continuous narrow mullions do not duplicate geometry at every floor.
   for j in range(bays+1):
    u=j*bay
    spans=[(y,y+fh,retailWidth,PAINT,(.70,.72,.68)),(y+fh,top,windowWidth,cladding,tint)] if shop and retailWidth else [(y,top,windowWidth,FRAME if curtain else cladding,(1,1,1) if curtain else tint)]
    for lo,hi,opening,mat,color in spans:
     if hi<=lo:continue
     half=.045 if curtain else max(.22,(bay-opening)/2) if opening else .22;l=max(0,u-half);r=min(length,u+half)
     self.quad(p(r,lo,.06),p(l,lo,.06),p(l,hi,.06),p(r,hi,.06),mat,color)
  # A raised, hollow parapet has an inner face and coping instead of a
  # solid cap. The membrane remains below its rim and catches roof shadows.
  inner=[(x+(px-x)*max(0,1-.5/w),z+(pz-z)*max(0,1-.5/d)) for px,pz in points]
  self.surface(inner,top+.04,ROOF)
  for i,(a,b) in enumerate(zip(points,points[1:]+points[:1])):
   c,e=inner[i],inner[(i+1)%len(inner)]
   self.quad((b[0],top,b[1]),(a[0],top,a[1]),(a[0],top+.65,a[1]),(b[0],top+.65,b[1]),cladding,tint)
   self.detail=compactFar
   self.quad((c[0],top,c[1]),(e[0],top,e[1]),(e[0],top+.65,e[1]),(c[0],top+.65,c[1]),CONCRETE,tint)
   self.detail=False
   self.quad((a[0],top+.65,a[1]),(c[0],top+.65,c[1]),(e[0],top+.65,e[1]),(b[0],top+.65,b[1]),CONCRETE,tint)
  return top
 def window_frame(self,p,l,r,lo,hi,out=.06):
  # Painted timber/aluminium sash sits ahead of a recessed pane.
  # Keep its silhouette in distant topology and share the existing paint draw.
  color=(.82,.83,.77);edge=.065;centre=(l+r)/2;cross=lo+(hi-lo)*.62
  for a,b in [(l-edge,l+edge),(r-edge,r+edge)]:self.quad(p(b,lo-edge,out),p(a,lo-edge,out),p(a,hi+edge,out),p(b,hi+edge,out),PAINT,color)
  for a,b in [(lo-edge,lo+edge),(hi-edge,hi+edge)]:self.quad(p(r-edge,a,out),p(l+edge,a,out),p(l+edge,b,out),p(r-edge,b,out),PAINT,color)
  self.quad(p(centre+.028,lo,-.08),p(centre-.028,lo,-.08),p(centre-.028,hi,-.08),p(centre+.028,hi,-.08),PAINT,color)
  self.quad(p(r,cross-.03,-.07),p(l,cross-.03,-.07),p(l,cross+.03,-.07),p(r,cross+.03,-.07),PAINT,color)
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

def domestic_block(m,w,d,floors,x=0,z=0,tint=(.8,.84,.78),brick=False,siding=False,paired=False,attached=False,windowWidth=None):
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
    centre=(j+.5)*bay;opening=1.0 if door else min(windowWidth or 1.45,bay-.65);l=centre-opening/2;r=centre+opening/2;lo=base+(.08 if door else .86);hi=base+(2.2 if door else 2.28)
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

def suburban_roof(m,w,d,y,gambrel=False):
 # Cross-section runs from the street eave to the rear eave. A gambrel's
 # steep lower planes and shallow upper planes remain real geometry in LOD.
 W=w+.5;D=d+.6;tint=(1,.63,.40)
 profile=([(D/2,0),(D*.335,2.7),(0,3.65),(-D*.335,2.7),(-D/2,0)] if gambrel else [(D/2,0),(0,2.05),(-D/2,0)])
 def roof_y(z):
  for (a,ha),(b,hb) in zip(profile,profile[1:]):
   if b-1e-8<=z<=a+1e-8:return y+ha+(hb-ha)*(a-z)/(a-b)
  raise ValueError('roof coordinate outside profile')
 front=D*.43 if gambrel else D*.36;back=D*.34 if gambrel else D*.11
 left,right=(-1.7,1.7) if gambrel else (-1.5,1.5)
 # Cut the roof beneath the dormer instead of hiding an intersecting plane
 # inside its window. Each remaining rectangle keeps physical texture UVs.
 def patch(l,r,a,b):
  ya,yb=roof_y(a),roof_y(b);m.quad((l,ya,a),(r,ya,a),(r,yb,b),(l,yb,b),ROOF,tint,uvs=[(l/2,a/2),(r/2,a/2),(r/2,b/2),(l/2,b/2)])
 for (a,_),(b,_) in zip(profile,profile[1:]):
  edges=sorted(set([a,b]+[z for z in [front,back] if b<z<a]),reverse=True)
  for za,zb in zip(edges,edges[1:]):
   if back<(za+zb)/2<front:patch(-W/2,left,za,zb);patch(right,W/2,za,zb)
   else:patch(-W/2,W/2,za,zb)
 # Brick gable ends underneath the two/four roof planes, with white verge.
 for side in [-1,1]:
  x=side*w/2
  def p(u,v,out=0):return(x+side*out,v,side*u)
  l,r=-.65,.65;lo=y+(1.10 if gambrel else .35);hi=y+(2.30 if gambrel else 1.20)
  edges=sorted(set([z for z,_ in profile]+[l,r]))
  def wall(a,b,low,topA,topB):
   corners=([(a,low),(b,topB),(b,low),(a,low)] if abs(topA-low)<1e-8 else [(b,low),(a,low),(a,topA),(b,topB)])
   m.quad(*[p(u,v) for u,v in corners],BRICK,(.88,.66,.49),uvs=[(-u/2,v/2) for u,v in corners])
  for a,b in zip(edges,edges[1:]):
   if l<(a+b)/2<r:wall(a,b,y,lo,lo);wall(a,b,hi,roof_y(a),roof_y(b))
   else:wall(a,b,y,roof_y(a),roof_y(b))
  m.quad(p(r,lo,-.16),p(l,lo,-.16),p(l,hi,-.16),p(r,hi,-.16),OCCUPIED,(.78,.83,.84))
  m.window_frame(p,l,r,lo,hi)
  for u in [l,r]:m.quad(p(u,lo,0),p(u,lo,-.16),p(u,hi,-.16),p(u,hi,0),PAINT)
  for (a,ha),(b,hb) in zip(profile,profile[1:]):
   # Thin planar verge strips follow the broken slope without extra objects.
   q=[(side*(W/2+.015),y+ha+.045,a),(side*(W/2+.015),y+hb+.045,b),(side*(W/2+.015),y+hb-.10,b),(side*(W/2+.015),y+ha-.10,a)]
   m.quad(*(q[::-1] if side>0 else q),PAINT,(.85,.86,.80))
 for z in [-D/2,D/2]:m.box(0,y-.10,z,W,.16,.12,PAINT)
 m.box(0,y+max(h for _,h in profile)-.025,0,W,.10,.16,ROOF,tint)
 # Projecting dormer cheeks sit on the roof; the front has a real opening.
 base=roof_y(front);top=roof_y(back)+.32;lo=base+.20;hi=top-.20
 def face(l,r,a,b,out=0,mat=PAINT,color=(.84,.86,.81)):
  m.quad((l,a,front+out),(r,a,front+out),(r,b,front+out),(l,b,front+out),mat,color)
 face(left,right,base,lo);face(left,right,hi,top)
 face(left,left+.18,lo,hi);face(right-.18,right,lo,hi)
 face(left+.18,right-.18,lo,hi,-.12,OCCUPIED,(.79,.84,.85))
 for x in [left+.18,0,right-.18]:face(x-.045,x+.045,lo-.04,hi+.04,.035)
 for h in [lo,hi]:face(left+.13,right-.13,h-.045,h+.045,.04)
 for side,x in [(-1,left),(1,right)]:
  q=[(x,base,front),(x,roof_y(back),back),(x,top,back),(x,top,front)]
  m.quad(*(q if side>0 else q[::-1]),PAINT,(.75,.78,.73))
 # Opaque inner back sits behind the glazing, preserving night room depth.
 m.quad((right,roof_y(back),back),(left,roof_y(back),back),(left,top,back),(right,top,back),RECESS)
 m.box(0,top,(front+back)/2,right-left+.18,.12,front-back+.18,FRAME)
 # Tile laps and rainwater goods are omitted only in distant topology.
 m.detail=True
 for (a,_),(b,_) in zip(profile,profile[1:]):
  count=max(3,round(math.hypot(a-b,roof_y(a)-roof_y(b))/.28))
  for k in range(1,count):
   z=a+(b-a)*k/count;z2=z-.045;spans=[(-W/2,left),(right,W/2)] if back<=z<=front or back<=z2<=front else [(-W/2,W/2)]
   for l,r in spans:m.quad((l,roof_y(z)+.018,z),(r,roof_y(z)+.018,z),(r,roof_y(z2)+.018,z2),(l,roof_y(z2)+.018,z2),ROOF,tuple(v*.72 for v in tint))
 for z in [-D/2,D/2]:
  m.box(0,y-.04,z+.07*(1 if z>0 else -1),W,.10,.12,FRAME)
  m.cylinder(-w/2+.16,.08,z,.04,y-.12,FRAME,6)
 m.detail=False
 return roof_y

def compact_suburban_home(name,gambrel=False):
 w,d=(7.6,10.2) if gambrel else (6.4,9.2);floors=1 if gambrel else 2
 m=Model(name,'residential-low',2);m.houseForm='detached';m.roofForm='gambrel' if gambrel else 'cross-ridge-gable'
 domestic_block(m,w,d,floors,tint=(.92,.72,.54),brick=True)
 roof_y=suburban_roof(m,w,d,floors*2.85,gambrel)
 # Shallow entry canopy uses the authored door position, not the lot centre.
 entry=m.streetFronts[0]['position'][0]
 m.box(entry,2.40,d/2+.38,1.48,.12,.95,FRAME)
 m.box(entry,.015,d/2+.22,1.35,.12,.58,CONCRETE)
 m.box(entry,.015,d/2+.62,1.52,.06,.27,CONCRETE)
 # Rear roof-mounted solar panels use non-emissive existing metal material.
 for x in [-1.25,.10]:
  a,b=-.65,-2.25
  m.quad((x,roof_y(a)+.06,a),(x+1.10,roof_y(a)+.06,a),(x+1.10,roof_y(b)+.06,b),(x,roof_y(b)+.06,b),FRAME,(.37,.54,.69))
  for z in [a,(a+b)/2,b]:m.quad((x,roof_y(z)+.07,z),(x+1.1,roof_y(z)+.07,z),(x+1.1,roof_y(z-.025)+.07,z-.025),(x,roof_y(z-.025)+.07,z-.025),PAINT,(.44,.50,.51))
 m.box(w*.3,roof_y(-2.9)-.12,-2.9,.48,.85,.55,BRICK)
 m.box(w*.3,roof_y(-2.9)+.73,-2.9,.62,.09,.69,CONCRETE)
 m.finish()

compact_suburban_home('compact-brick-dormer-home')
compact_suburban_home('gambrel-garden-home',gambrel=True)

# Long single-storey homes follow the shallow roofs, raised timber porches
# and solar banks in the official residential-construction reference image.
# Original geometry shares the existing finishes and authored distant topology.
def modular_home(name,hipped=False):
 w,d=(14.2,8.2) if hipped else (16.2,7.4);base=.42;eave=base+2.85;rise=1.30 if hipped else 1.12
 tint=(.55,.43,.27) if hipped else (.24,.38,.47)
 m=Model(name,'residential-low',1);m.houseForm='detached';m.roofForm='shallow-hip' if hipped else 'shallow-long-gable'
 domestic_block(m,w,d,1,tint=tint,siding=True,windowWidth=1.06)
 for part in m.parts.values():
  for i in range(1,len(part['p']),3):part['p'][i]+=base
 for front in m.streetFronts:front['position'][1]+=base
 # A low, ventilated foundation supports the raised floor.
 m.box(0,0,0,w-.10,base,d-.10,CONCRETE,(.72,.73,.69))
 for side in [-1,1]:
  for x in [-w*.36,0,w*.36]:m.box(x,.12,side*(d/2-.035),.55,.14,.025,RECESS)
 # Ridge runs along the long frontage; explicit slopes retain metre-scale UVs.
 W=w+.65;D=d+.60;hip=1.65 if hipped else 0
 a=(-W/2,eave,D/2);b=(W/2,eave,D/2);c=(W/2,eave,-D/2);e=(-W/2,eave,-D/2)
 left=(-W/2+hip,eave+rise,0);right=(W/2-hip,eave+rise,0)
 def roof(q):m.quad(*q,ROOF,(.53,.57,.58),uvs=[(0,0),(math.dist(q[0],q[1])/2,0),(math.dist(q[0],q[1])/2,math.dist(q[1],q[2])/2),(0,math.dist(q[1],q[2])/2)])
 roof([a,b,right,left]);roof([c,e,left,right])
 if hipped:roof([e,a,left,e]);roof([b,c,right,b])
 else:
  for side in [-1,1]:
   x=side*w/2;q=[(x,eave,d/2),(x,eave,-d/2),(x,eave+rise,0),(x,eave,d/2)]
   m.quad(*(q if side>0 else q[::-1]),PAINT,tint)
 # Thin eaves, rainwater pipes and a ridge cap define the silhouette.
 for side in [-1,1]:
  m.box(0,eave-.10,side*D/2,W,.15,.08,PAINT,(.74,.76,.73))
  m.box(side*(W/2-.03),eave-.10,0,.08,.15,D,PAINT,(.74,.76,.73))
  m.cylinder(side*(w/2-.15),base, d/2+.12,.035,eave-base,FRAME,6)
 m.box(0,eave+rise-.015,0,W-hip*2,.055,.12,ROOF,(.63,.65,.64))
 # Porch boards, an open railing with a gate at the actual door, and steps.
 door=m.streetFronts[0]['position'][0];pw=8.0 if hipped else 11.4;back=d/2+.04;front=back+1.55;px=max(-w/2+pw/2+.2,min(w/2-pw/2-.2,door))
 m.box(px,base-.12,(back+front)/2,pw,.12,front-back,WOOD,(.91,.84,.70))
 m.detail=True
 for k in range(1,9):m.box(px,base+.002,back+(front-back)*k/9,pw,.008,.016,FRAME,(.45,.43,.39))
 m.detail=False
 def rail(x0,x1,z):
  if x1<=x0:return
  for x in [x0,x1]:m.box(x,base,z,.07,1.0,.07,WOOD,(.83,.82,.73))
  m.box((x0+x1)/2,base+.96,z,x1-x0,.06,.07,WOOD,(.83,.82,.73))
  m.box((x0+x1)/2,base+.16,z,x1-x0,.045,.05,WOOD,(.83,.82,.73))
  m.detail=True
  for k in range(1,max(2,round((x1-x0)/.17))):
   x=x0+(x1-x0)*k/max(2,round((x1-x0)/.17));m.box(x,base+.20,z,.027,.76,.027,WOOD,(.83,.82,.73))
  m.detail=False
 rail(px-pw/2,door-.7,front);rail(door+.7,px+pw/2,front)
 for side in [-1,1]:
  x=px+side*pw/2;m.box(x,base,(back+front)/2,.055,1.0,.055,WOOD)
  m.box(x,base+.96,(back+front)/2,.065,.06,front-back,WOOD,(.83,.82,.73))
 for k in range(3):m.box(door,0,front+.18+(2-k)*.26,1.32,(k+1)*base/3,.28,WOOD,(.86,.80,.68))
 # Broad shelter is held by slender posts, without closing the open porch.
 for x in [px-pw/2+.06,px+pw/2-.06]:m.box(x,base,front-.04,.09,2.36,.09,WOOD,(.85,.84,.78))
 roof([(px-pw/2-.15,base+2.82,back-.08),(px-pw/2-.15,base+2.65,front+.14),(px+pw/2+.15,base+2.65,front+.14),(px+pw/2+.15,base+2.82,back-.08)])
 # Solar modules sit above the front roof plane with fine frames and cell seams.
 def roof_y(z):return eave+rise*(1-z/(D/2))
 for x in [-4.6,-2.25,.1,2.45]:
  z0,z1=.65,2.30;span=1.98
  m.quad((x,roof_y(z1)+.065,z1),(x+span,roof_y(z1)+.065,z1),(x+span,roof_y(z0)+.065,z0),(x,roof_y(z0)+.065,z0),FRAME,(.31,.45,.62))
  for xx in [x,x+span]:m.quad((xx-.025,roof_y(z1)+.075,z1),(xx+.025,roof_y(z1)+.075,z1),(xx+.025,roof_y(z0)+.075,z0),(xx-.025,roof_y(z0)+.075,z0),PAINT,(.64,.69,.71))
  m.detail=True
  for k in range(1,5):
   z=z0+(z1-z0)*k/5;m.quad((x,roof_y(z+.012)+.076,z+.012),(x+span,roof_y(z+.012)+.076,z+.012),(x+span,roof_y(z)+.076,z),(x,roof_y(z)+.076,z),PAINT,(.48,.56,.60))
  m.detail=False
 m.cylinder(w*.35,eave+.35,-d*.24,.10,.58,FRAME,8)
 m.box(w*.35,eave+.92,-d*.24,.34,.05,.34,FRAME)
 m.finish()

m=dwelling('gabled-garden-cottage',8.4,10.4,1,tint=(.72,.81,.80),siding=True);m.finish()
m=dwelling('hipped-brick-bungalow',11,10,1,roof='hip',tint=(.90,.74,.60),brick=True);m.finish()
m=dwelling('dormer-detached-home',8.5,11,2,tint=(.90,.85,.72),siding=True);dormer(m,-2.2,1,6.6);m.finish()
m=dwelling('covered-porch-family-home',10,10.8,2,tint=(.70,.78,.84),siding=True,porch=False);covered_entry(m,-1.7,6.1,6.6,2.4);m.finish()
m=dwelling('cross-gable-family-home',8.2,10,2,tint=(.85,.78,.67),brick=True);domestic_block(m,5,6,1,x=5,z=-1,tint=(.79,.81,.74));pitched_roof(m,5,-1,5,6,2.85,1.6);m.finish()
m=dwelling('brick-paired-homes',12,11,2,form='semi',roof='hip',tint=(.88,.67,.54),brick=True);m.finish()
m=dwelling('narrow-gabled-townhouse',6.6,12,2,form='terrace',tint=(.76,.77,.73),brick=True);dormer(m,-1.5,1,6.65);m.finish()

def historic_terrace(name,stepped):
 # Narrow party-wall houses, with genuine recessed sash windows and a shaped
 # masonry gable in front of the pitched roof. All dimensions are metres.
 w,d,h,rise=7.6,12,8.55,2.5
 m=Model(name,'residential-low',3);m.houseForm='terrace';m.roofForm='stepped-gable' if stepped else 'bell-gable'
 tint=(.63,.46,.35) if stepped else (.80,.65,.49)
 def wall(x0,x1,y0,y1,z,material=BRICK,color=tint):
  if x1<=x0 or y1<=y0:return
  q=[(x0,y0,z),(x1,y0,z),(x1,y1,z),(x0,y1,z)]
  m.quad(*(q if z>0 else q[::-1]),material,color,uvs=[(x0/2,y0/2),(x1/2,y0/2),(x1/2,y1/2),(x0/2,y1/2)] if material==BRICK else None)
 def opening(x,lo,hi,width,z,door=False):
  sign=1 if z>0 else -1;l=x-width/2;r=x+width/2
  def frame(x,y,z,w,height,depth):
   # Distant topology keeps every sash and frame face. Only sub-pixel side
   # returns are omitted; the close model and its recessed depth stay intact.
   part=m.parts[PAINT];start=len(part['i']);m.detail=True;m.box(x,y,z,w,height,depth,PAINT);m.detail=False
   face=start+(0 if sign>0 else 6);part['far']+=part['i'][face:face+6]
  wall(l,r,lo,hi,z-sign*.18,WOOD if door else OCCUPIED if (round(x*10)+round(lo))%3==0 else GLASS,(.60,.68,.67))
  for side in [l,r]:m.quad((side,lo,z),(side,hi,z),(side,hi,z-sign*.18),(side,lo,z-sign*.18),PAINT)
  for side in [l-.055,r+.055]:frame(side,lo-.065,z,.11,hi-lo+.13,.16)
  for y in [lo-.06,hi]:frame(x,y,z,width+.22,.10,.20)
  if door:
   wall(l+.16,r-.16,hi-.64,hi-.14,z-sign*.15,GLASS,(.65,.75,.75))
   for y in [lo+.15,lo+.84]:m.box(x,y,z-sign*.14,width-.25,.53,.025,FRAME)
   m.box(r-.15,lo+1.0,z-sign*.1,.035,.22,.045,PAINT)
   if sign>0:m.streetFronts.append({'kind':'entrance','position':[x,.08,z+.08],'normal':[0,1],'width':width})
  else:
   frame(x,lo,z-sign*.09,.045,hi-lo,.045)
   frame(x,lo+(hi-lo)*.54,z-sign*.09,width,.055,.045)
  m.detail=True;m.box(x,lo-.12,z+sign*.04,width+.30,.06,.36,CONCRETE);m.detail=False
 # No windows in the shared side walls, and no projecting side eaves.
 for side in [-1,1]:
  x=side*w/2;q=[(x,0,-d/2),(x,h,-d/2),(x,h,d/2),(x,0,d/2)]
  q=q if side>0 else q[::-1]
  m.quad(*q,BRICK,tint,uvs=[(z/2,y/2) for _,y,z in q])
 for sign in [-1,1]:
  z=sign*d/2;bay=w/3
  for f in range(3):
   y=f*2.85
   for j in range(3):
    x=(j-1)*bay;door=sign>0 and f==0 and j==0;width=1.08 if door else 1.30
    lo=y+(.08 if door else .58);hi=y+2.37;l=x-width/2;r=x+width/2
    for rect in [(x-bay/2,l,y,y+2.85),(r,x+bay/2,y,y+2.85),(l,r,y,lo),(l,r,hi,y+2.85)]:wall(*rect,z)
    opening(x,lo,hi,width,z,door)
  m.box(0,.04,z,w,.22,.18,CONCRETE,(.67,.65,.59))
  for y in [2.83,5.68,h-.06]:m.box(0,y,z,w,.10,.18,PAINT,(.85,.85,.78))
 # Roof slopes stop behind the front masonry gable instead of overhanging it.
 W=w-.16;front=d/2-.12;back=-d/2-.12;roof_tint=(.78,.44,.30) if stepped else (.53,.56,.55)
 for side in [-1,1]:
  q=[(side*W/2,h,front),(0,h+rise,front),(0,h+rise,back),(side*W/2,h,back)]
  m.quad(*(q if side<0 else q[::-1]),ROOF,roof_tint,uvs=[(0,0),(2.3,0),(2.3,d/2),(0,d/2)])
  m.detail=True
  for k in range(1,17):
   t=k/17;x=side*W/2*(1-t);y=h+rise*t+.015
   q=[(x,y,back),(x,y,front),(x+side*.035,y-.01,front),(x+side*.035,y-.01,back)]
   m.quad(*(q if side>0 else q[::-1]),ROOF,tuple(c*.72 for c in roof_tint))
  m.detail=False
 m.box(0,h+rise-.025,0,.14,.12,d-.24,ROOF,roof_tint)
 q=[(w/2,h,-d/2),(-w/2,h,-d/2),(0,h+rise,-d/2),(w/2,h,-d/2)]
 m.quad(*q,BRICK,tint,uvs=[(x/2,y/2) for x,y,_ in q])
 # Piecewise profiles produce a stepped crown or a gently curved bell crown.
 profile=([(3.8,0),(3.8,.56),(3.1,.56),(3.1,1.12),(2.4,1.12),(2.4,1.68),(1.7,1.68),(1.7,2.24),(1,2.24),(1,2.8)] if stepped else [(3.8,0),(3.8,.35),(3.25,.35),(2.9,.48),(2.55,.72),(2.28,1.02),(2.02,1.4),(1.8,1.8),(1.57,2.18),(1.28,2.48),(.93,2.68),(.65,2.8)])
 z=d/2+.075;window_lo=h+.58;window_hi=h+1.92;half=.57
 for (a,y0),(b,y1) in zip(profile,profile[1:]):
  if y1<=y0:continue
  cuts=sorted({h+y0,h+y1,*[y for y in [window_lo,window_hi] if h+y0<y<h+y1]})
  for lo,hi in zip(cuts,cuts[1:]):
   left=a+(b-a)*(lo-h-y0)/(y1-y0);right=a+(b-a)*(hi-h-y0)/(y1-y0)
   def panel(points):m.quad(*[(x,y,z) for x,y in points],BRICK,tint,uvs=[(x/2,y/2) for x,y in points])
   if lo>=window_lo and hi<=window_hi:
    panel([(-left,lo),(-half,lo),(-half,hi),(-right,hi)]);panel([(half,lo),(left,lo),(right,hi),(half,hi)])
   else:panel([(-left,lo),(left,lo),(right,hi),(-right,hi)])
 # White stone capping follows the actual outer silhouette, including steps.
 for sign in [-1,1]:
  for (a,y0),(b,y1) in zip(profile,profile[1:]):
   x0=sign*a;x1=sign*b;dx=x1-x0;dy=y1-y0;length=math.hypot(dx,dy)
   nx=-sign*dy/length*.075;ny=sign*dx/length*.075
   q=[(x0,h+y0,z+.08),(x1,h+y1,z+.08),(max(-w/2,min(w/2,x1+nx)),h+y1+ny,z+.08),(max(-w/2,min(w/2,x0+nx)),h+y0+ny,z+.08)]
   m.quad(*(q if sign>0 else q[::-1]),PAINT)
 opening(0,window_lo,window_hi,half*2,z)
 m.box(0,h+2.8,z,profile[-1][0]*2,.12,.28,PAINT)
 # Slim lift beam and chimney add recognizable silhouettes at close range.
 m.box(0,h+2.43,z+.28,.11,.13,.62,FRAME)
 m.detail=True;m.box(0,h+2.23,z+.56,.045,.20,.045,FRAME);m.detail=False
 m.box(w*.28,h+.6,-2,.55,1.65,.62,BRICK,tint);m.box(w*.28,h+2.25,-2,.70,.12,.77,PAINT)
 m.finish()

historic_terrace('stepped-gable-brick-terrace',True)
historic_terrace('bell-gable-brick-terrace',False)

def street_terrace(name,dormered):
 # Reference: official Zones & Signature Buildings row-street pictures.
 # Original party-wall homes: three full storeys, narrow individual entries,
 # recessed sash windows, and either a raised stoop or a street-facing dormer.
 w,d,fh=7.6,12,2.95;base=.12 if dormered else 1.0;h=base+3*fh
 tint=(.75,.60,.48) if dormered else (.61,.40,.31)
 m=Model(name,'residential-low',3);m.houseForm='terrace';m.roofForm='street-ridge-dormer' if dormered else 'corniced-flat'
 def face(l,r,lo,hi,z,mat=BRICK,color=tint):
  if r<=l or hi<=lo:return
  q=[(l,lo,z),(r,lo,z),(r,hi,z),(l,hi,z)]
  m.quad(*(q if z>0 else q[::-1]),mat,color,uvs=[(x/2,y/2) for x,y,_ in (q if z>0 else q[::-1])] if mat==BRICK else None)
 def trim(x,y,z,width,height,depth,sign=1,mat=PAINT,color=(.82,.80,.72)):
  # Keep the outward frame face at distance; omit its tiny side returns.
  part=m.parts[mat];start=len(part['i']);m.detail=True;m.box(x,y,z,width,height,depth,mat,color);m.detail=False
  start+=0 if sign>0 else 6;part['far']+=part['i'][start:start+6]
 def opening(x,lo,hi,width,z,door=False):
  s=1 if z>0 else -1;l=x-width/2;r=x+width/2
  face(l,r,lo,hi,z-s*.20,WOOD if door else OCCUPIED if round(x+lo)%3==0 else GLASS,(.40,.50,.48) if door else (.78,.85,.84))
  for a in [l,r]:m.quad((a,lo,z),(a,hi,z),(a,hi,z-s*.20),(a,lo,z-s*.20),CONCRETE,(.68,.67,.61))
  for a in [l-.045,r+.045]:trim(a,lo-.045,z-s*.045,.09,hi-lo+.09,.14,s,PAINT,(.40,.46,.43))
  for y in [lo-.045,hi]:trim(x,y,z-s*.045,width+.18,.09,.14,s,PAINT,(.40,.46,.43))
  if door:
   face(l+.15,r-.15,hi-.65,hi-.12,z-s*.17,GLASS,(.80,.85,.81))
   for y in [lo+.16,lo+.79]:trim(x,y,z-s*.15,width-.26,.48,.045,s,PAINT,(.36,.46,.42))
   m.detail=True;m.box(r-.16,lo+.98,z-s*.10,.04,.23,.06,FRAME);m.detail=False
   if s>0:m.streetFronts.append({'kind':'entrance','position':[x,lo,z+.10],'normal':[0,1],'width':width})
  else:
   trim(x,lo,z-s*.12,.045,hi-lo,.055,s,FRAME)
   trim(x,lo+(hi-lo)*.60,z-s*.12,width,.055,.055,s,PAINT,(.42,.48,.46))
  trim(x,lo-.14,z+s*.06,width+.36,.085,.36,s,CONCRETE,(.83,.79,.69))
  # A narrow projecting sill and masonry header frame the real recess;
  # no bright continuous box surrounds every pane.
  trim(x,hi+.10,z+s*.03,width+.30,.12,.18,s,CONCRETE,(.58,.56,.49))
  if door and s>0:
   for side in [-1,1]:
    trim(x+side*(width/2+.17),lo-.04,z+.05,.18,hi-lo+.30,.28,s,CONCRETE,(.66,.64,.57))
    trim(x+side*(width/2+.17),lo-.04,z+.08,.24,.19,.34,s,CONCRETE,(.67,.65,.58))
   trim(x,hi+.25,z+.12,width+.70,.13,.48,s,CONCRETE,(.67,.65,.58))
   trim(x,hi+.38,z+.12,width+.80,.08,.54,s,CONCRETE,(.76,.74,.66))
   m.detail=True
   # The address plate and projecting wall lamp remain separate from glass.
   m.box(r+.34,lo+1.45,z+.17,.16,.22,.035,FRAME)
   m.box(l-.37,hi-.15,z+.20,.14,.24,.18,FRAME)
   m.box(l-.37,hi-.12,z+.30,.09,.15,.025,PAINT,(.94,.89,.71))
   m.detail=False
  elif not dormered and s>0 and lo>base+fh and lo<base+2*fh and x>1:
   m.detail=True
   # One window air conditioner per raised-stoop home, below the sash.
   m.box(x,lo-.42,z+.21,width*.78,.30,.62,FRAME,(.76,.80,.77))
   for j in range(4):m.box(x,lo-.38+j*.055,z+.535,width*.67,.022,.025,CONCRETE,(.59,.61,.57))
   m.detail=False
 # No side windows, overhanging eaves or other protrusions at party walls.
 for side in [-1,1]:
  x=side*w/2;q=[(x,0,-d/2),(x,h,-d/2),(x,h,d/2),(x,0,d/2)]
  m.quad(*(q if side>0 else q[::-1]),BRICK,tint,uvs=[(z/2,y/2) for _,y,z in (q if side>0 else q[::-1])])
 for sign in [-1,1]:
  z=sign*d/2
  face(-w/2,w/2,0,base,z,CONCRETE,(.69,.67,.59))
  for floor in range(3):
   y=base+floor*fh
   for bay in range(3):
    x=(bay-1)*w/3;door=floor==0 and bay==0;width=1.10 if door else 1.14
    lo=y+(.04 if door else .43);hi=y+2.46;l=x-width/2;r=x+width/2
    for rect in [(x-w/6,l,y,y+fh),(r,x+w/6,y,y+fh),(l,r,y,lo),(l,r,hi,y+fh)]:face(*rect,z)
    opening(x,lo,hi,width,z,door)
  for y in [base-.06,h-.16]:
   m.box(0,max(.02,y),z,w,.12,.18,CONCRETE,(.76,.72,.63))
 # Individual entrance stairs and open metal railings leave the door visible.
 entryX=-w/3;stepCount=1 if dormered else 5;rise=(base+.04)/stepCount
 for k in range(stepCount):m.box(entryX,.02,d/2+.2+(stepCount-1-k)*.30,1.48,rise*(k+1),.32,CONCRETE,(.71,.70,.64))
 if not dormered:
  for side in [-1,1]:
   x=entryX+side*.76
   for k in range(6):
    z=d/2+.12+k*.30;y=base+.04-k*rise
    m.detail=True;m.box(x,max(.02,y),z,.045,.85,.045,FRAME);m.detail=False
   for height in [.28,.82]:
    a=(x-.025,base+height,d/2+.10);b=(x-.025,.02+height,d/2+1.65)
    m.quad(a,b,(x+.025,b[1],b[2]),(x+.025,a[1],a[2]),FRAME)
 if dormered:
  rise=3.7;front=d/2+.24;back=-d/2-.24
  def ry(z):return h+rise*(1-abs(z)/front)
  def roof(l,r,z0,z1):
   q=[(l,ry(z1),z1),(r,ry(z1),z1),(r,ry(z0),z0),(l,ry(z0),z0)]
   m.quad(*q,ROOF,(.63,.65,.63),uvs=[(x/2,z/2) for x,_,z in q])
  # Cut a real dormer opening from the slope; no roof passes through its glass.
  roof(-w/2,w/2,back,0);roof(-w/2,-1.10,0,front);roof(1.10,w/2,0,front)
  roof(-1.10,1.10,0,1.20);roof(-1.10,1.10,4.20,front)
  z=4.20;lo=ry(z);top=h+3.30
  face(-1.10,1.10,lo,lo+.25,z,PAINT,(.51,.58,.58))
  face(-1.10,-.94,lo+.25,top,z,PAINT,(.51,.58,.58));face(.94,1.10,lo+.25,top,z,PAINT,(.51,.58,.58))
  face(-.94,.94,top-.13,top,z,PAINT,(.51,.58,.58));opening(0,lo+.25,top-.13,1.88,z)
  for s in [-1,1]:
   q=[(s*1.1,ry(1.20),1.20),(s*1.1,top,1.20),(s*1.1,top,z),(s*1.1,lo,z)]
   m.quad(*(q if s>0 else q[::-1]),PAINT,(.51,.58,.58))
  m.box(0,top,2.70,2.2,.10,3.0,ROOF,(.54,.57,.56))
  # Fine standing seams follow both roof slopes and stop at the dormer hole.
  # The main roof silhouette and glass remain in the distant topology.
  m.detail=True
  for k in range(1,20):
   x=-w/2+k*w/20
   spans=[(back,0),(0,front)] if abs(x)>1.13 else [(back,0),(0,1.20),(4.20,front)]
   for z0,z1 in spans:
    q=[(x-.018,ry(z1)+.025,z1),(x+.018,ry(z1)+.025,z1),(x+.018,ry(z0)+.025,z0),(x-.018,ry(z0)+.025,z0)]
    m.quad(*q,ROOF,(.42,.45,.43),uvs=[(xx/2,zz/2) for xx,_,zz in q])
  m.detail=False
  m.box(0,h+rise-.025,0,w,.12,.16,ROOF)
  for s in [-1,1]:
   q=[(s*w/2,h,back),(s*w/2,h+rise,0),(s*w/2,h,front),(s*w/2,h,back)]
   m.quad(*(q if s>0 else q[::-1]),BRICK,tint)
 else:
  m.surface(m.ring(w-.24,d-.24,0),h,ROOF,(.67,.68,.63))
  for z in [-d/2,d/2]:
   m.box(0,h,z,w,.32,.18,BRICK,tint);m.box(0,h+.32,z,w,.13,.34,CONCRETE,(.76,.73,.65))
   m.box(0,h-.12,z,w,.16,.42,FRAME,(.62,.67,.65))
  for s in [-1,1]:m.box(s*(w/2-.08),h,0,.16,.32,d,BRICK,tint)
  m.box(1.6,h,-2.8,1.1,.48,.8,FRAME);m.box(1.6,h+.48,-2.8,1.18,.08,.88,CONCRETE)
 # Chimney, rainwater pipe and gutters are shared-material static geometry.
 m.box(w/2-.52,h+.55,-2,.55,1.25,.72,BRICK,tint);m.box(w/2-.52,h+1.8,-2,.72,.12,.88,CONCRETE)
 for s in [-1,1]:m.box(0,h-.05,s*(d/2+.12),w,.12,.14,FRAME)
 m.detail=True;m.cylinder(w/2-.15,.04,d/2+.12,.045,h-.04,FRAME,6);m.detail=False
 m.finish()

street_terrace('raised-stoop-brick-terrace',False)
street_terrace('dormer-roof-brick-terrace',True)
m=dwelling('garden-wing-bungalow',9,10,1,tint=(.83,.86,.77),siding=True);domestic_block(m,5,7,1,x=5.5,z=-1.5,tint=(.7,.76,.78),siding=True);pitched_roof(m,5.5,-1.5,5,7,2.85,1.5,hip=1.1);m.finish()

# Reference: the official CS2 high-density office district. These original
# facades use separate vision glass, spandrels, projecting mullions and roof
# screens. Reuse existing materials; only small returns leave distant topology.
def office_skin(m,w,d,floors,x=0,z=0,y=0,bevel=.7,oval=False,ribs=False):
 inset=.19 if ribs else .015
 points=([(x+(w/2-inset)*math.cos(j*math.tau/32),z+(d/2-inset)*math.sin(j*math.tau/32)) for j in range(32)] if oval else m.ring(w-inset*2,d-inset*2,bevel,x,z))
 fh=3.2;top=y+floors*fh;metal=(.53,.58,.59)
 for side,(a,b) in enumerate(zip(points,points[1:]+points[:1])):
  dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz);tx,tz=dx/length,dz/length;nx,nz=tz,-tx
  def p(u,v,out=0):return(a[0]+tx*u+nx*out,v,a[1]+tz*u+nz*out)
  def panel(l,r,lo,hi,out,mat,color=(1,1,1)):
   m.quad(p(r,lo,out),p(l,lo,out),p(l,hi,out),p(r,hi,out),mat,color)
  bays=max(1,round(length/1.6));bay=length/bays;front=nz>.9 and length>3 and y==0
  for f in range(floors):
   level=y+f*fh;lo=level+(.12 if f==0 and y==0 else .72);hi=level+fh-.09
   # The floor-edge insulation is behind dark glass, never a glowing room.
   panel(0,length,max(y,level-.09),lo,-.10,GLASS,(.52,.61,.64))
   for j in range(bays):
    l=j*bay+.035;r=(j+1)*bay-.035;door=front and f==0 and j==bays//2
    shade=.90+((j*17+f*31+side*11)%13)/130
    panel(l,r,level+.08 if door else lo,hi,-.12,GLASS,(shade,shade,min(1,shade+.025)))
    if door:
     centre=(l+r)/2;m.streetFronts.append({'kind':'entrance','position':list(p(centre,level+.08,.08)),'normal':[nx,nz],'width':r-l})
     panel(centre-.025,centre+.025,level+.08,hi,.07,PAINT,metal)
     m.detail=True
     for u in [centre-.15,centre+.15]:panel(u-.018,u+.018,level+1,level+1.45,.13,PAINT)
     m.detail=False
  # Adjacent upper/lower frame strips form one coplanar transom. The
  # opaque spandrel continues behind it, so sub-pixel strips can drop out
  # at distance without opening a slit through the building.
  for f in range(floors+1):
   m.detail=0<f<floors
   level=y+f*fh;panel(0,length,max(y,level-.09),min(top,level+.045),.065,PAINT,metal)
  m.detail=False
  # One continuous profile per bay, rather than a stack of heavy floor boxes.
  for j in range(bays+1):
   u=j*bay;half=.035;l=max(0,u-half);r=min(length,u+half)
   panel(l,r,y,top,.075,PAINT,metal)
   m.detail=True
   m.quad(p(l,y,-.12),p(l,y,.075),p(l,top,.075),p(l,top,-.12),PAINT,metal)
   m.quad(p(r,y,.075),p(r,y,-.12),p(r,top,-.12),p(r,top,.075),PAINT,metal)
   m.detail=False
  # Substantial vertical fins distinguish the slender and stepped towers.
  if ribs and length>4:
   for u in [.28,length-.28]:
    panel(u-.12,u+.12,y,top+.4,.25,PAINT,(.69,.71,.68))
    for edge,reverse in [(u-.12,False),(u+.12,True)]:
     q=[p(edge,y,.025),p(edge,y,.25),p(edge,top+.4,.25),p(edge,top+.4,.025)]
     m.quad(*(q[::-1] if reverse else q),PAINT,(.57,.60,.59))
 # Hollow roof rim: parapet and coping expose the membrane and roof plant.
 inner=[(x+(px-x)*(1-.5/w),z+(pz-z)*(1-.5/d)) for px,pz in points]
 m.surface(inner,top+.04,ROOF)
 for i,(a,b) in enumerate(zip(points,points[1:]+points[:1])):
  c,e=inner[i],inner[(i+1)%len(inner)]
  m.quad((b[0],top,b[1]),(a[0],top,a[1]),(a[0],top+.45,a[1]),(b[0],top+.45,b[1]),FRAME)
  m.quad((c[0],top,c[1]),(e[0],top,e[1]),(e[0],top+.45,e[1]),(c[0],top+.45,c[1]),FRAME)
  m.quad((a[0],top+.45,a[1]),(c[0],top+.45,c[1]),(e[0],top+.45,e[1]),(b[0],top+.45,b[1]),PAINT,metal)
 return top

def office_roof(m,x,y,z,w=7,d=5):
 m.roofwork(x,y,z,w*.65,d*.55)
 # Open-top ventilation screen leaves the actual equipment visible overhead.
 points=[(x-w/2,z-d/2),(x+w/2,z-d/2),(x+w/2,z+d/2),(x-w/2,z+d/2)]
 for a,b in zip(points,points[1:]+points[:1]):
  dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz);nx,nz=dz/length,-dx/length
  m.quad((b[0],y+.05,b[1]),(a[0],y+.05,a[1]),(a[0],y+1.7,a[1]),(b[0],y+1.7,b[1]),RECESS)
  m.detail=True
  for j in range(7):
   lo=y+.12+j*.22;hi=lo+.10
   m.quad((b[0]+nx*.05,lo,b[1]+nz*.05),(a[0]+nx*.05,lo,a[1]+nz*.05),(a[0]+nx*.09,hi,a[1]+nz*.09),(b[0]+nx*.09,hi,b[1]+nz*.09),PAINT,(.37,.41,.42))
  m.detail=False
  m.quad((b[0],y+1.7,b[1]),(b[0]+nx*.12,y+1.7,b[1]+nz*.12),(a[0]+nx*.12,y+1.7,a[1]+nz*.12),(a[0],y+1.7,a[1]),PAINT,(.48,.51,.51))

def office_entry(m,canopy_z):
 front=min(m.streetFronts,key=lambda f:abs(f['position'][0]))
 x,_,z=front['position'];m.entrance(canopy_z,x=x)
 # Paired stone piers and a slim canopy give the tower a readable street entry.
 for dx in [-2.05,2.05]:m.box(x+dx,0,z+.10,.32,3.2,.50,PAINT,(.61,.62,.57))
 m.box(x,3.15,z+.35,4.55,.18,1.8,PAINT,(.65,.66,.62))

m=Model('glass-podium-offices','office',21);h=office_skin(m,25,21,3);h=office_skin(m,16,14,18,x=-2,z=-1,y=h,bevel=2);office_roof(m,-2,h,-1);m.plant(9,9.85,6,3,4);office_entry(m,11);m.finish()
m=Model('stepped-concrete-offices','office',18);h=m.shell(24,20,3);h=office_skin(m,21,17,7,y=h,ribs=True);h=office_skin(m,16,13,5,x=-2,y=h,ribs=True);h=office_skin(m,11,9,3,x=-3,y=h,ribs=True);office_roof(m,-3,h,0,6,4);m.plant(8,32.3,4,2,5);office_entry(m,10.5);m.finish()
m=Model('elliptic-glass-offices','office',19);h=office_skin(m,23,19,2,bevel=3);h=office_skin(m,19,15,17,y=h,oval=True);office_roof(m,0,h,0);office_entry(m,10);m.finish()
m=Model('slender-glass-offices','office',23);h=office_skin(m,11,13,23,bevel=1.3,ribs=True);office_roof(m,0,h,0,6,4);office_entry(m,7);m.finish()

# Small workplaces use their own metre-scale forms, not scaled-down towers.
# Reference: the official CS2 low-density-office district image, reviewed
# before authoring these original facades, roof equipment and entry volumes.
def office_solar(m,y,z):
 for x in [-3,0,3]:
  m.quad((x-1.2,y+.18,z+1),(x+1.2,y+.18,z+1),(x+1.2,y+.52,z-1),(x-1.2,y+.52,z-1),FRAME,(.34,.45,.54))
  for dx in [-.4,.4]:m.quad((x+dx-.02,y+.19,z+1),(x+dx+.02,y+.19,z+1),(x+dx+.02,y+.53,z-1),(x+dx-.02,y+.53,z-1),CONCRETE)

m=Model('corner-glass-local-offices','office',3,building='localoffice')
h=m.shell(12,11,3,bevel=.2,curtain=True)
# A projecting entrance bay and narrow upper fins break the facade silhouette.
m.box(3.9,0,5.8,.18,h+.65,.65,PAINT);m.box(1.5,0,5.8,.18,h+.65,.65,PAINT)
for y in [0,3.2,6.4,9.6]:m.box(2.7,y,5.8,2.6,.12,.65,PAINT)
m.entrance(6.0,x=0);m.roofwork(2.5,h,-2.5,2.4,1.8);office_solar(m,h,1.2)
m.finish()

m=Model('garden-wing-local-offices','office',2,building='localoffice')
h=m.shell(18,10,2,z=-1.5,bevel=.18,windowWidth=2.2,tint=(.78,.75,.65))
m.shell(5,4,1,x=3.5,z=5.4,bevel=.15,curtain=True)
m.box(3.5,3.15,7.6,5.6,.15,1.3,FRAME)
m.plant(-5,0,5.6,5,2);m.roofwork(-4,h,-2.2,2.4,1.8);office_solar(m,h,1)
m.finish()
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

def apartment_balcony(m,x,y,z,w=3.0):
 # Individual dwelling balconies leave solid masonry between neighboring
 # apartments. Open railings preserve the view into their recessed windows.
 m.box(x,y,z,w,.16,1.25,CONCRETE,(.83,.81,.73))
 front=z+.625
 for u in [x-w/2,x,x+w/2]:
  m.quad((u-.025,y+.16,front),(u+.025,y+.16,front),(u+.025,y+1.18,front),(u-.025,y+1.18,front),FRAME)
 for lo,hi in [(y+.28,y+.33),(y+1.12,y+1.18)]:
  m.quad((x-w/2,lo,front),(x+w/2,lo,front),(x+w/2,hi,front),(x-w/2,hi,front),FRAME)
 for edge in [x-w/2,x+w/2]:
  m.quad((edge,y+1.12,z-.6),(edge,y+1.12,front),(edge,y+1.18,front),(edge,y+1.18,z-.6),FRAME)
  bar=[(edge,y+.16,z-.025),(edge,y+.16,z+.025),(edge,y+1.12,z+.025),(edge,y+1.12,z-.025)]
  m.quad(*(bar if edge<x else bar[::-1]),FRAME)
 # Small intermediate bars drop only at a distance; slab and main rail stay.
 m.detail=True
 for k in range(1,10):
  u=x-w/2+w*k/10
  m.quad((u-.012,y+.33,front),(u+.012,y+.33,front),(u+.012,y+1.12,front),(u-.012,y+1.12,front),FRAME)
 m.detail=False

def finish_apartment(m):
 # Matte trim, slabs and blinds can share the painted surface draw. Bake
 # their original base colors into vertices rather than adding material draws.
 paint=m.parts[PAINT]
 for material in [CONCRETE,BLIND]:
  part=m.parts.pop(material);offset=len(paint['p'])//3
  for key in ['p','n','uv']:paint[key]+=part[key]
  paint['c'] += [value*materials[material][1][i%3]/materials[PAINT][1][i%3] for i,value in enumerate(part['c'])]
  for key in ['i','far']:paint[key]+=[i+offset for i in part[key]]
 m.finish()

def apartment_cornice(m,w,d,y,h):
 # A hollow perimeter trim leaves the roof membrane and terrace visible.
 outer=[(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]
 inner=[(-w/2+.28,-d/2+.28),(w/2-.28,-d/2+.28),(w/2-.28,d/2-.28),(-w/2+.28,d/2-.28)]
 def p(point,height):return (point[0],height,point[1])
 for i,a in enumerate(outer):
  b=outer[(i+1)%4];c=inner[i];e=inner[(i+1)%4];tint=(.88,.85,.76)
  m.quad(p(b,y),p(a,y),p(a,y+h),p(b,y+h),CONCRETE,tint)
  m.quad(p(b,y+h),p(a,y+h),p(c,y+h),p(e,y+h),CONCRETE,tint)
  m.detail=True;m.quad(p(c,y),p(e,y),p(e,y+h),p(c,y+h),CONCRETE,tint);m.detail=False

m=Model('linear-balcony-apartments','residential',6)
h=m.shell(21,11,6,bevel=.12,tint=(.60,.37,.28),cladding=BRICK,windowWidth=1.65,framed=True,baySpacing=4.1,balconyDoors=(1,3),frameOut=.10)
for floor in range(1,6):
 for x in [-4.152,4.152]:apartment_balcony(m,x,floor*3.2+.12,6.05,3)
# Ground-floor stonework and a projecting cornice give the block a clear base
# and roofline without horizontal glass bands around every facade.
m.box(0,0,0,21.1,.32,11.1,CONCRETE,(.85,.82,.73))
apartment_cornice(m,21.45,11.45,h-.16,.18)
apartment_cornice(m,21.25,11.25,h+.02,.16)
for x in [-4,4]:
 m.box(x,h+.1,-2,1.4,1.1,1.2,FRAME)
 m.detail=True;m.box(x,h+1.2,-2,1.6,.08,1.4,CONCRETE);m.detail=False
m.entrance(5.8);finish_apartment(m)
# A compact brick courtyard walk-up: two pitched wings enclose a usable
# garden rather than repeating the flat-roof balcony slab silhouette.
m=Model('small-courtyard-apartments','residential',4)
h=m.shell(7,17,4,x=-4.5,bevel=.12,tint=(.70,.48,.34),cladding=BRICK,windowWidth=1.35,framed=True)
back=m.shell(9,7,3,x=3.5,z=-5,bevel=.12,tint=(.84,.74,.58),cladding=PAINT,windowWidth=1.3,framed=True)
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
m=Model('brick-neighborhood-walkup','residential',3);h=m.shell(12,11,3,bevel=.18,tint=(.72,.43,.29),cladding=BRICK,framed=True)
m.box(0,h-.25,0,12.4,.28,11.4,CONCRETE,(.78,.72,.60));m.box(0,h,0,11.6,.16,10.6,ROOF)
m.roofwork(-2,h,-2,2.5,1.5);m.entrance(5.7);m.finish()
# A second human-scale apartment type for 16 m square sites. Its pitched
# attic and projecting entrance contrast with the compact brick walk-up.
m=Model('compact-hipped-apartments','residential',4)
h=m.shell(11,10,3,bevel=.18,tint=(.84,.79,.67),cladding=PAINT,windowWidth=1.45,framed=True)
pitched_roof(m,0,0,11,10,h,2.5,hip=1.4,tint=(.54,.58,.61))
dormer(m,0,3.5,h+1.2)
m.box(-3,h+1.1,-2,.7,1.8,.8,CONCRETE,(.72,.67,.57))
m.entrance(5.3)
# Paired entrance piers and a deep canopy provide a visible street threshold.
for x in [-1,1]:m.box(x,0,5.65,.22,2.6,.22,CONCRETE,(.84,.81,.73))
m.box(0,2.6,5.6,2.6,.2,1.6,CONCRETE,(.84,.81,.73))
m.finish()
m=Model('narrow-balcony-apartments','residential',5);h=m.shell(10,23,4,bevel=.3,balconies=True,tint=(.70,.77,.73),cladding=PAINT,framed=True,balconySides=(0,4),openRail=True)
h=m.shell(8,17,1,z=-2,y=h,bevel=.3,tint=(.68,.58,.44),cladding=BRICK,framed=True);m.roofwork(0,h,-3,2.8,1.8);m.plant(0,12.95,8.5,6,1.5);m.entrance(12);m.finish()
m=Model('stepped-midrise-apartments','residential',8)
h=m.shell(18,14,5,bevel=.12,tint=(.78,.73,.63),cladding=PAINT,windowWidth=1.65,framed=True,baySpacing=4.1,balconyDoors=(1,2),frameOut=.10)
for floor in [1,2,3,4]:
 for x in [-2.22,2.22]:apartment_balcony(m,x,floor*3.2+.12,7.5,2.8)
apartment_cornice(m,18.4,14.4,h-.15,.20)
h=m.shell(12,11,3,x=-2,z=-1,y=h,bevel=.12,tint=(.64,.45,.32),cladding=BRICK,windowWidth=1.35,framed=True,baySpacing=4.1,frameOut=.10)
m.plant(6,16.3,1,2,3)
for x in [-4,0]:
 m.box(x,h+.1,-2,1.4,1.1,1.2,FRAME)
 m.detail=True;m.box(x,h+1.2,-2,1.6,.08,1.4,CONCRETE);m.detail=False
m.entrance(7.3,-2.22);finish_apartment(m)
m=Model('corner-retail-gallery','commercial',3);h=m.shell(24,18,2,curtain=True);h=m.shell(14,12,1,x=-4,z=-2,y=h,curtain=True);m.plant(8,6.7,3,3,5);m.roofwork(-4,h,-2,4,2);m.entrance(10);m.finish()
def apartment_lobby(m,x,z):
 # Separate dwelling access fits in the masonry pier between retail displays.
 m.quad((x-.46,.08,z+.12),(x+.46,.08,z+.12),(x+.46,2.45,z+.12),(x-.46,2.45,z+.12),GLASS)
 for dx in [-.49,.49]:m.box(x+dx,.08,z+.14,.06,2.43,.06,PAINT)
 m.box(x,2.48,z+.27,1.16,.10,.46,FRAME)
 m.streetFronts.append({'kind':'entrance','position':[x,.08,z+.16],'normal':[0,1],'width':.92})

m=Model('neighborhood-mixed-use','commercial',5)
h=m.shell(18,12,5,bevel=.12,cladding=BRICK,tint=(.61,.39,.30),windowWidth=1.65,framed=True,baySpacing=4.3,balconyDoors=(1,2),frameOut=.10,retailWidth=3.3,retailGroup=2,clothAwning=True,compactFar=True)
for floor in range(1,5):
 for x in [-2.22,2.22]:apartment_balcony(m,x,floor*3.2+.12,6.5,2.8)
apartment_cornice(m,18.4,12.4,h-.16,.18)
m.roofwork(0,h,-2,3,1.6)
apartment_lobby(m,0,6)
finish_apartment(m)
# Mid-sized urban blocks fit the 32-40 metre frontages of four-cell-deep
# apartment zoning. Wings enclose real outdoor space at their authored scale.
# Based on the massing, separate balconies and masonry openings in the official
# Zones & Signature Buildings pictures; every vertex here is original.
def neighborhood_court(name,width,paired):
 m=Model(name,'residential',5 if paired else 6)
 front_depth=9;depth=26;front_z=(depth-front_depth)/2
 tint=(.66,.43,.32) if paired else (.80,.75,.62)
 cladding=BRICK if paired else PAINT
 floors=5 if paired else 6
 # Full-width street frontage and lower perpendicular garden wings.
 h=m.shell(width,front_depth,floors,z=front_z,bevel=.12,
  tint=tint,cladding=cladding,windowWidth=1.65,framed=True,
  baySpacing=4.6,balconyDoors=(1,round((width-.24)/4.6)-2),frameOut=.10,compactFar=True)
 bays=round((width-.24)/4.6);bay=(width-.24)/bays
 for f in range(1,floors):
  for j in [1,bays-2]:apartment_balcony(m,width/2-.12-(j+.5)*bay,f*3.2+.12,depth/2+.55,3)
 wing=7 if paired else 9
 for side in ([-1,1] if paired else [-1]):
  x=side*(width-wing)/2;z=-front_depth/2
  top=m.shell(wing,depth-front_depth,4,x=x,z=z,bevel=.12,
   tint=(.84,.77,.63),cladding=PAINT,windowWidth=1.45,framed=True,baySpacing=4.6,frameOut=.10,compactFar=True)
  # Roof equipment and projecting stair head stay visible in distant views.
  m.box(x,top+.08,z-3,2.5,1.7,3.2,PAINT,(.67,.67,.62))
  m.box(x,top+1.78,z-3,2.7,.10,3.4,PAINT,(.78,.77,.71))
 m.roofwork(-width*.23,h,front_z,3.6,2.2)
 # A furnished court occupies the space between the building wings. The
 # ground is open to the sky and uses the shared lot lawn below this asset.
 garden_x=0 if paired else wing/2;garden_w=width-2*wing if paired else width-wing
 m.box(garden_x,.025,-3,garden_w,.08,1.5,ROOF)
 m.plant(garden_x,0,-8,max(3,garden_w-4),3)
 m.box(garden_x,0,1,3,.45,.65,PAINT,(.80,.78,.71))
 m.detail=True
 for x in [garden_x-3,garden_x+3]:
  m.box(x,.42,-3.8,1.8,.12,.5,WOOD)
  m.box(x,.55,-4.02,1.8,.65,.08,WOOD)
  for dx in [-.65,.65]:m.box(x+dx,0,-3.8,.08,.42,.4,FRAME)
 m.detail=False
 finish_apartment(m)
neighborhood_court('neighborhood-u-court-apartments',28,True)
neighborhood_court('neighborhood-l-court-apartments',36,False)

m=Model('modern-courtyard-house','residential-low',2);h=m.shell(8,10,2,x=-3);m.shell(5,6,1,x=3,z=-2,curtain=True);m.box(3,0,4,4,.15,5,WOOD);m.plant(5,0,6,1,3);m.roofwork(-3,h,-2,1,.8);m.entrance(5.5,-3);m.finish()
m=Model('modern-rowhouse','residential-low',3);h=m.shell(7,11,3,balconies=True);m.box(-2,0,5.55,.8,9.3,.16,WOOD);m.plant(2,0,6,1,2);m.roofwork(0,h,-2,1.2,1);m.entrance(6);m.finish()

# Perimeter blocks use actual metre-sized wings around an open courtyard.
# Their larger footprint fills consolidated zones without enlarging windows.
def courtyard(name,category,floors,w=46,d=32,tint=(.86,.83,.74),facade=None):
 m=Model(name,category,floors)
 facade=facade or {}
 cladding=CONCRETE if category=='office' else BRICK
 # Separate wings leave a planted, ground-level central court; no solid podium.
 h=m.shell(w,9,floors,z=-(d-9)/2,bevel=.35,tint=tint,cladding=cladding,**facade)
 m.shell(w,9,floors-1,z=(d-9)/2,bevel=.35,tint=tint,balconies=category=='residential',cladding=cladding,**facade)
 m.shell(9,d-18,floors-1,x=-(w-9)/2,bevel=.35,tint=tint,cladding=cladding,**facade)
 m.shell(9,d-18,floors-2,x=(w-9)/2,bevel=.35,tint=tint,cladding=cladding,**facade)
 m.roofwork(-w*.28,h,-(d-9)/2,5,2)
 m.terrace(-w*.23,(floors-1)*3.2,(d-9)/2,10,5)
 m.terrace(w*.23,(floors-1)*3.2,(d-9)/2,10,5)
 m.roofwork((w-9)/2,(floors-2)*3.2,0,4,2)
 # The rear roof has clear space opposite its mechanical plant.
 m.plant(w*.23,h+.06,-(d-9)/2,min(10,w*.25),4.5)
 for x in [-w*.22,w*.22]:
  m.plant(x,0,0,5,5)
  if not facade:m.entrance(d/2+.35,x)
 if facade:
  front=w-.7;bays=round(front/facade['baySpacing']);bay=front/bays
  for j in [2,bays-3]:apartment_lobby(m,front/2-j*bay,d/2)
 # Benches and walkways make the courtyard read as usable shared space.
 m.box(0,.02,0,w-18,.08,1.8,ROOF)
 for x in [-6,6]:m.box(x,.45,3,3,.18,.6,WOOD)
 return m
m=courtyard('perimeter-garden-apartments','residential',6);m.finish()
m=courtyard('perimeter-terrace-residences','residential',9,48,34,tint=(.95,.72,.55));m.finish()
m=courtyard('perimeter-tower-residences','residential',10,46,32,tint=(.72,.80,.82));h=m.shell(14,9,5,x=-12,z=-11.5,y=32,curtain=True);m.roofwork(-12,h,-11.5,4,2);m.floors=15;m.finish()
m=courtyard('perimeter-mixed-use','commercial',6,44,30,tint=(.72,.73,.60),facade={'windowWidth':1.65,'framed':True,'baySpacing':4.6,'frameOut':.10,'retailWidth':3.3,'retailGroup':2,'clothAwning':True,'compactFar':True})
# Street-level canopies run along the retail frontage, leaving entrances between.
# Individual sign-fronted canopies are generated with each storefront bay.
finish_apartment(m)
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

from industrial_models import build_industry
build_industry(Model,dict(paint=PAINT,frame=FRAME,glass=GLASS,roof=ROOF,recess=RECESS,concrete=CONCRETE,brick=BRICK,wood=WOOD))

# Each model has one primitive per material, with vertex colour variation.
modular_home('long-porch-modular-home')
modular_home('solar-hipped-ranch-home',hipped=True)

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
