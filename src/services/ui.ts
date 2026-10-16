import { adb, AdbError, shell } from "../lib/adb.js";
import type { Bounds, UiElement } from "../types/index.js";

const DUMP_PATH = "/sdcard/window_dump.xml";
const NODE_PATTERN = /<node\b([^>]*?)\/?>/g;
const ATTRIBUTE_PATTERN = /([\w-]+)="([^"]*)"/g;
const BOUNDS_PATTERN = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

const lastDump = new Map<string, UiElement[]>();

function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named = ENTITIES[entity.toLowerCase()];
    if (named) return named;
    const hex = entity.startsWith("&#x") || entity.startsWith("&#X");
    const code = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return Number.isNaN(code) ? entity : String.fromCodePoint(code);
  });
}

function parseAttributes(raw: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of raw.matchAll(ATTRIBUTE_PATTERN)) {
    const [, key, value] = match;
    if (key !== undefined && value !== undefined) attributes.set(key, decodeEntities(value));
  }
  return attributes;
}

function parseBounds(raw: string | undefined): Bounds | null {
  const match = raw ? BOUNDS_PATTERN.exec(raw) : null;
  if (!match) return null;
  const [left, top, right, bottom] = match.slice(1).map(Number) as [number, number, number, number];
  if (right <= left || bottom <= top) return null;
  return { left, top, right, bottom };
}

export function parseUiDump(xml: string): UiElement[] {
  const elements: UiElement[] = [];

  for (const match of xml.matchAll(NODE_PATTERN)) {
    const attributes = parseAttributes(match[1] ?? "");
    const bounds = parseBounds(attributes.get("bounds"));
    if (!bounds) continue;

    const text = attributes.get("text") ?? "";
    const description = attributes.get("content-desc") ?? "";
    const clickable = attributes.get("clickable") === "true" || attributes.get("long-clickable") === "true";
    const scrollable = attributes.get("scrollable") === "true";
    const editable = attributes.get("class") === "android.widget.EditText";

    if (!text && !description && !clickable && !scrollable && !editable) continue;

    elements.push({
      index: elements.length,
      text,
      description,
      resourceId: attributes.get("resource-id") ?? "",
      className: attributes.get("class") ?? "",
      clickable,
      scrollable,
      focused: attributes.get("focused") === "true",
      bounds,
      center: {
        x: Math.round((bounds.left + bounds.right) / 2),
        y: Math.round((bounds.top + bounds.bottom) / 2),
      },
    });
  }

  return elements;
}

function shortId(resourceId: string): string {
  const separator = resourceId.indexOf(":id/");
  return separator === -1 ? resourceId : resourceId.slice(separator + 4);
}

function shortClass(className: string): string {
  return className.slice(className.lastIndexOf(".") + 1);
}

export function formatElements(elements: UiElement[]): string {
  if (elements.length === 0) {
    return "No readable elements on screen. Use screenshot to see it.";
  }

  return elements
    .map((element) => {
      const parts = [`[${element.index}]`, shortClass(element.className)];
      if (element.text) parts.push(JSON.stringify(element.text));
      if (element.description && element.description !== element.text) {
        parts.push(`desc=${JSON.stringify(element.description)}`);
      }
      if (element.resourceId) parts.push(`id=${shortId(element.resourceId)}`);
      parts.push(`(${element.center.x},${element.center.y})`);

      const flags = [
        element.clickable && "clickable",
        element.scrollable && "scrollable",
        element.focused && "focused",
      ].filter(Boolean);
      if (flags.length > 0) parts.push(flags.join(","));

      return parts.join(" ");
    })
    .join("\n");
}

function cacheKey(serial?: string): string {
  return serial ?? process.env.ANDROID_SERIAL ?? "default";
}

async function dumpXml(serial?: string): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await shell(`uiautomator dump ${DUMP_PATH}`, { serial });
      if (/ERROR|null root node/i.test(result)) throw new AdbError(result.trim());
      return await adb(["exec-out", "cat", DUMP_PATH], { serial });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new AdbError("UI dump failed");
}

export async function readScreen(serial?: string): Promise<UiElement[]> {
  const elements = parseUiDump(await dumpXml(serial));
  lastDump.set(cacheKey(serial), elements);
  return elements;
}

export function findElement(index: number, serial?: string): UiElement {
  const elements = lastDump.get(cacheKey(serial));
  if (!elements) throw new AdbError("No screen read yet. Call get_ui first.");

  const element = elements[index];
  if (!element) throw new AdbError(`Element ${index} not found. Call get_ui again to refresh.`);

  return element;
}
