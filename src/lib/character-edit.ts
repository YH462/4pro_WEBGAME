import sharp from "sharp";
import { db } from "./db";
import { HttpError } from "./http-error";
import { characterEditSchema, characterImageUrl } from "./character-edit-input";
import { characterModelUrl, maxCharacterModelBytes } from "./character-models";
import { validateCharacterModel } from "./character-model-validation";
export const maxCharacterImageBytes=2*1024*1024;
export async function readCharacterEdit(request:Request) {
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,"入力がありません。");
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxCharacterImageBytes+maxCharacterModelBytes+16*1024){await reader.cancel();throw new HttpError(413,"画像は2MB、3Dモデルは20MB以内で選択してください。");}chunks.push(value);}
  let form:FormData;
  try{form=await new Response(Buffer.concat(chunks),{headers:{"Content-Type":request.headers.get("content-type")??""}}).formData();}catch{throw new HttpError(400,"送信形式を確認してください。");}
  if([...form.keys()].some((key)=>!["data","image","model"].includes(key))||form.getAll("data").length!==1||form.getAll("image").length>1||form.getAll("model").length>1)throw new HttpError(400,"入力項目を確認してください。");
  const data=form.get("data");if(typeof data!=="string"||Buffer.byteLength(data)>8192)throw new HttpError(400,"入力が長すぎます。");
  let raw:unknown;try{raw=JSON.parse(data);}catch{throw new HttpError(400,"入力形式を確認してください。");}
  const input=characterEditSchema.parse(raw),file=form.get("image");
  if(input.imageAction!=="replace"&&file)throw new HttpError(400,"画像の変更方法を確認してください。");
  let image:Buffer|null=null;
  if(input.imageAction==="replace") {
    if(!file||typeof file==="string"||!file.size)throw new HttpError(400,"画像を選択してください。");
    if(file.size>maxCharacterImageBytes)throw new HttpError(413,"画像は2MB以内で選択してください。");
    const mime:Record<string,string>={"image/png":"png","image/jpeg":"jpeg","image/webp":"webp"};
    if(!mime[file.type])throw new HttpError(415,"PNG・JPEG・WebP画像を選択してください。");
    try {
      const bytes=Buffer.from(await file.arrayBuffer());
      const metadata=await sharp(bytes,{limitInputPixels:16_777_216}).metadata();
      if(metadata.format!==mime[file.type]||!metadata.width||!metadata.height||metadata.width>4096||metadata.height>4096||(metadata.pages??1)>1)throw new Error("Invalid image");
      // Re-encode to remove metadata and active formats, preserving transparency.
      image=await sharp(bytes,{limitInputPixels:16_777_216}).rotate().resize({width:1024,height:1024,fit:"inside",withoutEnlargement:true}).webp({quality:90,alphaQuality:100}).toBuffer();
    }catch{throw new HttpError(400,"画像を読み込めません。静止画のPNG・JPEG・WebP（最大4096px）を選択してください。");}
  }
  const modelFile=form.get("model");
  if(input.modelAction!=="replace"&&modelFile)throw new HttpError(400,"モデルの変更方法を確認してください。");
  let model:{data:Buffer;fileName:string}|null=null;
  if(input.modelAction==="replace") {
    if(!modelFile||typeof modelFile==="string"||!modelFile.size)throw new HttpError(400,"GLBモデルを選択してください。");
    if(!/\.glb$/i.test(modelFile.name))throw new HttpError(415,"3DモデルはGLB形式で選択してください。");
    if(modelFile.size>maxCharacterModelBytes)throw new HttpError(413,"3Dモデルは20MB以内で選択してください。");
    model={data:await validateCharacterModel(Buffer.from(await modelFile.arrayBuffer())),fileName:modelFile.name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g,"").slice(0,120)||"character.glb"};
  }
  return {input,image,model};
}
export async function updateCharacter(id:string,{input,image,model}:Awaited<ReturnType<typeof readCharacterEdit>>) {
  return db.$transaction(async(tx)=>{
    const rows=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "Character" WHERE "id" = ${id} FOR UPDATE`;
    if(!rows.length)throw new HttpError(404,"キャラクターが見つかりません。");
    const previous=await tx.character.findUniqueOrThrow({where:{id}});
    if(previous.revision!==input.revision)throw new HttpError(409,"別の画面で更新されています。ページを再読み込みしてから編集し直してください。");
    if(input.isDraft&&(previous.departmentId||previous.isLegendary))throw new HttpError(400,"学科キャラと4プロは仮キャラへ変更できません。");
    const modelChanged=input.modelAction==="replace"||Boolean(previous.modelId)&&input.modelYaw!==undefined&&input.modelYaw!==previous.modelYaw;
    if(modelChanged&&input.modelAction!=="remove"&&(!image||input.imageAction!=="replace"))throw new HttpError(400,"3Dモデルから作成したキャラ画像を一緒に保存してください。");
    if(input.modelAction==="remove"&&input.imageAction==="replace")throw new HttpError(400,"モデルを外す場合はキャラ画像も外してください。");
    let imageId=previous.imageId;
    if(input.imageAction==="remove"||input.modelAction==="remove")imageId=null;
    if(input.imageAction==="replace") {
      if(!image)throw new HttpError(400,"画像を選択してください。");
      imageId=(await tx.characterImage.create({data:{contentType:"image/webp",data:new Uint8Array(image)}})).id;
    }
    let modelId=previous.modelId;
    if(input.modelAction==="remove")modelId=null;
    if(input.modelAction==="replace") {
      if(!model)throw new HttpError(400,"GLBモデルを選択してください。");
      modelId=(await tx.characterModel.create({data:{fileName:model.fileName,byteLength:model.data.length,data:new Uint8Array(model.data)}})).id;
    }
    const {revision,imageAction,modelAction,modelYaw,...editable}=input;
    const updated=await tx.character.update({where:{id},data:{...editable,imageId,modelId,...(modelYaw!==undefined?{modelYaw}:{}),...(modelAction&&modelAction!=="keep"?{modelConfigured:true}:{}),revision:{increment:1}},select:{id:true,name:true,description:true,element:true,baseHp:true,baseAttack:true,baseDefense:true,baseSpecialChargeRate:true,isDraft:true,revision:true,imageId:true,modelId:true,modelYaw:true,model:{select:{fileName:true,byteLength:true}}}});
    if(previous.imageId&&previous.imageId!==imageId)await tx.characterImage.delete({where:{id:previous.imageId}});
    if(previous.modelId&&previous.modelId!==modelId)await tx.characterModel.delete({where:{id:previous.modelId}});
    return {...updated,imageUrl:characterImageUrl(imageId),modelUrl:characterModelUrl(modelId)};
  },{timeout:15000});
}
