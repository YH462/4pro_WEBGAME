"""Run with Blender: blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/export-character-models.py.

Exports visible character meshes and rigs without saving changes to the .blend sources.
"""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Matrix

root = Path(__file__).resolve().parents[1]
destination = root / 'public' / 'models' / 'characters'
destination.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root / 'src/lib/bundled-character-models.json').read_text(encoding='utf-8'))
additional_only = '--additional' in sys.argv
only_id = next((arg.split('=', 1)[1] for arg in sys.argv if arg.startswith('--id=')), None)
if only_id and only_id not in {asset['id'] for asset in manifest}:
    raise RuntimeError(f'Unknown character ID: {only_id}')
for asset in manifest:
    additional = asset['department'] is None
    if additional_only and not additional:
        continue
    if only_id and asset['id'] != only_id:
        continue
    source = root / '3Dmodels' / asset['source']
    if not source.is_file():
        raise RuntimeError(f'Missing source: {source}')
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    # Curves such as the USB cable must be converted in memory before glTF export.
    for obj in list(bpy.context.scene.objects):
        if obj.visible_get() and obj.type in {'CURVE', 'SURFACE', 'FONT', 'META'}:
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target='MESH')
    selected = [o for o in bpy.context.scene.objects if o.visible_get() and o.type in {'MESH', 'ARMATURE', 'EMPTY'}]
    if not any(o.type == 'MESH' for o in selected):
        raise RuntimeError(f'No visible meshes in {source.name}')
    if additional:
        for obj in selected:
            if obj.type == 'MESH' and len(obj.data.vertices) > 30000:
                for modifier in obj.modifiers:
                    if modifier.type == 'SUBSURF':
                        modifier.levels = 0
                        modifier.render_levels = 0
        bpy.context.view_layer.update()
        graph = bpy.context.evaluated_depsgraph_get()
        counts = []
        for obj in selected:
            if obj.type != 'MESH':
                continue
            evaluated = obj.evaluated_get(graph)
            mesh = evaluated.to_mesh()
            mesh.calc_loop_triangles()
            counts.append((obj, len(mesh.loop_triangles)))
            evaluated.to_mesh_clear()
        total = sum(count for _, count in counts)
        if total > 120000:
            ratio = 120000 / total
            for obj, count in counts:
                if count > 10000:
                    modifier = obj.modifiers.new('Web game LOD (export only)', 'DECIMATE')
                    modifier.ratio = ratio
                    modifier.use_collapse_triangulate = True
            print(f'EXPORT_LOD {source.name}: original triangles={total}, ratio={ratio:.3f}', flush=True)
            bpy.context.view_layer.update()
            graph = bpy.context.evaluated_depsgraph_get()
            for obj, count in counts:
                if count <= 10000:
                    continue
                evaluated = obj.evaluated_get(graph)
                mesh = evaluated.to_mesh()
                mesh.calc_loop_triangles()
                remaining = len(mesh.loop_triangles)
                evaluated.to_mesh_clear()
                if remaining > 120000 and ratio < .5:
                    # Duplicate vertices can prevent collapse. Weld coincident points
                    # instead of rebuilding the surface, preserving thin sculpted details.
                    for modifier in list(obj.modifiers):
                        if modifier.name == 'Web game LOD (export only)':
                            obj.modifiers.remove(modifier)
                    weld = obj.modifiers.new('Web game weld (export only)', 'WELD')
                    weld.merge_threshold = .0001
                    bpy.context.view_layer.update()
                    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
                    mesh = evaluated.to_mesh()
                    mesh.calc_loop_triangles()
                    welded_count = len(mesh.loop_triangles)
                    evaluated.to_mesh_clear()
                    if welded_count > 120000:
                        modifier = obj.modifiers.new('Web game LOD after weld (export only)', 'DECIMATE')
                        modifier.ratio = 120000 / welded_count
                        modifier.use_collapse_triangulate = True
                    print(f'EXPORT_WELD {source.name}: {obj.name}, triangles={remaining} -> {welded_count}', flush=True)
    if bpy.context.scene.get('webgame_orientation') == 'upright-front-v1':
        if any(obj.type == 'ARMATURE' for obj in selected):
            raise RuntimeError('World-space export is only supported for these static characters')
        # Evaluate all meshes before modifying any: Mirror can reference another
        # selected object. Bake source transforms into vertices, so the portable
        # GLB is upright/+Z-front without a runtime rotation or negative scales.
        graph = bpy.context.evaluated_depsgraph_get()
        evaluated = [(obj, bpy.data.meshes.new_from_object(
            obj.evaluated_get(graph), preserve_all_data_layers=True, depsgraph=graph
        ), obj.matrix_world.copy()) for obj in selected if obj.type == 'MESH']
        for obj, mesh, matrix in evaluated:
            mesh.transform(matrix)
            if matrix.determinant() < 0:
                mesh.flip_normals()
            obj.modifiers.clear()
            obj.parent = None
            obj.data = mesh
            obj.matrix_world = Matrix.Identity(4)
        selected = [obj for obj, _, _ in evaluated]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in selected:
        obj.select_set(True)
    target = destination / asset['file']
    bpy.ops.export_scene.gltf(
        filepath=str(target), export_format='GLB', use_selection=True,
        export_apply=True, export_animations=True, export_cameras=False,
        export_lights=False, export_yup=True, export_materials='EXPORT',
    )
    print('EXPORTED ' + json.dumps({'source': source.name, 'output': str(target), 'bytes': target.stat().st_size}, ensure_ascii=True), flush=True)
