import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { ExhibitionMap } from "@/components/exhibition-map";
import { adminPreviewCharacters } from "@/lib/admin-preview";
import styles from "@/app/home.module.css";
import previewStyles from "@/components/navigation.module.css";
export const dynamic="force-dynamic";
export default async function PreviewHome(){
  const {characters}=await adminPreviewCharacters();
  const partners=characters.map(c=>({...c,owned:true}));
  return <Shell preview active="/admin/preview"><div className={styles.screen}>
    <ExhibitionMap partners={partners.filter(p=>!p.isLegendary)} legend={partners.find(p=>p.id==="four-pro")} collectionHref="/admin/preview/collection"/>
    <Link className={previewStyles.previewLink} href="/admin/preview/collection"><BookOpen aria-hidden="true"/><span>全キャラの図鑑を確認</span><ChevronRight aria-hidden="true"/></Link>
  </div></Shell>;
}
