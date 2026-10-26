// Browser-safe URL helpers: only a validated token can become a return destination.
export const validAcquisitionToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export type StartDestination = "/" | "/battle/raid" | "/battle/raid?sync=local" | `/acquire/${string}`;
export function startDestination({ next, tag }: { next?: string | string[]; tag?: string | string[] }): StartDestination {
  if (next === "local-raid") return "/battle/raid?sync=local";
  if (next === "raid") return "/battle/raid";
  if (next === "acquire" && validAcquisitionToken(tag)) return `/acquire/${tag}`;
  return "/";
}
export function acquisitionUrl(token: string, origin: string) {
  if (!validAcquisitionToken(token)) throw new Error("Invalid acquisition token.");
  const url = new URL(origin);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Use an HTTP(S) origin without a path, query or credentials.");
  return new URL(`/acquire/${token}`, url.origin).href;
}
