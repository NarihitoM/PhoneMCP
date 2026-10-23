import { readFileSync } from "node:fs";

export const PACKAGE_NAME = "phone-mcp-by-narihito";

export function packageVersion(): string {
  try {
    const manifest: unknown = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    if (manifest && typeof manifest === "object" && "version" in manifest && typeof manifest.version === "string") {
      return manifest.version;
    }
  } catch {
    return "0.0.0";
  }
  return "0.0.0";
}
