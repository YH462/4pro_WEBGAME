import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createCharacterModelLibrary } from "../../src/lib/character-model-loader";
import { characterModel } from "../../src/lib/character-models";

const { loadAsync } = vi.hoisted(() => ({ loadAsync: vi.fn() }));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({ GLTFLoader: class { loadAsync = loadAsync; } }));

function fixture() {
  const geometry = new THREE.BoxGeometry(2, 4, 2);
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(7, -3, 5);
  const scene = new THREE.Group(); scene.add(mesh);
  return { scene, mesh, geometry, material, texture };
}

beforeEach(() => { loadAsync.mockReset(); });

describe("Blender character models", () => {
  it("grounds a tagged body's lowest pose without editing its authored descent", async () => {
    const source = fixture(); source.mesh.name = "body"; source.mesh.userData.raidMotionBody = true;
    loadAsync.mockResolvedValue({ scene: source.scene, animations: [new THREE.AnimationClip("drop", 1, [
      new THREE.VectorKeyframeTrack("body.position", [0, 1], [7, -3, 5, 7, -7, 5]),
    ])] });
    const library = createCharacterModelLibrary();
    const model = await library.load("motion", { url: "/drop.glb", yaw: 0 }, true);
    const mixer = new THREE.AnimationMixer(model), action = mixer.clipAction(model.animations[0]).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true; action.play(); mixer.setTime(1); model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model.getObjectByName("body")!);
    expect(bounds.min.y).toBeCloseTo(0); expect(bounds.max.y).toBeCloseTo(2);
    expect(model.userData.motionBounds.min[1]).toBeCloseTo(-.15);
    expect(model.animations[0].tracks[0].values[4]).toBe(-7);
    mixer.stopAllAction(); mixer.uncacheRoot(model); library.dispose();
  });
  it("frames tagged character bodies without shrinking them around distant projectiles", async () => {
    const source = fixture(); source.mesh.name = "body"; source.mesh.userData.raidMotionBody = true;
    const projectile = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    projectile.name = "projectile"; projectile.position.x = 1000; source.scene.add(projectile);
    loadAsync.mockResolvedValue({ scene: source.scene, animations: [new THREE.AnimationClip("authored", 1, [
      new THREE.VectorKeyframeTrack("body.position", [0, 1], [7, -3, 5, 7, -2, 5]),
      new THREE.VectorKeyframeTrack("projectile.position", [0, 1], [1000, 0, 0, 2000, 0, 0]),
    ])] });
    const library = createCharacterModelLibrary();
    const model = await library.load("motion", { url: "/motion.glb", yaw: 0 }, true);
    const body = model.getObjectByName("body")!;
    expect(new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3()).y).toBeCloseTo(2);
    expect(model.userData.motionBounds.max[0]).toBeLessThan(5);
    expect(model.userData.motionBounds.max[1]).toBeLessThan(3);
    expect(model.getObjectByName("projectile")).toBeDefined();
    expect(new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).x).toBeGreaterThan(400);
    library.dispose();
  });
  it("maps the S and C sources to control and civil independently of the character's element", async () => {
    loadAsync.mockImplementation(async () => ({ scene: fixture().scene }));
    const library = createCharacterModelLibrary();
    await library.load("flame-dragon"); await library.load("aqua-spirit");
    expect(loadAsync.mock.calls.map(([url]) => url)).toEqual(["/models/characters/s.glb", "/models/characters/c.glb"]);
    expect(characterModel("four-pro")?.url).toBe("/models/characters/keidentera.glb");
    expect(characterModel("temp-12")).toBeUndefined();
    expect(characterModel("toString")).toBeUndefined();
    library.dispose();
  });

  it("loads a repeated participant once, shares GPU assets and gives each instance its own centered transform", async () => {
    const source = fixture(); loadAsync.mockResolvedValue({ scene: source.scene });
    const library = createCharacterModelLibrary();
    const [first, second] = await Promise.all([library.load("forest-golem"), library.load("forest-golem")]);
    expect(loadAsync).toHaveBeenCalledTimes(1);
    expect(first).not.toBe(second);
    const bounds = new THREE.Box3().setFromObject(first);
    expect(bounds.min.y).toBeCloseTo(0); expect(bounds.max.y).toBeCloseTo(2);
    expect(bounds.getCenter(new THREE.Vector3()).x).toBeCloseTo(0);
    expect(bounds.getCenter(new THREE.Vector3()).z).toBeCloseTo(0);
    let firstMesh!: THREE.Mesh, secondMesh!: THREE.Mesh;
    first.traverse((object) => { if (object instanceof THREE.Mesh) firstMesh = object; });
    second.traverse((object) => { if (object instanceof THREE.Mesh) secondMesh = object; });
    expect(firstMesh.geometry).toBe(secondMesh.geometry); expect(firstMesh.material).toBe(secondMesh.material);
    first.position.x = 10; expect(second.position.x).toBe(0);
    const release = [source.geometry, source.material, source.texture].map((resource) => vi.spyOn(resource, "dispose"));
    library.dispose(); library.dispose();
    release.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
  });

  it("releases a load that completes after unmount instead of keeping its textures alive", async () => {
    const source = fixture();
    let resolve!: (value: { scene: THREE.Group }) => void;
    loadAsync.mockReturnValue(new Promise((done) => { resolve = done; }));
    const library = createCharacterModelLibrary();
    const pending = library.load("forest-golem");
    const released = vi.spyOn(source.texture, "dispose");
    library.dispose(); resolve({ scene: source.scene });
    await expect(pending).rejects.toThrow("unavailable");
    expect(released).toHaveBeenCalledTimes(1);
  });

  it("rejects empty assets so the caller can retain the placeholder", async () => {
    loadAsync.mockResolvedValue({ scene: new THREE.Group() });
    const library = createCharacterModelLibrary();
    await expect(library.load("forest-golem")).rejects.toThrow("invalid bounds");
    library.dispose();
  });
});
