"""Bake complete building assets from CC0 Poly Haven architecture kits.
Source kits live outside the repository. Run with their downloaded parent directory.
The resulting glTF is pruned and simplified with glTF Transform before publication.
"""
import json,math,struct,pathlib,sys,copy,shutil
base=pathlib.Path(sys.argv[1])
for kit in ['urban','factory']:
 folder=base/kit;doc=json.loads((folder/'source.gltf').read_text());sources={n['name']:n for n in doc['nodes']};doc['nodes']=[];doc['scenes']=[{'name':'Borough complete building library','nodes':[]}];doc['scene']=0
 extra=bytearray();bufferIndex=len(doc['buffers']);doc['buffers'].append({'uri':'building-details.bin','byteLength':0})
 for name in ['roof','dark','metal']:
  doc['materials'].append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':{'roof':[.15,.17,.16,1],'dark':[.08,.10,.11,1],'metal':[.36,.39,.4,1]}[name],'roughnessFactor':.84,'metallicFactor':.1}})
 mats={m['name']:i for i,m in enumerate(doc['materials'])};roof=mats['roof'];metal=mats['metal'];dark=mats['dark']
 # Roof texture supplies real surface variation in a conventional UV map.
 shutil.copy(pathlib.Path(__file__).resolve().parents[1]/'dist/assets/asphalt-color.jpg',folder/'textures/roof.jpg')
 doc['images'].append({'uri':'textures/roof.jpg'});doc['textures'].append({'source':len(doc['images'])-1,'sampler':0});doc['materials'][roof]['pbrMetallicRoughness']['baseColorTexture']={'index':len(doc['textures'])-1};doc['materials'][roof]['pbrMetallicRoughness']['baseColorFactor']=[.65,.65,.6,1]
 def node(n):doc['nodes'].append(n);return len(doc['nodes'])-1
 def addpart(children,name,x,y,z,angle=0):
  src=sources[name];children.append(node({'name':name,'mesh':src['mesh'],'translation':[x,y,z],'rotation':[0,math.sin(angle/2),0,math.cos(angle/2)]}))
 def accessor(values,kind):
  width={'VEC3':3,'VEC2':2}[kind];offset=len(extra);extra.extend(struct.pack('<'+'f'*len(values),*values));doc['bufferViews'].append({'buffer':bufferIndex,'byteOffset':offset,'byteLength':len(values)*4});a={'bufferView':len(doc['bufferViews'])-1,'componentType':5126,'count':len(values)//width,'type':kind}
  if kind=='VEC3':a.update(min=[min(values[i::3]) for i in range(3)],max=[max(values[i::3]) for i in range(3)])
  doc['accessors'].append(a);return len(doc['accessors'])-1
 def mesh(children,quads,mat,name):
  pos=[];normal=[];uv=[]
  for a,b,c,d in quads:
   u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];l=math.sqrt(sum(t*t for t in n)) or 1;n=[t/l for t in n]
   for p,t in [(a,[0,0]),(b,[1,0]),(c,[1,1]),(a,[0,0]),(c,[1,1]),(d,[0,1])]:pos+=p;normal+=n;uv+=t
  doc['meshes'].append({'name':name,'primitives':[{'attributes':{'POSITION':accessor(pos,'VEC3'),'NORMAL':accessor(normal,'VEC3'),'TEXCOORD_0':accessor(uv,'VEC2')},'material':mat}]});children.append(node({'name':name,'mesh':len(doc['meshes'])-1}))
 def box(children,x,y,z,w,h,d,mat,name):
  a=x-w/2;b=x+w/2;c=y;e=y+h;f=z-d/2;g=z+d/2
  mesh(children,[[[a,c,g],[b,c,g],[b,e,g],[a,e,g]],[[b,c,f],[a,c,f],[a,e,f],[b,e,f]],[[b,c,g],[b,c,f],[b,e,f],[b,e,g]],[[a,c,f],[a,c,g],[a,e,g],[a,e,f]],[[a,e,g],[b,e,g],[b,e,f],[a,e,f]]],mat,name)
 configs=( [('townhouse',3,3,2,'residential-low',1),('villa',4,3,2,'residential-low',2),('rowhouse',3,4,3,'residential-low',3),('corner-apartments',6,5,5,'residential',1),('court-apartments',10,8,6,'residential',2),('residential-tower',7,6,12,'residential',3),('terraced-residences',9,6,9,'residential',1),('shops',4,4,2,'commercial',2),('department-store',9,6,4,'commercial',1),('civic-offices',8,7,8,'office',2),('office-tower',10,8,15,'office',3),('slender-offices',4,4,18,'office',2),('narrow-apartments',4,4,11,'residential',1)] if kit=='urban' else [('workshop',5,5,2,'industrial',1),('warehouse',9,6,2,'industrial',2),('brick-factory',8,5,4,'industrial',3),('loft-apartments',7,5,5,'residential',2),('brick-retail',5,5,3,'commercial',3)] )
 for name,nx,nz,floors,category,variant in configs:
  children=[];width=nx*3;depth=nz*3
  def shell(ox,oz,bx,bz,nf,y0=0):
   w=bx*3;d=bz*3
   for side in range(4):
    angle=side*math.pi/2;count=bx if side%2==0 else bz;dep=d if side%2==0 else w
    def put(part,col,y):
     # Model modules span x=-3..0; align their center on each bay.
     xx=(col+.5)*3-count*1.5+1.5;zz=dep/2
     addpart(children,part,ox+xx*math.cos(angle)+zz*math.sin(angle),y0+y,oz-xx*math.sin(angle)+zz*math.cos(angle),angle)
    for floor in range(nf):
     for col in range(count):
      door=floor==0 and y0==0 and side==0 and col==count//2
      suffix=f'{variant:02d}'
      wall='wall_door_centered_small_01' if door else 'wall_window_centered_large_'+suffix
      window='door_centered_small_01' if door else 'window_centered_large_'+suffix
      if wall not in sources:wall='wall_window_centered_large_01'
      if window not in sources:window='window_centered_large_01'
      put(wall,col,floor*3);put(window,col,floor*3)
      if kit=='urban' and floor%2==1:put('cornice_standard_standard_01',col,(floor+1)*3-.2)
    for col in range(count):put('crown_standard_standard_01',col,nf*3)
   box(children,ox,y0+nf*3,oz,w,.16,d,roof,'textured roof')
   return y0+nf*3
  if name in ['court-apartments','terraced-residences']:
   # Separate wings give the completed model a courtyard or a terraced profile.
   h=shell(-width*.3,0,4,nz,floors);shell(width*.25,-depth*.24,5,max(2,nz//2),max(3,floors-2));shell(width*.25,depth*.29,5,2,3)
  else:h=shell(0,0,nx,nz,floors)
  if category=='residential-low':
   a=-width/2-.35;c=width/2+.35;f=-depth/2-.35;g=depth/2+.35;rise=2.6
   mesh(children,[[[a,h,f],[a,h,g],[0,h+rise,g],[0,h+rise,f]],[[0,h+rise,f],[0,h+rise,g],[c,h,g],[c,h,f]]],roof,'pitched roof')
   wallmat=next(i for i,m in enumerate(doc['materials']) if 'plaster' in m['name'])
   mesh(children,[[[a,h,f],[0,h+rise,f],[c,h,f],[a,h,f]],[[c,h,g],[0,h+rise,g],[a,h,g],[c,h,g]]],wallmat,'gable ends')
   box(children,-width*.28,h,-depth*.15,.75,3,1,metal,'chimney')
  else:
   # Mechanical plant is deliberately grouped on one part of the roof.
   for j in range(3):
    xx=-width*.2+j*2.1;zz=-depth*.2
    if name in ['court-apartments','terraced-residences']:xx=-width*.3
    box(children,xx,h+.2,zz+j*.5,1.6,1,1.5,metal,'air handling unit');box(children,xx,h+1.2,zz+j*.5,1.1,.08,1.05,dark,'vent grille')
    for k in range(6):box(children,xx-.6+k*.24,h+1.28,zz+j*.5,.055,.055,1.3,metal,'fan guard')
  # Projected entrance canopy and steps use actual building-scale dimensions.
  box(children,0,2.9,depth/2+.5,3.5,.12,1.8,metal,'entrance canopy');box(children,0,0,depth/2+.45,3.5,.18,1.3,metal,'entrance steps')
  idx=node({'name':name,'children':children,'extras':{'category':category,'floors':floors,'source':'Poly Haven CC0 '+kit}});doc['scenes'][0]['nodes'].append(idx)
 # Curved buildings use the artist-made facade bays around a closed perimeter.
 if kit=='urban':
  for name,segments,floors,category in [('crescent-offices',32,17,'office'),('round-residences',20,10,'residential'),('oval-commerce',24,4,'commercial')]:
   children=[];radius=3/(2*math.sin(math.pi/segments));points=[]
   for j in range(segments):
    theta=j*math.pi*2/segments;points.append([radius*math.cos(theta),radius*math.sin(theta)])
   for j,a in enumerate(points):
    c=points[(j+1)%segments];dx=c[0]-a[0];dz=c[1]-a[1];angle=math.atan2(dz,-dx)
    # The source bay's right endpoint is local X=0.
    for floor in range(floors):
     for part in ['wall_window_centered_large_02','window_centered_large_02']:
      addpart(children,part,a[0],floor*3,a[1],angle)
    addpart(children,'crown_standard_standard_01',a[0],floors*3,a[1],angle)
   quads=[];h=floors*3
   for j,a in enumerate(points):
    c=points[(j+1)%segments];quads.append([[0,h,0],[c[0],h,c[1]],[a[0],h,a[1]],[0,h,0]])
   mesh(children,quads,roof,'radial roof')
   for j in range(4):box(children,-2+j*1.4,h+.05,-2,1,1,1.5,metal,'roof plant')
   idx=node({'name':name,'children':children,'extras':{'category':category,'floors':floors,'source':'Poly Haven CC0 urban'}});doc['scenes'][0]['nodes'].append(idx)
 doc['buffers'][-1]['byteLength']=len(extra);(folder/'building-details.bin').write_bytes(extra);(folder/'buildings.gltf').write_text(json.dumps(doc,separators=(',',':')));print(kit,len(doc['scenes'][0]['nodes']),'complete models')
