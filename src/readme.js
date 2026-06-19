import { parseMarker, statusLabel } from "./config.js";

const MARKER_PATTERN = /<!--\s*(MANGADEX_[A-Z_]+:[A-Z]+)\s*-->([\s\S]*?)<!--\s*(MANGADEX_[A-Z_]+:[A-Z]+_END)\s*-->/g;

export function findReadmeSections(readme) {
  const sections = [];
  let match;
  const codeFences = findCodeFences(readme);

  while ((match = MARKER_PATTERN.exec(readme)) !== null) {
    if (isInsideRange(match.index, codeFences)) {
      continue;
    }

    const startMarker = match[1];
    const endMarker = match[3];
    const expectedEndMarker = `${startMarker}_END`;
    const parsed = parseMarker(startMarker);

    if (!parsed || endMarker !== expectedEndMarker) {
      continue;
    }

    sections.push({
      marker: startMarker,
      start: match.index,
      end: MARKER_PATTERN.lastIndex,
      fullMatch: match[0],
      ...parsed
    });
  }

  return sections;
}

export function updateReadmeSections(readme, mangaByStatus, options) {
  const codeFences = findCodeFences(readme);

  return readme.replace(MARKER_PATTERN, (fullMatch, startMarker, _content, endMarker, matchStart) => {
    if (isInsideRange(matchStart, codeFences)) {
      return fullMatch;
    }

    const expectedEndMarker = `${startMarker}_END`;
    const parsed = parseMarker(startMarker);

    if (!parsed || endMarker !== expectedEndMarker) {
      return fullMatch;
    }

    const manga = mangaByStatus.get(parsed.status) || [];
    const rendered = renderMangaList(manga, parsed, options);

    return `<!-- ${startMarker} -->\n${rendered}\n<!-- ${endMarker} -->`;
  });
}

function findCodeFences(markdown) {
  const ranges = [];
  const fencePattern = /^```.*$/gm;
  let openStart = null;
  let match;

  while ((match = fencePattern.exec(markdown)) !== null) {
    if (openStart === null) {
      openStart = match.index;
      continue;
    }

    ranges.push({
      start: openStart,
      end: fencePattern.lastIndex
    });
    openStart = null;
  }

  if (openStart !== null) {
    ranges.push({
      start: openStart,
      end: markdown.length
    });
  }

  return ranges;
}

function isInsideRange(index, ranges) {
  return ranges.some((range) => index >= range.start && index < range.end);
}

export function renderMangaList(mangaList, marker, options) {
  if (mangaList.length === 0) {
    return renderEmptyMessage(marker, options);
  }

  if (marker.type === "GRID") {
    return `<p float="left">\n${mangaList.map((manga) => renderGridItem(manga, options)).join("\n")}\n</p>`;
  }

  if (marker.type === "LIST") {
    return mangaList.map((manga) => renderListItem(manga, marker, options)).join("\n");
  }

  return `<details>\n<summary>MangaDex ${statusLabel(marker.status)}</summary>\n\n${mangaList
    .map((manga) => renderListItem(manga, marker, options))
    .join("\n")}\n</details>`;
}

export function selectTitle(manga, preferredLanguage = "en", fallbackLanguage = "ja-ro") {
  if (manga.title?.[preferredLanguage]) {
    return manga.title[preferredLanguage];
  }

  if (manga.title?.[fallbackLanguage]) {
    return manga.title[fallbackLanguage];
  }

  for (const altTitle of manga.altTitles || []) {
    if (altTitle?.[preferredLanguage]) {
      return altTitle[preferredLanguage];
    }
  }

  const firstTitle = Object.values(manga.title || {})[0];
  return firstTitle || "Untitled Manga";
}

function renderGridItem(manga, options) {
  const title = escapeHtml(selectTitle(manga, options.titleLanguage, options.fallbackTitleLanguage));
  const url = escapeHtml(mangaUrl(manga));
  const cover = escapeHtml(coverUrl(manga, options));
  const imageAttributes = [
    `height="200"`,
    `width="140"`,
    `title="${title}"`,
    `alt="${title}"`,
    `src="${cover}"`
  ].join(" ");

  return `<a href="${url}"><img ${imageAttributes}></a>`;
}

function renderListItem(manga, marker, options) {
  const title = selectTitle(manga, options.titleLanguage, options.fallbackTitleLanguage);
  const safeTitle = escapeMarkdown(title);
  const url = mangaUrl(manga);
  const meta = renderMetadata(manga, marker, options);

  if (!hasCoverImage(manga)) {
    return `- **[${safeTitle}](${url})**${meta}`;
  }

  const cover = escapeHtml(coverUrl(manga, options));
  return `- <a href="${url}"><img src="${cover}" width="50" align="center" alt="${escapeHtml(title)} cover" /></a> **[${safeTitle}](${url})**${meta}`;
}

function renderMetadata(manga, marker, options) {
  const customFormat = metadataFormatFor(marker.status, options.metadataFormats);

  if (customFormat === "") {
    return "";
  }

  if (customFormat !== undefined) {
    const rendered = renderMetadataFormat(customFormat, manga, marker, options);
    return rendered ? ` - ${rendered}` : "";
  }

  const parts = [];

  if (manga.status) {
    parts.push(manga.status);
  }

  if (manga.lastChapter) {
    parts.push(`ch. ${manga.lastChapter}`);
  }

  if (manga.year) {
    parts.push(String(manga.year));
  }

  return parts.length > 0 ? ` - ${parts.join(" / ")}` : "";
}

function renderEmptyMessage(marker, options) {
  const format = emptyMessageFor(marker.status, options.emptyMessages);

  if (format === "") {
    return "";
  }

  return renderStatusFormat(format ?? "No MangaDex entries found for ${libraryStatus}.", marker);
}

function emptyMessageFor(status, emptyMessages = {}) {
  if (Object.prototype.hasOwnProperty.call(emptyMessages, status) && emptyMessages[status] !== undefined) {
    return emptyMessages[status];
  }

  if (Object.prototype.hasOwnProperty.call(emptyMessages, "default") && emptyMessages.default !== undefined) {
    return emptyMessages.default;
  }

  return undefined;
}

function metadataFormatFor(status, metadataFormats = {}) {
  if (Object.prototype.hasOwnProperty.call(metadataFormats, status) && metadataFormats[status] !== undefined) {
    return metadataFormats[status];
  }

  if (Object.prototype.hasOwnProperty.call(metadataFormats, "default") && metadataFormats.default !== undefined) {
    return metadataFormats.default;
  }

  return undefined;
}

function renderMetadataFormat(format, manga, marker, options) {
  const title = selectTitle(manga, options.titleLanguage, options.fallbackTitleLanguage);
  const lastRead = manga.lastReadChapter || manga.lastRead || "";
  const lastChapter = manga.lastChapter || "";
  const readProgress = lastRead && lastChapter ? `${lastRead}/${lastChapter}` : "";
  const values = {
    status: manga.status || "",
    mangastatus: manga.status || "",
    librarystatus: statusLabel(marker.status),
    readingstatus: statusLabel(marker.status),
    lastchapter: lastChapter,
    currentlastchapter: lastChapter,
    chapter: lastChapter,
    lastread: lastRead,
    lastreadchapter: lastRead,
    readprogress: readProgress,
    progress: readProgress,
    year: manga.year || "",
    title
  };

  const rendered = format.replace(/\$\{\s*([^}]+?)\s*\}/g, (_match, key) => {
    const normalized = String(key).toLowerCase().replace(/[\s_-]+/g, "");
    return escapeMarkdown(values[normalized] ?? "");
  });

  return cleanRenderedMetadata(rendered);
}

function renderStatusFormat(format, marker) {
  const values = {
    status: marker.status,
    librarystatus: statusLabel(marker.status),
    readingstatus: statusLabel(marker.status)
  };

  return String(format).replace(/\$\{\s*([^}]+?)\s*\}/g, (_match, key) => {
    const normalized = String(key).toLowerCase().replace(/[\s_-]+/g, "");
    return escapeMarkdown(values[normalized] ?? "");
  });
}

function cleanRenderedMetadata(value) {
  return splitMetadataSegments(String(value))
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" / ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitMetadataSegments(value) {
  const segments = [];
  let current = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previous = value[index - 1] || "";
    const next = value[index + 1] || "";
    const isSeparator =
      character === "/" &&
      (index === 0 || /\s/.test(previous)) &&
      (index === value.length - 1 || /\s/.test(next));

    if (isSeparator) {
      segments.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  segments.push(current);
  return segments;
}

function mangaUrl(manga) {
  if (manga.url) {
    return manga.url;
  }

  return `https://mangadex.org/title/${manga.id}`;
}

function hasCoverImage(manga) {
  return Boolean(manga.coverUrl || manga.coverFileName);
}

function coverUrl(manga, options = {}) {
  if (manga.coverUrl) {
    return proxiedCoverUrl(manga.coverUrl, options.coverProxyUrl);
  }

  if (!manga.coverFileName) {
    return proxiedCoverUrl("https://mangadex.org/img/brand/mangadex-logo.svg", options.coverProxyUrl);
  }

  return proxiedCoverUrl(renderCoverUrl(manga, options.coverUrlFormat), options.coverProxyUrl);
}

function proxiedCoverUrl(url, proxyUrl) {
  if (!proxyUrl) {
    return url;
  }

  if (/\$\{\s*[^}]+?\s*\}/.test(proxyUrl)) {
    return renderCoverProxyUrl(url, proxyUrl);
  }

  const normalizedProxyUrl = proxyUrl.endsWith("/") ? proxyUrl : `${proxyUrl}/`;
  return `${normalizedProxyUrl}${url}`;
}

function renderCoverProxyUrl(url, format) {
  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    parsedUrl = null;
  }

  const path = parsedUrl ? `${parsedUrl.pathname}${parsedUrl.search}` : url;
  const values = {
    url,
    encodedurl: encodeURIComponent(url),
    path,
    encodedpath: encodeURIComponent(path)
  };

  return String(format).replace(/\$\{\s*([^}]+?)\s*\}/g, (_match, key) => {
    const normalized = String(key).toLowerCase().replace(/[\s_-]+/g, "");
    return values[normalized] ?? "";
  });
}

function renderCoverUrl(manga, format) {
  const template = format || manga.coverUrlFormat || "https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}.256.jpg";
  const values = {
    mangaid: manga.id,
    id: manga.id,
    coverfilename: manga.coverFileName,
    cover: manga.coverFileName
  };

  return template.replace(/\$\{\s*([^}]+?)\s*\}/g, (_match, key) => {
    const normalized = String(key).toLowerCase().replace(/[\s_-]+/g, "");
    return encodeURIComponent(values[normalized] ?? "");
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeMarkdown(value) {
  return String(value).replaceAll("[", "\\[").replaceAll("]", "\\]");
}
