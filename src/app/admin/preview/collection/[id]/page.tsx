import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { PartnerPanel } from "@/components/partner-panel";
import { adminPreviewCharacters } from "@/lib/admin-preview";
import styles from "@/components/partner-panel.module.css";
export const dynamic="force-dynamic";
export default async function PreviewDetail({params}:{params:Promise<{id:string}>}){
  const {partners,characters}=await adminPreviewCharacters();
  const {id}=await params,index=partners.findIndex(p=>p.id===id);
  if(index<0)notFound();
  const previous=characters[index-1]??null,next=characters[index+1]??null;
  const root="/admin/preview/collection";
  return <Shell preview active={root}><div className="detail-screen"><div className={styles.heading}>
    <Link href={root}><ArrowLeft size={20}/>図鑑に戻る</Link>
    <nav className={styles.characterNavigation} aria-label="キャラクターの切り替え">
      {previous?<Link href={`${root}/${previous.id}`} aria-label={`前のキャラクター：${previous.name}`}><ChevronLeft size={22}/></Link>:<button type="button" disabled aria-label="前のキャラクター"><ChevronLeft size={22}/></button>}
      {next?<Link href={`${root}/${next.id}`} aria-label={`次のキャラクター：${next.name}`}><ChevronRight size={22}/></Link>:<button type="button" disabled aria-label="次のキャラクター"><ChevronRight size={22}/></button>}
    </nav>
  </div><PartnerPanel partner={partners[index]} previous={previous} next={next} collectionHref={root}/></div></Shell>;
}
