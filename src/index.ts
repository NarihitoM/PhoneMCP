#!/usr/bin/env node
import { PACKAGE_NAME, packageVersion } from "./lib/package.js";

const HELP = `${PACKAGE_NAME} ${packageVersion()}

Control an Android phone from AI tools (Claude, Cursor, Codex, Gemini, OpenCode...).

Usage:
  phone-mcp setup     Install adb, add the phone server to your AI tools, pair your phone
  phone-mcp pair      Pair a phone over Wi-Fi (asks for IP address & port and pairing code)
  phone-mcp           Start the MCP server (your AI tool runs this)

Setup options:
  --yes               Add to every AI tool found, without asking
  --clients a,b       Only these tools: claude-code, claude-desktop, cursor, vscode,
                      windsurf, gemini, codex, opencode
  --address ip:port   Pairing IP address & port from the phone
  --code 123456       Pairing code from the phone
  --no-pair           Skip pairing

Run with npx without installing:  npx ${PACKAGE_NAME} setup`;

const [command] = process.argv.slice(2);

if (command === "setup") {
  const { runSetupCommand } = await import("./cli/setup.js");
  await runSetupCommand(process.argv.slice(3));
} else if (command === "pair") {
  const { runPairCommand } = await import("./cli/pair.js");
  await runPairCommand(process.argv.slice(3));
} else if (command === "--help" || command === "-h" || command === "help") {
  console.log(HELP);
} else if (command === "--version" || command === "-v") {
  console.log(packageVersion());
} else if (command) {
  console.error(`Unknown command: ${command}\n\n${HELP}`);
  process.exitCode = 1;
} else {
  const { startServer } = await import("./server.js");
  await startServer();
}
