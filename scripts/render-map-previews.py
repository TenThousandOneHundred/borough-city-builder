"""Render shaded oblique terrain previews from the game's sampled height fields.
Run sample-map-previews.mjs first, then this script with numpy and Pillow.
These are terrain renders, not stock landscapes or decorative placeholder art.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parents[1]
source=root/'references/map-preview-data'
output=root/'dist/assets/maps'
output.mkdir(parents=True,exist_ok=True)
for metadata in sorted(source.glob('*.json')):
    spec=json.loads(metadata.read_text());n=spec['size']
    data=np.fromfile(metadata.with_suffix('.bin'),dtype='<f4').reshape(n,n,2)
    h=data[:,:,0];wet=data[:,:,1];water=h<.18
    dz,dx=np.gradient(h,192/(n-1))
    normal=np.sqrt(dx*dx+dz*dz+1)
    light=np.clip((-.55*dx-.5*dz+.85)/normal,.15,1.2)
    rng=np.random.default_rng(spec['seed']);grain=rng.random((n,n))
    vegetation=np.clip((h-3)/24,0,1)
    base=np.zeros((n,n,3));base[:]=[128,147,102]
    base=base*(1-vegetation[:,:,None]*.28)+np.array([111,125,106])*vegetation[:,:,None]*.28
    rock=np.clip((np.hypot(dx,dz)-.4)/.6,0,.9)
    base=base*(1-rock[:,:,None])+np.array([167,164,147])*rock[:,:,None]
    shore=np.clip(wet*3,0,1)*(~water)
    base=base*(1-shore[:,:,None]*.7)+np.array([187,179,143])*shore[:,:,None]*.7
    base*=((.48+light*.62)*(1+(grain-.5)*.11))[:,:,None]
    # Terrain casts a directional shadow on lower slopes and shorelines.
    shadow=np.zeros((n,n),bool)
    for distance in range(2,30,2):
        blocker=np.roll(np.roll(h,distance,0),distance,1)-distance*192/(n-1)*.7
        blocked=blocker>h;blocked[:distance,:]=False;blocked[:,:distance]=False;shadow|=blocked
    base*=np.where(shadow,.76,1)[:,:,None]
    shallow=np.clip((h+1.6)/1.8,0,1)
    blue=np.array([34,79,98])+(np.array([96,151,153])-np.array([34,79,98]))*shallow[:,:,None]
    blue*= (1+(grain-.5)*.045)[:,:,None]
    base=np.where(water[:,:,None],blue,base)
    base=np.clip(base,0,255).astype('uint8')
    # The actual west-edge starter street, in the same world coordinates.
    surface=Image.fromarray(base);draw=ImageDraw.Draw(surface)
    row=(2+96)/192*(n-1);end=(-18+96)/192*(n-1)
    draw.line([(0,row),(end,row)],fill=(67,74,70),width=5)
    for x in range(1,int(end),9):draw.line([(x,row),(min(x+4,end),row)],fill=(207,210,189),width=1)
    colors=np.asarray(surface)
    width=n+44;height=306;canvas=Image.new('RGB',(width,height));pix=np.asarray(canvas).copy()
    for y in range(height):pix[y,:]=np.array([26,47,55])+(np.array([16,32,42])-np.array([26,47,55]))*y/height
    canvas=Image.fromarray(pix.astype('uint8'));draw=ImageDraw.Draw(canvas)
    project=lambda x,z,height:(22+(x+96)/192*(n-1),48+(z+96)/192*(n-1)*.57-max(.18,height)*1.65)
    # Painter-order surface strips preserve the real hills and water outline.
    ys=48+np.arange(n)[:,None]*.57-np.maximum(h,.18)*1.65
    for row in range(n-1):
        for col in range(n-1):
            draw.polygon([(22+col,ys[row,col]),(23+col,ys[row,col+1]),(23+col,ys[row+1,col+1]),(22+col,ys[row+1,col])],fill=tuple(colors[row,col]))
    for tree in sorted(spec['trees'],key=lambda t:t['z']):
        x,y=project(tree['x'],tree['z'],tree['height']);r=1.25+rng.random()*.55
        draw.ellipse((x-.2,y-.3,x+2*r,y+1.5),fill=(46,65,47))
        draw.ellipse((x-r,y-3.5,x+r,y+.1),fill=(53,79,49))
        draw.ellipse((x-r+.2,y-3.3,x+.5,y-1.2),fill=(81,108,62))
    # A subtle frame and north marker belong to the preview, not to the map.
    draw.text((width-26,16),'N',fill=(183,206,209));draw.line([(width-22,29),(width-22,39)],fill=(139,172,184),width=1)
    canvas=canvas.resize((856,428),Image.Resampling.LANCZOS)
    canvas.save(output/(metadata.stem+'.webp'),'WEBP',quality=90,method=6)
    print(metadata.stem, (output/(metadata.stem+'.webp')).stat().st_size)
