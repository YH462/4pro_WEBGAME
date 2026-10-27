"""Export evaluated boss meshes, including Mirror, without saving the .blend files."""
import bpy
from pathlib import Path

root = Path(__file__).resolve().parents[1]
destination = root / 'public' / 'models' / 'bosses'
destination.mkdir(parents=True, exist_ok=True)

for color, filename in [('赤', 'red'), ('青', 'blue'), ('緑', 'green'), ('黄', 'yellow')]:
    source = root / '3Dmodels' / f'敵キャラ_デスドラグーン（{color}）.blend'
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    meshes = [obj for obj in bpy.context.scene.objects if obj.visible_get() and obj.type == 'MESH']
    if not meshes:
        raise RuntimeError(f'No visible meshes: {source}')
    # Evaluate every object before replacing any data: other Mirror modifiers
    # reference the body object as their shared symmetry plane.
    graph = bpy.context.evaluated_depsgraph_get()
    evaluated = [(obj, bpy.data.meshes.new_from_object(
        obj.evaluated_get(graph), preserve_all_data_layers=True, depsgraph=graph
    )) for obj in meshes]
    for obj, mesh in evaluated:
        obj.modifiers.clear()
        obj.data = mesh
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.export_scene.gltf(
        filepath=str(destination / f'des-dragoon-{filename}.glb'),
        export_format='GLB', use_selection=True, export_apply=True,
        export_yup=True, export_animations=False,
    )
    print(f'Exported complete boss: {filename}')
