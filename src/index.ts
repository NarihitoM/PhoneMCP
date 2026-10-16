#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAppTools } from "./tools/apps.js";
import { registerDeviceTools } from "./tools/device.js";
import { registerInputTools } from "./tools/input.js";
import { registerScreenTools } from "./tools/screen.js";

const server = new McpServer(
  { name: "phone-control", version: "1.0.0" },
  {
    instructions:
      "Controls an Android phone over ADB. Typical loop: get_ui to read the screen, tap_element / type_text / swipe / press_key to act, wait briefly, then get_ui again to confirm. Use screenshot only when get_ui has no useful elements. If no phone is connected, try connect_wifi.",
  },
);

registerDeviceTools(server);
registerScreenTools(server);
registerInputTools(server);
registerAppTools(server);

await server.connect(new StdioServerTransport());
