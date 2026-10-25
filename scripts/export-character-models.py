"""Run with Blender: blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/export-character-models.py.

Exports visible character meshes and rigs without saving changes to the .blend sources.
"""
import bpy
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
destination = root / 'public' / 'models' / 'characters'
destination.mkdir(parents=True, exist_ok=True)
for code in ('M', 'E', 'C', 'S'):
    sources = list((root / '3Dmodels').glob(f'{code}*.blend'))
    if len(sources) != 1:
        raise RuntimeError(f'Expected one {code} .blend file, found {len(sources)}')
    bpy.ops.wm.open_mainfile(filepath=str(sources[0]), load_ui=False, use_scripts=False)
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    selected = [o for o in bpy.context.scene.objects if o.visible_get() and o.type in {'MESH', 'ARMATURE', 'EMPTY'}]
    if not any(o.type == 'MESH' for o in selected):
        raise RuntimeError(f'No visible meshes in {sources[0].name}')
    for obj in selected:
        obj.select_set(True)
    target = destination / f'{code.lower()}.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(target), export_format='GLB', use_selection=True,
        export_apply=True, export_animations=True, export_cameras=False,
        export_lights=False, export_yup=True, export_materials='EXPORT',
    )
    print('EXPORTED ' + json.dumps({'source': sources[0].name, 'output': str(target), 'bytes': target.stat().st_size}, ensure_ascii=True), flush=True)
