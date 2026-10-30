"""Author mature conifers and their view atlases in Blender.
Run Blender --background --factory-startup --python scripts/build-mature-conifers.py
Use -- --preview to render the model comparison before baking the full atlases.
Reference: official Cities: Skylines II City Corner #11 tree-LOD photograph.
All geometry is authored here; no commercial game assets are extracted.
"""
import bpy
import math
import random
import sys
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/assets/trees'
SOURCE = ROOT / 'source-assets/trees'
QA = ROOT / 'references/qa'
for folder in (OUT, SOURCE, QA):
    folder.mkdir(parents=True, exist_ok=True)
PREVIEW = '--preview' in sys.argv
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, roughness):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = roughness
    colors = m.node_tree.nodes.new('ShaderNodeVertexColor')
    colors.layer_name = 'Color'
    m.node_tree.links.new(colors.outputs['Color'], bsdf.inputs['Base Color'])
    m.diffuse_color = (.08, .14, .04, 1)
    return m

bark_mat = material('Mature conifer bark', .95)
needle_mat = material('Living needles', .86)

class Mesh:
    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.vertices, self.faces, self.colors, self.materials = [], [], [], []

    def face(self, points, color, mat):
        start = len(self.vertices)
        self.vertices.extend(tuple(p) for p in points)
        self.colors.extend([(*color, 1)] * len(points))
        self.faces.append(tuple(range(start, start + len(points))))
        self.materials.append(mat)

    def tube(self, points, radii, sides=6, trunk=False):
        rings = []
        for i, (p, radius) in enumerate(zip(points, radii)):
            tangent = (points[min(i+1, len(points)-1)]-points[max(0,i-1)]).normalized()
            u = tangent.cross(Vector((0,1,0))).normalized()
            if u.length < .01:
                u = tangent.cross(Vector((1,0,0))).normalized()
            v = tangent.cross(u).normalized()
            rings.append([p + (u*math.cos(j*math.tau/sides)+v*math.sin(j*math.tau/sides))*radius*(1+.09*math.sin(j*13.2+i*.7)) for j in range(sides)])
        for i in range(len(rings)-1):
            for j in range(sides):
                stripe = .78 + .24*(.5+.5*math.sin(j*9.7+i*.3))
                col = tuple(c*stripe for c in ((.16,.092,.046) if trunk else (.105,.075,.036)))
                self.face([rings[i][j],rings[i][(j+1)%sides],rings[i+1][(j+1)%sides],rings[i+1][j]],col,0)

    def frond(self, origin, direction, length, width, phase, vigor):
        axis = direction.normalized()
        side = axis.cross(Vector((0,0,1))).normalized()
        if side.length < .01:
            side = Vector((1,0,0))
        up = side.cross(axis).normalized()
        # Needle fans put actual silhouettes on both sides of each shoot.
        for row in range(1):
            bend = side*math.cos(phase+row*1.3)+up*math.sin(phase+row*1.3)
            for j in range(6):
                t = (j+.35)/6
                stem = origin+axis*(length*t)+up*(math.sin(t*math.pi)*length*.07)
                for sign in (-1,1):
                    reach = width*(.42+.58*math.sin(t*math.pi))*(.84+self.rng.random()*.3)
                    tip = stem + bend*(sign*reach) + axis*length*.17 + up*self.rng.uniform(-.07,.07)
                    blade = axis*(.085+.045*self.rng.random())
                    shade = (.76+.35*self.rng.random())*vigor
                    color = (.034*shade,.071*shade,.015*shade)
                    self.face([stem-blade,tip,stem+blade],color,1)

    def foliage(self, points, width, phase, vigor):
        for i in range(1,len(points)):
            a,b = points[i-1],points[i]
            direction = (b-a).normalized()
            for t in (.27,.77):
                self.frond(a.lerp(b,t),direction,.86,width,phase+self.rng.uniform(-.4,.4),vigor)

    def object(self, name):
        mesh = bpy.data.meshes.new(name+' geometry')
        mesh.from_pydata(self.vertices,[],self.faces)
        mesh.materials.append(bark_mat)
        mesh.materials.append(needle_mat)
        for p, m in zip(mesh.polygons,self.materials):
            p.material_index = m
        attribute = mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
        attribute.data.foreach_set('color',np.asarray(self.colors,dtype=np.float32).ravel())
        obj = bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(obj)
        return obj

def build_tree(name, pine, seed):
    m = Mesh(seed)
    rng = m.rng
    height = 22.5 if pine else 23
    def trunk(z):
        bend=max(0,z-12)/10 if pine else 0
        return Vector((.14*math.sin(z*.19)+bend*.75,.11*math.sin(z*.23+1)-bend*.3,z))
    levels = 29
    points = [trunk(height*i/(levels-1)) for i in range(levels)]
    m.tube(points,[.34*(1-i/(levels-1))**1.05+.014 for i in range(levels)],14,True)
    tiers = 9 if pine else 17
    bottom = 12.0 if pine else 2.8
    for tier in range(tiers):
        t = tier/(tiers-1)
        z = bottom+(height-bottom-1.0)*t+rng.uniform(-.28,.28)
        count = 6 if pine else 7
        radius = (4.8*math.sin((.16+t*.72)*math.pi)**.6+.5) if pine else 4.5*(1-t)**.8+.18
        for j in range(count):
            angle = j*math.tau/count+tier*2.399+rng.uniform(-.4,.4)
            axis = Vector((math.cos(angle),math.sin(angle),0))
            side = Vector((-axis.y,axis.x,0))
            reach = radius*rng.uniform(.67,1.27)
            origin = trunk(z+rng.uniform(-.6,.6))
            branch = []
            for q in range(5):
                s = q/4
                rise = (1.1*s-.35*math.sin(s*math.pi)) if pine else (-.7*math.sin(s*math.pi)+.22*s)
                branch.append(origin+axis*(reach*s)+side*(math.sin(s*math.pi)*rng.uniform(-.18,.18))+Vector((0,0,rise)))
            m.tube(branch,[(.09 if pine else .075)*(1-q/4)+.009 for q in range(5)],5)
            for twig in range(3):
                s = .3+twig*.24
                start = branch[min(3,int(s*4))].lerp(branch[min(4,int(s*4)+1)],s*4%1)
                for sign in (-1,1):
                    lateral = (axis*.4+side*sign*.85).normalized()
                    length = min(1.8 if pine else 1.35,reach*(.5-.16*s))*rng.uniform(.82,1.16)
                    end = start+lateral*length+Vector((0,0,rng.uniform(-.2,.25)))
                    twig_points = [start,start.lerp(end,.5)+Vector((0,0,-.14)),end]
                    m.tube(twig_points,[.025,.015,.004],4)
                    m.foliage(twig_points,.38 if pine else .29,rng.uniform(-.7,.7),.84+t*.26)
            m.foliage(branch[-2:],.38 if pine else .30,rng.uniform(-.5,.5),.9+t*.24)
    # Narrow, irregular leader prevents a clipped or blunt conifer crown.
    for k in range(0 if pine else 5):
        z = height-.9+k*.16
        angle = k*2.399
        axis = Vector((math.cos(angle),math.sin(angle),.35)).normalized()
        m.frond(trunk(z),axis,.45,.12,k,.95)
    obj = m.object(name)
    obj['authoring_tool'] = 'Blender'
    obj['source_reference'] = 'Cities Skylines II City Corner 11, tree LOD photograph'
    obj['form'] = 'raised irregular pine crown' if pine else 'layered tapered conifer'
    print(name,'triangles',sum(len(f)-2 for f in m.faces),'vertices',len(m.vertices),flush=True)
    return obj

def build_mature_pine():
    # The reference has separated, lopsided crown masses on a raised trunk,
    # rather than a miniature spruce with its lower whorls removed.
    m = Mesh(16302)
    rng = m.rng
    def trunk(z):
        return Vector((.025*z+.19*math.sin(z*.25),.12*math.sin(z*.3),z))
    stem = [trunk(i*22.8/30) for i in range(31)]
    m.tube(stem,[.36*(1-i/31)**1.15+.014 for i in range(31)],14,True)
    # Relative crown centers establish the distinctive lower side branch and
    # staggered masses seen in the actual game photograph.
    clusters = [
        (3.1,-.6,11.8,1.5),(-2.2,1.2,13.7,1.55),(2.5,1.8,14.6,1.5),
        (-3.3,-.6,15.9,1.85),(2.6,-1.6,16.7,1.7),(-1.8,2.7,17.7,1.75),
        (-2.1,-2.2,18.9,1.95),(1.7,.6,19.8,1.8),(-.8,1.7,21.1,1.5),
        (-1.1,-.9,22.0,1.35),(.9,-1.7,20.8,1.5),(-3.1,1.0,18.4,1.4)
    ]
    for index,(x,y,z,radius) in enumerate(clusters):
        center=Vector((x,y,z))+trunk(z)*Vector((1,1,0))
        origin=trunk(z-rng.uniform(1.2,2.9))
        bend=origin.lerp(center,.45)+Vector((0,0,-.5))
        m.tube([origin,bend,center],[.11,.065,.026],6)
        for k in range(17):
            angle=k*2.399+index*.7+rng.uniform(-.35,.35)
            outward=Vector((math.cos(angle),math.sin(angle),rng.uniform(.12,.55)))
            start=center+Vector((rng.uniform(-.45,.45),rng.uniform(-.45,.45),rng.uniform(-.65,.5)))
            reach=radius*rng.uniform(.65,1.15)
            end=start+outward*reach
            points=[center,start.lerp(end,.4)+Vector((0,0,-.16)),end]
            m.tube(points,[.029,.014,.004],4)
            # Overlapping sprays form rounded foliage masses with irregular
            # edges, but retain clear spaces between the primary limbs.
            for section in range(4):
                t=.18+section*.22
                at=points[1].lerp(end,t)
                for sign in (-1,1):
                    axis=(outward+Vector((-outward.y,outward.x,.25))*sign*.75).normalized()
                    m.frond(at,axis,.95,.48,angle*.2+sign*.7+rng.uniform(-.4,.4),rng.uniform(.86,1.13))
        for k in range(16):
            axis=Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(-.35,.65))).normalized()
            at=center+Vector((rng.uniform(-.65,.65),rng.uniform(-.65,.65),rng.uniform(-.4,.6)))
            m.frond(at,axis,1.15,.55,rng.uniform(-2,2),rng.uniform(.86,1.1))
    obj=m.object('MaturePine')
    obj['authoring_tool']='Blender'
    obj['source_reference']='Cities Skylines II City Corner 11, tree LOD photograph'
    obj['form']='raised asymmetric crown with separated foliage masses'
    print('MaturePine','triangles',sum(len(f)-2 for f in m.faces),'vertices',len(m.vertices),flush=True)
    return obj

trees = [build_tree('MatureSpruce',False,16201),build_mature_pine()]
bpy.ops.object.select_all(action='DESELECT')
for obj in trees: obj.select_set(True)
bpy.context.view_layer.objects.active = trees[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/'mature-conifers.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'mature-conifers.blend'),compress=True)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.world.color = (.25,.29,.34)
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.58,.62,.59,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
sun_data = bpy.data.lights.new('Daylight','SUN');sun_data.energy = 3.0;sun_data.angle = .12;sun_data.color = (1,.95,.84)
sun = bpy.data.objects.new('Daylight',sun_data);bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(28),math.radians(-25),math.radians(-35))
camera_data = bpy.data.cameras.new('Asset camera');camera_data.type = 'ORTHO'
camera = bpy.data.objects.new('Asset camera',camera_data);bpy.context.collection.objects.link(camera);scene.camera = camera
def aim(position,target):
    camera.location = position
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()

if PREVIEW:
    scene.render.resolution_x = 1200;scene.render.resolution_y = 800
    trees[0].location.x = -7;trees[1].location.x = 7
    camera_data.ortho_scale = 42
    aim((35,-65,29),(0,0,12))
    scene.render.filepath = str(QA/'edition163-conifer-models.png')
    bpy.ops.render.render(write_still=True)
else:
    panel_size = 384
    scene.render.resolution_x = scene.render.resolution_y = panel_size
    for species,tree in zip(('spruce','pine'),trees):
        for other in trees: other.hide_render = other!=tree
        height = tree.dimensions.z
        bounds=[tree.matrix_world @ Vector(c) for c in tree.bound_box]
        cx=(min(p.x for p in bounds)+max(p.x for p in bounds))/2
        cy=(min(p.y for p in bounds)+max(p.y for p in bounds))/2
        cz=min(p.z for p in bounds)+height*.54
        camera_data.ortho_scale = height*1.2
        atlas = np.zeros((panel_size*4,panel_size*8,4),dtype=np.float32)
        for row in range(4):
            elevation = row*math.pi/6
            for col in range(8):
                azimuth = col*math.pi/4
                radius = height*4
                aim((cx+math.sin(azimuth)*math.cos(elevation)*radius,cy-math.cos(azimuth)*math.cos(elevation)*radius,cz+math.sin(elevation)*radius),(cx,cy,cz))
                scene.render.filepath = str(QA/f'conifer-{species}-{row}-{col}.png')
                bpy.ops.render.render(write_still=True)
                panel = bpy.data.images.load(scene.render.filepath,check_existing=False)
                values = np.empty(panel_size*panel_size*4,dtype=np.float32);panel.pixels.foreach_get(values)
                atlas[row*panel_size:(row+1)*panel_size,col*panel_size:(col+1)*panel_size] = values.reshape(panel_size,panel_size,4)
                bpy.data.images.remove(panel)
        image = bpy.data.images.new('Mature '+species+' view atlas',width=panel_size*8,height=panel_size*4,alpha=True)
        image.pixels.foreach_set(atlas.ravel());image.file_format = 'PNG'
        image.filepath_raw = str(OUT/f'mature-{species}-atlas.png');image.save()
        print('Saved',image.filepath_raw,flush=True)
