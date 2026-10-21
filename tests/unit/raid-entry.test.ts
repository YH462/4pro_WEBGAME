import { describe, expect, it } from "vitest";
import { raidEntryUrls } from "../../src/lib/raid-entry";

describe("screen participation links", () => {
  const local = { appUrl: "http://localhost:3000", local: true, requestHost: "localhost:3000" };
  it("uses LAN addresses instead of sending phones to localhost", () => {
    expect(raidEntryUrls({ ...local, lanHosts: ["localhost", "127.0.0.1", "192.168.0.237", "192.168.0.237", "172.20.10.3"] })).toEqual([
      "http://192.168.0.237:3000/battle/raid?sync=local", "http://172.20.10.3:3000/battle/raid?sync=local",
    ]);
  });
  it("selects the screen's LAN address when several interfaces exist", () => {
    expect(raidEntryUrls({ ...local, requestHost: "172.20.10.3:3000", lanHosts: ["192.168.0.237", "172.20.10.3"] })[0]).toBe("http://172.20.10.3:3000/battle/raid?sync=local");
  });
  it("never creates a QR for loopback, untrusted hosts, or missing LAN connections", () => {
    expect(raidEntryUrls({ ...local, requestHost: "evil.example:3000", lanHosts: ["localhost", "127.0.0.1", "[::1]", "8.8.8.8", "192.168.1.999"] })).toEqual([]);
  });
  it("uses the configured HTTPS origin and keeps preview separate from local sync", () => {
    expect(raidEntryUrls({ appUrl: "https://festival.example", local: false, requestHost: "evil.example", lanHosts: ["192.168.0.237"] })).toEqual(["https://festival.example/battle/raid"]);
    expect(raidEntryUrls({ ...local, local: false, lanHosts: ["192.168.0.237"] })).toEqual(["http://192.168.0.237:3000/battle/raid"]);
  });
});
