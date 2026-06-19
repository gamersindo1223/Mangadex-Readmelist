# MangaDex ReadmeList Docs

Reference for marker types, action inputs, secrets, local testing, and the CORS setup wizard.

## Marker Format

Add marker blocks to the markdown file that the action should update:

```html
<!-- MANGADEX_<STATUS>:<TYPE> -->
<!-- MANGADEX_<STATUS>:<TYPE>_END -->
```

Example:

```html
<!-- MANGADEX_READING:LIST -->
<!-- MANGADEX_READING:LIST_END -->
```

Marker names must be uppercase.

## Available Statuses

| Marker status | MangaDex status | Meaning |
| --- | --- | --- |
| `READING` | `reading` | Currently reading |
| `PLAN_TO_READ` | `plan_to_read` | Planned reading |
| `PTR` | `plan_to_read` | Short alias for `PLAN_TO_READ` |
| `COMPLETED` | `completed` | Completed manga |
| `ON_HOLD` | `on_hold` | On-hold manga |
| `DROPPED` | `dropped` | Dropped manga |
| `RE_READING` | `re_reading` | Re-reading manga |

## Available Display Types

| Type | Output |
| --- | --- |
| `LIST` | Markdown list with a 50px cover, title link, manga status, last chapter, and year when available |
| `GRID` | Linked cover image grid |
| `DEFAULT` | Collapsible `<details>` block containing the list output |

## Full Marker Example

```html
<!-- MANGADEX_READING:LIST -->
<!-- MANGADEX_READING:LIST_END -->

<!-- MANGADEX_READING:GRID -->
<!-- MANGADEX_READING:GRID_END -->

<!-- MANGADEX_READING:DEFAULT -->
<!-- MANGADEX_READING:DEFAULT_END -->

<!-- MANGADEX_PLAN_TO_READ:LIST -->
<!-- MANGADEX_PLAN_TO_READ:LIST_END -->

<!-- MANGADEX_COMPLETED:LIST -->
<!-- MANGADEX_COMPLETED:LIST_END -->

<!-- MANGADEX_ON_HOLD:LIST -->
<!-- MANGADEX_ON_HOLD:LIST_END -->

<!-- MANGADEX_DROPPED:LIST -->
<!-- MANGADEX_DROPPED:LIST_END -->

<!-- MANGADEX_RE_READING:LIST -->
<!-- MANGADEX_RE_READING:LIST_END -->
```

See [`test/fixtures/README.md`](test/fixtures/README.md) for a fixture containing every supported status and display type.

## Required GitHub Secrets

| Secret | Required | Description |
| --- | --- | --- |
| `MD_CLIENT_ID` | Yes | MangaDex personal client id |
| `MD_CLIENT_SECRET` | Yes | MangaDex personal client secret |
| `MD_REFRESH_TOKEN` | Yes | MangaDex refresh token |
| `GH_PAT` | Only for token rotation | Fine-grained GitHub PAT with repository `Secrets: Read and write` permission |

`GH_PAT` is only needed when `rotate_secret` is `true`.

## Action Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `md_client_id` | Yes | none | MangaDex personal client id |
| `md_client_secret` | Yes | none | MangaDex personal client secret |
| `md_refresh_token` | Yes | none | MangaDex refresh token |
| `gh_token` | No | current workflow token | Token used for checkout, commit, and push |
| `gh_pat` | No | empty | PAT used only for secret rotation |
| `repo_path` | No | current repository | Repository to update, for example `OWNER/REPO` |
| `repo_branch` | No | current ref | Branch to update |
| `repo_filename` | No | `README.md` | Markdown file to update |
| `display_limit` | No | `10` | Max entries per marker block, between 1 and 100 |
| `sort_by` | No | `latestUploadedChapter` | Sort field |
| `sort_order` | No | `desc` | `asc` or `desc` |
| `title_language` | No | `en` | Preferred title language code |
| `fallback_title_language` | No | `ja-ro` | Fallback title language code |
| `content_ratings` | No | `safe,suggestive,erotica` | Comma-separated MangaDex content ratings |
| `cover_url_format` | No | `uploads.mangadex.org` template | Cover image URL template |
| `cover_proxy_url` | No | empty | Optional proxy template for cover image URLs |
| `metadata_format` | No | built-in | Optional metadata format for `LIST` and `DEFAULT` items |
| `metadata_format_reading` | No | unset | Optional metadata format override for `READING` |
| `metadata_format_plan_to_read` | No | unset | Optional metadata format override for `PLAN_TO_READ` |
| `metadata_format_completed` | No | unset | Optional metadata format override for `COMPLETED` |
| `metadata_format_on_hold` | No | unset | Optional metadata format override for `ON_HOLD` |
| `metadata_format_dropped` | No | unset | Optional metadata format override for `DROPPED` |
| `metadata_format_re_reading` | No | unset | Optional metadata format override for `RE_READING` |
| `empty_message` | No | built-in | Optional message for empty marker blocks |
| `empty_message_reading` | No | unset | Optional empty message override for `READING` |
| `empty_message_plan_to_read` | No | unset | Optional empty message override for `PLAN_TO_READ` |
| `empty_message_completed` | No | unset | Optional empty message override for `COMPLETED` |
| `empty_message_on_hold` | No | unset | Optional empty message override for `ON_HOLD` |
| `empty_message_dropped` | No | unset | Optional empty message override for `DROPPED` |
| `empty_message_re_reading` | No | unset | Optional empty message override for `RE_READING` |
| `rotate_secret` | No | `false` | Whether to update `MD_REFRESH_TOKEN` after token refresh |
| `refresh_token_secret_name` | No | `MD_REFRESH_TOKEN` | Secret name to update when rotation is enabled |
| `commit_message` | No | `docs: update MangaDex readlist` | Commit message |
| `committer_name` | No | `github-actions[bot]` | Commit author name |
| `committer_email` | No | `41898282+github-actions[bot]@users.noreply.github.com` | Commit author email |

## Sort Fields

| `sort_by` value | Behavior |
| --- | --- |
| `latestUploadedChapter` | Sorts by latest uploaded chapter timestamp after loading the user's status IDs |
| `updatedAt` | Sorts by MangaDex manga update timestamp |
| `createdAt` | Sorts by MangaDex manga creation timestamp |
| `title` | Sorts by first available title value |
| `followedCount` | Sorts by followed count when MangaDex returns it |
| `year` | Sorts by release year |

## Metadata Formatting

By default, list entries render metadata like:

```text
ongoing / ch. 18 / 2024
```

Set `metadata_format` to control the text after each title. Per-status values override the global format. If a per-status value is unset, it falls back to `metadata_format`; if it is explicitly empty, metadata is hidden for that status.

Examples:

```yaml
metadata_format: "${status} / ${lastChapter} / ${year}"
metadata_format_reading: "${status} / ${lastRead}/${lastChapter} / ${year}"
metadata_format_plan_to_read: ""
```

Available placeholders:

| Placeholder | Meaning |
| --- | --- |
| `${status}` | MangaDex manga status, for example `ongoing` or `completed` |
| `${libraryStatus}` | Your library status label, for example `Reading` |
| `${lastChapter}` | MangaDex manga last chapter value |
| `${lastRead}` | Highest read chapter detected from MangaDex read markers |
| `${progress}` | `${lastRead}/${lastChapter}` when both values exist |
| `${year}` | Manga release year |
| `${title}` | Rendered title |

Placeholder names are flexible: `${last read}`, `${last_read}`, and `${lastRead}` all resolve the same way.

## Content Ratings

`content_ratings` maps to MangaDex `contentRating[]`.

Common values:

| Value |
| --- |
| `safe` |
| `suggestive` |
| `erotica` |
| `pornographic` |

Default:

```text
safe,suggestive,erotica
```

## Cover URL Formatting

By default, covers use MangaDex's static upload host:

```text
https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}.256.jpg
```

The `https://mangadex.org/covers/...` route can return MangaDex's anti-hotlink placeholder image in browser markdown previews, even with `200 OK`, so it is not the default.

Available placeholders:

| Placeholder | Meaning |
| --- | --- |
| `${mangaId}` | MangaDex title UUID |
| `${coverFileName}` | Cover filename from the `cover_art` relationship |

Example:

```yaml
cover_url_format: "https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}.512.jpg"
```

If a markdown preview still receives MangaDex's placeholder image, proxy the cover request through your own Worker. The image-only worker is available at [`proxy/mangadex-cover-worker.js`](proxy/mangadex-cover-worker.js).

Recommended image-worker setting:

```yaml
cover_proxy_url: "https://apsiknb-image.hf.space${path}"
```

This turns:

```text
https://uploads.mangadex.org/covers/<manga-id>/<cover-file>.256.jpg
```

into:

```text
https://apsiknb-image.hf.space/covers/<manga-id>/<cover-file>.256.jpg
```

For a general CORS proxy, use:

```yaml
cover_proxy_url: "https://cor.brtree.dpdns.org/${url}"
```

Available proxy placeholders:

| Placeholder | Meaning |
| --- | --- |
| `${url}` | Full rendered cover URL |
| `${encodedUrl}` | URL-encoded full cover URL |
| `${path}` | Path and query from the rendered cover URL |
| `${encodedPath}` | URL-encoded path and query |

## Empty Messages

By default, empty marker blocks render:

```text
No MangaDex entries found for Re-reading.
```

Set `empty_message` to change this globally. Per-status values override the global message. If a per-status value is unset, it falls back to `empty_message`; if it is explicitly empty, the empty message is hidden for that status.

Examples:

```yaml
empty_message: "Nothing in ${libraryStatus}."
empty_message_re_reading: ""
```

Available placeholders:

| Placeholder | Meaning |
| --- | --- |
| `${status}` | Raw library status, for example `re_reading` |
| `${libraryStatus}` | Display label, for example `Re-reading` |

## Workflow Example

```yaml
name: Update MangaDex readlist

on:
  schedule:
    # Recommended interval: 24 hours. Please do not run more often to avoid abusing MangaDex.
    - cron: "0 0 * * *"
  workflow_dispatch:

jobs:
  update-readme:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: MangaDex ReadmeList
        uses: gamersindo1223/Mangadex-Readmelist@main
        with:
          md_client_id: ${{ secrets.MD_CLIENT_ID }}
          md_client_secret: ${{ secrets.MD_CLIENT_SECRET }}
          md_refresh_token: ${{ secrets.MD_REFRESH_TOKEN }}
          repo_path: "OWNER/REPO"
          repo_branch: "main"
          repo_filename: "README.md"
          display_limit: "10"
          sort_by: "latestUploadedChapter"
          sort_order: "desc"
          cover_url_format: "https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}.256.jpg"
          cover_proxy_url: "https://apsiknb-image.hf.space${path}"
          rotate_secret: "true"
          gh_pat: ${{ secrets.GH_PAT }}
```

## Token Setup

Use the browser setup wizard:

```text
http://setup.brtree.dpdns.org/web/
```

For local use, open:

```text
web/index.html
```

It uses a CORS proxy based on [gamersindo1223/cors](https://github.com/gamersindo1223/cors).

The proxy must preserve:

```text
Content-Type: application/x-www-form-urlencoded
```

The fixed worker source is available at [`proxy/cors-worker.ts`](proxy/cors-worker.ts).

If you do not want to use a browser proxy, run:

```powershell
node scripts/get-refresh-token.js
```

The local helper prompts for the MangaDex username, password, optional 2FA code, client id, and client secret. Password and client secret input are hidden in the terminal.

## Local `.env` Testing

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Then fill in:

```dotenv
INPUT_MD_CLIENT_ID=personal-client-...
INPUT_MD_CLIENT_SECRET=your-client-secret
INPUT_MD_REFRESH_TOKEN=your-refresh-token
# Or use MD_CLIENT_ID, MD_CLIENT_SECRET, and MD_REFRESH_TOKEN.
INPUT_REPO_FILENAME=README.md
INPUT_DISPLAY_LIMIT=10
INPUT_SORT_BY=latestUploadedChapter
INPUT_SORT_ORDER=desc
INPUT_TITLE_LANGUAGE=en
INPUT_FALLBACK_TITLE_LANGUAGE=ja-ro
INPUT_CONTENT_RATINGS=safe,suggestive,erotica
INPUT_COVER_URL_FORMAT=https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}.256.jpg
INPUT_COVER_PROXY_URL=https://apsiknb-image.hf.space${path}
# INPUT_METADATA_FORMAT=${status} / ${lastRead}/${lastChapter} / ${year}
# INPUT_METADATA_FORMAT_PLAN_TO_READ=
# INPUT_EMPTY_MESSAGE=Nothing in ${libraryStatus}.
# INPUT_EMPTY_MESSAGE_RE_READING=
TARGET_REPOSITORY_DIR=.
MANGADEX_DOH=true
MANGADEX_DNS=1.1.1.1
MANGADEX_DOH_TIMEOUT_MS=5000
MANGADEX_UPDATE_ENV_REFRESH_TOKEN=true
```

Run:

```powershell
node src/index.js
```

Existing process environment variables override `.env` values. Set this to disable `.env` loading:

```powershell
$env:MANGADEX_READLIST_ENV = "false"
```

## Network Diagnostics

If MangaDex requests time out locally, run:

```powershell
npm run diagnose:network
```

With `MANGADEX_DOH=true` or `MANGADEX_DNS=1.1.1.1`, MangaDex requests use an undici global dispatcher that resolves hostnames through Cloudflare DNS-over-HTTPS on port 443. Set `MANGADEX_DNS_DEBUG=true` to print resolved IPs during normal commands.

## Test Fixture

`test/fixtures/README.md` includes every supported marker status and display type. Use it when validating renderer changes.

Render it with your real MangaDex library from `.env`:

```powershell
npm run render:fixture
```

The preview is written to `test/fixtures/output/README.generated.md`. This command uses the same MangaDex OAuth credentials and DNS-over-HTTPS settings as the action, including `MANGADEX_DOH=true` or `MANGADEX_DNS=1.1.1.1`.

If MangaDex rotates the refresh token, the command updates local `.env` automatically. Set `MANGADEX_UPDATE_ENV_REFRESH_TOKEN=false` to disable that.
