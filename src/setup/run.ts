import { execFile } from "node:child_process";

interface RunResult {
  ok: boolean;
  output: string;
}

function runFile(file: string, args: string[], verbatim = false): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { encoding: "utf8", timeout: 60_000, windowsHide: true, windowsVerbatimArguments: verbatim },
      (error, stdout, stderr) => resolve({ ok: !error, output: `${stdout}${stderr}`.trim() }),
    );
  });
}

function quoteForCmd(arg: string): string {
  return /[\s"&|<>^()]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg;
}

export async function findExecutable(name: string): Promise<string | null> {
  const lookup = process.platform === "win32" ? "where" : "which";
  const result = await runFile(lookup, [name]);
  if (!result.ok) return null;

  const paths = result.output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (process.platform !== "win32") return paths[0] ?? null;
  return paths.find((path) => /\.(exe|cmd|bat)$/i.test(path)) ?? null;
}

export function runExecutable(path: string, args: string[]): Promise<RunResult> {
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(path)) {
    const commandLine = [path, ...args].map(quoteForCmd).join(" ");
    return runFile("cmd.exe", ["/d", "/s", "/c", `"${commandLine}"`], true);
  }
  return runFile(path, args);
}
