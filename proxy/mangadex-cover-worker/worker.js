const UPLOADS_ORIGIN = "https://uploads.mangadex.org";
const CACHE_SECONDS = 60 * 60 * 24 * 7;

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders({ allow: "GET, HEAD, OPTIONS" })
      });
    }

    const requestUrl = new URL(request.url);
    const targetUrl = toMangaDexUploadUrl(requestUrl);

    if (!targetUrl) {
      return new Response(help(requestUrl), {
        status: 400,
        headers: {
          ...corsHeaders(),
          "content-type": "text/plain; charset=utf-8"
        }
      });
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        accept: request.headers.get("accept") || "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "user-agent": "MangaDex-Cover-Proxy/1.0"
      },
      cf: {
        cacheEverything: true,
        cacheTtl: CACHE_SECONDS
      }
    });

    const responseHeaders = new Headers(corsHeaders());
    copyHeader(upstreamResponse.headers, responseHeaders, "content-type");
    copyHeader(upstreamResponse.headers, responseHeaders, "etag");
    copyHeader(upstreamResponse.headers, responseHeaders, "last-modified");
    responseHeaders.set("cache-control", `public, max-age=${CACHE_SECONDS}`);
    responseHeaders.set("x-content-type-options", "nosniff");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  }
};

function toMangaDexUploadUrl(requestUrl) {
  let pathname = requestUrl.pathname;

  if (pathname === "/" && requestUrl.searchParams.has("url")) {
    try {
      const source = new URL(requestUrl.searchParams.get("url"));
      pathname = source.pathname;
    } catch {
      return null;
    }
  }

  if (!pathname.startsWith("/covers/")) {
    return null;
  }

  const targetUrl = new URL(`${UPLOADS_ORIGIN}${pathname}`);
  targetUrl.search = requestUrl.search;
  targetUrl.searchParams.delete("url");
  return targetUrl.toString();
}

function corsHeaders(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": extra.allow || "GET, HEAD, OPTIONS",
    "access-control-allow-headers": "accept, content-type",
    "cross-origin-resource-policy": "cross-origin"
  };
}

function copyHeader(from, to, name) {
  const value = from.get(name);
  if (value) {
    to.set(name, value);
  }
}

function help(url) {
  return [
    "MangaDex cover proxy",
    "",
    "Use:",
    `${url.origin}/covers/<manga-id>/<cover-file>.256.jpg`,
    "",
    "Example MangaDex ReadmeList input:",
    `cover_proxy_url: "${url.origin}\${path}"`
  ].join("\n");
}
