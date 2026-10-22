// A scanned QR is navigation input, never proof of raid admission.
export function raidQrDestination(value: string, origin: string): string | null {
  const text = value.trim();
  if (!text || text.length > 2048 || !/^(https?:\/\/|\/)/i.test(text)) return null;
  try {
    const url = new URL(text, origin);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin || url.username || url.password) return null;
    if (!["/battle", "/battle/", "/battle/raid", "/battle/raid/"].includes(url.pathname)) return null;
    return `/battle/raid${url.search}`;
  } catch {
    return null;
  }
}
