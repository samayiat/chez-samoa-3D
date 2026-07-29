# Short Order sky pipeline -- CITY locale. The restaurant reads as a ROOFTOP
# deck in the middle of a real skyline, not a postcard skyline out one window:
# a close ring of looming "neighbour" rooftops (with water towers / antennas /
# AC-unit clutter, one signature tall spire) surrounds the whole horizon, with
# a denser, hazier, atmospheric-perspective-faded skyline further out filling
# the gaps between them. Day: clear sky, silhouettes fade toward the horizon
# haze. Night: the near buildings light up window-by-window, a searchlight
# sweeps from one rooftop, the far skyline is a field of dim distant lights.
#
# Windows are a baked texture (window_grid_image/facade_mat), not one box per
# window -- hundreds of windows per building for the cost of one quad, the
# standard game-art cheat for dense facades. See sky_common.py for why the
# glow itself is baked into the colour image rather than routed through a
# separate Emission map (the vendored r128 GLTFLoader this game uses doesn't
# understand KHR_materials_emissive_strength -- verified by an actual
# export+reload round-trip -- so Emission Strength above 1 silently clamps).
# Run headless:  OUT=/path/out.glb VARIANT=day|night blender --background --python make_sky_city.py
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sky_common import init, variant, mat, box, textured_box, window_grid_image, facade_mat, cone_z, finish, dome_bands, export
import bmesh

OUT=os.environ.get("OUT","/tmp/sky_city.glb")
V=variant()
init()
R=90.0
R_FAR=86.0     # distant skyline, hazy, dense, full ring
R_NEAR=40.0    # close "neighbour" rooftops -- what actually sells the rooftop feel

if V=="day":
    bands=[
        (-5, 12, mat("b0",(0.72,0.78,0.84))),     # low haze -- also the atmospheric-perspective target colour
        (12, 40, mat("b1",(0.46,0.60,0.82))),
        (40, 72, mat("b2",(0.26,0.44,0.78))),
        (72, 90, mat("b3",(0.14,0.30,0.64))),
    ]
    haze=(0.72,0.78,0.84)
    near_wall_cols=[(0.36,0.36,0.40),(0.44,0.34,0.28),(0.30,0.40,0.46),(0.40,0.40,0.44)]   # concrete / brick / glass-blue / concrete
    near_win_col=(0.16,0.20,0.26)      # dark glass panes, not glowing -- daytime windows just read darker than the wall
    far_win_col=(0.20,0.24,0.30)
    lit_frac=0.85                       # "windows" always -- it's glazing, not lighting, during the day
    window_lit=False; beacon_emit=0.4; searchlight=False
else:
    bands=[
        (-5, 12, mat("b0",(0.10,0.09,0.14))),
        (12, 40, mat("b1",(0.05,0.045,0.10))),
        (40, 72, mat("b2",(0.03,0.03,0.07))),
        (72, 90, mat("b3",(0.012,0.012,0.04))),
    ]
    haze=(0.10,0.09,0.14)
    near_wall_cols=[(0.05,0.05,0.06),(0.045,0.04,0.045),(0.04,0.045,0.055),(0.05,0.045,0.05)]
    near_win_col=(1.0,0.82,0.35)        # bright warm lit windows -- baked straight into the texture, see header
    far_win_col=(0.9,0.75,0.5)
    lit_frac=0.4                        # only some windows lit at night
    window_lit=True; beacon_emit=2.6; searchlight=True

dome_bands(R, bands)

# ---- FAR skyline: a dense full ring, faded toward the haze colour (cheap
# atmospheric perspective -- no fog shader needed, just blend the albedo).
# One shared window-grid texture (not unique per building -- these are too
# small/distant for individual variety to read) gives the whole ring a
# consistent "field of tiny windows" texture instead of a flat silhouette. ----
random.seed(3)
def lerp(a,b,t): return tuple(a[i]+(b[i]-a[i])*t for i in range(3))
far_wall=lerp((0.30,0.32,0.38) if V=="day" else (0.03,0.03,0.05), haze, 0.55)
far_img=window_grid_image("far", cols=4, rows=14, wall_rgb=far_wall, win_rgb=lerp(far_win_col,haze,0.35), lit_frac=(0.9 if V=="day" else 0.3), seed=101)
m_far=facade_mat("m_far", far_img, rough=0.85)
n_far=52
bm=bmesh.new()
for i in range(n_far):
    az=2*math.pi*i/n_far + random.uniform(-0.05,0.05)
    h=4+random.random()*12; w=1.6+random.random()*1.6
    cx,cy=R_FAR*math.cos(az), R_FAR*math.sin(az)
    textured_box(bm, cx, cy, h/2, w, w*0.75, h)
finish("farskyline", bm, m_far)

# ---- NEAR "neighbour" rooftops: fewer, bigger, looming, each with its OWN
# baked facade texture (window count scaled to its real height/width) so the
# ring reads as genuinely varied buildings up close, not a repeated tile.
# Gaps between them read as open street sightlines rather than a solid wall. ----
random.seed(19)
n_near=20
buildings=[]   # (cx,cy,h,w,landmark) for clutter passes below
bidx=0
for i in range(n_near):
    if random.random()<0.18: continue   # gaps -- an open sightline down a "street"
    az=2*math.pi*i/n_near + random.uniform(-0.07,0.07)
    landmark = (i==0)
    h=(30+random.random()*10) if landmark else (10+random.random()*16)
    w=3.5+random.random()*2.5
    cx,cy=R_NEAR*math.cos(az), R_NEAR*math.sin(az)
    wall=near_wall_cols[bidx%len(near_wall_cols)]
    win=lerp(near_win_col,(0,0,0),random.uniform(0,0.15))   # slight per-building tint variance
    cols=max(3,round(w*1.3)); rows=max(5,round(h*0.7))
    img=window_grid_image("near%d"%bidx, cols=cols, rows=rows, wall_rgb=wall, win_rgb=win, lit_frac=lit_frac, seed=200+bidx)
    m=facade_mat("m_near%d"%bidx, img, rough=0.8, metal=0.1)
    bm=bmesh.new(); textured_box(bm, cx, cy, h/2, w, w*0.85, h)
    finish("nearbldg%d"%bidx, bm, m)
    buildings.append((cx,cy,h,w,landmark))
    bidx+=1

# rooftop clutter: water towers / AC clusters / antennas on ~half the buildings
random.seed(29)
m_clutter=mat("m_clutter",(0.32,0.24,0.18) if V=="day" else (0.06,0.05,0.04), rough=0.7)
bm=bmesh.new()
for (cx,cy,h,w,landmark) in buildings:
    if landmark:
        cone_z(bm, 0.5, 0.05, h, h+8, cx, cy, segs=8)   # the signature spire
        continue
    roll=random.random()
    if roll<0.35:                                        # water tower: barrel on legs
        cone_z(bm, 1.1, 1.1, h, h+1.6, cx+random.uniform(-w*0.2,w*0.2), cy, segs=10)
        cone_z(bm, 1.3, 0.0, h+1.6, h+2.3, cx, cy, segs=10)
    elif roll<0.6:                                        # AC unit cluster
        for _ in range(3):
            box(bm, cx+random.uniform(-w*0.3,w*0.3), cy+random.uniform(-w*0.3,w*0.3), h+0.3, 0.6, 0.6, 0.6)
    elif roll<0.8:                                        # antenna spike
        cone_z(bm, 0.15, 0.02, h, h+3.5, cx, cy, segs=6)
finish("clutter", bm, m_clutter)

# beacon: kept as its own small landmark distinct from the signature spire above
bm=bmesh.new()
cone_z(bm, 0.5, 0.08, 0, 12, R_NEAR*0.55, R_NEAR*0.2)
finish("beacon", bm, m_clutter)
bm=bmesh.new()
cone_z(bm, 0.25, 0.03, 12, 14, R_NEAR*0.55, R_NEAR*0.2)
finish("beacontip", bm, mat("m_beacon",(1.0,0.2,0.55), rough=0.2, emit=(1.0,0.2,0.55), estrength=beacon_emit))

if searchlight:
    bm=bmesh.new()
    m_beam=mat("m_beam",(0.75,0.85,1.0), rough=0.3, emit=(0.75,0.85,1.0), estrength=1.6)
    bx,by = R_NEAR*0.7, -R_NEAR*0.3
    cone_z(bm, 0.06, 2.4, 24, 82, bx, by, segs=10)   # thin at the source, wide against the sky -- silhouettes as a beam
    finish("searchbeam", bm, m_beam)

export(OUT)
