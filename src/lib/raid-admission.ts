// The room identifier binds a scanned URL to one reception. It is navigation
// input, not staff authentication or proof of physical attendance.
export const validRaidRoomId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function raidAdmissionUrl(origin: string, roomId: string) {
  if (!validRaidRoomId(roomId)) throw new Error("Invalid raid room.");
  const url = new URL("/battle/raid", origin); url.searchParams.set("room", roomId);
  return url.href;
}
