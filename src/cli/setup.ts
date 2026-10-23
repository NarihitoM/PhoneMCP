import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { adbVersion, LOCAL_PLATFORM_TOOLS } from "../lib/adb.js";
import { PACKAGE_NAME, packageVersion } from "../lib/package.js";
import { connectedSummary } from "../services/device.js";
import { type Client, CLIENTS, currentEnv, detectClients, SERVER_NAME } from "../setup/clients.js";
import { type ServerLaunch, serverLaunch } from "../setup/launch.js";
import { installPlatformTools } from "../setup/platformTools.js";
import { PAIRING_STEPS, runPair } from "./pair.js";
import { Prompt } from "./prompt.js";

interface SetupOptions {
  yes: boolean;
  clients?: string;
  address?: string;
  code?: string;
  pair: boolean;
}

function parseOptions(argv: string[]): SetupOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      yes: { type: "boolean", short: "y", default: false },
      clients: { type: "string" },
      address: { type: "string" },
      code: { type: "string" },
      "no-pair": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });
  return {
    yes: values.yes,
    clients: values.clients,
    address: values.address,
    code: values.code,
    pair: !values["no-pair"],
  };
}

function heading(step: string, title: string): void {
  console.log(`\n[${step}] ${title}`);
}

async function ensureAdb(): Promise<void> {
  heading("1/3", "Android platform-tools (adb)");
  const existing = await adbVersion();
  if (existing) {
    console.log(`  Found adb (${existing})`);
    return;
  }

  console.log("  adb not found. Downloading Android platform-tools from Google...");
  await installPlatformTools();
  const installed = await adbVersion();
  if (!installed) throw new Error(`adb was downloaded to ${LOCAL_PLATFORM_TOOLS} but does not run.`);
  console.log(`  Installed adb (${installed}) to ${LOCAL_PLATFORM_TOOLS}`);
}

function requestedClients(list: string | undefined): Client[] {
  if (!list) return CLIENTS;
  const ids = list.split(",").map((id) => id.trim().toLowerCase()).filter(Boolean);
  const unknown = ids.filter((id) => !CLIENTS.some((client) => client.id === id));
  if (unknown.length > 0) {
    throw new Error(`Unknown --clients: ${unknown.join(", ")}. Use: ${CLIENTS.map((client) => client.id).join(", ")}`);
  }
  return CLIENTS.filter((client) => ids.includes(client.id));
}

function manualConfig(launch: ServerLaunch): string {
  return JSON.stringify({ mcpServers: { [SERVER_NAME]: { command: launch.command, args: launch.args } } }, null, 2);
}

async function chooseClients(prompt: Prompt, found: Client[], options: SetupOptions): Promise<Client[]> {
  if (options.yes || options.clients) return found;
  if (await prompt.confirm(`  Add the phone server to all of these?`)) return found;

  const chosen: Client[] = [];
  for (const client of found) {
    if (await prompt.confirm(`  Add to ${client.name}?`, false)) chosen.push(client);
  }
  return chosen;
}

async function configureClients(prompt: Prompt, options: SetupOptions): Promise<void> {
  heading("2/3", "Add the phone server to your AI tools");
  const env = currentEnv();
  const scriptPath = fileURLToPath(new URL("../index.js", import.meta.url));
  const launch = serverLaunch(scriptPath, process.execPath, env.platform, packageVersion());

  const found = await detectClients(env, requestedClients(options.clients));
  if (found.length === 0) {
    console.log("  No supported AI tools found. Add this to your MCP client config:\n");
    console.log(manualConfig(launch));
    return;
  }

  console.log(`  Found: ${found.map((client) => client.name).join(", ")}`);
  const chosen = await chooseClients(prompt, found, options);

  for (const client of chosen) {
    try {
      console.log(`  [ok]   ${client.name}: ${await client.install(launch, env)}`);
    } catch (error) {
      console.log(`  [fail] ${client.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const client of found.filter((client) => !chosen.includes(client))) {
    console.log(`  [skip] ${client.name}`);
  }
}

async function pairPhone(prompt: Prompt, options: SetupOptions): Promise<void> {
  heading("3/3", "Pair your phone");
  if (!options.pair) {
    console.log("  Skipped. Run `phone-mcp pair` later.");
    return;
  }

  const summary = await connectedSummary().catch(() => "");
  if (summary.startsWith("Ready") && !options.address) {
    console.log(`  ${summary}`);
    const pairAnother = options.yes ? false : await prompt.confirm("  Pair another phone?", false);
    if (!pairAnother) return;
  }

  console.log(`\n${PAIRING_STEPS}\n`);
  await runPair(prompt, { address: options.address, code: options.code });
}

export async function runSetupCommand(argv: string[]): Promise<void> {
  const options = parseOptions(argv);
  const prompt = new Prompt();

  try {
    console.log(`Phone MCP setup (${PACKAGE_NAME} ${packageVersion()})`);
    await ensureAdb();
    await configureClients(prompt, options);
    await pairPhone(prompt, options);

    console.log("\nAll set. Restart your AI tool (or open a new chat) so it loads the phone tools.");
    console.log('Then try: "what\'s on my phone screen?"');
  } catch (error) {
    console.error(`\nSetup stopped: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    prompt.close();
  }
}
