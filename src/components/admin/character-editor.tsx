"use client";
import { useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import type { CharacterEditInput } from "@/lib/character-edit-input";
import { characterModel } from "@/lib/character-models";
import { CharacterArt } from "../character-art";
import styles from "./admin.module.css";
type Editable=Omit<CharacterEditInput,"imageAction">&{id:string;imageUrl:string|null};
const fieldsFrom=(value:Editable)=>({name:value.name,description:value.description,element:value.element,isDraft:value.isDraft,baseHp:String(value.baseHp),baseAttack:String(value.baseAttack),baseDefense:String(value.baseDefense),baseSpecialChargeRate:value.baseSpecialChargeRate===null?"":String(value.baseSpecialChargeRate)});
export function AdminCharacterEditor({initial,fixedClassification}:{initial:Editable;fixedClassification:boolean}) {
  const router=useRouter(),locked=useRef(false),fileInput=useRef<HTMLInputElement>(null);
  const [saved,setSaved]=useState(initial),[fields,setFields]=useState(()=>fieldsFrom(initial));
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<string|null>(null),[imageAction,setImageAction]=useState<CharacterEditInput["imageAction"]>("keep");
  useEffect(()=>{setReady(true);},[]);
  useEffect(()=>{if(!file){setPreview(null);return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  const imageUrl=imageAction==="remove"?null:preview??saved.imageUrl;
  const update=(key:keyof typeof fields,value:string|boolean)=>{setFields((current)=>({...current,[key]:value}));setMessage("");};
  async function save(event:React.FormEvent) {
    event.preventDefault();if(locked.current)return;locked.current=true;setBusy(true);setError("");setMessage("");
    try {
      const data=new FormData();
      data.set("data",JSON.stringify({...fields,baseHp:Number(fields.baseHp),baseAttack:Number(fields.baseAttack),baseDefense:Number(fields.baseDefense),baseSpecialChargeRate:fields.baseSpecialChargeRate===""?null:Number(fields.baseSpecialChargeRate),revision:saved.revision,imageAction}));
      if(file)data.set("image",file);
      const response=await fetch(`/api/admin/characters/${saved.id}`,{method:"PATCH",body:data});
      const result=await response.json();
      if(response.status===401){router.replace("/admin/login");throw new Error("ログインの有効期限が切れました。");}
      if(!response.ok)throw new Error(result.error||"保存できませんでした。");
      setSaved(result.character);setFields(fieldsFrom(result.character));setFile(null);setImageAction("keep");
      if(fileInput.current)fileInput.current.value="";
      setMessage("キャラクター情報を保存しました。発行済みのURLはそのまま使えます。");router.refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:"接続を確認してください。");}
    finally{locked.current=false;setBusy(false);}
  }
  return <section className={`${styles.panel} ${styles.editor}`} aria-labelledby="character-edit-title"><h2 id="character-edit-title">キャラクターを編集</h2><p className={styles.note}>ID「{saved.id}」と獲得条件は固定です。名前・画像・基本値を変更しても、タグURL・所持・育成の加算値は引き継ぎます。</p><form onSubmit={(event)=>void save(event)}>
    <fieldset disabled={!ready||busy} className={styles.editFields}>
      {characterModel(saved.id)&&<p className={styles.note}>このキャラのレイド表示は3Dモデルを使用します。ここで設定する画像は図鑑などの2D表示に反映されます。</p>}
      <div className={styles.editAppearance}><div className={styles.editPreview} role="img" aria-label="編集中のキャラ画像"><CharacterArt element={fields.element} imageUrl={imageUrl} portrait/></div><div><label htmlFor="character-image">キャラ画像<input ref={fileInput} id="character-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event)=>{const selected=event.target.files?.[0];if(!selected)return;if(selected.size>2*1024*1024){setError("画像は2MB以内で選択してください。");event.target.value="";return;}setError("");setFile(selected);setImageAction("replace");setMessage("");}}/></label><p className={styles.note}>PNG・JPEG・WebP、2MB以内・最大4096px。保存時に最大1024pxへ縮小します。透過画像も使用できます。画像は2Dで表示されます。</p>{(saved.imageUrl||file)&&<button type="button" className={styles.button} onClick={()=>{setFile(null);setImageAction(saved.imageUrl?"remove":"keep");if(fileInput.current)fileInput.current.value="";}}>画像を外して標準表示に戻す</button>}</div></div>
      <div className={styles.editGrid}><label htmlFor="character-name">キャラ名<input id="character-name" required maxLength={50} value={fields.name} onChange={(event)=>update("name",event.target.value)}/></label><label htmlFor="character-element">属性<select id="character-element" aria-label="属性" value={fields.element} onChange={(event)=>update("element",event.target.value)}><option value="FOREST">森</option><option value="THUNDER">雷</option><option value="FLAME">炎</option><option value="AQUA">水</option><option value="LEGEND">レジェンド</option></select></label></div>
      <label htmlFor="character-description">紹介文<textarea id="character-description" aria-label="紹介文" rows={4} maxLength={1000} value={fields.description} onChange={(event)=>update("description",event.target.value)}/></label>
      <div className={styles.statInputs}>{([{key:"baseHp",label:"基本HP",min:1},{key:"baseAttack",label:"基本攻撃",min:1},{key:"baseDefense",label:"基本防御",min:1},{key:"baseSpecialChargeRate",label:"基本チャージ効率",min:0}] as const).map(({key,label,min})=><label htmlFor={`character-${key}`} key={key}>{label}<input id={`character-${key}`} type="number" min={min} max={10000} step={1} required={key!=="baseSpecialChargeRate"} placeholder={key==="baseSpecialChargeRate"?"未設定":""} value={fields[key]} onChange={(event)=>update(key,event.target.value)}/></label>)}</div><p className={styles.note}>チャージ効率は空欄で未設定にできます。基本値の変更は全プレイヤーに反映されます。</p>
      <label className={styles.checkbox}><input type="checkbox" checked={fields.isDraft} disabled={fixedClassification} onChange={(event)=>update("isDraft",event.target.checked)}/>仮キャラ（開発中）として表示する</label><p className={styles.note}>{fixedClassification?"学科キャラと4プロは正式キャラとして扱います。":"正式版に差し替える際はチェックを外してください。キャラIDを変える必要はありません。"}</p>
      <button type="submit" className={`${styles.button} ${styles.primary}`}>{busy?"保存しています…":"キャラ情報を保存"}</button>
    </fieldset><p className={styles.error} role="alert">{error}</p><p className={styles.success} role="status">{message}</p>
  </form></section>;
}
