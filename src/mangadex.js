import { httpRequest } from "./http.js";

const AUTH_URL = "https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token";
const API_BASE_URL = "https://api.mangadex.org";
const USER_AGENT = "MangaDex-ReadmeList/1.0 (+https://github.com/gamersindo1223/Mangadex-Readmelist)";

export async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  });

  const data = await requestJson(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!data.access_token) {
    throw new Error("MangaDex refresh response did not include an access_token.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken
  };
}

export async function fetchStatuses(accessToken) {
  const data = await requestJson(`${API_BASE_URL}/manga/status`, {
    headers: authHeaders(accessToken)
  });

  return data.statuses || {};
}

export async function fetchMangaDetails(ids, options) {
  if (ids.length === 0) {
    return [];
  }

  const manga = [];

  for (const idChunk of chunk(ids, 100)) {
    const params = new URLSearchParams();
    params.set("limit", String(idChunk.length));
    params.append("includes[]", "cover_art");

    for (const id of idChunk) {
      params.append("ids[]", id);
    }

    for (const rating of options.contentRatings) {
      params.append("contentRating[]", rating);
    }

    const data = await requestJson(`${API_BASE_URL}/manga?${params.toString()}`);
    manga.push(...(data.data || []).map(normalizeManga));
  }

  if (options.sortBy === "latestUploadedChapter") {
    await attachLatestChapterDates(manga);
  }

  const displayedManga = sortMangaForDisplay(manga, options).slice(0, options.limit);

  if (options.includeReadProgress && options.accessToken) {
    await attachReadProgress(displayedManga, options.accessToken);
  }

  return displayedManga;
}

export function groupIdsByStatus(statuses) {
  const grouped = new Map();

  for (const [id, status] of Object.entries(statuses)) {
    if (!grouped.has(status)) {
      grouped.set(status, []);
    }
    grouped.get(status).push(id);
  }

  return grouped;
}

function normalizeManga(manga) {
  const coverRelationship = (manga.relationships || []).find(
    (relationship) => relationship.type === "cover_art" && relationship.attributes?.fileName
  );

  return {
    id: manga.id,
    title: manga.attributes?.title || {},
    altTitles: manga.attributes?.altTitles || [],
    status: manga.attributes?.status || "",
    year: manga.attributes?.year || "",
    lastChapter: manga.attributes?.lastChapter || "",
    createdAt: manga.attributes?.createdAt || "",
    updatedAt: manga.attributes?.updatedAt || "",
    latestUploadedChapter: manga.attributes?.latestUploadedChapter || "",
    latestUploadedAt: "",
    followedCount: manga.attributes?.followedCount || 0,
    coverFileName: coverRelationship?.attributes?.fileName || ""
  };
}

async function attachLatestChapterDates(manga) {
  const chapterIds = [
    ...new Set(manga.map((entry) => entry.latestUploadedChapter).filter(Boolean))
  ];

  if (chapterIds.length === 0) {
    return;
  }

  const chapterDates = new Map();

  for (const idChunk of chunk(chapterIds, 100)) {
    const params = new URLSearchParams();
    params.set("limit", String(idChunk.length));

    for (const id of idChunk) {
      params.append("ids[]", id);
    }

    const data = await requestJson(`${API_BASE_URL}/chapter?${params.toString()}`);

    for (const chapter of data.data || []) {
      const attributes = chapter.attributes || {};
      chapterDates.set(
        chapter.id,
        attributes.readableAt || attributes.publishAt || attributes.updatedAt || attributes.createdAt || ""
      );
    }
  }

  for (const entry of manga) {
    entry.latestUploadedAt = chapterDates.get(entry.latestUploadedChapter) || "";
  }
}

async function attachReadProgress(manga, accessToken) {
  if (manga.length === 0) {
    return;
  }

  const mangaIds = manga.map((entry) => entry.id);
  const readChapterIds = await fetchReadChapterIds(mangaIds, accessToken);
  const chapters = await fetchChapterDetails(readChapterIds);
  const mangaIdSet = new Set(mangaIds);
  const latestByManga = new Map();

  for (const chapter of chapters) {
    const mangaRelationship = (chapter.relationships || []).find((relationship) => relationship.type === "manga");
    const mangaId = mangaRelationship?.id;

    if (!mangaId || !mangaIdSet.has(mangaId)) {
      continue;
    }

    const attributes = chapter.attributes || {};
    const candidate = {
      chapter: attributes.chapter || "",
      readableAt: attributes.readableAt || attributes.publishAt || attributes.updatedAt || attributes.createdAt || ""
    };
    const current = latestByManga.get(mangaId);

    if (!current || compareChapterProgress(candidate, current) > 0) {
      latestByManga.set(mangaId, candidate);
    }
  }

  for (const entry of manga) {
    const latest = latestByManga.get(entry.id);
    entry.lastReadChapter = latest?.chapter || "";
    entry.lastReadAt = latest?.readableAt || "";
  }
}

async function fetchReadChapterIds(mangaIds, accessToken) {
  const chapterIds = new Set();

  for (const idChunk of chunk(mangaIds, 100)) {
    const params = new URLSearchParams();

    for (const id of idChunk) {
      params.append("ids[]", id);
    }

    const data = await requestJson(`${API_BASE_URL}/manga/read?${params.toString()}`, {
      headers: authHeaders(accessToken)
    });

    for (const chapterId of normalizeReadMarkers(data.data)) {
      chapterIds.add(chapterId);
    }
  }

  return [...chapterIds];
}

async function fetchChapterDetails(chapterIds) {
  const chapters = [];

  for (const idChunk of chunk(chapterIds, 100)) {
    const params = new URLSearchParams();
    params.set("limit", String(idChunk.length));
    params.append("includes[]", "manga");

    for (const id of idChunk) {
      params.append("ids[]", id);
    }

    const data = await requestJson(`${API_BASE_URL}/chapter?${params.toString()}`);
    chapters.push(...(data.data || []));
  }

  return chapters;
}

function normalizeReadMarkers(data) {
  if (Array.isArray(data)) {
    return data.filter(Boolean);
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  return Object.values(data).flat().filter(Boolean);
}

function compareChapterProgress(left, right) {
  const leftNumber = Number.parseFloat(left.chapter);
  const rightNumber = Number.parseFloat(right.chapter);
  const leftHasNumber = Number.isFinite(leftNumber);
  const rightHasNumber = Number.isFinite(rightNumber);

  if (leftHasNumber && rightHasNumber && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  if (leftHasNumber !== rightHasNumber) {
    return leftHasNumber ? 1 : -1;
  }

  return String(left.readableAt).localeCompare(String(right.readableAt));
}

export function sortMangaForDisplay(manga, options) {
  const direction = options.sortOrder === "asc" ? 1 : -1;

  return [...manga].sort((left, right) => {
    const leftValue = sortableValue(left, options.sortBy);
    const rightValue = sortableValue(right, options.sortBy);

    if (leftValue < rightValue) {
      return -1 * direction;
    }

    if (leftValue > rightValue) {
      return 1 * direction;
    }

    return sortableValue(left, "title").localeCompare(sortableValue(right, "title"));
  });
}

function sortableValue(manga, sortBy) {
  if (sortBy === "latestUploadedChapter") {
    return manga.latestUploadedAt || "";
  }

  if (sortBy === "updatedAt") {
    return manga.updatedAt || "";
  }

  if (sortBy === "createdAt") {
    return manga.createdAt || "";
  }

  if (sortBy === "year") {
    return manga.year || 0;
  }

  if (sortBy === "followedCount") {
    return manga.followedCount || 0;
  }

  return Object.values(manga.title || {})[0] || "";
}

function chunk(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function requestJson(url, options = {}) {
  const response = await httpRequest(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MangaDex request failed: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`
  };
}
