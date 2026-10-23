import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { type ConfigResult, setEntry, tomlString, updateJsonConfig, updateTomlConfig } from "./configFiles.js";
import type { ServerLaunch } from "./launch.js";
import { findExecutable, runExecutable } from "./run.js";

export const SERVER_NAME = "phone";

export interface SetupEnv {
  platform: NodeJS.Platform;
  home: string;
  appData: string;
  configHome: string;
  codexHome: string;
}

export interface Client {
  id: string;
  name: string;
  detect(env: SetupEnv): Promise<boolean>;
  install(launch: ServerLaunch, env: SetupEnv): Promise<string>;
}

export function currentEnv(): SetupEnv {
  const home = homedir();
  return {
    platform: process.platform,
    home,
    appData: process.env.APPDATA ?? join(home, "AppData", "Roaming"),
    configHome: process.env.XDG_CONFIG_HOME ?? join(home, ".config"),
    codexHome: process.env.CODEX_HOME ?? join(home, ".codex"),
  };
}

function appSupport(env: SetupEnv, app: string): string {
  if (env.platform === "win32") return join(env.appData, app);
  if (env.platform === "darwin") return join(env.home, "Library", "Application Support", app);
  return join(env.configHome, app);
}

function describe(result: ConfigResult, path: string): string {
  if (result === "unreadable") {
    throw new Error(`could not read ${path} (it may contain comments). Add the server manually.`);
  }
  return `${result} ${path}`;
}

function mcpServersClient(id: string, name: string, configPath: (env: SetupEnv) => string): Client {
  return {
    id,
    name,
    detect: async (env) => existsSync(dirname(configPath(env))),
    install: async (launch, env) => {
      const path = configPath(env);
      const result = await updateJsonConfig(path, (config) =>
        setEntry(config, "mcpServers", SERVER_NAME, { command: launch.command, args: launch.args }),
      );
      return describe(result, path);
    },
  };
}

export function claudeDesktopPath(env: SetupEnv): string {
  return join(appSupport(env, "Claude"), "claude_desktop_config.json");
}

export function vscodePath(env: SetupEnv): string {
  return join(appSupport(env, "Code"), "User", "mcp.json");
}

export function opencodePath(env: SetupEnv): string {
  const dir = join(env.configHome, "opencode");
  const json = join(dir, "opencode.json");
  const jsonc = join(dir, "opencode.jsonc");
  return !existsSync(json) && existsSync(jsonc) ? jsonc : json;
}

const claudeCode: Client = {
  id: "claude-code",
  name: "Claude Code",
  detect: async () => (await findExecutable("claude")) !== null,
  install: async (launch) => {
    const claude = await findExecutable("claude");
    if (!claude) throw new Error("claude command not found");

    await runExecutable(claude, ["mcp", "remove", SERVER_NAME, "-s", "user"]);
    const result = await runExecutable(claude, [
      "mcp",
      "add",
      SERVER_NAME,
      "-s",
      "user",
      "--",
      launch.command,
      ...launch.args,
    ]);
    if (!result.ok) throw new Error(result.output || "claude mcp add failed");
    return "added with `claude mcp add` (user scope)";
  },
};

const vscode: Client = {
  id: "vscode",
  name: "VS Code",
  detect: async (env) => existsSync(dirname(vscodePath(env))),
  install: async (launch, env) => {
    const path = vscodePath(env);
    const result = await updateJsonConfig(path, (config) =>
      setEntry(config, "servers", SERVER_NAME, { type: "stdio", command: launch.command, args: launch.args }),
    );
    return describe(result, path);
  },
};

const codex: Client = {
  id: "codex",
  name: "Codex CLI",
  detect: async (env) => existsSync(env.codexHome),
  install: async (launch, env) => {
    const path = join(env.codexHome, "config.toml");
    const body = [
      `command = ${tomlString(launch.command)}`,
      `args = [${launch.args.map(tomlString).join(", ")}]`,
    ].join("\n");
    const result = await updateTomlConfig(path, `mcp_servers.${SERVER_NAME}`, body);
    return describe(result, path);
  },
};

const opencode: Client = {
  id: "opencode",
  name: "OpenCode",
  detect: async (env) => existsSync(join(env.configHome, "opencode")),
  install: async (launch, env) => {
    const path = opencodePath(env);
    const result = await updateJsonConfig(path, (config) => {
      if (!config.$schema) config.$schema = "https://opencode.ai/config.json";
      setEntry(config, "mcp", SERVER_NAME, {
        type: "local",
        command: [launch.command, ...launch.args],
        enabled: true,
      });
    });
    return describe(result, path);
  },
};

export const CLIENTS: Client[] = [
  claudeCode,
  mcpServersClient("claude-desktop", "Claude Desktop", claudeDesktopPath),
  mcpServersClient("cursor", "Cursor", (env) => join(env.home, ".cursor", "mcp.json")),
  vscode,
  mcpServersClient("windsurf", "Windsurf", (env) => join(env.home, ".codeium", "windsurf", "mcp_config.json")),
  mcpServersClient("gemini", "Gemini CLI", (env) => join(env.home, ".gemini", "settings.json")),
  codex,
  opencode,
];

export async function detectClients(env: SetupEnv, clients: Client[] = CLIENTS): Promise<Client[]> {
  const found = await Promise.all(clients.map(async (client) => ((await client.detect(env)) ? client : null)));
  return found.filter((client): client is Client => client !== null);
}
