import { z } from "zod";
const schema = z.object({
  APP_URL: z.url().default("http://localhost:3000"),
  EVENT_ID: z.string().min(1).default("local-exhibition"),
  SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  ALLOW_INSECURE_LOCAL_HTTP: z.enum(["true", "false"]).default("false"),
  ENABLE_DEV_SIMULATOR: z.enum(["true", "false"]).default("false"),
});
export function parseConfig(input: Record<string, string | undefined>) {
  const result = schema.parse(input);
  const url = new URL(result.APP_URL);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback && result.ALLOW_INSECURE_LOCAL_HTTP === "true")) throw new Error("APP_URL requires HTTPS; HTTP is permitted only for explicitly enabled loopback development.");
  return { ...result, origin: url.origin, secureCookie: url.protocol === "https:", simulator: result.ENABLE_DEV_SIMULATOR === "true" && loopback && input.NODE_ENV !== "production" };
}
export function config() { return parseConfig(process.env); }
