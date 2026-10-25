"""Original growable industrial buildings, in metres.
Shared material batches and authored distant topology keep the complete sheds,
loading bays, rooflights and processing silhouettes at city-view distances.
"""
import math

def build_industry(Model, materials):
 PAINT, FRAME, GLASS, ROOF, RECESS, CONCRETE, BRICK, WOOD = [materials[k] for k in ['paint','frame','glass','roof','recess','concrete','brick','wood']]
 steel=(.65,.70,.70); trim=(.79,.81,.77); yellow=(.94,.69,.16)

 def finish(m):
  # Vertex colours are linear in glTF. Convert this reference palette from
  # display colours so sunlit sheet metal does not wash out to cream.
  m.parts[PAINT]['c']=[v**2.2 for v in m.parts[PAINT]['c']]
  m.finish()

 def pipe(m,a,b,r=.13,color=steel,sides=10):
  axis=[b[i]-a[i] for i in range(3)];length=math.sqrt(sum(v*v for v in axis));axis=[v/length for v in axis]
  helper=[0,1,0] if abs(axis[1])<.9 else [1,0,0]
  u=[axis[1]*helper[2]-axis[2]*helper[1],axis[2]*helper[0]-axis[0]*helper[2],axis[0]*helper[1]-axis[1]*helper[0]];l=math.sqrt(sum(v*v for v in u));u=[v/l for v in u]
  v=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]]
  normals=[[u[k]*math.cos(j*math.tau/sides)+v[k]*math.sin(j*math.tau/sides) for k in range(3)] for j in range(sides)]
  for j in range(sides):
   n,q=normals[j],normals[(j+1)%sides];p=lambda origin,normal:tuple(origin[k]+normal[k]*r for k in range(3))
   lo=j*math.tau*r/sides;hi=(j+1)*math.tau*r/sides
   m.quad(p(a,q),p(a,n),p(b,n),p(b,q),PAINT,color,uvs=[(hi,0),(lo,0),(lo,length),(hi,length)])
   m.parts[PAINT]['n'][-12:]=q+n+n+q

 def vessel(m,x,z,r,h,color=steel):
  sides=24
  # Rolled steel shells, a shallow conical cap and retained reinforcing bands.
  def section(y,height,r0,r1):
   slope=(r0-r1)/height;normalScale=math.sqrt(1+slope*slope)
   def uv(angle,radius,yy):
    if r0==r1:return (angle*radius,yy)
    # Unroll the conical lid as an annular sector, so its narrowing tip does
    # not squeeze a full cylinder's circumference into a few centimetres.
    scale=math.hypot(height,r0-r1)/(r0-r1);theta=angle/scale
    return (radius*scale*math.sin(theta),radius*scale*math.cos(theta))
   for j in range(sides):
    a=j*math.tau/sides;b=(j+1)*math.tau/sides
    p=lambda angle,rr,yy:(x+math.cos(angle)*rr,yy,z+math.sin(angle)*rr)
    m.quad(p(b,r0,y),p(a,r0,y),p(a,r1,y+height),p(b,r1,y+height),PAINT,color,uvs=[uv(b,r0,y),uv(a,r0,y),uv(a,r1,y+height),uv(b,r1,y+height)])
    n=lambda t:[math.cos(t)/normalScale,slope/normalScale,math.sin(t)/normalScale]
    m.parts[PAINT]['n'][-12:]=n(b)+n(a)+n(a)+n(b)
  section(.35,h,r,r);section(h+.35,r*.4,r,.12)
  cap=h+.35+r*.4
  for j in range(sides):
   a=j*math.tau/sides;b=(j+1)*math.tau/sides
   m.quad((x,cap,z),(x+.12*math.cos(b),cap,z+.12*math.sin(b)),(x+.12*math.cos(a),cap,z+.12*math.sin(a)),(x,cap,z),PAINT,color)
  for y in [.3,h*.35,h*.7,h+.25]:
   for j in range(sides):
    a=j*math.tau/sides;b=(j+1)*math.tau/sides
    m.quad((x+(r+.025)*math.cos(b),y,z+(r+.025)*math.sin(b)),(x+(r+.025)*math.cos(a),y,z+(r+.025)*math.sin(a)),(x+(r+.025)*math.cos(a),y+.09,z+(r+.025)*math.sin(a)),(x+(r+.025)*math.cos(b),y+.09,z+(r+.025)*math.sin(b)),FRAME)
  m.detail=True
  # Ladder stands off the shell; fine rungs disappear only in distant geometry.
  front=z+r+.15
  for dx in [-.3,.3]:pipe(m,(x+dx,.4,front),(x+dx,h+.65,front),.035,trim,6)
  for i in range(int(h/.34)):pipe(m,(x-.3,.5+i*.34,front),(x+.3,.5+i*.34,front),.026,trim,6)
  m.detail=False

 def panels(m,x,z,w,d,h,color):
  m.box(x,0,z,w,.65,d,CONCRETE,(.83,.83,.77))
  # Broad individually shaded sheet panels remain in distant geometry.
  for axis,length,side in [('x',w,d/2),('z',d,w/2)]:
   count=math.ceil(length/2.6)
   for sign in [-1,1]:
    for i in range(count):
     lo=-length/2+length*i/count;hi=-length/2+length*(i+1)/count;tint=tuple(c*(.96+.02*((i+int(length))%4)) for c in color)
     if axis=='x':q=[(x+lo,.65,z+sign*side),(x+hi,.65,z+sign*side),(x+hi,h,z+sign*side),(x+lo,h,z+sign*side)]
     else:q=[(x+sign*side,.65,z+lo),(x+sign*side,.65,z+hi),(x+sign*side,h,z+hi),(x+sign*side,h,z+lo)]
     if (axis=='x' and sign<0) or (axis=='z' and sign>0):q=q[::-1]
     m.quad(*q,PAINT,tint)
    m.detail=True
    for i in range(1,math.ceil(length/.58)):
     u=-length/2+i*.58
     if u>=length/2:continue
     if axis=='x':m.box(x+u,.65,z+sign*(side+.025),.045,h-.65,.055,PAINT,color)
     else:m.box(x+sign*(side+.025),.65,z+u,.055,h-.65,.045,PAINT,color)
    m.detail=False
  for sx in [-1,1]:
   for sz in [-1,1]:m.box(x+sx*(w/2+.025),.1,z+sz*(d/2+.025),.11,h+.05,.11,PAINT,trim)

 def shed_roof(m,x,z,w,d,h,rise=1.0,color=(.48,.56,.57)):
  a,b=x-w/2-.25,x+w/2+.25;f,g=z-d/2-.25,z+d/2+.25
  m.quad((a,h,g),(x,h+rise,g),(x,h+rise,f),(a,h,f),PAINT,color)
  m.quad((b,h,g),(b,h,f),(x,h+rise,f),(x,h+rise,g),PAINT,color)
  m.quad((a,h,z+d/2),(b,h,z+d/2),(x,h+rise,z+d/2),(a,h,z+d/2),PAINT,color)
  m.quad((b,h,z-d/2),(a,h,z-d/2),(x,h+rise,z-d/2),(b,h,z-d/2),PAINT,color)
  m.box(x,h+rise-.02,z,.18,.12,d+.6,PAINT,trim)
  for side in [a,b]:m.box(side,h-.12,z,.13,.18,d+.6,FRAME)
  m.detail=True
  for side in [-1,1]:
   for i in range(1,math.ceil((d+.5)/.7)):
    zz=f+i*.7
    if zz>=g:continue
    xx=a if side<0 else b
    q=[(xx,h+.028,zz),(x,h+rise+.028,zz),(x,h+rise+.055,zz+.045),(xx,h+.055,zz+.045)]
    if side<0:q=q[::-1]
    m.quad(*q,PAINT,trim,uvs=m.metric_uvs(q,[side*rise/(w/2+.25),1,0]))
  for sx in [-1,1]:pipe(m,(x+sx*(w/2+.12),.2,z-d/2+.2),(x+sx*(w/2+.12),h,z-d/2+.2),.06,trim,6)
  m.detail=False

 def bay(m,x,z,width=3.2,raised=False):
  y=.9 if raised else .08;height=3.3
  m.streetFronts.append({'kind':'loading','position':[x,y,z+.55],'normal':[0,1],'width':width,'raised':raised})
  m.box(x,y,z,width+.36,height+.28,.14,FRAME)
  # Closed sectional shutter sits behind the projecting rubber dock surround.
  m.box(x,y+.1,z+.09,width,height-.12,.06,PAINT,(.59,.64,.63))
  for dx in [-width/2-.14,width/2+.14]:m.box(x+dx,y,z+.19,.20,height+.18,.22,RECESS)
  m.box(x,y+height+.04,z+.19,width+.48,.18,.22,RECESS)
  if raised:
   m.box(x,0,z+.55,width+.55,.9,1.25,CONCRETE,(.73,.74,.7))
   m.box(x,.87,z+.73,width-.16,.06,.7,FRAME)
  m.detail=True
  for i in range(1,10):m.box(x,y+i*.32,z+.13,width,.018,.025,FRAME)
  m.detail=False
  for dx in [-width/2-.45,width/2+.45]:pipe(m,(x+dx,.05,z+.7),(x+dx,1.05,z+.7),.07,yellow,8)
  # Door and dock remain part of the model footprint, so angled lots cannot
  # push them through a neighboring building or into a road.

 def pallets(m,x,z):
  m.detail=True
  for i in range(3):
   xx=x+(i%2)*1.35;zz=z+(i//2)*1.25
   m.box(xx,.05,zz,1.15,.16,1,WOOD)
   m.box(xx,.21,zz,1.05,1.05,.9,PAINT,(.65,.56,.36))
   for dx in [-.32,.32]:m.box(xx+dx,.2,zz+.46,.04,1.08,.025,FRAME)
  m.detail=False

 def office(m,x,z,w=7,d=5):
  m.shell(w,d,1,x=x,z=z,bevel=.06,cladding=PAINT,tint=(.76,.79,.73),windowWidth=1.65,framed=True,baySpacing=2.6)
  m.box(x,2.95,z+d/2+.65,3,.12,1.45,FRAME)

 def apron(m,x,z,w,d):
  m.quad((x-w/2,.025,z-d/2),(x-w/2,.025,z+d/2),(x+w/2,.025,z+d/2),(x+w/2,.025,z-d/2),ROOF,(.75,.77,.74),uvs=[(0,0),(0,d/2),(w/2,d/2),(w/2,0)])

 m=Model('industrial-trade-depot','industrial',1,building='warehouse')
 panels(m,0,-1,13,8,4.5,(.54,.63,.59));shed_roof(m,0,-1,13,8,4.5,.8)
 for x in [-3.5,.5]:bay(m,x,3.05,2.8)
 office(m,4.4,2.4,3.4,3.8);m.roofwork(-2,4.9,-1,2.6,1.5);apron(m,0,4.4,13.8,2.8);pallets(m,-5,-3);finish(m)

 m=Model('industrial-light-workshop','industrial',1,building='factory')
 panels(m,0,-1,13,9,4.7,(.43,.51,.58));shed_roof(m,0,-1,13,9,4.7,1.0)
 bay(m,-2.8,3.55,3.4);office(m,3.8,3.2,4.4,3.5);apron(m,-2,5,8,2.8)
 # An elevated glazed rooflight and exhaust distinguish manufacturing from
 # the compact storage depot without reducing doors to miniature scale.
 m.box(0,5.55,-2,2.1,.65,4.8,FRAME)
 m.quad((-1,6.215,.3),(1,6.215,.3),(1,6.215,-4.3),(-1,6.215,-4.3),GLASS,(.65,.72,.73))
 for z in [-3,-1]:m.box(0,6.23,z,2.1,.035,.05,FRAME)
 pipe(m,(-4.5,4.7,-3.8),(-4.5,8.2,-3.8),.25,steel,12)
 pipe(m,(-4.5,8.2,-3.8),(-3.6,8.2,-3.8),.25,steel,12)
 m.roofwork(3,5.15,-2.5,2.2,1.3);finish(m)

 m=Model('industrial-distribution-hall','industrial',2,building='warehouse')
 panels(m,0,-4,40,23,7,(.66,.70,.67));shed_roof(m,0,-4,40,23,7,1.25)
 for x in [-13,-7,-1,5]:bay(m,x,7.55,3.8,True)
 office(m,14,9.4,10,7);apron(m,-5,11.5,29,7.8)
 for x in [-12,-2,8]:m.roofwork(x,8.0,-3,3.4,2.2)
 # Three long rooflight ridges give the broad roof a readable rhythm.
 for x in [-12,0,12]:
  y=7+1.25*(1-abs(x)/20)+.07
  m.box(x,y,-6,2.3,.28,7,FRAME)
  m.quad((x-1,y+.295,-2.5),(x+1,y+.295,-2.5),(x+1,y+.295,-9.5),(x-1,y+.295,-9.5),GLASS,(.65,.72,.73))
  for z in [-8,-6,-4]:m.box(x,y+.31,z,2.3,.035,.045,FRAME)
 pallets(m,-18,10);finish(m)

 m=Model('industrial-sawtooth-works','industrial',2,building='factory')
 panels(m,0,-3,25,19,5.8,(.57,.31,.24))
 # Northlight sawteeth are continuous roofs with vertical glazed clerestories.
 for i in range(4):
  z=-12.5+i*4.75;front=z+4.75;lo,hi=5.8,7.5
  m.quad((-12.7,lo,front),(12.7,lo,front),(12.7,hi,z),(-12.7,hi,z),PAINT,(.50,.56,.56))
  m.quad((12.5,lo,z),(-12.5,lo,z),(-12.5,hi,z),(12.5,hi,z),GLASS,(.65,.72,.73))
  for x in [-12.5,12.5]:
   q=[(x,lo,z),(x,lo,front),(x,hi,z),(x,lo,z)]
   m.quad(*(q if x<0 else q[::-1]),PAINT,(.57,.31,.24))
  m.box(0,hi-.06,z,25.5,.12,.12,FRAME)
  for x in range(-12,13,3):m.box(x,lo,z-.025,.065,hi-lo,.08,FRAME)
  m.detail=True
  for x in range(-12,13):m.quad((x-.02,lo+.02,front),(x+.02,lo+.02,front),(x+.02,hi+.02,z),(x-.02,hi+.02,z),PAINT,trim)
  m.detail=False
 for x in [3.5,8.5]:bay(m,x,6.55,3.4)
 office(m,-6.5,8,9,5);apron(m,6,9.4,12,5.8);pallets(m,9,-9)
 for x in [-8,5]:pipe(m,(x,6.3,-7),(x,10,-7),.32,steel,14);pipe(m,(x,10,-7),(x+1.2,10,-7),.32,steel,14)
 finish(m)

 m=Model('industrial-processing-yard','industrial',3,building='factory')
 panels(m,-6,-5,20,20,6.3,(.42,.53,.57));shed_roof(m,-6,-5,20,20,6.3,1.1)
 office(m,-10,8,10,6);bay(m,-1,5.05,4.2,True);apron(m,-1,10,11,8)
 for z,h in [(-9,16),(-1,12)]:vessel(m,9,z,2.45,h,(.69,.73,.71))
 # Exposed structural gantry and pipes connect the processing vessels to the hall.
 for x in [4.8,13.1]:
  for z in [-12,3]:m.box(x,.1,z,.24,8.5,.24,FRAME)
  for y in [4.2,8.1]:m.box(x,y,-4.5,.18,.25,15.5,FRAME)
 for z in [-12,3]:m.box(8.9,8.1,z,8.7,.25,.22,FRAME)
 for z,y in [(-9,7.1),(-1,5.5)]:
  pipe(m,(9,y,z),(2,y,z),.22,steel,12);pipe(m,(2,y,z),(2,5.8,z),.22,steel,12)
 pipe(m,(7,.4,4),(7,6.7,4),.16,yellow,10);pipe(m,(7,6.7,4),(-3,6.7,4),.16,yellow,10)
 m.roofwork(-7,7.2,-5,4,2.4);pallets(m,11,6);finish(m)
