import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildConfig } from "./config.js";
import { loadDotEnv } from "./env.js";
import { fetchMangaDetails, fetchStatuses, groupIdsByStatus, refreshAccessToken } from "./mangadex.js";
import { findReadmeSections, updateReadmeSections } from "./readme.js";

async function main() {
  await loadDotEnv();
  const config = buildConfig();
  const readmePath = path.join(config.targetRepositoryDir, config.repoFilename);
  const readme = await readFile(readmePath, "utf8");
  const sections = findReadmeSections(readme);

  if (sections.length === 0) {
    throw new Error(
      `No MangaDex marker sections found in ${config.repoFilename}. Add markers such as <!-- MANGADEX_READING:LIST --> and <!-- MANGADEX_READING:LIST_END -->.`
    );
  }

  const tokenPair = await refreshAccessToken({
    clientId: config.mdClientId,
    clientSecret: config.mdClientSecret,
    refreshToken: config.mdRefreshToken
  });

  await exportRefreshToken(tokenPair.refreshToken);

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

  const nextReadme = updateReadmeSections(readme, mangaByStatus, {
    titleLanguage: config.titleLanguage,
    fallbackTitleLanguage: config.fallbackTitleLanguage,
    coverUrlFormat: config.coverUrlFormat,
    coverProxyUrl: config.coverProxyUrl,
    metadataFormats: config.metadataFormats,
    emptyMessages: config.emptyMessages
  });

  if (nextReadme === readme) {
    console.log("No README changes detected.");
    return;
  }

  await writeFile(readmePath, nextReadme, "utf8");
  console.log(`Updated ${config.repoFilename}.`);
}

function exportRefreshToken(refreshToken) {
  if (!process.env.GITHUB_ENV || !refreshToken) {
    return;
  }

  const escaped = refreshToken.replaceAll("%", "%25").replaceAll("\n", "%0A").replaceAll("\r", "%0D");
  const line = `NEW_MD_REFRESH_TOKEN=${escaped}\n`;

  return import("node:fs/promises").then(({ appendFile }) => appendFile(process.env.GITHUB_ENV, line, "utf8"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
