import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {describe,expect,it} from 'vitest';
import {inspectCharacterGLB} from '../../src/lib/character-glb';
import {validateCharacterModel} from '../../src/lib/character-model-validation';
import {characterModels} from '../../src/lib/character-models';

describe('Kanreki bundled model',()=>{
  it('bakes both sides and the face toward +Z without a viewer rotation or external resources',async()=>{
    expect(characterModels['temp-12']).toMatchObject({displayName:'還暦',url:'/models/characters/kanreki.glb',yaw:0});
    const bytes=await readFile('public/models/characters/kanreki.glb');
    await validateCharacterModel(bytes);
    const {doc}=inspectCharacterGLB(bytes);
    expect(bytes.length).toBeLessThan(1024*1024);
    expect(doc.animations??[]).toEqual([]);
    expect(doc.nodes).toHaveLength(1);
    const node=doc.nodes[0];
    expect(node.rotation??[0,0,0,1]).toEqual([0,0,0,1]);
    expect(node.scale??[1,1,1]).toEqual([1,1,1]);
    expect(node.translation??[0,0,0]).toEqual([0,0,0]);
    const primitives=doc.meshes[node.mesh].primitives as {material:number;attributes:{POSITION:number}}[];
    const materials=doc.materials as {pbrMetallicRoughness:{baseColorFactor:number[]}}[];
    const faceMaterial=materials.findIndex(m=>m.pbrMetallicRoughness.baseColorFactor.slice(0,3).every(v=>v>.7&&v<.9));
    const eyesMaterial=materials.findIndex(m=>m.pbrMetallicRoughness.baseColorFactor.slice(0,3).every(v=>v===0));
    for(const material of [faceMaterial,eyesMaterial]){
      expect(material).toBeGreaterThanOrEqual(0);
      const bounds=doc.accessors[primitives.find(p=>p.material===material)!.attributes.POSITION];
      expect(bounds.min[2]).toBeGreaterThan(.5);
      expect(bounds.min[0]).toBeLessThan(-.5);
      expect(bounds.max[0]).toBeGreaterThan(.5);
    }
  });
  it('ships a transparent portrait for the collection',async()=>{
    const image=await sharp(await readFile('public/models/characters/kanreki.webp')).metadata();
    expect(image).toMatchObject({format:'webp',width:512,height:512,hasAlpha:true});
  });
});
