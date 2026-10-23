import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { packageVersion } from "./lib/package.js";
import { registerAppTools } from "./tools/apps.js";
import { registerDeviceTools } from "./tools/device.js";
import { registerInputTools } from "./tools/input.js";
import { registerScreenTools } from "./tools/screen.js";

const INSTRUCTIONS =
  "Controls an Android phone over ADB. Typical loop: get_ui to read the screen, tap_element / type_text / swipe / press_key to act, wait briefly, then get_ui again to confirm. Use screenshot only when get_ui has no useful elements. If no phone is connected, try connect_wifi.";

export function createServer(): McpServer {
  const server = new McpServer({ name: "phone-control", version: packageVersion() }, { instructions: INSTRUCTIONS });

  registerDeviceTools(server);
  registerScreenTools(server);
  registerInputTools(server);
  registerAppTools(server);

  return server;
}

export async function startServer(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}
