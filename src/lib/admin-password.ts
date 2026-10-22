import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 32, { N:32768,r:8,p:3,maxmem:64*1024*1024 }, (error, key) => error ? reject(error) : resolve(key));
});
export async function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyAdminPassword(password: string, encoded: string) {
  if (!/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(encoded)) return false;
  const [,salt,hash] = encoded.split("$");
  return timingSafeEqual(await derive(password, salt), Buffer.from(hash,"hex"));
}
// Equal-cost verification for an unknown username; never a usable account password.
export const dummyAdminHash = `scrypt-v1$${"0".repeat(32)}$${"0".repeat(64)}`;
