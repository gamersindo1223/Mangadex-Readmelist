import { loadDotEnv } from "../src/env.js";
import { httpRequest } from "../src/http.js";

await loadDotEnv();

process.env.MANGADEX_DNS_DEBUG = "true";

const targets = [
  "https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token",
  "https://api.mangadex.org/manga?limit=1"
];

for (const target of targets) {
  try {
    console.log(`Checking ${target}`);
    const response = await httpRequest(target, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "MangaDex-ReadmeList-Diagnostics/1.0"
      }
    });

    console.log(`${response.status} ${response.statusText}`);
  } catch (error) {
    console.error(error.message || error);
  }
}
