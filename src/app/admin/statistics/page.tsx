import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin-session";
import { StatisticsDashboard } from "@/components/admin/statistics-dashboard";
export const dynamic="force-dynamic";
export const metadata={title:"統計ダッシュボード",referrer:"no-referrer" as const,robots:{index:false,follow:false}};
export default async function StatisticsPage(){
  if(!await currentAdmin())redirect("/admin/login?next=statistics");
  return <StatisticsDashboard/>;
}
