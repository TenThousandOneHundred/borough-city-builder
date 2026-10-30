"""Original zoning UI models, authored and rendered in Blender.
Reference: official CSII Zones & Signature Buildings, 1_Zoning_toolbar.png.
Run Blender --background --factory-startup --python scripts/build-zone-icons.py
"""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/assets/ui/zones'
SOURCE = ROOT / 'source-assets/ui'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 128
scene.render.resolution_y = 128
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.world.color = (.35, .35, .35)

def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = .7
    return m

green = material('Housing green', (.22, .8, .035))
blue = material('Commercial blue', (.035, .57, .95))
yellow = material('Industry yellow', (.95, .65, .04))
purple = material('Office violet', (.55, .075, .83))
dark = material('Recessed windows', (.045, .16, .075))
roof = material('Roof highlight', (.45, .95, .11))
collections = []
current = None

def own(obj):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    current.objects.link(obj)
    return obj

def box(name, location, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    o = own(bpy.context.object)
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    bevel = o.modifiers.new('Soft icon edges', 'BEVEL')
    bevel.width = .025
    bevel.segments = 1
    o.modifiers.new('Face normals', 'WEIGHTED_NORMAL')
    return o

def building(x, y, w, d, h, mat, floors=0):
    box('Building', (x,y,.12+h/2), (w,d,h), mat)
    box('Roof lip', (x,y,.14+h), (w+.06,d+.06,.07), mat)
    for f in range(floors):
        z = .38+f*(h-.4)/max(1,floors)
        for dx in [-w*.25,w*.25]:
            box('Window', (x+dx,y-d/2-.01,z), (.14,.025,.17), dark)
        for dy in [-d*.25,d*.25]:
            box('Side window', (x+w/2+.01,y+dy,z), (.025,.14,.17), dark)

def house(x,y,w=.85,d=1.15):
    building(x,y,w,d,.58,green)
    z=.73
    verts=[(x-w/2-.06,y-d/2-.06,z),(x+w/2+.06,y-d/2-.06,z),
           (x,y-d/2-.06,z+.38),(x-w/2-.06,y+d/2+.06,z),
           (x+w/2+.06,y+d/2+.06,z),(x,y+d/2+.06,z+.38)]
    mesh=bpy.data.meshes.new('Pitched roof')
    mesh.from_pydata(verts,[],[(0,1,2),(3,5,4),(0,2,5,3),(2,1,4,5),(0,3,4,1)])
    o=bpy.data.objects.new('Pitched roof',mesh);current.objects.link(o);mesh.materials.append(roof)

specs=[('residential_low',green),('residential_row',green),('residential_medium',green),
       ('residential_mixed',blue),('residential_lowrent',green),('residential_high',green),
       ('commercial_low',blue),('commercial_high',blue),('industrial',yellow),('office_low',purple),('office',purple)]
for name,mat in specs:
    current=bpy.data.collections.new(name);scene.collection.children.link(current);collections.append(current)
    box('Zone footprint',(0,0,.04),(2.8,2.55,.08),mat)
    if name=='residential_low':
        house(-.55,-.25);house(.55,.3,.7,.9)
    elif name=='residential_row':
        for x in [-.82,0,.82]: house(x,0,.74,1.5)
    elif name=='residential_medium': building(0,0,1.75,1.55,1.65,green,3)
    elif name=='residential_mixed':
        building(0,0,1.85,1.65,.4,blue)
        building(0,0,1.5,1.35,2.05,green,4)
        box('Shops',(0,-.86,.32),(1.82,.09,.3),blue)
    elif name=='residential_lowrent':
        building(0,0,2,1.8,1.6,green)
        for z in [.45,.8,1.15,1.5]: box('Balcony band',(0,0,z),(2.1,1.9,.065),roof)
    elif name=='residential_high': building(0,0,1.2,1.2,2.75,green,5)
    elif name=='commercial_low': building(0,0,2.1,1.65,.75,blue,1)
    elif name=='commercial_high':
        building(-.4,.15,1.3,1.4,2.15,blue,4);building(.65,-.45,.8,.9,1,blue,2)
    elif name=='industrial':
        building(-.15,-.3,2.1,1.35,.7,yellow,1)
        for x in [-.65,.25]: box('Chimney',(x,.55,1.15),(.3,.3,2.1),yellow)
    elif name=='office_low': building(0,0,2,1.5,1.05,purple,2)
    else:
        building(-.35,0,1.1,1.2,2.7,purple,5);building(.65,-.25,.75,1,1.7,purple,3)

bpy.ops.object.camera_add(location=(7,-9,8))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.05))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=4.6;scene.camera=camera
bpy.ops.object.light_add(type='AREA',location=(-3,-4,8))
bpy.context.object.data.energy=600;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=5
bpy.ops.object.light_add(type='AREA',location=(4,3,5))
bpy.context.object.data.energy=180;bpy.context.object.data.size=4
for c in collections: c.hide_render=True
for c in collections:
    c.hide_render=False
    scene.render.filepath=str(OUT/(c.name+'.png'))
    bpy.ops.render.render(write_still=True)
    c.hide_render=True
collections[0].hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'zoning-icons.blend'))
