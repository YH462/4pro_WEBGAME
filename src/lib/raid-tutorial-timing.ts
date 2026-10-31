// OpeningVoice.mp3 decodes to 48.927s. Allow its last word to finish before battle.
export const raidTutorialSeconds = 49;
export const raidTutorialStarts = [0, 16, 26, 38] as const;
export const raidTutorialAudio = "/music/OpeningVoice.mp3";

export function raidTutorialStep(remainingSeconds: number) {
  const elapsed = Math.max(0, raidTutorialSeconds - remainingSeconds);
  return Math.max(0, raidTutorialStarts.findLastIndex(start => elapsed >= start));
}
