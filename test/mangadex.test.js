import test from "node:test";
import assert from "node:assert/strict";
import { sortMangaForDisplay } from "../src/mangadex.js";
import { buildConfig } from "../src/config.js";

test("sortMangaForDisplay sorts by latest uploaded chapter timestamp", () => {
  const manga = [
    { title: { en: "Older" }, latestUploadedAt: "2024-01-01T00:00:00+00:00" },
    { title: { en: "Newer" }, latestUploadedAt: "2024-02-01T00:00:00+00:00" }
  ];

  const sorted = sortMangaForDisplay(manga, {
    sortBy: "latestUploadedChapter",
    sortOrder: "desc"
  });

  assert.deepEqual(
    sorted.map((entry) => entry.title.en),
    ["Newer", "Older"]
  );
});

test("buildConfig rejects unsupported sort fields", () => {
  assert.throws(
    () =>
      buildConfig({
        INPUT_MD_CLIENT_ID: "client",
        INPUT_MD_CLIENT_SECRET: "secret",
        INPUT_MD_REFRESH_TOKEN: "refresh",
        INPUT_SORT_BY: "rating"
      }),
    /sort_by must be one of/
  );
});

test("buildConfig accepts GitHub secret style MangaDex environment names", () => {
  const config = buildConfig({
    MD_CLIENT_ID: "client",
    MD_CLIENT_SECRET: "secret",
    MD_REFRESH_TOKEN: "refresh"
  });

  assert.equal(config.mdClientId, "client");
  assert.equal(config.mdClientSecret, "secret");
  assert.equal(config.mdRefreshToken, "refresh");
});

test("buildConfig detects read progress placeholders in metadata formats", () => {
  const config = buildConfig({
    MD_CLIENT_ID: "client",
    MD_CLIENT_SECRET: "secret",
    MD_REFRESH_TOKEN: "refresh",
    INPUT_METADATA_FORMAT_READING: "${lastRead}/${lastChapter}"
  });

  assert.equal(config.includeReadProgress, true);
  assert.equal(config.metadataFormats.reading, "${lastRead}/${lastChapter}");
});

test("buildConfig includes cover URL and empty message inputs", () => {
  const config = buildConfig({
    MD_CLIENT_ID: "client",
    MD_CLIENT_SECRET: "secret",
    MD_REFRESH_TOKEN: "refresh",
    INPUT_COVER_URL_FORMAT: "https://example.test/${mangaId}/${coverFileName}",
    INPUT_COVER_PROXY_URL: "https://img.example.test${path}",
    INPUT_EMPTY_MESSAGE: "Nothing in ${libraryStatus}.",
    INPUT_EMPTY_MESSAGE_RE_READING: ""
  });

  assert.equal(config.coverUrlFormat, "https://example.test/${mangaId}/${coverFileName}");
  assert.equal(config.coverProxyUrl, "https://img.example.test${path}");
  assert.equal(config.emptyMessages.default, "Nothing in ${libraryStatus}.");
  assert.equal(config.emptyMessages.re_reading, "");
});

test("buildConfig defaults to MangaDex static upload cover URLs", () => {
  const config = buildConfig({
    MD_CLIENT_ID: "client",
    MD_CLIENT_SECRET: "secret",
    MD_REFRESH_TOKEN: "refresh"
  });

  assert.equal(config.coverUrlFormat, "https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}.256.jpg");
});

test("sortMangaForDisplay supports ascending year sort", () => {
  const manga = [
    { title: { en: "Later" }, year: 2024 },
    { title: { en: "Earlier" }, year: 2020 }
  ];

  const sorted = sortMangaForDisplay(manga, {
    sortBy: "year",
    sortOrder: "asc"
  });

  assert.deepEqual(
    sorted.map((entry) => entry.title.en),
    ["Earlier", "Later"]
  );
});
