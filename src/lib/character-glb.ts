import { HttpError } from "./http-error";
import { maxCharacterModelBytes } from "./character-models";

/** Shared by the browser preview and upload validation; never follows resource URLs. */
export function inspectCharacterGLB(data: Uint8Array) {
  const invalid = () => new HttpError(400, "GLBを読み込めません。画像を含むglTF Binary (.glb)で書き出してください。");
  if(data.length>maxCharacterModelBytes)throw new HttpError(413,"3Dモデルは20MB以内で選択してください。");
  try {
    const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
    if(data.length<28||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==data.length)throw invalid();
    const jsonLength=view.getUint32(12,true),binHeader=20+jsonLength;
    if(jsonLength>1024*1024||jsonLength%4||view.getUint32(16,true)!==0x4e4f534a||binHeader+8>data.length)throw invalid();
    const doc=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(data.subarray(20,binHeader)));
    const binLength=view.getUint32(binHeader,true),binStart=binHeader+8;
    if(view.getUint32(binHeader+4,true)!==0x004e4942||binLength%4||binStart+binLength!==data.length||doc.asset?.version!=="2.0")throw invalid();
    const stack:[unknown,number][]=[[doc,0]];let entries=0;
    while(stack.length){const [value,depth]=stack.pop()!;
      if(++entries>100000||depth>40||typeof value==="number"&&!Number.isFinite(value))throw invalid();
      if(value&&typeof value==="object")for(const [key,child] of Object.entries(value)){
        if(key==="uri")throw new HttpError(400,"外部ファイルを参照するモデルは登録できません。テクスチャをGLBに含めてください。");
        stack.push([child,depth+1]);
      }
    }
    return {doc,binLength,binStart};
  }catch(error){if(error instanceof HttpError)throw error;throw invalid();}
}
