# Short Order sky pipeline -- WARP SPEED locale: a starburst of streaks radiating
# outward, frozen mid-jump (it's a static GLB -- the game can't animate it, so
# the STATIC radial pattern itself has to read as "warp speed" at a glance).
# Day: warm-tinted streaks (pink/gold accents) on deep blue-black. Night: pure
# cold blue-white streaks on true black -- distinct palettes, same geometry.
# Run headless:  OUT=/path/out.glb VARIANT=day|night blender --background --python make_sky_warp.py
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sky_common import init, variant, mat, finish, dome_bands, export
import bmesh, mathutils

OUT=os.environ.get("OUT","/tmp/sky_warp.glb")
V=variant()
init()
R=90.0

bands=[
    (-90, -30, mat("b0",(0.02,0.02,0.05))),
    (-30, 30, mat("b1",(0.015,0.015,0.05))),
    (30, 90, mat("b2",(0.01,0.01,0.04))),
]
dome_bands(R, bands)

# a radial streak: a thin tapering spoke from near-origin out to the dome,
# built as a triangular prism along an arbitrary axis (small base, sharp tip)
def spoke(bm, dirv, r0, length, seg_r=3, mat_col=None):
    dirv=dirv.normalized()
    ref=mathutils.Vector((0,0,1)) if abs(dirv.z)<0.9 else mathutils.Vector((1,0,0))
    t=dirv.cross(ref).normalized(); b=dirv.cross(t).normalized()
    base=dirv*2.0   # start a little off the exact center so streaks don't all pinch at one point
    tip=dirv*(2.0+length)
    ring=[]
    for i in range(seg_r):
        a=2*math.pi*i/seg_r
        off=t*(r0*math.cos(a))+b*(r0*math.sin(a))
        ring.append(bm.verts.new(tuple(base+off)))
    tipv=bm.verts.new(tuple(tip))
    for i in range(seg_r):
        j=(i+1)%seg_r
        bm.faces.new((ring[i],ring[j],tipv))

random.seed(5)
if V=="day":
    palette=[(0.55,0.72,1.0),(0.95,0.55,0.75),(0.95,0.78,0.45)]
    estrength=2.6; n_streaks=90
else:
    palette=[(0.65,0.82,1.0),(0.85,0.92,1.0)]
    estrength=3.4; n_streaks=140

for ci,col in enumerate(palette):
    bm=bmesh.new()
    m=mat("m_streak%d"%ci, col, rough=0.2, emit=col, estrength=estrength)
    for _ in range(n_streaks//len(palette)):
        d=mathutils.Vector((random.uniform(-1,1), random.uniform(-1,1), random.uniform(-1,1)))
        if d.length<0.001: continue
        length=R*0.85*(0.5+random.random()*0.5)
        spoke(bm, d, 0.05+random.random()*0.10, length)
    finish("streaks%d"%ci, bm, m)

export(OUT)
