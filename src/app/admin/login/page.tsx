import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin-session";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminLogin } from "@/components/admin/admin-login";
import styles from "@/components/admin/admin.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"管理者ログイン",referrer:"no-referrer" as const};
export default async function Login({searchParams}:{searchParams:Promise<{next?:string}>}) {
  const destination=(await searchParams).next==="raid-screen"?"/raid/screen":"/admin";
  if(await currentAdmin())redirect(destination);
  return <div className={styles.adminPage}><AdminHeader/><AdminLogin destination={destination}/></div>;
}
