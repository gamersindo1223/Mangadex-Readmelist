export default {
  async fetch(request: Request): Promise<Response> {
    const reqHeaders = new Headers(request.headers);
    const responseHeaders = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        reqHeaders.get("Access-Control-Request-Headers") ||
        "Accept, Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, Origin, User-Agent, X-Requested-With, Token, x-access-token",
    });

    try {
      let url = request.url.substring(8);
      url = decodeURIComponent(url.substring(url.indexOf("/") + 1));

      if (
        request.method === "OPTIONS" ||
        url.length < 3 ||
        url.indexOf(".") === -1 ||
        url === "favicon.ico" ||
        url === "robots.txt"
      ) {
        const invalid = !(request.method === "OPTIONS" || url.length === 0);
        return new Response(await getHelp(new URL(request.url)), {
          status: invalid ? 400 : 200,
          headers: withContentType(responseHeaders, "text/html; charset=utf-8"),
        });
      }

      url = fixUrl(url);

      const fetchHeaders = new Headers();
      const dropHeaders = new Set([
        "accept-encoding",
        "cf-connecting-ip",
        "cf-ipcountry",
        "cf-ray",
        "cf-visitor",
        "content-length",
        "cookie",
        "host",
        "origin",
        "referer",
        "sec-ch-ua",
        "sec-ch-ua-mobile",
        "sec-ch-ua-platform",
        "sec-fetch-dest",
        "sec-fetch-mode",
        "sec-fetch-site",
        "sec-fetch-storage-access",
        "sec-fetch-user",
        "true-client-ip",
        "x-forwarded-for",
        "x-forwarded-proto",
        "x-real-ip",
      ]);
      for (const [key, value] of reqHeaders.entries()) {
        const normalizedKey = key.toLowerCase();
        if (!dropHeaders.has(normalizedKey)) {
          fetchHeaders.set(key, value);
        }
      }

      if (!fetchHeaders.has("user-agent")) {
        fetchHeaders.set("user-agent", "MangaDex-ReadmeList-Proxy/1.0");
      }

      const fetchRequest: RequestInit = {
        method: request.method,
        headers: fetchHeaders,
      };

      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        const contentType = (reqHeaders.get("content-type") || "").toLowerCase();

        if (
          contentType.includes("application/x-www-form-urlencoded") ||
          contentType.includes("application/json") ||
          contentType.includes("application/text") ||
          contentType.includes("text/")
        ) {
          fetchRequest.body = await request.text();
        } else if (contentType.includes("multipart/form-data")) {
          fetchRequest.body = await request.formData();
        } else {
          fetchRequest.body = await request.arrayBuffer();
        }
      }

      const fetchResponse = await fetch(url, fetchRequest);
      const contentType = fetchResponse.headers.get("content-type");
      if (contentType) {
        responseHeaders.set("content-type", contentType);
      }
      responseHeaders.set("cache-control", "public, max-age=86400");

      return new Response(fetchResponse.body, {
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          code: -1,
          msg: err instanceof Error ? err.message : String(err),
        }),
        {
          status: 500,
          headers: withContentType(responseHeaders, "application/json; charset=utf-8"),
        }
      );
    }
  },
};

function fixUrl(url: string) {
  if (url.includes("://")) {
    return url;
  }

  if (url.includes(":/")) {
    return url.replace(":/", "://");
  }

  return `http://${url}`;
}

function withContentType(headers: Headers, contentType: string) {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("content-type", contentType);
  return nextHeaders;
}

async function getHelp(url: URL) {
  return `<!DOCTYPE html>
  <html>

<head>

  <title>Safone's CORS Proxy</title>

  <style>


body {


  font-family: "Courier New", Courier, monospace;


}

  </style>

</head>

<body>

  <p>Welcome to Safone's CORS Proxy!</p>

  <p>
    This enables cross-origin requests to anywhere.
    <br>


You can use this proxy to bypass CORS in the browser.

  </p>

  <p>USAGE:</p>

  <p>


&nbsp;&nbsp;&nbsp;&nbsp;${url.protocol}//${url.hostname}/&lt;url-to-resource&gt;

  </p>

  <p>EXAMPLES:</p>

  <p>&nbsp;&nbsp;&nbsp;&nbsp;${url.protocol}//${url.hostname}/https://api.github.com/repos/AsmSafone/SafoneAPI</p>

  <p>&nbsp;&nbsp;&nbsp;&nbsp;${url.protocol}//${url.hostname}/https://api.github.com/repos/AsmSafone/SafoneAPI/releases</p>

  <p>NOTE:</p>

  <p>&nbsp;&nbsp;&nbsp;&nbsp;This fork preserves Content-Type for application/x-www-form-urlencoded requests, so OAuth token endpoints such as MangaDex can consume the body correctly.</p>
    <br/>
    <footer>
      <p align="center">
        <a href="https://github.com/AsmSafone">GitHub Repository</a>
        | <a href="https://buymeacoffee.com/safone">Buy Me a Coffee!</a>
      </p>
    </footer>

</body>
  </html>
  `;
}
