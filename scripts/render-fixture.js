import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildConfig } from "../src/config.js";
import { loadDotEnv } from "../src/env.js";
import { fetchMangaDetails, fetchStatuses, groupIdsByStatus, refreshAccessToken } from "../src/mangadex.js";
import { findReadmeSections, updateReadmeSections } from "../src/readme.js";

const inputPath = "test/fixtures/README.md";
const outputPath = "test/fixtures/output/README.generated.md";

await loadDotEnv();
process.env.MANGADEX_DOH ||= "true";
process.env.MANGADEX_DNS ||= "1.1.1.1";
process.env.MANGADEX_HTTP_TIMEOUT_MS ||= "30000";
process.env.INPUT_METADATA_FORMAT ||= "${status} / ${progress} / ${year}";
process.env.INPUT_COVER_PROXY_URL ||= "https://apsiknb-image.hf.space${path}";

const config = buildConfig({
  ...process.env,
  INPUT_REPO_FILENAME: process.env.INPUT_REPO_FILENAME || inputPath,
  TARGET_REPOSITORY_DIR: process.env.TARGET_REPOSITORY_DIR || process.cwd()
});

const readme = await readFile(inputPath, "utf8");
const sections = findReadmeSections(readme);
const mangaByStatus = await fetchMangaLibraryForSections(sections, config);
const rendered = updateReadmeSections(readme, mangaByStatus, {
  titleLanguage: config.titleLanguage,
  fallbackTitleLanguage: config.fallbackTitleLanguage,
  coverUrlFormat: config.coverUrlFormat,
  coverProxyUrl: config.coverProxyUrl,
  metadataFormats: config.metadataFormats,
  emptyMessages: config.emptyMessages
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, rendered, "utf8");

console.log(`Rendered fixture: ${outputPath}`);
console.log("Fixture source: MangaDex library from .env credentials");

async function fetchMangaLibraryForSections(sections, config) {
  const tokenPair = await refreshAccessToken({
    clientId: config.mdClientId,
    clientSecret: config.mdClientSecret,
    refreshToken: config.mdRefreshToken
  });

  if (tokenPair.refreshToken && tokenPair.refreshToken !== config.mdRefreshToken) {
    await persistRotatedRefreshToken(tokenPair.refreshToken);
  }

  const statuses = await fetchStatuses(tokenPair.accessToken);
  const groupedIds = groupIdsByStatus(statuses);
  const mangaByStatus = new Map();
  const neededStatuses = [...new Set(sections.map((section) => section.status))];

  for (const status of neededStatuses) {
    const ids = groupedIds.get(status) || [];
    const manga = await fetchMangaDetails(ids, {
      accessToken: tokenPair.accessToken,
      limit: config.displayLimit,
      sortBy: config.sortBy,
      sortOrder: config.sortOrder,
      contentRatings: config.contentRatings,
      includeReadProgress: config.includeReadProgress
    });
    mangaByStatus.set(status, manga);
  }

  return mangaByStatus;
}

async function persistRotatedRefreshToken(refreshToken) {
  if (process.env.MANGADEX_UPDATE_ENV_REFRESH_TOKEN === "false") {
    console.warn("MangaDex returned a rotated refresh token. MANGADEX_UPDATE_ENV_REFRESH_TOKEN=false, so .env was not updated.");
    return;
  }

  let content;

  try {
    content = await readFile(".env", "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn("MangaDex returned a rotated refresh token, but no local .env file exists to update.");
      return;
    }

    throw error;
  }

  const lines = content.split(/\r?\n/);
  let updated = false;

  const nextLines = lines.map((line) => {
    const match = line.match(/^(\s*)(INPUT_MD_REFRESH_TOKEN|MD_REFRESH_TOKEN)(\s*=\s*)(.*)$/);

    if (!match || updated) {
      return line;
    }

    updated = true;
    return `${match[1]}${match[2]}${match[3]}${refreshToken}`;
  });

  if (!updated) {
    nextLines.push(`INPUT_MD_REFRESH_TOKEN=${refreshToken}`);
  }

  await writeFile(".env", nextLines.join("\n"), "utf8");
  console.log("Updated local .env with rotated MangaDex refresh token.");
}
