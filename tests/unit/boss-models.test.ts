import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { inspectCharacterGLB } from "../../src/lib/character-glb";
import { validateCharacterModel } from "../../src/lib/character-model-validation";
import { bossVariants } from "../../src/lib/boss";

describe("exported dragon geometry", () => {
  for (const [color, url] of Object.entries(bossVariants)) {
    it(`${color} includes both mirrored halves of the body`, async () => {
      const data = await readFile(`public${url}`);
      await validateCharacterModel(data);
      const { doc, binStart } = inspectCharacterGLB(data);
      const body = doc.nodes.find((node: { name?: string }) => node.name === "Cube");
      expect(body).toBeDefined();
      let minX = Infinity, maxX = -Infinity;
      for (const primitive of doc.meshes[body.mesh].primitives) {
        const accessor = doc.accessors[primitive.attributes.POSITION];
        const view = doc.bufferViews[accessor.bufferView];
        const start = binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
        for (let index = 0; index < accessor.count; index++) {
          const x = data.readFloatLE(start + index * (view.byteStride ?? 12));
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        }
      }
      // The original uploads contained only positive-X geometry. The body's
      // Mirror modifier must produce comparable spans on both sides of X=0.
      expect(minX).toBeLessThan(-0.5);
      expect(maxX).toBeGreaterThan(0.5);
      expect(Math.abs(minX + maxX)).toBeLessThan(0.01);
    });
  }
});
