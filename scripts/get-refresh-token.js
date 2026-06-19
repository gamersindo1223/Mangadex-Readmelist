import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { loadDotEnv } from "../src/env.js";
import { httpRequest } from "../src/http.js";

const AUTH_URL = "https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token";

await loadDotEnv();

const username = process.env.MD_USERNAME || await promptText("MangaDex username: ");
const password = process.env.MD_PASSWORD || await promptSecret("MangaDex password: ");
const totp = process.env.MD_TOTP || process.env.MD_OTP || await promptText("2FA code (press Enter if none): ", true);
const clientId = process.env.MD_CLIENT_ID || await promptText("MangaDex client id: ");
const clientSecret = process.env.MD_CLIENT_SECRET || await promptSecret("MangaDex client secret: ");

if (!username || !password || !clientId || !clientSecret) {
  console.error("Username, password, client id, and client secret are required.");
  process.exit(1);
}

const body = new URLSearchParams({
  grant_type: "password",
  username,
  password,
  client_id: clientId,
  client_secret: clientSecret
});

if (totp) {
  body.set("totp", totp);
}

try {
  const response = await httpRequest(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "MangaDex-ReadmeList-TokenHelper/1.0"
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
    console.error(`MangaDex token request failed: ${response.status} ${response.statusText}`);
    console.error(data.error_description || data.error || text);
    process.exit(1);
  }

  console.log("");
  console.log("Add these GitHub repository secrets:");
  console.log(`MD_CLIENT_ID=${clientId}`);
  console.log("MD_CLIENT_SECRET=<the client secret you entered>");
  console.log(`MD_REFRESH_TOKEN=${data.refresh_token}`);
  console.log("");
  console.log("Do not commit these values. Add them only in GitHub repository Settings > Secrets and variables > Actions.");
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}

function promptText(question, optional = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(optional ? answer.trim() : answer.trim());
    });
  });
}

function promptSecret(question) {
  if (!stdin.isTTY) {
    throw new Error(`Cannot securely prompt for hidden input. Set the related environment variable instead.`);
  }

  return new Promise((resolve, reject) => {
    let value = "";
    const wasRaw = stdin.isRaw;

    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(wasRaw);
      stdout.write("\n");
    };

    const onData = (buffer) => {
      const input = buffer.toString("utf8");

      for (const character of input) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Cancelled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        value += character;
      }
    };

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}
