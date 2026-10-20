"use client";
import type { PartnerView } from "@/lib/character-presentation";
import { RaidMobileConsole } from "./raid-mobile-console";
export function BattleConsole({ partners }: { partners: PartnerView[] }) {
  return <RaidMobileConsole partners={partners}/>;
}
