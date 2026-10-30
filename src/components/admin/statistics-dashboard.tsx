"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, BookOpen, CalendarDays, Clock3, Crown, Download, Flag, Hexagon, LockKeyhole, Maximize2, RefreshCw, Swords, Target, Trophy, Users } from "lucide-react";
import type { EventStatistics, RankingMetric } from "@/lib/event-statistics";
import styles from "./statistics-dashboard.module.css";

const number=(n:number)=>n.toLocaleString("ja-JP",{maximumFractionDigits:1});
const percent=(n:number|null)=>n===null?"—":`${number(n*100)}%`;
const tabs=[{id:"collected",label:"収集数",icon:Crown},{id:"victories",label:"討伐成功数",icon:Swords},{id:"points",label:"討伐ポイント",icon:Trophy}] as const;
const exports=[{id:"all",label:"すべて保存（ZIP）"},{id:"summary",label:"概要"},{id:"participants",label:"参加者・ランキング"},{id:"collections",label:"キャラ獲得履歴"},{id:"raids",label:"戦闘結果"},{id:"raid-participants",label:"戦闘参加者"}];

function HourChart({hours}:{hours:EventStatistics["hours"]}){
  const [choice,setChoice]=useState("");
  const dates=[...new Set(hours.map(item=>item.hour.slice(0,10)))];
  const day=dates.includes(choice)?choice:dates.at(-1)??"";
  const counts=Array.from({length:24},(_,i)=>hours.find(item=>item.hour===`${day}T${String(i).padStart(2,"0")}`)?.count??0);
  const max=Math.max(2,...counts),x=(i:number)=>45+i*24,y=(n:number)=>166-n/max*138;
  const line=counts.map((n,i)=>`${x(i)},${y(n)}`).join(" ");
  return <section className={`${styles.card} ${styles.hourCard}`} aria-label="時間帯別の参加登録">
    <div className={styles.cardHeading}><h2><BarChart3/>時間帯別の参加登録</h2>{dates.length>0&&<select aria-label="登録グラフの表示日" value={day} onChange={e=>setChoice(e.target.value)}>{dates.map(date=><option key={date}>{date}</option>)}</select>}</div>
    <div className={styles.chartScroll}><svg className={styles.hourChart} viewBox="0 0 640 210" role="img" aria-label={day?`${day}の時間帯別登録数。合計${counts.reduce((n,v)=>n+v,0)}人` : "参加登録はまだありません"}>
      <defs><linearGradient id="registration-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d51f42" stopOpacity=".3"/><stop offset="100%" stopColor="#d51f42" stopOpacity=".03"/></linearGradient></defs>
      {[0,.5,1].map(r=><g key={r}><line x1="45" x2="597" y1={y(max*r)} y2={y(max*r)} stroke="#e5e9ef"/><text x="34" y={y(max*r)+5} textAnchor="end">{number(max*r)}</text></g>)}
      <polygon points={`45,166 ${line} 597,166`} fill="url(#registration-fill)"/>
      <polyline points={line} fill="none" stroke="#d51f42" strokeWidth="3" strokeLinejoin="round"/>
      {counts.map((n,i)=><circle key={i} cx={x(i)} cy={y(n)} r="4" fill="#d51f42" stroke="#fff" strokeWidth="1.5"><title>{String(i).padStart(2,"0")}:00：{n}人</title></circle>)}
      {[0,3,6,9,12,15,18,21].map(i=><text key={i} x={x(i)} y="196" textAnchor="middle">{String(i).padStart(2,"0")}:00</text>)}
    </svg></div>
  </section>;
}

export function StatisticsDashboard(){
  const [data,setData]=useState<EventStatistics|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
  const [expired,setExpired]=useState(false),[exporting,setExporting]=useState(false),[actionError,setActionError]=useState("");
  const [metric,setMetric]=useState<RankingMetric>("collected"),[all,setAll]=useState(false);
  const request=useRef<AbortController|null>(null),download=useRef<AbortController|null>(null),mounted=useRef(false),expiredRef=useRef(false);
  const requireLogin=useCallback(()=>{expiredRef.current=true;setExpired(true);setData(null);setError("ログインの有効期限が切れました。");},[]);
  const refresh=useCallback(async()=>{
    if(document.hidden||expiredRef.current||request.current)return;
    const controller=new AbortController();request.current=controller;setBusy(true);
    try{
      const response=await fetch("/api/admin/statistics",{cache:"no-store",signal:controller.signal});
      if(controller.signal.aborted||!mounted.current)return;
      if(response.status===401){requireLogin();return;}
      if(!response.ok)throw new Error("統計を取得できませんでした。次の更新で再試行します。");
      const payload=await response.json();
      if(!controller.signal.aborted&&mounted.current){setData(payload.statistics);setError("");}
    }catch(reason){if(!controller.signal.aborted&&mounted.current)setError(reason instanceof Error?reason.message:"接続を確認してください。");}
    finally{if(request.current===controller){request.current=null;if(mounted.current)setBusy(false);}}
  },[requireLogin]);
  useEffect(()=>{
    mounted.current=true;void refresh();
    const timer=setInterval(()=>void refresh(),5000);
    const visibility=()=>{if(document.hidden)request.current?.abort();else void refresh();};
    document.addEventListener("visibilitychange",visibility);
    return ()=>{mounted.current=false;clearInterval(timer);document.removeEventListener("visibilitychange",visibility);request.current?.abort();request.current=null;download.current?.abort();};
  },[refresh]);
  async function save(file:string){
    if(exporting||expired)return;
    const controller=new AbortController();download.current=controller;setExporting(true);setActionError("");
    try{
      const response=await fetch(`/api/admin/statistics/export?file=${file}`,{cache:"no-store",signal:controller.signal});
      if(response.status===401){requireLogin();return;}
      if(!response.ok)throw new Error("CSVを出力できませんでした。もう一度お試しください。");
      const blob=await response.blob();if(controller.signal.aborted||!mounted.current)return;
      const url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download=response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]??`4pro-statistics.${file==="all"?"zip":"csv"}`;
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(reason){if(!controller.signal.aborted&&mounted.current)setActionError(reason instanceof Error?reason.message:"保存に失敗しました。");}
    finally{if(download.current===controller){download.current=null;if(mounted.current)setExporting(false);}}
  }
  async function fullscreen(){
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
    catch{setActionError("全画面にできませんでした。ブラウザーの全画面機能をご利用ください。");}
  }
  const s=data?.summary;
  const metrics=[
    {label:"参加登録",value:s?.registered,unit:"人",icon:Users},
    {label:"収集参加者",value:s?.collectors,unit:"人",icon:BookOpen},
    {label:"4学科達成",value:s?.complete,unit:"人",extra:s?percent(s.completionRate):undefined,icon:Hexagon},
    {label:"レイド参加者",value:s?.raidPlayers,unit:"人",icon:Swords},
    {label:"完了した戦闘",value:s?.battles,unit:"戦",icon:Flag},
    {label:"討伐成功率",text:s?percent(s.winRate):"—",icon:Trophy},
  ];
  const rows=data?.rankings[metric]??[];
  return <main className={styles.page}>
    <header className={styles.header}>
      <div className={styles.identity}><Link href="/admin" className={styles.brand} aria-label="4PRO キャラクター管理"><Hexagon fill="currentColor"/>4<span>PRO</span></Link><h1>統計ダッシュボード</h1><span className={styles.private}><LockKeyhole size={17}/>管理者限定</span></div>
      <div className={styles.actions}>
        <button type="button" onClick={()=>void refresh()} disabled={busy||expired} aria-busy={busy}><RefreshCw size={19} className={busy?styles.spin:undefined}/>今すぐ更新</button>
        <details className={styles.export}><summary><Download size={20}/>{exporting?"出力中…":"CSV出力"}</summary><div className={styles.exportMenu}>{exports.map(item=><button key={item.id} type="button" disabled={exporting||!data||expired} onClick={event=>{event.currentTarget.closest("details")?.removeAttribute("open");void save(item.id);}}>{item.label}{item.id!=="all"&&<span>CSV</span>}</button>)}</div></details>
        <button type="button" aria-label="全画面で表示" onClick={()=>void fullscreen()}><Maximize2 size={20}/></button>
      </div>
    </header>
    <div className={styles.metadata}><span className={styles.event}><CalendarDays size={19}/>{data?.event.name??"イベント統計"}</span><span><i className={error?styles.offline:styles.live}/>{expired?"ログインが必要です":error?"接続を確認中":"5秒ごとに更新"}</span><span><Clock3 size={18}/>最終更新 {data?new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(data.generatedAt)):"—"}</span><span className={styles.scope}>現イベント・全期間{data?.event.status==="ENDED"?"（終了）":""}</span><Link href="/admin">キャラクター管理へ</Link></div>
    {(error||actionError)&&<div className={styles.error} role="alert">{error||actionError}{expired&&<Link href="/admin/login?next=statistics">管理者ログインへ</Link>}</div>}
    {!data&&!error&&<p className={styles.loading} role="status">統計を読み込み中…</p>}
    {!expired&&<>
      <section className={styles.metrics} aria-label="イベントの主要統計">{metrics.map(({label,value,text,unit,extra,icon:Icon})=><article className={styles.kpi} key={label}><h2><Icon/>{label}</h2><div><strong>{text??(value===undefined?"—":number(value))}</strong>{value!==undefined&&<span>{unit}</span>}{extra&&<b>{extra}</b>}</div></article>)}</section>
      <div className={styles.charts}>
        <HourChart hours={data?.hours??[]}/>
        <section className={styles.card} aria-label="キャラ別の獲得人数"><h2><Crown/>キャラ別の獲得人数</h2><div className={styles.bars}>{data?.characters.map(c=><div key={c.id} className={styles.barRow}><span title={c.name}>{c.name}{c.isLegendary&&<small>コンプリート報酬</small>}</span><div className={styles.barTrack}><i style={{width:`${c.owners/Math.max(1,...data.characters.map(c=>c.owners))*100}%`}}/></div><b>{number(c.owners)}</b></div>)}{data?.characters.length===0&&<p>キャラクターがありません。</p>}</div></section>
        <section className={`${styles.card} ${styles.raidCard}`} aria-label="レイド成績"><h2><Target/>レイド成績</h2><div className={styles.raidSummary}><div className={styles.donut} role="img" aria-label={`討伐成功率 ${s?percent(s.winRate):"未取得"}`} style={{background:`conic-gradient(#d51f42 0 ${(s?.winRate??0)*100}%,#dfe3eb 0 100%)`}}><strong>{s?percent(s.winRate):"—"}</strong></div><dl><div><dt><i/>討伐成功</dt><dd>{s?number(s.victories):"—"}戦</dd></div><div><dt><i/>全滅</dt><dd>{s?number(s.defeats):"—"}戦</dd></div><div className={styles.turns}><dt>平均討伐</dt><dd>{s?.averageTurns==null?"—":number(s.averageTurns)}<span>ターン</span></dd></div></dl></div></section>
      </div>
      <section className={`${styles.card} ${styles.ranking}`} aria-label="参加者ランキング"><div className={styles.rankingHeader}><h2><Trophy/>参加者ランキング</h2><div role="tablist" aria-label="ランキングの種類">{tabs.map(({id,label,icon:Icon})=><button key={id} type="button" role="tab" id={`rank-${id}`} aria-selected={id===metric} aria-controls="rankings-panel" onClick={()=>{setMetric(id);setAll(false);}}><Icon size={20}/>{label}</button>)}</div><button type="button" className={styles.all} onClick={()=>setAll(v=>!v)}>{all?"上位10人に戻す":"全件を見る"}</button></div>
        <div id="rankings-panel" role="tabpanel" aria-labelledby={`rank-${metric}`} className={styles.tableScroll}>
          <table><thead><tr><th scope="col">順位</th><th scope="col">ニックネーム</th><th scope="col">収集数</th><th scope="col">討伐成功数</th><th scope="col">討伐ポイント</th></tr></thead><tbody>{(all?rows:rows.slice(0,10)).map(p=><tr key={p.id}><td><b className={styles.medal} data-place={p.ranks[metric]}>{p.ranks[metric]}</b></td><th scope="row" title={`参加者ID：${p.id}`}>{p.displayName}</th><td>{number(p.collected)}体</td><td>{number(p.victories)}回</td><td>{number(p.points)} pt</td></tr>)}</tbody></table>
          {data&&rows.length===0&&<p className={styles.empty}>まだランキングの対象となる記録がありません。</p>}
        </div>
      </section>
      {data&&<details className={styles.more}><summary>学科・レイドの詳しい統計</summary><div className={styles.detailGrid}><section className={styles.card}><h2>学科別の獲得人数</h2>{data.departments.map(d=><div className={styles.detailRow} key={d.id}><span>{d.name}</span><b>{number(d.owners)}人</b></div>)}</section><section className={styles.card}><h2>完了戦闘の参加人数別成績</h2><div className={styles.tableScroll}><table><thead><tr><th>人数</th><th>完了戦闘</th><th>討伐成功</th></tr></thead><tbody>{data.sizes.map(s=><tr key={s.participants}><td>{s.participants}人</td><td>{s.battles}戦</td><td>{s.victories}戦</td></tr>)}</tbody></table>{!data.sizes.length&&<p className={styles.empty}>完了した戦闘はまだありません。</p>}</div></section><section className={styles.card}><h2>キャラ別レイド使用数</h2>{data.characters.map(c=><div key={c.id} className={styles.detailRow}><span>{c.name}</span><b>{c.uses}回</b></div>)}</section></div></details>}
    </>}
  </main>;
}
