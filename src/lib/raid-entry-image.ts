import QRCode from "qrcode";
import { raidAdmissionUrl } from "./raid-admission";
import type { RaidEntryTarget } from "./raid-entry";
let cached: { url: string; target: Promise<RaidEntryTarget> } | undefined;
export function raidReceptionQr(origin: string, roomId: string) {
  const url = raidAdmissionUrl(origin, roomId);
  if (cached?.url === url) return cached.target;
  const target = QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 4, scale: 12, color: { dark: "#000000", light: "#ffffff" } }).then(qrImage => ({ url, qrImage }));
  cached = { url, target };
  void target.catch(() => { if (cached?.target === target) cached = undefined; });
  return target;
}
