import type { Metadata } from "next";
import { RaidScreen } from "@/components/raid-screen/raid-screen";
import { config } from "@/lib/config";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "会場レイドスクリーン" };

export default async function RaidScreenPage({ searchParams }: { searchParams: Promise<{ sync?: string }> }) {
  const local = (await searchParams).sync === "local";
  if (local && !config().simulator) notFound();
  return <RaidScreen local={local}/>;
}
