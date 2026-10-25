import { describe,expect,it } from "vitest";
import { readFile } from "node:fs/promises";
import { validateCharacterModel } from "../../src/lib/character-model-validation";
import { glbFixture } from "../fixtures/glb";
import { characterModels } from "../../src/lib/character-models";
describe("uploaded GLB validation",()=>{
  it("accepts an embedded GLB and every bundled Blender export",async()=>{
    await expect(validateCharacterModel(glbFixture())).resolves.toBeInstanceOf(Buffer);
    for(const asset of Object.values(characterModels))await expect(validateCharacterModel(await readFile(`public${asset.url}`))).resolves.toBeInstanceOf(Buffer);
  });
  it("rejects external resources, corrupt ranges, missing geometry and unsupported decoders",async()=>{
    for(const data of [Buffer.from("not a glb"),glbFixture().subarray(0,40),glbFixture({buffers:[{byteLength:36,uri:"https://example.com/a.bin"}]}),glbFixture({images:[{uri:"data:image/png;base64,a"}]}),glbFixture({bufferViews:[{buffer:0,byteLength:100}]}),glbFixture({meshes:[]}),glbFixture({nodes:[{mesh:0,children:[0]}]}),glbFixture({nodes:[{mesh:999}]}),glbFixture({extensionsRequired:["KHR_draco_mesh_compression"]}),glbFixture({accessors:[{bufferView:0,componentType:5126,count:999,type:"VEC3"}]})])await expect(validateCharacterModel(data)).rejects.toMatchObject({status:400});
  });
  it("rejects excessive upload size and nonfinite vertex positions",async()=>{
    await expect(validateCharacterModel(Buffer.alloc(20*1024*1024+1))).rejects.toMatchObject({status:413});
    const data=glbFixture();data.writeFloatLE(NaN,data.length-36);
    await expect(validateCharacterModel(data)).rejects.toMatchObject({status:400});
  });
});
