"""Normalize the two legacy upside-down sources once, preserving editable meshes.

Run with Blender --background --factory-startup --disable-autoexec
--python-exit-code 1 --python scripts/normalize-character-orientation.py.
Original sources are backed up under .local/ before saving.
"""
import bpy
import math
import shutil
from pathlib import Path
from mathutils import Matrix, Vector

root = Path(__file__).resolve().parents[1]
version = 'upright-front-v1'
backup = root / '.local' / 'model-orientation-originals'
backup.mkdir(parents=True, exist_ok=True)
# Legacy front is +X. Turn the character upright around that axis, then
# align the front to Blender -Y (= glTF +Z). This is a rotation, not a reflection.
correction = Matrix.Rotation(-math.pi / 2, 4, 'Z') @ Matrix.Rotation(math.pi, 4, 'X')
for filename in ['デンラコ.blend', 'ブシラッコ.blend']:
    source = root / '3Dmodels' / filename
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    if bpy.context.scene.get('webgame_orientation') == version:
        print(f'Already normalized: {filename}', flush=True)
        continue
    original = backup / filename
    if not original.exists():
        shutil.copy2(source, original)
    objects = list(bpy.context.scene.objects)
    # Rotate only hierarchy roots; child transforms and Mirror references follow.
    roots = [(obj, obj.matrix_world.copy()) for obj in objects if obj.parent is None]
    for obj, matrix in roots:
        obj.matrix_world = correction @ matrix
    bpy.context.view_layer.update()
    bpy.context.scene['webgame_orientation'] = version
    # Save an upright front view as well as the actual object transforms.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                region = area.spaces.active.region_3d
                region.view_rotation = Vector((0, -1, 0)).to_track_quat('Z', 'Y')
                region.view_location = Vector((0, 0, 0))
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    print(f'Normalized source: {filename}', flush=True)
