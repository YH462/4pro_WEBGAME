import { Shell } from "@/components/shell";
import { ExhibitionMap } from "@/components/exhibition-map";
import { RaidQrScanner } from "@/components/raid-qr-scanner";
import { SurveyBanner } from "@/components/survey-banner";
import { currentPlayer } from "@/lib/session";
import { db } from "@/lib/db";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";
export default async function Home() {
  const player = await currentPlayer();
  const characters = await db.character.findMany({ orderBy: { sortOrder: "asc" }, include: { department: true } });
  const partners = characters.map((character) => ({
    ...character,
    owned: player?.characters.some((item) => item.characterId === character.id) ?? false,
  }));
  return (
    <Shell>
      <div className={`${styles.screen} ${styles.withSurvey}`}>
        <SurveyBanner url={process.env.KOSEN_SURVEY_URL}/>
        <ExhibitionMap
          partners={partners.filter((partner) => !partner.isLegendary)}
          legend={partners.find((partner) => partner.id === "four-pro")}
        />
        <RaidQrScanner hasPlayer={!!player}/>
      </div>
    </Shell>
  );
}
