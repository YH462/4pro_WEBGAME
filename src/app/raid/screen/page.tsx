import type { Metadata } from "next";
import { RaidScreen } from "@/components/raid-screen/raid-screen";
import { config } from "@/lib/config";
import { notFound, redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin-session";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { localNetworkHosts } from "@/lib/local-network";
import { raidEntryUrls } from "@/lib/raid-entry";
import { RaidShowcase } from "@/components/raid-screen/raid-showcase";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "会場レイドスクリーン" };

export default async function RaidScreenPage({ searchParams }: { searchParams: Promise<{ sync?: string; demo?: string; character?: string }> }) {
  const params = await searchParams;
  const showcase = params.demo === "effects";
  const local = !showcase && params.sync === "local";
  const cfg = config();
  if (local && !cfg.simulator) notFound();
  if (!local && !showcase && !await currentAdmin()) redirect("/admin/login?next=raid-screen");
  const urls = !local && !showcase ? []
    : raidEntryUrls({ appUrl: cfg.APP_URL, local, lanHosts: localNetworkHosts(), requestHost: (await headers()).get("host") });
  const entryTargets = await Promise.all(urls.map(async (url) => ({
    url,
    qrImage: await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 4, scale: 12, color: { dark: "#000000", light: "#ffffff" } }),
  })));
  if (showcase) {
    const characters=await db.character.findMany({select:{id:true,name:true,sortOrder:true},orderBy:{sortOrder:"asc"}});
    return <RaidShowcase entryTargets={entryTargets} demoCharacters={characters} initialDemoCharacterId={params.character}/>;
  }
  return <RaidScreen local production={!local} canSync={cfg.simulator} entryTargets={entryTargets}/>;
}
