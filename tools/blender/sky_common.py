# Shared bpy helpers for the make_sky_*.py locale scripts. Not a standalone
# asset script -- imported via sys.path injection (see the top of each
# make_sky_*.py). Keeps the six locale scripts short: geometry + palette only.
import bpy, bmesh, math, os

def init():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def variant():
    return os.environ.get("VARIANT", "day")   # "day" | "night"

def mat(name, rgb, rough=0.85, metal=0.0, emit=None, estrength=0.0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    b=m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value=(rgb[0],rgb[1],rgb[2],1.0)
    b.inputs["Roughness"].default_value=rough; b.inputs["Metallic"].default_value=metal
    if emit:
        b.inputs["Emission Color"].default_value=(emit[0],emit[1],emit[2],1.0)
        b.inputs["Emission Strength"].default_value=estrength
    m.use_backface_culling=False   # -> doubleSided in the exported glTF (dome is viewed from inside)
    return m

def finish(name, bm, material):
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob=bpy.data.objects.new(name,me); ob.data.materials.append(material)
    bpy.context.collection.objects.link(ob)
    for p in ob.data.polygons: p.use_smooth=False
    return ob

def box(bm, cx,cy,cz, sx,sy,sz):
    hx,hy,hz=sx/2,sy/2,sz/2
    v={}
    for dx in(-1,1):
        for dy in(-1,1):
            for dz in(-1,1):
                v[(dx,dy,dz)]=bm.verts.new((cx+dx*hx, cy+dy*hy, cz+dz*hz))
    F=[[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1)],
       [(-1,-1,1),(-1,1,1),(1,1,1),(1,-1,1)],
       [(-1,-1,-1),(-1,1,-1),(-1,1,1),(-1,-1,1)],
       [(1,-1,-1),(1,-1,1),(1,1,1),(1,1,-1)],
       [(-1,-1,-1),(-1,-1,1),(1,-1,1),(1,-1,-1)],
       [(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    for f in F: bm.faces.new([v[k] for k in f])

# cone/frustum along Z: r0 at z0 -> r1 at z1 (r1=0 gives a spike/peak)
def cone_z(bm, r0, r1, z0, z1, cx, cy, segs=14):
    a0=[]; a1=[]
    for i in range(segs):
        a=2*math.pi*i/segs
        a0.append(bm.verts.new((cx+r0*math.cos(a), cy+r0*math.sin(a), z0)))
        if r1>0.0001:
            a1.append(bm.verts.new((cx+r1*math.cos(a), cy+r1*math.sin(a), z1)))
    if r1>0.0001:
        for i in range(segs):
            j=(i+1)%segs; bm.faces.new((a0[i],a0[j],a1[j],a1[i]))
    else:
        tip=bm.verts.new((cx,cy,z1))
        for i in range(segs):
            j=(i+1)%segs; bm.faces.new((a0[i],a0[j],tip))

# low-poly faceted sphere (rings of latitude), centered at cx,cy,cz
def sphere(bm, cx,cy,cz, r, segs=10, rings=6):
    top=bm.verts.new((cx,cy,cz+r)); bot=bm.verts.new((cx,cy,cz-r))
    rows=[]
    for ri in range(1,rings):
        phi=math.pi*ri/rings
        rr=r*math.sin(phi); zz=r*math.cos(phi)
        row=[]
        for i in range(segs):
            a=2*math.pi*i/segs
            row.append(bm.verts.new((cx+rr*math.cos(a), cy+rr*math.sin(a), cz+zz)))
        rows.append(row)
    for i in range(segs):
        j=(i+1)%segs
        bm.faces.new((top, rows[0][i], rows[0][j]))
        bm.faces.new((bot, rows[-1][j], rows[-1][i]))
    for ri in range(len(rows)-1):
        for i in range(segs):
            j=(i+1)%segs
            bm.faces.new((rows[ri][i],rows[ri][j],rows[ri+1][j],rows[ri+1][i]))

# thin ring / halo (planet rings), tilt = rotation around X in radians
def ring_torus(bm, cx,cy,cz, R, r, segs=22, rsegs=7, tilt=0.35):
    ct,st=math.cos(tilt),math.sin(tilt)
    rows=[]
    for i in range(segs):
        a=2*math.pi*i/segs
        row=[]
        for j in range(rsegs):
            b=2*math.pi*j/rsegs
            lx=(R+r*math.cos(b))*math.cos(a)
            ly=(R+r*math.cos(b))*math.sin(a)
            lz=r*math.sin(b)
            ty=ly*ct-lz*st; tz=ly*st+lz*ct
            row.append(bm.verts.new((cx+lx, cy+ty, cz+tz)))
        rows.append(row)
    for i in range(segs):
        i2=(i+1)%segs
        for j in range(rsegs):
            j2=(j+1)%rsegs
            bm.faces.new((rows[i][j],rows[i2][j],rows[i2][j2],rows[i][j2]))

# the sky itself: a stack of flat-shaded latitude BANDS from horizon (0 deg)
# to zenith (90 deg), each its own material -- a painterly banded gradient
# with no textures/UV at all, matching the game's low-poly flat-shaded look
# (and sidestepping any UV/image-texture plumbing in the export). Negative
# e0 is fine (bands can dip below the horizon -- used by the underwater dome,
# which wraps the full sphere since there is no real horizon underwater).
def dome_bands(radius, bands):
    segs=24
    objs=[]
    for idx,(e0,e1,m) in enumerate(bands):
        bm=bmesh.new()
        a0=math.radians(e0); a1=math.radians(e1)
        r0=radius*math.cos(a0); z0=radius*math.sin(a0)
        r1=radius*math.cos(a1); z1=radius*math.sin(a1)
        ring0=[]; ring1=[]
        for i in range(segs):
            t=2*math.pi*i/segs
            ring0.append(bm.verts.new((r0*math.cos(t), r0*math.sin(t), z0)))
            ring1.append(bm.verts.new((r1*math.cos(t), r1*math.sin(t), z1)))
        for i in range(segs):
            j=(i+1)%segs
            bm.faces.new((ring0[i],ring0[j],ring1[j],ring1[i]))
        if e1>=89.9:                                   # cap the zenith
            top=bm.verts.new((0,0,z1))
            for i in range(segs):
                j=(i+1)%segs
                bm.faces.new((ring1[i],ring1[j],top))
        if e0<=-89.9:                                  # cap the nadir (underwater dome)
            bot=bm.verts.new((0,0,z0))
            for i in range(segs):
                j=(i+1)%segs
                bm.faces.new((ring0[j],ring0[i],bot))
        objs.append(finish('skyband%d'%idx, bm, m))
    return objs

# textured box: same 6 faces as box(), but with a UV layer so a facade_mat's
# window-grid texture actually shows up (box() alone has no UVs -- every face
# would sample a single texel). Every face gets its own full 0..1 UV quad.
def textured_box(bm, cx,cy,cz, sx,sy,sz):
    hx,hy,hz=sx/2,sy/2,sz/2
    v={}
    for dx in(-1,1):
        for dy in(-1,1):
            for dz in(-1,1):
                v[(dx,dy,dz)]=bm.verts.new((cx+dx*hx, cy+dy*hy, cz+dz*hz))
    F=[[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1)],
       [(-1,-1,1),(-1,1,1),(1,1,1),(1,-1,1)],
       [(-1,-1,-1),(-1,1,-1),(-1,1,1),(-1,-1,1)],
       [(1,-1,-1),(1,-1,1),(1,1,1),(1,1,-1)],
       [(-1,-1,-1),(-1,-1,1),(1,-1,1),(1,-1,-1)],
       [(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    uv=bm.loops.layers.uv.verify() if hasattr(bm.loops.layers.uv,'verify') else bm.loops.layers.uv.new()
    UVQ=[(0,0),(1,0),(1,1),(0,1)]
    for f in F:
        face=bm.faces.new([v[k] for k in f])
        for loop,co in zip(face.loops, UVQ): loop[uv].uv=co

# a dense WINDOW-GRID texture, generated procedurally (no image assets, no
# PIL -- numpy only) instead of modelling one box per window. This is the
# standard game-art cheat for distant/large facades: bake window density
# into a small tiled texture, not geometry -- hundreds of windows for the
# cost of one quad instead of hundreds of boxes.
#   NB: the window GLOW for night is baked straight into this colour image
#   (bright cells), not routed through a separate Emission texture. Verified
#   by an actual export+reload round-trip that the vendored three r128
#   GLTFLoader this game uses doesn't understand KHR_materials_emissive_
#   strength, so any Emission Strength above 1 silently clamps to 1 on
#   load -- not enough punch to read as "lit window vs. dark wall" reliably.
#   Baking the glow into the colour itself sidesteps that entirely, and since
#   buildSky() converts every sky material to unlit anyway (see index.html),
#   "glowing" here just means "painted bright," which is all that's needed.
def window_grid_image(name, cols, rows, wall_rgb, win_rgb, lit_frac=0.4, seed=0, margin=0.18):
    import numpy as np
    rng=np.random.default_rng(seed)
    cell=8                                    # px per cell -- coarse/pixelated, matches the flat-shaded look
    h,w=rows*cell, cols*cell
    img=np.empty((h,w,4),dtype=np.float32)
    img[...,0]=wall_rgb[0]; img[...,1]=wall_rgb[1]; img[...,2]=wall_rgb[2]; img[...,3]=1.0
    lit=rng.random((rows,cols))<lit_frac
    m=max(1,int(cell*margin))
    for r in range(rows):
        y0,y1=r*cell+m,(r+1)*cell-m
        for c in range(cols):
            if not lit[r,c]: continue
            x0,x1=c*cell+m,(c+1)*cell-m
            img[y0:y1,x0:x1,0]=win_rgb[0]; img[y0:y1,x0:x1,1]=win_rgb[1]; img[y0:y1,x0:x1,2]=win_rgb[2]
    bimg=bpy.data.images.new(name, width=w, height=h, alpha=True)
    bimg.pixels=img.flatten().tolist(); bimg.pack()
    return bimg

# a material driven by window_grid_image() -- unlit-friendly Base Color
# texture, low roughness variance since it never actually gets lit (see
# buildSky()'s unlit conversion).
def facade_mat(name, img, rough=0.85, metal=0.05):
    m=bpy.data.materials.new(name); m.use_nodes=True
    nt=m.node_tree; bsdf=nt.nodes.get("Principled BSDF")
    tb=nt.nodes.new("ShaderNodeTexImage"); tb.image=img; tb.interpolation='Closest'
    nt.links.new(tb.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value=rough; bsdf.inputs["Metallic"].default_value=metal
    m.use_backface_culling=False
    return m

def export(out):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True)
    print("WROTE", out)
