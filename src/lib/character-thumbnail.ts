import * as THREE from "three";
import type { CharacterModelAsset } from "./character-models";
import { createCharacterModelLibrary } from "./character-model-loader";

/** Render a transparent portrait once; thumbnails never contain a procedural fallback. */
export async function renderCharacterThumbnail(asset: CharacterModelAsset, signal?: AbortSignal): Promise<Blob> {
  const library=createCharacterModelLibrary();
  let renderer:THREE.WebGLRenderer|undefined;
  try {
    const model=await library.load("thumbnail",asset);
    signal?.throwIfAborted();
    const canvas=document.createElement("canvas");
    renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:"low-power"});
    renderer.setPixelRatio(1);renderer.setSize(512,512,false);renderer.setClearColor(0xffffff,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    const scene=new THREE.Scene();scene.add(model,new THREE.HemisphereLight(0xffffff,0x76818a,2.2));
    const key=new THREE.DirectionalLight(0xfffaf4,3);key.position.set(-3,5,6);scene.add(key);
    const rim=new THREE.DirectionalLight(0xffffff,1.3);rim.position.set(3,2,-2);scene.add(rim);
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const half=Math.max(size.y*.57,size.x*.57),camera=new THREE.OrthographicCamera(-half,half,half,-half,.1,50);
    camera.position.set(center.x,center.y,Math.max(8,size.z+3));camera.lookAt(center);camera.updateProjectionMatrix();
    renderer.render(scene,camera);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob((value)=>value?resolve(value):reject(new Error("キャラ画像を生成できませんでした。")),"image/png"));
    signal?.throwIfAborted();return blob;
  } finally { renderer?.dispose();renderer?.forceContextLoss();library.dispose(); }
}
