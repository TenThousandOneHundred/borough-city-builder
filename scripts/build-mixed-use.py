"""Blender-authored apartment-over-shop buildings, metres, with authored detail tiers.
Reference: official Cities: Skylines II Zones & Signature Buildings / 4_Mixed_use.png.
Run Blender --background --factory-startup --python scripts/build-mixed-use.py
"""
import bpy, math, json, struct
import numpy as np
from pathlib import Path
from mathutils import Vector
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist/assets/buildings'; SOURCE=ROOT/'source-assets/buildings'; QA=ROOT/'references/qa'
for p in [OUT,SOURCE,QA]:p.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

# One repeating brick field in metres, authored and packed in the Blender file.
def brick_image(name,tint):
    n=512;yy,xx=np.mgrid[0:n,0:n];row=yy//16;shift=(row%2)*32
    mortar=((xx+shift)%64<2)|(yy%16<2);rng=np.random.default_rng(171)
    courses=rng.uniform(.91,1.07,(32,9));variation=courses[row,((xx+shift)//64)%9]+rng.normal(0,.025,(n,n))
    rgb=np.clip(variation[:,:,None]*np.array(tint)[None,None,:],0,1)
    rgb[mortar]=np.array(tint)*.74+.10
    rgba=np.concatenate([rgb,np.ones((n,n,1))],axis=2).astype(np.float32)
    im=bpy.data.images.new(name,width=n,height=n,alpha=False);im.pixels.foreach_set(rgba.ravel());im.pack();return im

def mat(name,color,rough=.7,metal=0,image=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
    if image:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;m.node_tree.links.new(tex.outputs['Color'],b.inputs['Base Color'])
    return m
brick=mat('mixed-rose-brick',(.68,.47,.43),.88,image=brick_image('Rose running-bond brick',(.48,.40,.42)))
sage=mat('mixed-sage-brick',(.36,.46,.39),.86,image=brick_image('Sage painted masonry',(.34,.43,.35)))
stone=mat('mixed-stone',(.30,.32,.33),.87)
frames=mat('mixed-window-frames',(.79,.81,.76),.48,.2)
glass=mat('modern-glass',(.09,.14,.16),.25,.45)
occupied=mat('modern-glass-occupied',(.15,.18,.17),.3,.35)
roof=mat('modern-roof',(.30,.32,.30),.94)
dark=mat('mixed-recess',(.055,.065,.063),.91)
metal=mat('mixed-metal',(.36,.39,.38),.54,.5)
shop=mat('mixed-shop-glass',(.13,.20,.19),.28,.35)
shop.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.25
shop.surface_render_method='DITHERED'
interior=mat('mixed-shop-interior',(.64,.40,.21),.84)
interior.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(.23,.12,.045,1)
interior.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.35
sign=mat('mixed-shop-lettering',(.82,.78,.62),.7)
materials=[brick,sage,stone,frames,glass,occupied,roof,dark,metal,shop,sign,interior]
BRICK,SAGE,STONE,FRAME,GLASS,OCCUPIED,ROOF,DARK,METAL,SHOP,SIGN,INTERIOR=range(len(materials))

def coord(p):return (p[0],-p[2],p[1])
class Model:
    def __init__(self,name,w,d,floors,cladding):
        self.name,self.w,self.d,self.floors,self.cladding=name,w,d,floors,cladding
        self.parts=defaultdict(lambda: [[],[],[]]);self.detail=False;self.fronts=[]
    def face(self,points,material,uv=None):
        verts,faces,uvs=self.parts[(material,self.detail)];start=len(verts);verts.extend(coord(p) for p in points);faces.append(tuple(range(start,start+len(points))))
        if uv is None:
            a,b,c=[Vector(p) for p in points[:3]];normal=(b-a).cross(c-a)
            uv=[((p[2] if abs(normal.x)>abs(normal.z) else p[0])/2,p[1]/2) for p in points]
        uvs.extend(uv)
    def box(self,x,y,z,w,h,d,material):
        a,b=x-w/2,x+w/2;c,e=y,y+h;f,g=z-d/2,z+d/2
        for q in [((a,c,g),(b,c,g),(b,e,g),(a,e,g)),((b,c,f),(a,c,f),(a,e,f),(b,e,f)),((b,c,g),(b,c,f),(b,e,f),(b,e,g)),((a,c,f),(a,c,g),(a,e,g),(a,e,f)),((a,e,g),(b,e,g),(b,e,f),(a,e,f)),((a,c,f),(b,c,f),(b,c,g),(a,c,g))]:self.face(q,material)
    def facade(self,a,b,bays,y0,y1,windows=True,balcony=False,cladding=None):
        wall=self.cladding if cladding is None else cladding
        dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz);tx,tz=dx/length,dz/length;nx,nz=-tz,tx
        def p(u,y,out=0):return (a[0]+tx*u+nx*out,y,a[1]+tz*u+nz*out)
        def rect(l,r,lo,hi,material,out=0,uv=None):self.face([p(l,lo,out),p(r,lo,out),p(r,hi,out),p(l,hi,out)],material,uv)
        if not windows:rect(0,length,y0,y1,wall);return
        span=length/bays
        for j in range(bays):
            mid=(j+.5)*span;ww=1.35 if not balcony else 1.55;l,r=mid-ww/2,mid+ww/2
            lo=y0+(.18 if balcony else .85);hi=min(y1-.45,lo+1.78)
            rect(j*span,l,y0,y1,wall);rect(r,(j+1)*span,y0,y1,wall);rect(l,r,y0,lo,wall);rect(l,r,hi,y1,wall)
            # True openings: jambs reach glass set behind the brick face.
            self.detail=True
            for q in [[p(l,lo),p(l,hi),p(l,hi,-.18),p(l,lo,-.18)],[p(r,hi),p(r,lo),p(r,lo,-.18),p(r,hi,-.18)],[p(l,hi),p(r,hi),p(r,hi,-.18),p(l,hi,-.18)],[p(r,lo),p(l,lo),p(l,lo,-.18),p(r,lo,-.18)]]:self.face(q,STONE)
            self.detail=False
            # Each pane has its own 0..1 UV range for the game's room lighting.
            for side in [0,1]:
                x0=l+.08+side*(ww/2);x1=l+(side+1)*ww/2-.045
                rect(x0,x1,lo+.075,hi-.075,OCCUPIED if (j+int(y0)*3)%5==1 else GLASS,-.16,[(0,0),(1,0),(1,1),(0,1)])
            for u in [l,mid-.025,r-.065]:rect(u,u+.065,lo,hi,FRAME,-.08)
            for v in [lo,hi-.065]:rect(l,r,v,v+.065,FRAME,-.08)
            # A projecting sill remains in the distant silhouette.
            if abs(nz)>.9:self.box(p(mid,lo-.065,.06)[0],lo-.065,p(mid,lo-.065,.06)[2],ww+.16,.075,.24,FRAME)
            # Small AC units and vent bars are nearby-only details.
            if j%3==0 and int(y0)%2==0:
                self.detail=True;center=p(r+.42,y0+.65,.20)
                if abs(nz)>.9:
                    self.box(center[0],center[1],center[2],.62,.36,.35,METAL)
                    for k in range(4):self.box(center[0],center[1]+.06+k*.07,center[2]+nz*.18,.48,.018,.015,DARK)
                self.detail=False
    def balcony(self,y):
        z=self.d/2;width=6.5
        self.box(0,y,z-.18,width,.16,2.0,STONE)
        self.box(0,y+.16,z+.80,width,.035,.045,FRAME)
        self.box(0,y+1.16,z+.80,width,.055,.055,FRAME)
        for x in [-width/2,width/2]:
            self.box(x,y+1.16,z-.15,.055,.055,1.95,FRAME)
            self.box(x,y+.16,z+.80,.065,1,.065,FRAME)
            self.box(x,y+.16,z-1.05,.065,1,.065,FRAME)
        self.box(0,y+.16,z+.8,.055,1,.055,FRAME)
        self.detail=True
        for i in range(1,22):
            x=-width/2+i*width/22
            if abs(x)>.1:self.box(x,y+.18,z+.8,.028,.96,.028,FRAME)
        for side in [-1,1]:
            for i in range(1,6):self.box(side*width/2,y+.18,z-1.05+i*.31,.028,.96,.028,FRAME)
        self.detail=False
    def build(self):
        w,d,n=self.w,self.d,self.floors;front=d/2;base=3.8;top=base+(n-1)*3.05
        # Retail podium with actual shop openings and a separate residential lobby.
        self.box(0,0,0,w,.20,d,STONE);self.box(0,3.3,0,w,.50,d,STONE)
        self.box(0,.2,-d/2+.15,w,3.1,.3,STONE)
        for side in [-1,1]:
            x=side*(w/2-.16);run=7.2
            # Retail wraps the front corner rather than ending in a blank podium wall.
            self.box(x,.2,-run/2,.32,3.1,d-run,STONE)
            self.box(x,.2,front-run/2,.32,.4,run,STONE)
            self.box(x,2.8,front-run/2,.32,.5,run,STONE)
            for k in range(4):self.box(x,.6,front-k*2.4,.32,2.2,.18,STONE)
            for k in range(3):
                z=front-(k+.5)*2.4;plane=side*(w/2-.17)
                pts=[(plane,.6,z-1.1),(plane,.6,z+1.1),(plane,2.8,z+1.1),(plane,2.8,z-1.1)]
                if side>0:pts.reverse()
                self.face(pts,SHOP,[(0,0),(1,0),(1,1),(0,1)])
                self.box(side*(w/2-1.5),.6,z,.12,2.2,2.2,INTERIOR)
                self.box(side*(w/2-.1),.6,z,.08,2.2,.055,FRAME)
                self.box(side*(w/2-.06),2.9,z,.12,.28,1.7,METAL)
        for lo,hi in [(-w/2,-1.25),(1.25,w/2)]:
            length=hi-lo
            for x in [lo+.18,hi-.18]:self.box(x,.2,front-.15,.36,3.1,.3,STONE)
            center=(lo+hi)/2
            self.face([(lo+.35,.3,front-.18),(hi-.35,.3,front-.18),(hi-.35,2.75,front-.18),(lo+.35,2.75,front-.18)],SHOP,[(0,0),(1,0),(1,1),(0,1)])
            self.box(center,.22,front-1.7,length-.7,2.65,.15,INTERIOR)
            self.box(center,.20,front-.9,length-.7,.06,1.6,STONE)
            self.box(center,2.75,front-.9,length-.7,.06,1.6,SIGN)
            self.detail=True
            for shelf in [0,.65,1.3]:
                self.box(center,.45+shelf,front-1.0,length-1.2,.065,.38,STONE)
                for k in range(6):self.box(lo+.8+k*(length-1.6)/6,.515+shelf,front-.96,.22,.30,.19,SIGN if k%2 else INTERIOR)
            self.detail=True
            for x in [center-.14,center+.14]:self.box(x,1.05,front-.04,.035,.42,.06,METAL)
            self.detail=False
            for j in range(1,4):self.box(lo+j*length/4,.28,front-.08,.055,2.50,.08,FRAME)
            self.box(center,2.80,front+.08,length-.5,.42,.16,METAL)
            if self.cladding==BRICK and lo>0:
                # The photo has narrow glazed openings in a predominantly stone frontage.
                opening=1.0;step=(length-.7)/3;start=lo+.35
                for j in range(3):
                    left=start+j*step;mid=left+step/2
                    self.box((left+mid-opening/2)/2,.3,front-.04,(step-opening)/2,2.45,.24,STONE)
                    self.box((mid+opening/2+left+step)/2,.3,front-.04,(step-opening)/2,2.45,.24,STONE)
                    for edge in [mid-opening/2,mid+opening/2]:self.box(edge,.3,front+.09,.07,2.45,.08,FRAME)
                self.box(center,2.75,front-.02,length-.4,.55,.32,STONE)
            self.fronts.append(dict(kind='shop',position=[center,.2,front],normal=[0,1],width=1.0 if self.cladding==BRICK and lo>0 else length-.7))
        self.box(-1.12,.2,front-.12,.20,3.1,.24,STONE);self.box(1.12,.2,front-.12,.20,3.1,.24,STONE)
        self.face([(-1.02,.2,front-.20),(1.02,.2,front-.20),(1.02,2.95,front-.20),(-1.02,2.95,front-.20)],GLASS,[(0,0),(1,0),(1,1),(0,1)])
        for x in [-1.02,0,1.02]:self.box(x,.2,front-.12,.055,2.75,.06,FRAME)
        self.fronts.append(dict(kind='entrance',position=[0,.2,front-.08],normal=[0,1],width=2.04))
        for f in range(n-1):
            y=base+f*3.05;bal=1<=f<=n-3
            self.facade((-w/2,front),(-3.4,front),max(2,round((w/2-3.4)/3)),y,y+3.05)
            self.facade((3.4,front),(w/2,front),max(2,round((w/2-3.4)/3)),y,y+3.05)
            # Balcony bay is physically recessed, with exposed return walls.
            for x in [-3.4,3.4]:self.box(x,y,front-.53,.12,3.05,1.06,self.cladding)
            self.facade((-3.4,front-1.05),(3.4,front-1.05),2,y,y+3.05,balcony=bal,cladding=STONE if bal else self.cladding)
            self.facade((w/2,front),(w/2,-d/2),max(4,round(d/3)),y,y+3.05)
            self.facade((w/2,-d/2),(-w/2,-d/2),max(5,round(w/3)),y,y+3.05)
            self.facade((-w/2,-d/2),(-w/2,front),max(4,round(d/3)),y,y+3.05)
            if bal:self.balcony(y)
        self.box(0,top,0,w,.20,d,ROOF)
        for x in [-w/2+.12,w/2-.12]:self.box(x,top+.20,0,.24,.45,d,STONE)
        for z in [-d/2+.12,d/2-.12]:self.box(0,top+.20,z,w,.45,.24,STONE)
        # Set-back utility room breaks the flat roof silhouette without a tower cap.
        self.box(-w*.16,top+.2,-d*.1,w*.38,1.85,d*.36,STONE)
        self.box(-w*.16,top+2.05,-d*.1,w*.38+.12,.12,d*.36+.12,ROOF)
        self.box(w*.27,top+.20,-d*.2,2.2,1.0,1.8,METAL)
        self.detail=True
        for i in range(9):self.box(w*.27-.9+i*.22,top+1.20,-d*.2,.07,.04,1.65,DARK)
        for x in [-w/2+.25,w/2-.25]:self.box(x,0,front+.055,.08,top,.10,METAL)
        self.detail=False
        root=bpy.data.objects.new(self.name,None);bpy.context.collection.objects.link(root)
        root['category']='commercial';root['building']='mixeduse';root['family']='modern';root['floors']=n;root['authoredLod']=True
        for (material,detail),(verts,faces,uvs) in self.parts.items():
            mesh=bpy.data.meshes.new(self.name+' '+materials[material].name);mesh.from_pydata(verts,[],faces);mesh.update()
            uv=mesh.uv_layers.new(name='UVMap')
            for poly in mesh.polygons:
                for li in poly.loop_indices:uv.data[li].uv=uvs[mesh.loops[li].vertex_index]
            obj=bpy.data.objects.new(mesh.name+(' detail' if detail else ''),mesh);bpy.context.collection.objects.link(obj);obj.parent=root;obj.data.materials.append(materials[material]);obj['lodDetail']=detail
        return root

models=[Model('brick-balcony-mixed-use',24,19,9,BRICK),Model('sage-balcony-mixed-use',18,16,8,SAGE)]
roots=[m.build() for m in models]
# Two simple original shop names, rendered as geometry in the Blender asset.
for root,m in zip(roots,models):
    for text,x in ([('CORNER MARKET',-(m.w/2+1.25)/2)] if m.cladding==BRICK else [('CORNER MARKET',-(m.w/2+1.25)/2),('NORTH BOOKS',(m.w/2+1.25)/2)]):
        curve=bpy.data.curves.new(text,'FONT');curve.body=text;curve.size=.29;curve.align_x='CENTER';curve.resolution_u=2
        obj=bpy.data.objects.new(text,curve);bpy.context.collection.objects.link(obj);obj.parent=root;obj.location=(x,-m.d/2-.18,2.9);obj.rotation_euler=(math.pi/2,0,0);curve.materials.append(sign)
        bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.convert(target='MESH');obj.select_set(False)
        if not obj.data.uv_layers:obj.data.uv_layers.new(name='UVMap')
        obj['lodDetail']=True
bpy.ops.object.select_all(action='DESELECT')
for root in roots:
    root.select_set(True)
    for o in root.children:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'mixed-use.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
# Preserve structured entrance metadata in GLB extras (the Blender root stores its JSON).
path=OUT/'mixed-use.glb';data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+size]);tail=data[20+size:]
for node in doc['nodes']:
    for model,root in zip(models,roots):
        if node.get('name')==model.name:node.setdefault('extras',{})['streetFronts']=model.fronts;root['streetFrontsJSON']=json.dumps(model.fronts)
js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(js)+len(tail))+struct.pack('<I4s',len(js),b'JSON')+js+tail)
# A clean editable project with a neutral street-level comparison render.
roots[0].location.x=-15;roots[1].location.x=13
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.65,.76,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
bpy.ops.object.light_add(type='AREA',location=(-30,-40,55));bpy.context.object.data.energy=42000;bpy.context.object.data.size=25
bpy.ops.object.camera_add(location=(60,-95,48));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,15))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=69;scene.camera=cam
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'mixed-use.blend'),compress=True)
scene.render.filepath=str(QA/'edition171-blender.png');bpy.ops.render.render(write_still=True)
print('AUTHORED_MIXED_USE_COMPLETE',path.stat().st_size)
