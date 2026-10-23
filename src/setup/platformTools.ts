import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { LOCAL_PLATFORM_TOOLS } from "../lib/adb.js";

const REPOSITORY_URL = "https://dl.google.com/android/repository/";
const INDEX_URL = `${REPOSITORY_URL}repository2-3.xml`;
const STABLE_CHANNEL = "channel-0";

export type HostOs = "windows" | "macosx" | "linux";

export interface PlatformToolsArchive {
  file: string;
  sha1: string;
  size: number;
}

export function hostOs(platform: NodeJS.Platform): HostOs | null {
  if (platform === "win32") return "windows";
  if (platform === "darwin") return "macosx";
  if (platform === "linux") return "linux";
  return null;
}

function tag(block: string, name: string): string | undefined {
  return new RegExp(`<${name}\\b[^>]*>([^<]*)</${name}>`).exec(block)?.[1]?.trim();
}

export function findPlatformToolsArchive(xml: string, os: HostOs): PlatformToolsArchive | null {
  const packages = xml.match(/<remotePackage path="platform-tools">[\s\S]*?<\/remotePackage>/g) ?? [];
  const stable = packages.find((block) => block.includes(`ref="${STABLE_CHANNEL}"`)) ?? packages[0];
  if (!stable) return null;

  for (const archive of stable.match(/<archive>[\s\S]*?<\/archive>/g) ?? []) {
    if (tag(archive, "host-os") !== os) continue;

    const file = tag(archive, "url");
    const sha1 = /<checksum type="sha1">([0-9a-f]{40})<\/checksum>/i.exec(archive)?.[1];
    const size = Number(tag(archive, "size"));
    if (file && /^[\w.-]+\.zip$/.test(file) && sha1 && size > 0) return { file, sha1: sha1.toLowerCase(), size };
  }
  return null;
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function run(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 120_000 }, (error, _stdout, stderr) => {
      if (error) reject(new Error(`${file} failed: ${stderr.trim() || error.message}`));
      else resolve();
    });
  });
}

async function extractZip(zipPath: string, destination: string, platform: NodeJS.Platform): Promise<void> {
  if (platform !== "linux") {
    const tar = platform === "win32" ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";
    await run(tar, ["-xf", zipPath, "-C", destination]);
    return;
  }
  try {
    await run("unzip", ["-o", "-q", zipPath, "-d", destination]);
  } catch {
    await run("python3", ["-m", "zipfile", "-e", zipPath, destination]);
  }
}

export async function installPlatformTools(
  target = LOCAL_PLATFORM_TOOLS,
  platform: NodeJS.Platform = process.platform,
): Promise<string> {
  const os = hostOs(platform);
  if (!os) throw new Error(`No Android platform-tools build for ${platform}. Install adb manually.`);

  const archive = findPlatformToolsArchive(await (await download(INDEX_URL)).toString("utf8"), os);
  if (!archive) throw new Error("Could not find platform-tools in Google's SDK index.");

  const zip = await download(`${REPOSITORY_URL}${archive.file}`);
  const sha1 = createHash("sha1").update(zip).digest("hex");
  if (zip.length !== archive.size || sha1 !== archive.sha1) {
    throw new Error("Downloaded platform-tools did not match Google's published checksum. Try again later.");
  }

  const zipPath = join(tmpdir(), `${archive.file}-${process.pid}`);
  await writeFile(zipPath, zip);
  try {
    await rm(target, { recursive: true, force: true });
    await mkdir(dirname(target), { recursive: true });
    await extractZip(zipPath, dirname(target), platform);
  } finally {
    await rm(zipPath, { force: true });
  }

  const adbPath = join(target, platform === "win32" ? "adb.exe" : "adb");
  if (platform !== "win32") await chmod(adbPath, 0o755);
  return adbPath;
}
