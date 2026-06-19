# MangaDex Cover Worker

Small Cloudflare Worker for proxying MangaDex cover images.

It maps:

```text
https://your-worker.example/covers/<manga-id>/<cover-file>.256.jpg
```

to:

```text
https://uploads.mangadex.org/covers/<manga-id>/<cover-file>.256.jpg
```

This is useful when markdown preview sites hotlink MangaDex covers with browser headers that make MangaDex return a placeholder image.

## Deploy

```powershell
npm install
npm run deploy
```

## MangaDex ReadmeList

Set:

```yaml
cover_proxy_url: "https://your-worker.example${path}"
```

Keep the normal cover URL format:

```yaml
cover_url_format: "https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}.256.jpg"
```

The generated README image URL will become:

```text
https://your-worker.example/covers/<manga-id>/<cover-file>.256.jpg
```
