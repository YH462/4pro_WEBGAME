import { networkInterfaces } from "node:os";

export function privateIpv4(address: string) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return false;
  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) &&
    (parts[0] === 10 || parts[0] === 192 && parts[1] === 168 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

export function localNetworkHosts() {
  return ["localhost", "127.0.0.1", ...Object.values(networkInterfaces()).flatMap((items) =>
    (items ?? []).filter((item) => item.family === "IPv4" && !item.internal && privateIpv4(item.address)).map((item) => item.address))];
}

export function developmentOriginAllowed(origin: string | null, appUrl: string, enabled: boolean) {
  if (!enabled || process.env.NODE_ENV !== "development" || !origin) return false;
  const canonical = new URL(appUrl);
  return canonical.protocol === "http:" && localNetworkHosts().some((host) => origin === `http://${host}:${canonical.port || "80"}`);
}
