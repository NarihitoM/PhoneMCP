import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

export type JsonObject = Record<string, unknown>;

export type ConfigResult = "created" | "updated" | "unreadable";

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonObject(text: string): JsonObject | null {
  try {
    const parsed: unknown = JSON.parse(text.replace(/^﻿/, ""));
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setEntry(config: JsonObject, section: string, name: string, value: unknown): void {
  const current = config[section];
  const entries = isJsonObject(current) ? current : {};
  entries[name] = value;
  config[section] = entries;
}

export async function updateJsonConfig(path: string, update: (config: JsonObject) => void): Promise<ConfigResult> {
  if (!existsSync(path)) {
    await mkdir(dirname(path), { recursive: true });
    const config: JsonObject = {};
    update(config);
    await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
    return "created";
  }

  const config = parseJsonObject(await readFile(path, "utf8"));
  if (!config) return "unreadable";

  await copyFile(path, `${path}.bak`);
  update(config);
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
  return "updated";
}

export function upsertTomlTable(content: string, table: string, body: string): string {
  const header = `[${table}]`;
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === header);

  if (start !== -1) {
    const next = lines.findIndex((line, index) => index > start && /^\s*\[/.test(line));
    lines.splice(start, (next === -1 ? lines.length : next) - start);
  }

  const kept = lines.join("\n").replace(/\s+$/, "");
  return `${kept ? `${kept}\n\n` : ""}${header}\n${body}\n`;
}

export function tomlString(value: string): string {
  return JSON.stringify(value);
}

export async function updateTomlConfig(path: string, table: string, body: string): Promise<ConfigResult> {
  const exists = existsSync(path);
  if (exists) await copyFile(path, `${path}.bak`);
  else await mkdir(dirname(path), { recursive: true });

  const content = exists ? await readFile(path, "utf8") : "";
  await writeFile(path, upsertTomlTable(content, table, body));
  return exists ? "updated" : "created";
}
