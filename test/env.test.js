import test from "node:test";
import assert from "node:assert/strict";
import { parseEnvLine } from "../src/env.js";

test("parseEnvLine parses unquoted values", () => {
  assert.deepEqual(parseEnvLine("INPUT_DISPLAY_LIMIT=10"), {
    key: "INPUT_DISPLAY_LIMIT",
    value: "10"
  });
});

test("parseEnvLine parses quoted values", () => {
  assert.deepEqual(parseEnvLine('INPUT_REPO_FILENAME="README.md"'), {
    key: "INPUT_REPO_FILENAME",
    value: "README.md"
  });
});

test("parseEnvLine ignores comments and invalid lines", () => {
  assert.equal(parseEnvLine("# comment"), null);
  assert.equal(parseEnvLine("not-an-env-line"), null);
});

test("parseEnvLine supports DNS override values", () => {
  assert.deepEqual(parseEnvLine("MANGADEX_DNS=1.1.1.1"), {
    key: "MANGADEX_DNS",
    value: "1.1.1.1"
  });
});
