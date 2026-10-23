import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CLIENTS, detectClients, type SetupEnv } from "./clients.js";

const LAUNCH = { command: "node", args: ["/opt/phone-mcp/dist/index.js"] };

async function withHome(run: (env: SetupEnv) => Promise<void>): Promise<void> {
  const home = await mkdtemp(join(tmpdir(), "phone-mcp-home-"));
  const env: SetupEnv = {
    platform: "linux",
    home,
    appData: join(home, "AppData", "Roaming"),
    configHome: join(home, ".config"),
    codexHome: join(home, ".codex"),
  };
  try {
    await run(env);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

const fileClients = CLIENTS.filter((client) => client.id !== "claude-code");

function client(id: string) {
  const found = CLIENTS.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing client ${id}`);
  return found;
}

test("detectClients only finds tools whose config folder exists", async () => {
  await withHome(async (env) => {
    assert.deepEqual(await detectClients(env, fileClients), []);

    await mkdir(join(env.home, ".cursor"));
    await mkdir(join(env.home, ".gemini"));
    const found = await detectClients(env, fileClients);
    assert.deepEqual(found.map((entry) => entry.id).sort(), ["cursor", "gemini"]);
  });
});

test("mcpServers clients add the phone server and keep existing ones", async () => {
  await withHome(async (env) => {
    const path = join(env.home, ".cursor", "mcp.json");
    await mkdir(join(env.home, ".cursor"));
    await writeFile(path, JSON.stringify({ mcpServers: { github: { command: "gh" } } }));

    await client("cursor").install(LAUNCH, env);

    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), {
      mcpServers: { github: { command: "gh" }, phone: LAUNCH },
    });
  });
});

test("VS Code uses the servers key with a stdio type", async () => {
  await withHome(async (env) => {
    await client("vscode").install(LAUNCH, env);
    const config = JSON.parse(await readFile(join(env.configHome, "Code", "User", "mcp.json"), "utf8"));

    assert.deepEqual(config, { servers: { phone: { type: "stdio", ...LAUNCH } } });
  });
});

test("OpenCode uses a local command array", async () => {
  await withHome(async (env) => {
    await client("opencode").install(LAUNCH, env);
    const config = JSON.parse(await readFile(join(env.configHome, "opencode", "opencode.json"), "utf8"));

    assert.deepEqual(config.mcp.phone, { type: "local", command: ["node", "/opt/phone-mcp/dist/index.js"], enabled: true });
  });
});

test("Codex writes a TOML table and is safe to run twice", async () => {
  await withHome(async (env) => {
    await mkdir(env.codexHome);
    await writeFile(join(env.codexHome, "config.toml"), 'model = "o3"\n');

    await client("codex").install(LAUNCH, env);
    await client("codex").install(LAUNCH, env);
    const toml = await readFile(join(env.codexHome, "config.toml"), "utf8");

    assert.equal(toml, 'model = "o3"\n\n[mcp_servers.phone]\ncommand = "node"\nargs = ["/opt/phone-mcp/dist/index.js"]\n');
  });
});

test("a config with comments is left untouched", async () => {
  await withHome(async (env) => {
    const path = join(env.home, ".gemini", "settings.json");
    await mkdir(join(env.home, ".gemini"));
    await writeFile(path, '{ // my settings\n "theme": "dark" }');

    await assert.rejects(client("gemini").install(LAUNCH, env), /could not read/);
    assert.equal(await readFile(path, "utf8"), '{ // my settings\n "theme": "dark" }');
  });
});
