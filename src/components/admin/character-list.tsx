"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CharacterArt } from "../character-art";
import styles from "./admin.module.css";
type CharacterRow={id:string;name:string;element:string;imageUrl?:string|null;department:string|null;isLegendary:boolean;owners:number;tags:number;enabledTags:number};
export function AdminCharacterList({characters}:{characters:CharacterRow[]}) {
  const [ready,setReady]=useState(false);
  useEffect(()=>{setReady(true);},[]);
  const [query,setQuery]=useState(""),[category,setCategory]=useState("all");
  const filtered=characters.filter((item)=>(`${item.name} ${item.id} ${item.department??""}`.toLowerCase().includes(query.trim().toLowerCase()))&&(category==="all"||category==="department"&&Boolean(item.department)||category==="extra"&&!item.department&&!item.isLegendary||category==="legend"&&item.isLegendary));
  return <><div className={styles.filters}><label htmlFor="character-search">キャラクターを検索<input id="character-search" type="search" disabled={!ready} value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="キャラ名・ID・学科名"/></label><label htmlFor="character-category">分類<select id="character-category" aria-label="分類" disabled={!ready} value={category} onChange={(event)=>setCategory(event.target.value)}><option value="all">すべて</option><option value="department">学科キャラ</option><option value="extra">学科なし</option><option value="legend">条件解放</option></select></label></div><div className={styles.cards}>{filtered.map((character)=><article className={styles.card} key={character.id}><div className={styles.cardTop}><div className={styles.art} aria-hidden="true"><CharacterArt element={character.element} imageUrl={character.imageUrl} portrait/></div><div><h2>{character.name}</h2><span className={styles.badge}>{character.isLegendary?"4学科で解放":character.department??"学科なし"}</span></div></div><div className={styles.cardStats}><span>所持者 <b>{character.owners}</b>人</span><span>有効タグ <b>{character.enabledTags}</b> / {character.tags}</span></div><Link className={styles.button} href={`/admin/characters/${character.id}`}>{character.isLegendary?"編集・解放条件":"編集・タグ管理"}</Link></article>)}</div>{!filtered.length&&<p className={styles.empty}>該当するキャラクターはありません。</p>}</>;
}
