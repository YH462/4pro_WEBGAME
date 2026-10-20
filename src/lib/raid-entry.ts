import { privateIpv4 } from "./local-network";

export type RaidEntryTarget = { url: string; qrImage: string };

// Only configured origins and addresses belonging to this PC can become QR links.
export function raidEntryUrls({ appUrl, local, lanHosts, requestHost }: {
  appUrl: string; local: boolean; lanHosts: string[]; requestHost: string | null;
}) {
  const canonical = new URL(appUrl);
  const path = `/battle/raid${local ? "?sync=local" : ""}`;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(canonical.hostname)) {
    return [new URL(path, canonical.origin).href];
  }
  const origins = [...new Set(lanHosts.filter(privateIpv4))].map((host) => {
    const url = new URL(canonical.origin);
    url.hostname = host;
    return url;
  });
  // Opening the screen through a LAN address selects that same address first.
  origins.sort((a, b) => Number(b.host === requestHost) - Number(a.host === requestHost));
  return origins.map((origin) => new URL(path, origin).href);
}
