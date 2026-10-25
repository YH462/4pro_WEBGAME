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
  it("maps the S and C sources to control and civil independently of the character's element", async () => {
    loadAsync.mockImplementation(async () => ({ scene: fixture().scene }));
    const library = createCharacterModelLibrary();
    await library.load("flame-dragon"); await library.load("aqua-spirit");
    expect(loadAsync.mock.calls.map(([url]) => url)).toEqual(["/models/characters/s.glb", "/models/characters/c.glb"]);
    expect(characterModel("four-pro")).toBeUndefined();
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
