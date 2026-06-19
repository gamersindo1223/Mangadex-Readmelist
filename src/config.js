const VALID_STATUSES = new Set([
  "reading",
  "on_hold",
  "plan_to_read",
  "dropped",
  "re_reading",
  "completed"
]);

const VALID_TYPES = new Set(["DEFAULT", "GRID", "LIST"]);
const VALID_SORT_FIELDS = new Set([
  "latestUploadedChapter",
  "updatedAt",
  "createdAt",
  "title",
  "followedCount",
  "year"
]);
const DEFAULT_METADATA_FORMAT = "__default__";
const DEFAULT_COVER_URL_FORMAT = "https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}.256.jpg";
const METADATA_FORMAT_ENV_KEYS = new Map([
  ["reading", ["INPUT_METADATA_FORMAT_READING", "INPUT_READING_METADATA_FORMAT"]],
  ["on_hold", ["INPUT_METADATA_FORMAT_ON_HOLD", "INPUT_ON_HOLD_METADATA_FORMAT"]],
  ["plan_to_read", ["INPUT_METADATA_FORMAT_PLAN_TO_READ", "INPUT_PLAN_TO_READ_METADATA_FORMAT", "INPUT_PTR_METADATA_FORMAT"]],
  ["dropped", ["INPUT_METADATA_FORMAT_DROPPED", "INPUT_DROPPED_METADATA_FORMAT"]],
  ["re_reading", ["INPUT_METADATA_FORMAT_RE_READING", "INPUT_RE_READING_METADATA_FORMAT"]],
  ["completed", ["INPUT_METADATA_FORMAT_COMPLETED", "INPUT_COMPLETED_METADATA_FORMAT"]]
]);
const EMPTY_MESSAGE_ENV_KEYS = new Map([
  ["reading", ["INPUT_EMPTY_MESSAGE_READING", "INPUT_READING_EMPTY_MESSAGE"]],
  ["on_hold", ["INPUT_EMPTY_MESSAGE_ON_HOLD", "INPUT_ON_HOLD_EMPTY_MESSAGE"]],
  ["plan_to_read", ["INPUT_EMPTY_MESSAGE_PLAN_TO_READ", "INPUT_PLAN_TO_READ_EMPTY_MESSAGE", "INPUT_PTR_EMPTY_MESSAGE"]],
  ["dropped", ["INPUT_EMPTY_MESSAGE_DROPPED", "INPUT_DROPPED_EMPTY_MESSAGE"]],
  ["re_reading", ["INPUT_EMPTY_MESSAGE_RE_READING", "INPUT_RE_READING_EMPTY_MESSAGE"]],
  ["completed", ["INPUT_EMPTY_MESSAGE_COMPLETED", "INPUT_COMPLETED_EMPTY_MESSAGE"]]
]);

const STATUS_ALIASES = new Map([
  ["READING", "reading"],
  ["ON_HOLD", "on_hold"],
  ["PLAN_TO_READ", "plan_to_read"],
  ["PTR", "plan_to_read"],
  ["DROPPED", "dropped"],
  ["RE_READING", "re_reading"],
  ["COMPLETED", "completed"]
]);

export function buildConfig(env = process.env) {
  const displayLimit = parsePositiveInteger(env.INPUT_DISPLAY_LIMIT ?? "10", "display_limit");
  const metadataFormats = buildMetadataFormats(env);
  const emptyMessages = buildEmptyMessages(env);

  return {
    mdClientId: required(env.INPUT_MD_CLIENT_ID || env.MD_CLIENT_ID, "md_client_id"),
    mdClientSecret: required(env.INPUT_MD_CLIENT_SECRET || env.MD_CLIENT_SECRET, "md_client_secret"),
    mdRefreshToken: required(env.INPUT_MD_REFRESH_TOKEN || env.MD_REFRESH_TOKEN, "md_refresh_token"),
    repoFilename: env.INPUT_REPO_FILENAME || "README.md",
    displayLimit,
    sortBy: normalizeSortBy(env.INPUT_SORT_BY || "latestUploadedChapter"),
    sortOrder: normalizeSortOrder(env.INPUT_SORT_ORDER || "desc"),
    titleLanguage: env.INPUT_TITLE_LANGUAGE || "en",
    fallbackTitleLanguage: env.INPUT_FALLBACK_TITLE_LANGUAGE || "ja-ro",
    contentRatings: parseList(env.INPUT_CONTENT_RATINGS || "safe,suggestive,erotica"),
    coverUrlFormat: optionalEnv(env, "INPUT_COVER_URL_FORMAT") || DEFAULT_COVER_URL_FORMAT,
    coverProxyUrl: optionalEnv(env, "INPUT_COVER_PROXY_URL") || "",
    metadataFormats,
    emptyMessages,
    includeReadProgress: shouldFetchReadProgress(metadataFormats),
    targetRepositoryDir: env.TARGET_REPOSITORY_DIR || process.cwd()
  };
}

export function parseMarker(markerText) {
  const match = markerText.match(/^MANGADEX_([A-Z_]+):([A-Z]+)$/);
  if (!match) {
    return null;
  }

  const status = STATUS_ALIASES.get(match[1]);
  const type = match[2];

  if (!status || !VALID_TYPES.has(type)) {
    return null;
  }

  return { status, type };
}

export function statusLabel(status) {
  return {
    reading: "Reading",
    on_hold: "On Hold",
    plan_to_read: "Plan to Read",
    dropped: "Dropped",
    re_reading: "Re-reading",
    completed: "Completed"
  }[status] || status;
}

function required(value, name) {
  if (!value) {
    throw new Error(`Missing required input: ${name}`);
  }

  return value;
}

function parsePositiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error(`${name} must be an integer between 1 and 100.`);
  }

  return parsed;
}

function normalizeSortOrder(value) {
  const normalized = value.toLowerCase();
  if (normalized !== "asc" && normalized !== "desc") {
    throw new Error("sort_order must be asc or desc.");
  }

  return normalized;
}

function normalizeSortBy(value) {
  if (!VALID_SORT_FIELDS.has(value)) {
    throw new Error(`sort_by must be one of: ${[...VALID_SORT_FIELDS].join(", ")}.`);
  }

  return value;
}

function parseList(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildMetadataFormats(env) {
  const formats = {
    default: optionalEnv(env, "INPUT_METADATA_FORMAT", "INPUT_ITEM_METADATA_FORMAT")
  };

  for (const [status, keys] of METADATA_FORMAT_ENV_KEYS) {
    formats[status] = optionalEnv(env, ...keys);
  }

  return formats;
}

function buildEmptyMessages(env) {
  const messages = {
    default: optionalEnv(env, "INPUT_EMPTY_MESSAGE", "INPUT_EMPTY_STATE_MESSAGE")
  };

  for (const [status, keys] of EMPTY_MESSAGE_ENV_KEYS) {
    messages[status] = optionalEnv(env, ...keys);
  }

  return messages;
}

function optionalEnv(env, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(env, key)) {
      return env[key] === DEFAULT_METADATA_FORMAT ? undefined : env[key];
    }
  }

  return undefined;
}

function shouldFetchReadProgress(metadataFormats) {
  return Object.values(metadataFormats).some((format) => {
    if (!format || format === DEFAULT_METADATA_FORMAT) {
      return false;
    }

    return /\$\{\s*(last[\s_-]*read|last[\s_-]*read[\s_-]*chapter|read[\s_-]*progress|progress)\s*\}/i.test(format);
  });
}
