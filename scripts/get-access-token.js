import { loadDotEnv } from "../src/env.js";
import { httpRequest } from "../src/http.js";

const AUTH_URL = "https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token";

await loadDotEnv();

const clientId = envValue("MD_CLIENT_ID", "INPUT_MD_CLIENT_ID");
const clientSecret = envValue("MD_CLIENT_SECRET", "INPUT_MD_CLIENT_SECRET");
const refreshToken = envValue("MD_REFRESH_TOKEN", "INPUT_MD_REFRESH_TOKEN");

if (!clientId || !clientSecret || !refreshToken) {
  console.error("Missing MangaDex OAuth values.");
  console.error("Set MD_CLIENT_ID, MD_CLIENT_SECRET, and MD_REFRESH_TOKEN.");
  console.error("This script also accepts INPUT_MD_CLIENT_ID, INPUT_MD_CLIENT_SECRET, and INPUT_MD_REFRESH_TOKEN from .env.");
  process.exit(1);
}

console.log("Requesting new MangaDex access token...");
const body = new URLSearchParams({
  grant_type: "refresh_token",
  refresh_token: refreshToken,
  client_id: clientId,
  client_secret: clientSecret
});

try {
  const response = await httpRequest(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "MangaDex-ReadmeList-AccessTokenHelper/1.0"
    },
    body
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }

  if (!response.ok) {
    console.error(`MangaDex access token request failed: ${response.status} ${response.statusText}`);
    console.error(data.error_description || data.error || text);
    process.exit(1);
  }

  if (!data.access_token) {
    console.error("MangaDex response did not include access_token.");
    process.exit(1);
  }

  console.log(data.access_token);

  if (data.refresh_token && data.refresh_token !== refreshToken) {
    console.error("");
    console.error("MangaDex also returned a rotated refresh token.");
    console.error("Update MD_REFRESH_TOKEN/INPUT_MD_REFRESH_TOKEN before using this helper again:");
    console.error(data.refresh_token);
  }
} catch (error) {
  console.error("Error requesting MangaDex access token:");
  console.error(error.message || error);

  if (error.cause) {
    console.error("Underlying cause:", error.cause);
  }

  process.exit(1);
}

function envValue(...keys) {
  for (const key of keys) {
    if (process.env[key]) {
      return process.env[key];
    }
  }

  return "";
}
