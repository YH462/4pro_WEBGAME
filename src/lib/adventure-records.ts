export type CollectedPartnerRecord = {
  id: string; name: string; element: string; imageUrl: string | null; acquiredAt: string;
};
export type RaidHistoryRecord = {
  id: string; roomId: string; characterId: string; characterName: string;
  bossName: string; won: boolean; turns: number; finishedAt: string;
};
export type AdventureRecords = {
  playerId: string; collected: number; total: number; raidCount: number; victories: number;
  characters: CollectedPartnerRecord[]; raids: RaidHistoryRecord[];
  awards: PlayerAwardsView;
};
import type { PlayerAwardsView } from "./achievement-rules";
