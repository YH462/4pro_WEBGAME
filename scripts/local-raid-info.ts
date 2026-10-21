import "dotenv/config";
import { localNetworkHosts } from "../src/lib/local-network";

const port = new URL(process.env.APP_URL || "http://localhost:3000").port || "3000";
console.log("PCスクリーン: http://localhost:" + port + "/raid/screen?sync=local");
for (const host of localNetworkHosts().filter((host) => host !== "localhost" && host !== "127.0.0.1")) {
  console.log("同じWi-Fiのスマホ: http://" + host + ":" + port + "/battle/raid?sync=local");
}
