import type { NextConfig } from "next";
import { localNetworkHosts } from "./src/lib/local-network";
const config: NextConfig = {
  allowedDevOrigins: localNetworkHosts(),
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ] }];
  },
};
export default config;
