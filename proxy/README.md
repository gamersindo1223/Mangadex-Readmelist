# MangaDex Cover Worker

This folder contains proxy examples used by this repository.

For a GitHub-ready standalone proxy project with both auth and image proxies, see [`../mangadex-image-auth-proxy`](../mangadex-image-auth-proxy).

## Image-only worker

Use `mangadex-cover-worker.js` for a separate lightweight project that only proxies MangaDex cover images.

Request shape:

```text
https://your-worker.example/covers/<manga-id>/<cover-file>.256.jpg
```

The worker fetches:

```text
https://uploads.mangadex.org/covers/<manga-id>/<cover-file>.256.jpg
```

Recommended action input:

```yaml
cover_proxy_url: "https://your-worker.example${path}"
```

## General CORS worker

Use `cors-worker.ts` if you want a broader proxy for the setup wizard and other API calls.

Recommended action input:

```yaml
cover_proxy_url: "https://cor.brtree.dpdns.org/${url}"
```

The general worker strips browser-only headers such as `Referer`, `Origin`, `Cookie`, and `sec-fetch-*` before forwarding requests.

## Hugging Face Space proxy

Use [`huggingface-image-proxy`](huggingface-image-proxy) for a Docker-based Hugging Face Space.

Recommended action input:

```yaml
cover_proxy_url: "https://your-space.hf.space${path}"
```

This proxy sends a MangaDex referer and browser-like headers before streaming the image response.
