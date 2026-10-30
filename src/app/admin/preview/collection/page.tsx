import { Shell } from "@/components/shell";
import { PartnerCollection } from "@/components/partner-collection";
import { adminPreviewCharacters } from "@/lib/admin-preview";
import styles from "@/app/collection/collection.module.css";
export const dynamic="force-dynamic";
export default async function PreviewCollection(){
  const {partners}=await adminPreviewCharacters();
  return <Shell preview active="/admin/preview/collection"><div className={styles.screen}>
    <header className={styles.heading}><div className={styles.title}><h1>キャラ図鑑</h1></div><strong>全{partners.length}体</strong></header>
    <PartnerCollection partners={partners} collectionHref="/admin/preview/collection"/>
  </div></Shell>;
}
