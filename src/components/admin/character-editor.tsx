"use client";
import { useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import type { CharacterEditInput } from "@/lib/character-edit-input";
import { CharacterModelFields } from "./character-model-fields";
import { refreshCharacterModels } from "../battle/use-character-models";
import { CharacterArt } from "../character-art";
import styles from "./admin.module.css";
type Editable=Omit<CharacterEditInput,"imageAction"|"modelAction">&{id:string;imageUrl:string|null;modelUrl:string|null;modelYaw:number;model:{fileName:string;byteLength:number}|null};
const fieldsFrom=(value:Editable)=>({name:value.name,description:value.description,isDraft:value.isDraft,baseHp:String(value.baseHp),baseAttack:String(value.baseAttack),baseDefense:String(value.baseDefense),baseSpecialChargeRate:value.baseSpecialChargeRate===null?"":String(value.baseSpecialChargeRate)});
export function AdminCharacterEditor({initial,fixedClassification}:{initial:Editable;fixedClassification:boolean}) {
  const router=useRouter(),locked=useRef(false);
  const [saved,setSaved]=useState(initial),[fields,setFields]=useState(()=>fieldsFrom(initial));
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [modelFile,setModelFile]=useState<File|null>(null),[modelAction,setModelAction]=useState<"keep"|"replace"|"remove">("keep"),[modelYaw,setModelYaw]=useState(initial.modelYaw);
  const [modelChecking,setModelChecking]=useState(false);
  const [modelPreview,setModelPreview]=useState<string|null>(null),[thumbnailAttempt,setThumbnailAttempt]=useState(0);
  const [thumbnail,setThumbnail]=useState<{key:string;file:File|null;url:string|null;error:string}>({key:"",file:null,url:null,error:""});
  useEffect(()=>{setReady(true);},[]);
  useEffect(()=>{if(!modelFile){setModelPreview(null);return;}const url=URL.createObjectURL(modelFile);setModelPreview(url);return()=>URL.revokeObjectURL(url);},[modelFile]);
  const hasModel=modelAction!=="remove"&&Boolean(modelFile||saved.modelUrl);
  const modelUrl=modelAction==="remove"?null:modelFile?modelPreview:saved.modelUrl;
  const thumbnailKey=`${modelUrl??""}:${modelYaw}`;
  const thumbnailReady=thumbnail.key===thumbnailKey&&Boolean(thumbnail.file);
  const thumbnailError=thumbnail.key===thumbnailKey?thumbnail.error:"";
  useEffect(()=>{
    if(!modelUrl||thumbnail.key===thumbnailKey&&thumbnail.file)return;
    const controller=new AbortController();let imageUrl:string|undefined;
    const timer=setTimeout(()=>{
      void import("@/lib/character-thumbnail").then(({renderCharacterThumbnail})=>renderCharacterThumbnail({url:modelUrl,yaw:modelYaw*Math.PI/180},controller.signal)).then((blob)=>{
        if(controller.signal.aborted)return;
        imageUrl=URL.createObjectURL(blob);
        setThumbnail({key:thumbnailKey,file:new File([blob],"character-thumbnail.png",{type:"image/png"}),url:imageUrl,error:""});
      }).catch(()=>{if(!controller.signal.aborted)setThumbnail({key:thumbnailKey,file:null,url:null,error:"キャラ画像を作成できませんでした。WebGL対応のブラウザーで再度お試しください。"});});
    },200);
    return()=>{clearTimeout(timer);controller.abort();if(imageUrl)URL.revokeObjectURL(imageUrl);};
  },[modelUrl,modelYaw,thumbnailKey,thumbnailAttempt]);
  const imageUrl=hasModel?(thumbnailReady?thumbnail.url:null):modelAction==="remove"?null:saved.imageUrl;
  const update=(key:keyof typeof fields,value:string|boolean)=>{setFields((current)=>({...current,[key]:value}));setMessage("");};
  async function save(event:React.FormEvent) {
    event.preventDefault();if(locked.current||modelChecking||hasModel&&!thumbnailReady)return;locked.current=true;setBusy(true);setError("");setMessage("");
    try {
      const data=new FormData();
      data.set("data",JSON.stringify({...fields,element:saved.element,baseHp:Number(fields.baseHp),baseAttack:Number(fields.baseAttack),baseDefense:Number(fields.baseDefense),baseSpecialChargeRate:fields.baseSpecialChargeRate===""?null:Number(fields.baseSpecialChargeRate),revision:saved.revision,imageAction:hasModel?"replace":modelAction==="remove"?"remove":"keep",modelAction,modelYaw}));
      if(hasModel&&thumbnail.file)data.set("image",thumbnail.file);
      if(modelFile)data.set("model",modelFile);
      const response=await fetch(`/api/admin/characters/${saved.id}`,{method:"PATCH",body:data});
      const result=await response.json();
      if(response.status===401){router.replace("/admin/login");throw new Error("ログインの有効期限が切れました。");}
      if(!response.ok)throw new Error(result.error||"保存できませんでした。");
      setSaved(result.character);setFields(fieldsFrom(result.character));
      if(hasModel&&thumbnail.file)setThumbnail({key:`${result.character.modelUrl}:${result.character.modelYaw}`,file:thumbnail.file,url:result.character.imageUrl,error:""});
      setModelFile(null);setModelAction("keep");setModelYaw(result.character.modelYaw);refreshCharacterModels();
      setMessage("キャラクター情報を保存しました。発行済みのURLはそのまま使えます。");router.refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:"接続を確認してください。");}
    finally{locked.current=false;setBusy(false);}
  }
  return <section className={`${styles.panel} ${styles.editor}`} aria-labelledby="character-edit-title"><h2 id="character-edit-title">キャラクターを編集</h2><p className={styles.note}>ID「{saved.id}」と獲得条件は固定です。名前・画像・基本値を変更しても、タグURL・所持・育成の加算値は引き継ぎます。</p><form onSubmit={(event)=>void save(event)}>
    <fieldset disabled={!ready||busy||modelChecking} className={styles.editFields}>
      <div className={styles.editAppearance}><div className={styles.editPreview} role="img" aria-label="編集中のキャラ画像">{hasModel&&!thumbnailReady?<span role="status">{thumbnailError?"画像の作成に失敗しました":"画像を作成中…"}</span>:<CharacterArt element={saved.element} imageUrl={imageUrl} portrait/>}</div><div><h3>キャラ画像</h3><p className={styles.note}>3Dモデルから正面の画像を自動作成します。ホーム・図鑑・獲得画面にもこの画像が表示されます。</p>{hasModel&&thumbnailReady&&<p className={styles.note}>画像を自動作成しました。「キャラ情報を保存」でモデルと一緒に保存します。</p>}{thumbnailError&&<><p role="alert" className={styles.error}>{thumbnailError}</p><button type="button" className={styles.button} onClick={()=>setThumbnailAttempt((value)=>value+1)}>画像を再作成</button></>}</div></div>
      <CharacterModelFields id={saved.id} element={saved.element} savedUrl={saved.modelUrl} savedName={saved.model?.fileName??null} previewUrl={modelUrl} file={modelFile} action={modelAction} yaw={modelYaw} onFile={(value)=>{setModelPreview(null);setModelFile(value);setModelAction("replace");setMessage("");}} onRemove={()=>{setModelFile(null);setModelAction("remove");setMessage("");}} onYaw={(value)=>{setModelYaw(value);setMessage("");}} onError={setError} onValidating={setModelChecking}/>
      <label htmlFor="character-name">キャラ名<input id="character-name" required maxLength={50} value={fields.name} onChange={(event)=>update("name",event.target.value)}/></label>
      <label htmlFor="character-description">紹介文<textarea id="character-description" aria-label="紹介文" rows={4} maxLength={1000} value={fields.description} onChange={(event)=>update("description",event.target.value)}/></label>
      <div className={styles.statInputs}>{([{key:"baseHp",label:"基本HP",min:1},{key:"baseAttack",label:"基本攻撃",min:1},{key:"baseDefense",label:"基本防御",min:1},{key:"baseSpecialChargeRate",label:"基本チャージ効率",min:0}] as const).map(({key,label,min})=><label htmlFor={`character-${key}`} key={key}>{label}<input id={`character-${key}`} type="number" min={min} max={10000} step={1} required={key!=="baseSpecialChargeRate"} placeholder={key==="baseSpecialChargeRate"?"未設定":""} value={fields[key]} onChange={(event)=>update(key,event.target.value)}/></label>)}</div><p className={styles.note}>チャージ効率は空欄で未設定にできます。基本値の変更は全プレイヤーに反映されます。</p>
      <label className={styles.checkbox}><input type="checkbox" checked={fields.isDraft} disabled={fixedClassification} onChange={(event)=>update("isDraft",event.target.checked)}/>仮キャラ（開発中）として表示する</label><p className={styles.note}>{fixedClassification?"学科キャラと4プロは正式キャラとして扱います。":"正式版に差し替える際はチェックを外してください。キャラIDを変える必要はありません。"}</p>
      <button type="submit" disabled={hasModel&&!thumbnailReady} className={`${styles.button} ${styles.primary}`}>{busy?"保存しています…":"キャラ情報を保存"}</button>
    </fieldset><p className={styles.error} role="alert">{error}</p><p className={styles.success} role="status">{message}</p>
  </form></section>;
}
