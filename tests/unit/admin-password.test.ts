import { describe, expect, it } from "vitest";
import { dummyAdminHash, hashAdminPassword, verifyAdminPassword } from "../../src/lib/admin-password";
describe("administrator password storage",()=>{
  it("salts and hashes passwords and rejects incorrect credentials",async()=>{
    const password="only-used-in-tests-12345";
    const first=await hashAdminPassword(password),second=await hashAdminPassword(password);
    expect(first).not.toContain(password);expect(first).not.toBe(second);
    expect(await verifyAdminPassword(password,first)).toBe(true);
    expect(await verifyAdminPassword("incorrect",first)).toBe(false);
    expect(await verifyAdminPassword(password,dummyAdminHash)).toBe(false);
    expect(await verifyAdminPassword(password,"malformed")).toBe(false);
  });
});
