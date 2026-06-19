import dns from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch, setGlobalDispatcher } from "undici";

const CLOUDFLARE_DOH_URL = "https://cloudflare-dns.com/dns-query";
const CLOUDFLARE_DOH_HOST = "cloudflare-dns.com";
const DEFAULT_DOH_IP = "1.1.1.1";

let dispatcherCacheKey = "";
let dohCache = new Map();

const dohBootstrapAgent = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      if (hostname === CLOUDFLARE_DOH_HOST) {
        callbackLookup(callback, dohBootstrapIp(), 4, options);
        return;
      }

      dns.lookup(hostname, callback);
    }
  }
});

export async function httpRequest(url, options = {}) {
  installDoHBypass();

  const timeoutMs = parsePositiveInteger(
    process.env.MANGADEX_HTTP_TIMEOUT_MS || process.env.INPUT_MANGADEX_HTTP_TIMEOUT_MS || "30000",
    30000
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await undiciFetch(url, {
      ...options,
      signal: options.signal || controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${new URL(url).hostname}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function installDoHBypass() {
  if (!shouldUseDoH()) {
    return false;
  }

  const cacheKey = [
    dohBootstrapIp(),
    dohTimeoutMs(),
    process.env.MANGADEX_DNS_DEBUG || ""
  ].join(":");

  if (dispatcherCacheKey === cacheKey) {
    return true;
  }

  dohCache = new Map();
  setGlobalDispatcher(
    new Agent({
      connect: {
        lookup: lookupWithDoH
      }
    })
  );
  dispatcherCacheKey = cacheKey;
  return true;
}

export async function resolveDoH(hostname, family = 4) {
  if (isIP(hostname)) {
    return [{ address: hostname, family: isIP(hostname) }];
  }

  const normalizedFamily = family === 6 ? 6 : 4;
  const cacheKey = `${hostname}:${normalizedFamily}:${dohBootstrapIp()}`;
  const cached = dohCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.addresses;
  }

  const addresses = await queryCloudflareDoH(hostname, normalizedFamily);
  dohCache.set(cacheKey, {
    addresses,
    expiresAt: Date.now() + 60_000
  });

  debugDns(hostname, addresses);
  return addresses;
}

async function lookupWithDoH(hostname, options, callback) {
  try {
    if (isIP(hostname)) {
      callbackLookup(callback, hostname, isIP(hostname), options);
      return;
    }

    const family = typeof options === "number" ? options : options?.family;
    const all = typeof options === "object" && options?.all;
    const addresses = await resolveDoH(hostname, family || 4);

    if (all) {
      callback(null, addresses);
      return;
    }

    callbackLookup(callback, addresses[0].address, addresses[0].family, options);
  } catch {
    dns.lookup(hostname, options, callback);
  }
}

async function queryCloudflareDoH(hostname, family) {
  const queryType = family === 6 ? "AAAA" : "A";
  const url = `${CLOUDFLARE_DOH_URL}?name=${encodeURIComponent(hostname)}&type=${queryType}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), dohTimeoutMs());

  try {
    const response = await undiciFetch(url, {
      dispatcher: dohBootstrapAgent,
      headers: {
        Accept: "application/dns-json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Cloudflare DoH failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.Status !== 0 || !Array.isArray(data.Answer)) {
      throw new Error(`Cloudflare DoH failed to resolve ${hostname}`);
    }

    const answerType = family === 6 ? 28 : 1;
    const addresses = data.Answer
      .filter((answer) => answer.type === answerType && answer.data)
      .map((answer) => ({
        address: answer.data,
        family
      }));

    if (addresses.length === 0) {
      throw new Error(`Cloudflare DoH returned no ${queryType} records for ${hostname}`);
    }

    return addresses;
  } finally {
    clearTimeout(timeout);
  }
}

function shouldUseDoH() {
  const explicit = (process.env.MANGADEX_DOH || process.env.INPUT_MANGADEX_DOH || "").toLowerCase();

  if (["true", "1", "yes", "on"].includes(explicit)) {
    return true;
  }

  const dnsServers = process.env.MANGADEX_DNS || process.env.MANGADEX_DNS_SERVERS || "";
  return dnsServers
    .split(",")
    .map((server) => server.trim())
    .some((server) => server === DEFAULT_DOH_IP || server === "1.0.0.1");
}

function dohBootstrapIp() {
  const dnsServers = process.env.MANGADEX_DNS || process.env.MANGADEX_DNS_SERVERS || "";
  const preferred = dnsServers
    .split(",")
    .map((server) => server.trim())
    .find((server) => server === DEFAULT_DOH_IP || server === "1.0.0.1");

  return preferred || DEFAULT_DOH_IP;
}

function dohTimeoutMs() {
  return parsePositiveInteger(
    process.env.MANGADEX_DOH_TIMEOUT_MS ||
      process.env.MANGADEX_DNS_TIMEOUT_MS ||
      process.env.INPUT_MANGADEX_DOH_TIMEOUT_MS ||
      process.env.INPUT_MANGADEX_DNS_TIMEOUT_MS ||
      "5000",
    5000
  );
}

function debugDns(hostname, addresses) {
  if (process.env.MANGADEX_DNS_DEBUG !== "true") {
    return;
  }

  console.error(
    `Resolved ${hostname} with Cloudflare DNS-over-HTTPS: ${addresses
      .map((address) => `${address.address}/${address.family}`)
      .join(", ")}`
  );
}

function callbackLookup(callback, address, family, options) {
  if (typeof options === "object" && options?.all) {
    callback(null, [{ address, family }]);
    return;
  }

  callback(null, address, family);
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
