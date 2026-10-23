import { PACKAGE_NAME } from "../lib/package.js";

export interface ServerLaunch {
  command: string;
  args: string[];
}

export function isTemporaryInstall(scriptPath: string): boolean {
  return /[\\/]_npx[\\/]/.test(scriptPath);
}

export function serverLaunch(
  scriptPath: string,
  nodePath: string,
  platform: NodeJS.Platform,
  version: string,
): ServerLaunch {
  if (!isTemporaryInstall(scriptPath)) return { command: nodePath, args: [scriptPath] };

  const npxArgs = ["-y", `${PACKAGE_NAME}@${version}`];
  return platform === "win32" ? { command: "cmd", args: ["/c", "npx", ...npxArgs] } : { command: "npx", args: npxArgs };
}
