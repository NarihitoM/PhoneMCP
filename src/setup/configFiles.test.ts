import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseJsonObject, setEntry, updateJsonConfig, upsertTomlTable } from "./configFiles.js";

test("parseJsonObject accepts objects with a BOM and rejects everything else", () => {
  assert.deepEqual(parseJsonObject('﻿{"a":1}'), { a: 1 });
  assert.equal(parseJsonObject("[1,2]"), null);
  assert.equal(parseJsonObject('{ // comment\n"a": 1 }'), null);
});

test("setEntry keeps other servers", () => {
  const config = { mcpServers: { other: { command: "x" } }, theme: "dark" };
  setEntry(config, "mcpServers", "phone", { command: "node" });

  assert.deepEqual(config, { mcpServers: { other: { command: "x" }, phone: { command: "node" } }, theme: "dark" });
});

test("updateJsonConfig creates, updates with a backup, and refuses unreadable files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "phone-mcp-"));
  try {
    const path = join(dir, "nested", "mcp.json");
    assert.equal(await updateJsonConfig(path, (config) => setEntry(config, "mcpServers", "phone", 1)), "created");
    assert.equal(await updateJsonConfig(path, (config) => setEntry(config, "mcpServers", "other", 2)), "updated");
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), { mcpServers: { phone: 1, other: 2 } });
    assert.ok(existsSync(`${path}.bak`));

    await writeFile(path, "{ // not json\n}");
    assert.equal(await updateJsonConfig(path, () => undefined), "unreadable");
    assert.equal(await readFile(path, "utf8"), "{ // not json\n}");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("upsertTomlTable appends a new table and replaces an existing one", () => {
  const original = 'model = "o3"\n\n[mcp_servers.phone]\ncommand = "old"\n\n[mcp_servers.other]\ncommand = "keep"\n';
  const updated = upsertTomlTable(original, "mcp_servers.phone", 'command = "new"');

  assert.ok(updated.includes('[mcp_servers.other]\ncommand = "keep"'));
  assert.ok(updated.endsWith('[mcp_servers.phone]\ncommand = "new"\n'));
  assert.equal(updated.match(/\[mcp_servers\.phone\]/g)?.length, 1);
  assert.equal(upsertTomlTable("", "t", "a = 1"), "[t]\na = 1\n");
});
