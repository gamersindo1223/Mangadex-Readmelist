import test from "node:test";
import assert from "node:assert/strict";
import { installDoHBypass, resolveDoH } from "../src/http.js";

test("installDoHBypass stays disabled without DNS-over-HTTPS env", () => {
  const originalDoh = process.env.MANGADEX_DOH;
  const originalDns = process.env.MANGADEX_DNS;

  delete process.env.MANGADEX_DOH;
  delete process.env.MANGADEX_DNS;

  try {
    assert.equal(installDoHBypass(), false);
  } finally {
    restoreEnv("MANGADEX_DOH", originalDoh);
    restoreEnv("MANGADEX_DNS", originalDns);
  }
});

test("installDoHBypass enables from explicit DoH env", () => {
  const originalDoh = process.env.MANGADEX_DOH;
  const originalDns = process.env.MANGADEX_DNS;

  process.env.MANGADEX_DOH = "true";
  delete process.env.MANGADEX_DNS;

  try {
    assert.equal(installDoHBypass(), true);
  } finally {
    restoreEnv("MANGADEX_DOH", originalDoh);
    restoreEnv("MANGADEX_DNS", originalDns);
  }
});

test("installDoHBypass enables from Cloudflare DNS env", () => {
  const originalDoh = process.env.MANGADEX_DOH;
  const originalDns = process.env.MANGADEX_DNS;

  delete process.env.MANGADEX_DOH;
  process.env.MANGADEX_DNS = "1.1.1.1";

  try {
    assert.equal(installDoHBypass(), true);
  } finally {
    restoreEnv("MANGADEX_DOH", originalDoh);
    restoreEnv("MANGADEX_DNS", originalDns);
  }
});

test("resolveDoH returns IP literals without network lookup", async () => {
  assert.deepEqual(await resolveDoH("1.1.1.1"), [{ address: "1.1.1.1", family: 4 }]);
});

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
