import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { inspectCharacterGLB } from "../../src/lib/character-glb";
import { validateCharacterModel } from "../../src/lib/character-model-validation";
import { characterModels } from "../../src/lib/character-models";

describe("portable upright character assets", () => {
  for (const id of ["temp-09", "temp-11"]) {
    it(`${id} has a +Z-facing face, an upper head and both hands without node rotations`, async () => {
      const asset = characterModels[id];
      const bytes = await readFile(`public${asset.url}`);
      await validateCharacterModel(bytes);
      const { doc, binStart } = inspectCharacterGLB(bytes);
      expect(asset.yaw).toBe(0);
      for (const node of doc.nodes) {
        expect(node.rotation ?? [0, 0, 0, 1]).toEqual([0, 0, 0, 1]);
        expect(node.scale ?? [1, 1, 1]).toEqual([1, 1, 1]);
        expect(node.translation ?? [0, 0, 0]).toEqual([0, 0, 0]);
        expect(node.matrix).toBeUndefined();
      }
      function bounds(name: string, material?: string) {
        const node = doc.nodes.find((item: { name: string }) => item.name === name);
        expect(node, name).toBeDefined();
        const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (const primitive of doc.meshes[node.mesh].primitives) {
          if (material && doc.materials[primitive.material].name !== material) continue;
          const accessor = doc.accessors[primitive.attributes.POSITION];
          const view = doc.bufferViews[accessor.bufferView];
          const start = binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
          for (let index = 0; index < accessor.count; index++) for (let axis = 0; axis < 3; axis++) {
            const value = bytes.readFloatLE(start + index * (view.byteStride ?? 12) + axis * 4);
            min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
          }
        }
        expect(min.every(Number.isFinite)).toBe(true);
        return { min, max };
      }
      const eyes = bounds("球.002");
      expect(eyes.min[2]).toBeGreaterThan(.9); // Front is +Z even in a raw GLB viewer.
      const hands = bounds(id === "temp-09" ? "球.001" : "球.003");
      expect(hands.min[0]).toBeLessThan(-1.4);
      expect(hands.max[0]).toBeGreaterThan(1.4);
      expect(hands.max[1]).toBeLessThan(eyes.min[1]);
      if (id === "temp-09") {
        const lightning = bounds("円柱", "マテリアル");
        expect(lightning.max[1]).toBeGreaterThan(1.8); // Antenna above the head.
      } else {
        const headband = bounds("球", "マテリアル.005");
        expect(headband.min[1]).toBeGreaterThan(eyes.max[1]);
      }
    });
  }
});
