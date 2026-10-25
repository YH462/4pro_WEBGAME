"use client";
import { PartnerScene } from "../battle/partner-scene";
import { maxCharacterModelBytes } from "@/lib/character-models";
import { inspectCharacterGLB } from "@/lib/character-glb";
import styles from "./admin.module.css";

export function CharacterModelFields({ id, element, savedUrl, savedName, previewUrl, file, action, yaw, onFile, onRemove, onYaw, onError, onValidating }: {
  id:string; element:string; savedUrl:string|null; savedName:string|null; file:File|null; action:string; yaw:number;
  previewUrl:string|null;
  onFile:(file:File)=>void; onRemove:()=>void; onYaw:(value:number)=>void; onError:(message:string)=>void;
  onValidating:(value:boolean)=>void;
}) {
  const url=previewUrl;
  return <section className={styles.modelFields} aria-labelledby="character-model-title">
    <h3 id="character-model-title">3Dモデル</h3><p className={styles.note}>登録したモデルはこのキャラのレイド表示に反映されます。NFCタグや育成データは引き継ぎます。</p>
    <div className={styles.modelPreview} role="img" aria-label="編集中の3Dモデル">{url?<PartnerScene characterId={id} element={element} model={{url,yaw:yaw*Math.PI/180}}/>:<span>{file?"モデルを準備中…":"3Dモデル未登録"}</span>}</div>
    <label htmlFor="character-model">3Dモデルファイル<input key={`${file?.name??""}:${action}`} id="character-model" type="file" accept=".glb,model/gltf-binary" onChange={async(event)=>{
      const selected=event.target.files?.[0];if(!selected)return;
      if(!/\.glb$/i.test(selected.name)){onError("3DモデルはGLB形式で選択してください。");event.target.value="";return;}
      if(selected.size>maxCharacterModelBytes){onError("3Dモデルは20MB以内で選択してください。");event.target.value="";return;}
      onValidating(true);
      try { inspectCharacterGLB(new Uint8Array(await selected.arrayBuffer())); onError("");onFile(selected); }
      catch(error){onError(error instanceof Error?error.message:"GLBを読み込めません。");}
      finally{onValidating(false);}
    }}/></label><p className={styles.note}>GLB形式・20MB以内。テクスチャをファイル内に含めてください。プレビューは未保存です。下の「キャラ情報を保存」で確定します。</p>
    {(file||savedName)&&<p className={styles.note}>{file?`選択中：${file.name}`:`登録済み：${savedName}`}</p>}
    <label htmlFor="character-model-yaw">モデルの正面調整（度）<input id="character-model-yaw" type="number" min={-180} max={180} step={1} value={yaw} onChange={(event)=>onYaw(Number(event.target.value))}/></label>
    <p className={styles.note}>−180〜180度。横や後ろを向いている場合に調整してください。大きさと足元の位置は自動でそろえます。</p>
    {(savedUrl||file)&&action!=="remove"&&<button type="button" className={styles.button} onClick={onRemove}>3Dモデルを外す</button>}
    {action==="remove"&&<p className={styles.note}>保存すると3Dモデルと自動作成したキャラ画像を外し、標準表示に戻ります。</p>}
  </section>;
}
