import sharp from "sharp";
import { HttpError } from "./http-error";
import { inspectCharacterGLB } from "./character-glb";

const invalid = () => new HttpError(400, "GLBを読み込めません。画像を含むglTF Binary (.glb)で書き出してください。");
const supported = new Set(["KHR_materials_unlit", "KHR_materials_clearcoat", "KHR_materials_ior", "KHR_materials_specular", "KHR_materials_transmission", "KHR_materials_volume", "KHR_materials_sheen", "KHR_materials_emissive_strength", "KHR_materials_iridescence", "KHR_materials_anisotropy", "KHR_materials_dispersion", "KHR_texture_transform", "KHR_mesh_quantization", "EXT_mesh_gpu_instancing"]);

/** Inspect the container and embedded resources without loading or fetching a scene. */
export async function validateCharacterModel(data: Buffer) {
  try {
    const {doc,binLength,binStart}=inspectCharacterGLB(data);
    if (!Array.isArray(doc.buffers) || doc.buffers.length !== 1 || !Number.isInteger(doc.buffers[0].byteLength) || doc.buffers[0].byteLength <= 0 || binLength - doc.buffers[0].byteLength < 0 || binLength - doc.buffers[0].byteLength > 3) throw invalid();
    if (!Array.isArray(doc.nodes) || doc.nodes.length > 1000 || !Array.isArray(doc.meshes) || !doc.meshes.length || doc.meshes.length > 500 || !Array.isArray(doc.accessors) || !Array.isArray(doc.bufferViews)) throw invalid();
    if(!Array.isArray(doc.scenes)||!doc.scenes.length||!Number.isInteger(doc.scene??0)||!doc.scenes[doc.scene??0])throw invalid();
    const parents=new Array<number>(doc.nodes.length).fill(0);
    for(const node of doc.nodes) {
      if(node.mesh!==undefined&&(!Number.isInteger(node.mesh)||!doc.meshes[node.mesh]))throw invalid();
      if(node.children!==undefined&&!Array.isArray(node.children))throw invalid();
      for(const child of node.children??[])if(!Number.isInteger(child)||!doc.nodes[child]||++parents[child]>1)throw invalid();
    }
    const queue=parents.flatMap((count,index)=>count===0?[index]:[]);let visited=0;
    while(visited<queue.length){const node=doc.nodes[queue[visited++]];for(const child of node.children??[])if(--parents[child]===0)queue.push(child);}
    if(visited!==doc.nodes.length)throw invalid();
    const roots=doc.scenes[doc.scene??0].nodes;
    if(!Array.isArray(roots)||!roots.length||roots.some((index:unknown)=>!Number.isInteger(index)||!doc.nodes[index as number]))throw invalid();
    const reachable=new Set<number>(),pending:number[]=[...roots];
    while(pending.length){const index=pending.pop()!;if(reachable.has(index))continue;reachable.add(index);pending.push(...(doc.nodes[index].children??[]));}
    if(![...reachable].some((index)=>doc.nodes[index].mesh!==undefined))throw invalid();
    for (const view of doc.bufferViews) if (view.buffer !== 0 || !Number.isInteger(view.byteLength) || view.byteLength <= 0 || !Number.isInteger(view.byteOffset ?? 0) || (view.byteOffset ?? 0) < 0 || (view.byteOffset ?? 0) + view.byteLength > doc.buffers[0].byteLength) throw invalid();
    const components:Record<number,number>={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
    const widths:Record<string,number>={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
    for(const accessor of doc.accessors) {
      const view=doc.bufferViews[accessor.bufferView],component=components[accessor.componentType],width=widths[accessor.type];
      if(!view||!component||!width||accessor.sparse||!Number.isInteger(accessor.count)||accessor.count<=0||accessor.count>1000000||!Number.isInteger(accessor.byteOffset??0)||(accessor.byteOffset??0)<0)throw invalid();
      const stride=view.byteStride??component*width;
      if(!Number.isInteger(stride)||stride<component*width||stride>252||(accessor.byteOffset??0)+(accessor.count-1)*stride+component*width>view.byteLength)throw invalid();
    }
    let vertices = 0;
    for (const mesh of doc.meshes) {
      if (!Array.isArray(mesh.primitives) || !mesh.primitives.length) throw invalid();
      for (const primitive of mesh.primitives) {
        const position = doc.accessors[primitive.attributes?.POSITION];
        if (!position || position.type !== "VEC3" || !Number.isInteger(position.count) || position.count <= 0) throw invalid();
        vertices += position.count;
        if (vertices > 500000) throw new HttpError(400, "モデルが複雑すぎます。頂点数を50万以下に減らしてください。");
        if(position.componentType===5126) {
          const view=doc.bufferViews[position.bufferView],stride=view.byteStride??12,start=binStart+(view.byteOffset??0)+(position.byteOffset??0);
          for(let i=0;i<position.count;i++)for(let axis=0;axis<3;axis++)if(!Number.isFinite(data.readFloatLE(start+i*stride+axis*4)))throw invalid();
        }
      }
    }
    for (const extension of [...(doc.extensionsUsed ?? []), ...(doc.extensionsRequired ?? [])]) if (!supported.has(extension)) throw new HttpError(400, "未対応のGLB拡張です。圧縮や追加拡張を無効にして書き出してください。");
    if ((doc.images?.length ?? 0) > 16) throw invalid();
    let pixels = 0;
    for (const image of doc.images ?? []) {
      const view = doc.bufferViews[image.bufferView]; if (!view) throw invalid();
      const start = binStart + (view.byteOffset ?? 0);
      const metadata = await sharp(data.subarray(start, start + view.byteLength), { limitInputPixels: 16_777_216 }).metadata();
      if (!metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096 || (metadata.pages ?? 1) > 1 || !["png", "jpeg"].includes(metadata.format ?? "") || image.mimeType !== `image/${metadata.format}`) throw invalid();
      pixels += metadata.width * metadata.height;
      if (pixels > 33_554_432) throw new HttpError(400, "テクスチャの合計サイズを小さくしてください。");
    }
    return data;
  } catch (error) { if (error instanceof HttpError) throw error; throw invalid(); }
}
