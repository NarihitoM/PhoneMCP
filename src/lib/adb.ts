import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BUFFER = 64 * 1024 * 1024;

export class AdbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdbError";
  }
}

interface RunOptions {
  serial?: string;
  timeoutMs?: number;
}

function resolveAdbPath(): string {
  if (process.env.ADB_PATH) return process.env.ADB_PATH;

  const exe = process.platform === "win32" ? "adb.exe" : "adb";
  const roots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT];
  const localAppData =
    process.platform === "win32" ? (process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local")) : undefined;
  if (localAppData) {
    roots.push(
      join(localAppData, "Android", "Sdk"),
      join(localAppData, "Microsoft", "WinGet", "Packages", "Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe"),
    );
  }

  if (process.platform === "darwin") roots.push(join(homedir(), "Library", "Android", "sdk"));
  if (process.platform === "linux") roots.push(join(homedir(), "Android", "Sdk"));

  const candidates = roots.flatMap((root) => (root ? [join(root, "platform-tools", exe)] : []));
  if (localAppData) candidates.push(join(localAppData, "Microsoft", "WinGet", "Links", exe));
  if (process.platform !== "win32") candidates.push("/opt/homebrew/bin/adb", "/usr/local/bin/adb", "/usr/bin/adb");

  return candidates.find((candidate) => existsSync(candidate)) ?? "adb";
}

const adbPath = resolveAdbPath();

function withSerial(args: string[], serial?: string): string[] {
  const target = serial ?? process.env.ANDROID_SERIAL;
  return target ? ["-s", target, ...args] : args;
}

function friendlyError(output: string, code: string | number | null | undefined): AdbError {
  const text = output.trim();

  if (code === "ENOENT") {
    return new AdbError(
      "adb was not found. Install Android platform-tools (winget install Google.PlatformTools) or set ADB_PATH.",
    );
  }
  if (/more than one device/i.test(text)) {
    return new AdbError("More than one device is connected. Pass a serial (see list_devices) or set ANDROID_SERIAL.");
  }
  if (/no devices\/emulators found|device not found/i.test(text)) {
    return new AdbError("No phone connected. Connect over USB, or use connect_wifi / pair_wifi for Wireless debugging.");
  }
  if (/unauthorized/i.test(text)) {
    return new AdbError("Phone is unauthorized. Unlock it and tap Allow on the USB/Wireless debugging prompt.");
  }
  if (/offline/i.test(text)) {
    return new AdbError("Phone is offline. Reconnect it (connect_wifi) or toggle debugging on the phone.");
  }

  return new AdbError(text || `adb exited with code ${String(code)}`);
}

function runAdb(args: string[], timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(
      adbPath,
      args,
      { encoding: "buffer", maxBuffer: MAX_BUFFER, timeout: timeoutMs, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          const output = `${stderr.toString()}\n${stdout.toString()}`;
          const code = (error as NodeJS.ErrnoException).code;
          reject(error.killed ? new AdbError(`adb timed out after ${timeoutMs}ms`) : friendlyError(output, code));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

export async function adb(args: string[], options: RunOptions = {}): Promise<string> {
  const stdout = await runAdb(withSerial(args, options.serial), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return stdout.toString("utf8");
}

export async function adbBinary(args: string[], options: RunOptions = {}): Promise<Buffer> {
  return runAdb(withSerial(args, options.serial), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

export async function adbGlobal(args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const stdout = await runAdb(args, timeoutMs);
  return stdout.toString("utf8");
}

export function shell(command: string, options: RunOptions = {}): Promise<string> {
  return adb(["shell", command], options);
}
