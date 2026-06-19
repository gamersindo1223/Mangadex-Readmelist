# Hugging Face MangaDex Image Proxy

Docker Space proxy for MangaDex cover images.

It maps:

```text
https://your-space.hf.space/covers/<manga-id>/<cover-file>.256.jpg
```

to:

```text
https://uploads.mangadex.org/covers/<manga-id>/<cover-file>.256.jpg
```

The proxy sends a MangaDex referer and browser-like request headers, then streams the image back with permissive image/CORS headers.

## Files

```text
server.js
package.json
Dockerfile
```

Commit these files to a Hugging Face Docker Space.

## MangaDex ReadmeList

Set:

```yaml
cover_proxy_url: "https://your-space.hf.space${path}"
```

Keep:

```yaml
cover_url_format: "https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}.256.jpg"
```
