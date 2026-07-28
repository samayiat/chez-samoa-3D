# Short Order sky pipeline -- CITY locale (neon skyline + beacon tower).
# Day: clear blue sky over grey-blue silhouettes. Night: dark sky, lit windows,
# neon beacon glow -- the two variants look like different times of day, not
# just a recolor, since the buildings only light up after dark.
# Run headless:  OUT=/path/out.glb VARIANT=day|night blender --background --python make_sky_city.py
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sky_common import init, variant, mat, box, cone_z, finish, dome_bands, export
import bmesh

OUT=os.environ.get("OUT","/tmp/sky_city.glb")
V=variant()
init()
R=90.0

if V=="day":
    bands=[
        (-5, 15, mat("b0",(0.62,0.72,0.82))),
        (15, 45, mat("b1",(0.42,0.58,0.82))),
        (45, 75, mat("b2",(0.24,0.42,0.78))),
        (75, 90, mat("b3",(0.14,0.28,0.62))),
    ]
    bldg_col=(0.30,0.34,0.42); window_lit=False; beacon_emit=0.4
else:
    bands=[
        (-5, 15, mat("b0",(0.14,0.10,0.20))),
        (15, 45, mat("b1",(0.07,0.06,0.16))),
        (45, 75, mat("b2",(0.04,0.04,0.11))),
        (75, 90, mat("b3",(0.015,0.015,0.05))),
    ]
    bldg_col=(0.06,0.06,0.09); window_lit=True; beacon_emit=2.6

dome_bands(R, bands)

# skyline: a row of boxes across the far horizon (single side -- read as a
# distant downtown out one direction, not a full ring, so it stays legible)
random.seed(11)
bldg_mat=mat("m_bldg", bldg_col, rough=0.75, metal=0.2)
win_mat=mat("m_win",(1.0,0.82,0.35), rough=0.3, emit=(1.0,0.75,0.3), estrength=2.4) if window_lit else None
n=14; spread=70
bm=bmesh.new()
for i in range(n):
    x=(i-(n-1)/2)*(spread/n) + random.uniform(-1.5,1.5)
    h=6+random.random()*16; w=3+random.random()*2.5
    box(bm, x, R*0.96, h/2, w, w*0.8, h)
finish("skyline", bm, bldg_mat)

if window_lit:
    bm=bmesh.new()
    for i in range(n):
        x=(i-(n-1)/2)*(spread/n) + random.uniform(-1.5,1.5)
        h=6+random.random()*16
        rows=int(h/1.6)
        for r in range(rows):
            if random.random()<0.55:
                box(bm, x+random.uniform(-1,1), R*0.955, 0.8+r*1.6, 0.5, 0.05, 0.5)
    finish("windows", bm, win_mat)

# beacon tower: a tall thin spike with a glowing tip
bm=bmesh.new()
cone_z(bm, 0.9, 0.15, 0, 20, 0, R*0.96)
finish("beacon", bm, bldg_mat)
bm=bmesh.new()
cone_z(bm, 0.4, 0.05, 20, 23, 0, R*0.96)
finish("beacontip", bm, mat("m_beacon",(1.0,0.2,0.55), rough=0.2, emit=(1.0,0.2,0.55), estrength=beacon_emit))

export(OUT)
