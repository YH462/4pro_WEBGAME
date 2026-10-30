"""Export self-contained animated variants; never save the uploaded sources.

Blender --background --factory-startup --disable-autoexec --python-exit-code 1
--python scripts/export-raid-motions.py [-- --id=temp-09]
"""
import bpy
import json
import math
import shutil
import sys
from pathlib import Path
from mathutils import Matrix

root = Path(__file__).resolve().parents[1]
source_dir = root / '3Dmodels' / 'モーション統合'
destination = root / 'public/models/motions'
scratch = root / '.local/raid-motion-export'
destination.mkdir(parents=True, exist_ok=True)
scratch.mkdir(parents=True, exist_ok=True)
only_id = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--id=')), None)
only_ids = set(only_id.split(',')) if only_id else None
only_action = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--action=')), None)
if only_action and only_action not in {'attack', 'heal'}:
    raise RuntimeError(f'Unknown motion action: {only_action}')
sources = json.loads((root / 'scripts/raid-motion-sources.json').read_text(encoding='utf-8'))
if only_ids and not only_ids.issubset({asset['id'] for asset in sources}):
    raise RuntimeError(f'Unknown motion character: {only_id}')
for asset in sources:
    if only_ids and asset['id'] not in only_ids:
        continue
    excluded = set()
    if asset.get('visibilitySource'):
        # glTF has no Blender viewport-hidden flag. Some uploaded files contain
        # parked construction/reference meshes that the ordinary model hides.
        # Restore that explicit source visibility, retaining new effect meshes.
        bpy.ops.wm.open_mainfile(filepath=str(root / '3Dmodels' / asset['visibilitySource']), load_ui=False, use_scripts=False)
        excluded = {obj.name for obj in bpy.context.scene.objects if not obj.visible_get()}
    for action in ['attack', 'heal']:
        if only_action and action != only_action:
            continue
        if not asset.get(action):
            continue
        if action in asset.get('inactiveActions', {}):
            print(f'SKIPPED {asset["id"]} {action}: {asset["inactiveActions"][action]}', flush=True)
            continue
        source = source_dir / asset[action]
        if not source.is_file():
            raise RuntimeError(f'Missing merged source: {source}. Run node scripts/merge-raid-motion-sources.mjs first.')
        if source.suffix == '.glb':
            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.import_scene.gltf(filepath=str(source))
        else:
            path = source
            if source.suffix != '.blend':
                path = scratch / (source.name + '.blend')
                shutil.copy2(source, path)
            bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False, use_scripts=False)
        scene = bpy.context.scene
        # Exclude explicitly identified parked references and their helper trees.
        # They are not part of the authored character or visible action.
        excluded_objects = set()
        for name in asset.get('excludeObjects', {}).get(action, []):
            obj = scene.objects.get(name)
            if obj:
                excluded_objects.update([obj, *obj.children_recursive])
        for obj in excluded_objects:
            bpy.data.objects.remove(obj, do_unlink=True)
        if asset.get('maxTextureSize'):
            for image in bpy.data.images:
                width, height = image.size
                if max(width, height) > asset['maxTextureSize']:
                    scale = asset['maxTextureSize'] / max(width, height)
                    image.scale(max(1, round(width * scale)), max(1, round(height * scale)))
        actions = [a for a in bpy.data.actions if a.users]
        if not actions:
            raise RuntimeError(f'No animation: {source}')
        scene.frame_start = math.floor(min(a.frame_range[0] for a in actions))
        scene.frame_end = math.ceil(max(a.frame_range[1] for a in actions))
        scene.frame_set(scene.frame_start)
        if bpy.context.object and bpy.context.object.mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')
        # Curves and their materials are part of the authored character too.
        for obj in list(scene.objects):
            if obj.type in {'CURVE', 'SURFACE', 'FONT', 'META'} and obj.visible_get():
                bpy.ops.object.select_all(action='DESELECT')
                obj.select_set(True)
                bpy.context.view_layer.objects.active = obj
                bpy.ops.object.convert(target='MESH')
        objects = [o for o in scene.objects if o.type in {'MESH', 'ARMATURE', 'EMPTY'} and o.name not in excluded]
        body_prefixes = asset.get('bodyPrefixes', {}).get(action, [])
        body_objects = [obj for obj in objects if any(obj.name.startswith(prefix) for prefix in body_prefixes)]
        if body_prefixes and not body_objects:
            raise RuntimeError(f'No character body found for framing: {asset["id"]} {action}')
        for obj in body_objects:
            # Portable metadata: retain effects, but frame the character rather
            # than far-travelling projectiles or oversized healing particles.
            obj['raidMotionBody'] = True
        if asset['id'] == 'des-dragoon':
            # Keep all Mirror halves before the exporter processes referenced
            # objects. Bake only the rest mesh; retain Armature/skin animation.
            armatures = [(m, m.show_viewport) for obj in objects for m in obj.modifiers if m.type == 'ARMATURE']
            for modifier, _ in armatures:
                modifier.show_viewport = False
            bpy.context.view_layer.update()
            graph = bpy.context.evaluated_depsgraph_get()
            snapshots = [(obj, bpy.data.meshes.new_from_object(obj.evaluated_get(graph), preserve_all_data_layers=True, depsgraph=graph)) for obj in objects if obj.type == 'MESH']
            for modifier, visible in armatures:
                modifier.show_viewport = visible
            for obj, mesh in snapshots:
                for modifier in list(obj.modifiers):
                    if modifier.type != 'ARMATURE':
                        obj.modifiers.remove(modifier)
                obj.data = mesh
        # The tree's uploaded skinned GLBs have >400k vertices. Reduce dense
        # surfaces before the Armature modifier; preserve bones and their keys.
        bpy.context.view_layer.update()
        graph = bpy.context.evaluated_depsgraph_get()
        counts = []
        for obj in objects:
            if obj.type != 'MESH':
                continue
            evaluated = obj.evaluated_get(graph)
            mesh = evaluated.to_mesh()
            mesh.calc_loop_triangles()
            counts.append((obj, len(mesh.loop_triangles)))
            evaluated.to_mesh_clear()
        total = sum(count for _, count in counts)
        if total > 120000:
            for obj, count in counts:
                if count > 10000:
                    modifier = obj.modifiers.new('Raid motion LOD (export only)', 'DECIMATE')
                    modifier.ratio = 120000 / total
                    modifier.use_collapse_triangulate = True
                    obj.modifiers.move(len(obj.modifiers) - 1, 0)
                    bpy.context.view_layer.update()
                    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
                    mesh = evaluated.to_mesh()
                    mesh.calc_loop_triangles()
                    remaining = len(mesh.loop_triangles)
                    evaluated.to_mesh_clear()
                    if remaining > 120000 and modifier.ratio < .5:
                        # Some uploaded GLBs split every face into independent
                        # vertices. Weld coincident points before simplification,
                        # preserving the authored object transforms and keys.
                        obj.modifiers.remove(modifier)
                        weld = obj.modifiers.new('Raid motion weld (export only)', 'WELD')
                        weld.merge_threshold = .0001
                        obj.modifiers.move(len(obj.modifiers) - 1, 0)
                        bpy.context.view_layer.update()
                        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
                        mesh = evaluated.to_mesh()
                        mesh.calc_loop_triangles()
                        welded_count = len(mesh.loop_triangles)
                        evaluated.to_mesh_clear()
                        if welded_count > 120000:
                            collapse = obj.modifiers.new('Raid motion LOD after weld (export only)', 'DECIMATE')
                            collapse.ratio = 120000 / welded_count
                            collapse.use_collapse_triangulate = True
                            obj.modifiers.move(len(obj.modifiers) - 1, 1)
                        print(f'RAID_WELD {asset["id"]} {action} {obj.name}: {remaining} -> {welded_count}', flush=True)
        # Preserve local animated channels and rig/Mirror relationships under a
        # permanent asset-space correction, rather than rotating it in the UI.
        orientation = bpy.data.objects.new('RaidMotionOrientation', None)
        scene.collection.objects.link(orientation)
        yaw = asset.get('actionYaw', {}).get(action, asset['yaw'])
        orientation.matrix_world = Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Matrix.Rotation(math.pi if asset.get('flip') else 0, 4, 'X')
        for obj in objects:
            if obj.parent is None:
                obj.parent = orientation
                obj.matrix_parent_inverse = Matrix.Identity(4)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in [*objects, orientation]:
            obj.hide_set(False)
            obj.select_set(True)
        target = destination / f"{asset['file']}-{action}.glb"
        bpy.ops.export_scene.gltf(
            filepath=str(target), export_format='GLB', use_selection=True,
            export_apply=True, export_animations=True, export_frame_range=True,
            export_cameras=False, export_lights=False, export_yup=True,
            export_extras=True,
        )
        print(f'EXPORTED {asset["id"]} {action}: {target.stat().st_size} bytes', flush=True)
