import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { findReadmeSections, selectTitle, updateReadmeSections } from "../src/readme.js";

test("findReadmeSections detects valid MangaDex blocks", () => {
  const readme = [
    "<!-- MANGADEX_READING:LIST -->",
    "old",
    "<!-- MANGADEX_READING:LIST_END -->"
  ].join("\n");

  const sections = findReadmeSections(readme);

  assert.equal(sections.length, 1);
  assert.equal(sections[0].status, "reading");
  assert.equal(sections[0].type, "LIST");
});

test("findReadmeSections supports status aliases", () => {
  const readme = [
    "<!-- MANGADEX_PTR:GRID -->",
    "old",
    "<!-- MANGADEX_PTR:GRID_END -->"
  ].join("\n");

  const sections = findReadmeSections(readme);

  assert.equal(sections.length, 1);
  assert.equal(sections[0].status, "plan_to_read");
  assert.equal(sections[0].type, "GRID");
});

test("findReadmeSections ignores markers inside fenced code blocks", () => {
  const readme = [
    "```html",
    "<!-- MANGADEX_READING:LIST -->",
    "<!-- MANGADEX_READING:LIST_END -->",
    "```",
    "<!-- MANGADEX_COMPLETED:LIST -->",
    "<!-- MANGADEX_COMPLETED:LIST_END -->"
  ].join("\n");

  const sections = findReadmeSections(readme);

  assert.equal(sections.length, 1);
  assert.equal(sections[0].status, "completed");
});

test("updateReadmeSections ignores markers inside fenced code blocks", () => {
  const readme = [
    "```html",
    "<!-- MANGADEX_READING:LIST -->",
    "old fenced",
    "<!-- MANGADEX_READING:LIST_END -->",
    "```",
    "<!-- MANGADEX_COMPLETED:LIST -->",
    "old live",
    "<!-- MANGADEX_COMPLETED:LIST_END -->"
  ].join("\n");

  const output = updateReadmeSections(
    readme,
    new Map([["completed", []]]),
    { titleLanguage: "en", fallbackTitleLanguage: "ja-ro" }
  );

  assert.match(output, /old fenced/);
  assert.doesNotMatch(output, /old live/);
});

test("updateReadmeSections replaces only valid matching blocks", () => {
  const readme = [
    "Before",
    "<!-- MANGADEX_PLAN_TO_READ:LIST -->",
    "old",
    "<!-- MANGADEX_PLAN_TO_READ:LIST_END -->",
    "After"
  ].join("\n");

  const mangaByStatus = new Map([
    [
      "plan_to_read",
      [
        {
          id: "abc",
          title: { en: "A [Good] Manga" },
          altTitles: [],
          status: "ongoing",
          year: 2024,
          lastChapter: "12",
          coverFileName: "cover.jpg"
        }
      ]
    ]
  ]);

  const output = updateReadmeSections(readme, mangaByStatus, {
    titleLanguage: "en",
    fallbackTitleLanguage: "ja-ro"
  });

  assert.match(output, /A \\\[Good\\\] Manga/);
  assert.match(output, /https:\/\/mangadex.org\/title\/abc/);
  assert.match(output, /https:\/\/uploads\.mangadex\.org\/covers\/abc\/cover\.jpg\.256\.jpg/);
  assert.doesNotMatch(output, /https:\/\/mangadex\.org\/covers\//);
  assert.doesNotMatch(output, /old/);
});

test("updateReadmeSections supports custom cover URL format", () => {
  const readme = [
    "<!-- MANGADEX_READING:GRID -->",
    "old",
    "<!-- MANGADEX_READING:GRID_END -->"
  ].join("\n");
  const output = updateReadmeSections(
    readme,
    new Map([
      [
        "reading",
        [
          {
            id: "abc",
            title: { en: "Custom Cover" },
            altTitles: [],
            coverFileName: "cover.jpg"
          }
        ]
      ]
    ]),
    {
      titleLanguage: "en",
      fallbackTitleLanguage: "ja-ro",
      coverUrlFormat: "https://example.test/${mangaId}/${coverFileName}"
    }
  );

  assert.match(output, /https:\/\/example\.test\/abc\/cover\.jpg/);
});

test("updateReadmeSections supports cover proxy URL templates", () => {
  const readme = [
    "<!-- MANGADEX_READING:LIST -->",
    "old",
    "<!-- MANGADEX_READING:LIST_END -->"
  ].join("\n");
  const output = updateReadmeSections(
    readme,
    new Map([
      [
        "reading",
        [
          {
            id: "abc",
            title: { en: "Proxied Cover" },
            altTitles: [],
            coverFileName: "cover.jpg"
          }
        ]
      ]
    ]),
    {
      titleLanguage: "en",
      fallbackTitleLanguage: "ja-ro",
      coverUrlFormat: "https://uploads.mangadex.org/covers/${mangaId}/${coverFileName}.256.jpg",
      coverProxyUrl: "https://img.example.test${path}"
    }
  );

  assert.match(output, /https:\/\/img\.example\.test\/covers\/abc\/cover\.jpg\.256\.jpg/);
});

test("updateReadmeSections uses custom metadata format", () => {
  const readme = [
    "<!-- MANGADEX_READING:LIST -->",
    "old",
    "<!-- MANGADEX_READING:LIST_END -->"
  ].join("\n");
  const output = updateReadmeSections(
    readme,
    new Map([
      [
        "reading",
        [
          {
            id: "abc",
            title: { en: "Readable" },
            altTitles: [],
            status: "ongoing",
            year: 2024,
            lastChapter: "12",
            lastReadChapter: "8"
          }
        ]
      ]
    ]),
    {
      titleLanguage: "en",
      fallbackTitleLanguage: "ja-ro",
      metadataFormats: {
        default: "${status} / ${lastRead}/${lastChapter} / ${year}"
      }
    }
  );

  assert.match(output, /ongoing \/ 8\/12 \/ 2024/);
});

test("updateReadmeSections removes empty formatter separators", () => {
  const readme = [
    "<!-- MANGADEX_READING:LIST -->",
    "old",
    "<!-- MANGADEX_READING:LIST_END -->"
  ].join("\n");
  const output = updateReadmeSections(
    readme,
    new Map([
      [
        "reading",
        [
          {
            id: "abc",
            title: { en: "No Progress Yet" },
            altTitles: [],
            status: "ongoing",
            year: 2024,
            lastChapter: "12"
          },
          {
            id: "def",
            title: { en: "Has Progress" },
            altTitles: [],
            status: "completed",
            year: 2024,
            lastChapter: "18",
            lastReadChapter: "1"
          }
        ]
      ]
    ]),
    {
      titleLanguage: "en",
      fallbackTitleLanguage: "ja-ro",
      metadataFormats: {
        default: "${status} / ${progress} / ${year}"
      }
    }
  );

  assert.match(output, /No Progress Yet.*ongoing \/ 2024/);
  assert.match(output, /Has Progress.*completed \/ 1\/18 \/ 2024/);
  assert.doesNotMatch(output, / \/  \/ /);
});

test("updateReadmeSections lets empty status metadata override hide metadata", () => {
  const readme = [
    "<!-- MANGADEX_PLAN_TO_READ:LIST -->",
    "old",
    "<!-- MANGADEX_PLAN_TO_READ:LIST_END -->"
  ].join("\n");
  const output = updateReadmeSections(
    readme,
    new Map([
      [
        "plan_to_read",
        [
          {
            id: "abc",
            title: { en: "Hidden Meta" },
            altTitles: [],
            status: "ongoing",
            year: 2024,
            lastChapter: "12"
          }
        ]
      ]
    ]),
    {
      titleLanguage: "en",
      fallbackTitleLanguage: "ja-ro",
      metadataFormats: {
        default: "${status} / ${year}",
        plan_to_read: ""
      }
    }
  );

  assert.match(output, /\*\*\[Hidden Meta\]\(https:\/\/mangadex\.org\/title\/abc\)\*\*$/m);
  assert.doesNotMatch(output, /ongoing \/ 2024/);
});

test("updateReadmeSections supports custom empty messages", () => {
  const readme = [
    "<!-- MANGADEX_RE_READING:LIST -->",
    "old",
    "<!-- MANGADEX_RE_READING:LIST_END -->",
    "<!-- MANGADEX_DROPPED:LIST -->",
    "old",
    "<!-- MANGADEX_DROPPED:LIST_END -->"
  ].join("\n");
  const output = updateReadmeSections(readme, new Map(), {
    titleLanguage: "en",
    fallbackTitleLanguage: "ja-ro",
    emptyMessages: {
      default: "Nothing in ${libraryStatus}.",
      dropped: ""
    }
  });

  assert.match(output, /Nothing in Re-reading\./);
  assert.doesNotMatch(output, /No MangaDex entries found/);
  assert.match(output, /<!-- MANGADEX_DROPPED:LIST -->\n\n<!-- MANGADEX_DROPPED:LIST_END -->/);
});

test("selectTitle falls back from preferred title to alternate values", () => {
  const manga = {
    title: { ja: "Japanese title" },
    altTitles: [{ en: "English alt title" }]
  };

  assert.equal(selectTitle(manga, "en", "ja-ro"), "English alt title");
});

test("fixture README contains every status and display type", async () => {
  const readme = await readFile(new URL("./fixtures/README.md", import.meta.url), "utf8");
  const sections = findReadmeSections(readme);
  const seen = new Set(sections.map((section) => `${section.status}:${section.type}`));

  for (const status of ["reading", "plan_to_read", "completed", "on_hold", "dropped", "re_reading"]) {
    for (const type of ["LIST", "GRID", "DEFAULT"]) {
      assert.ok(seen.has(`${status}:${type}`), `missing ${status}:${type}`);
    }
  }

  assert.equal(sections.length, 18);
});
