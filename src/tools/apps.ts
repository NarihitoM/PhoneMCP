import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AdbError, shell } from "../lib/adb.js";
import { respond, serialParam } from "../lib/tool.js";
import { shellQuote } from "../services/text.js";

const packageParam = z
  .string()
  .refine((value) => /^[A-Za-z]\w*(\.[A-Za-z_]\w*)+$/.test(value), "Invalid package name, e.g. com.android.settings");

export function registerAppTools(server: McpServer): void {
  server.registerTool(
    "list_apps",
    {
      title: "List apps",
      description: "List installed app package names. Filter by part of the name, e.g. 'whatsapp'.",
      inputSchema: {
        filter: z.string().optional(),
        includeSystem: z.boolean().default(false),
        serial: serialParam,
      },
      annotations: { readOnlyHint: true },
    },
    ({ filter, includeSystem, serial }) =>
      respond(async () => {
        const output = await shell(includeSystem ? "pm list packages" : "pm list packages -3", { serial });
        const needle = filter?.toLowerCase();
        const packages = output
          .split(/\r?\n/)
          .map((line) => line.replace(/^package:/, "").trim())
          .filter((name) => name && (!needle || name.toLowerCase().includes(needle)))
          .sort();
        return packages.length > 0 ? packages.join("\n") : "No matching apps.";
      }),
  );

  server.registerTool(
    "launch_app",
    {
      title: "Launch app",
      description: "Open an app by package name (find it with list_apps).",
      inputSchema: { package: packageParam, serial: serialParam },
    },
    ({ package: packageName, serial }) =>
      respond(async () => {
        const output = await shell(
          `monkey -p ${shellQuote(packageName)} -c android.intent.category.LAUNCHER 1`,
          { serial },
        );
        if (/no activities found|aborted/i.test(output)) {
          throw new AdbError(`Could not launch ${packageName}. Is it installed? Check list_apps.`);
        }
        return `Launched ${packageName}`;
      }),
  );

  server.registerTool(
    "open_url",
    {
      title: "Open URL",
      description: "Open a link on the phone (web page, deep link, tel:, mailto:, geo:).",
      inputSchema: { url: z.string().min(1).max(1000), serial: serialParam },
    },
    ({ url, serial }) =>
      respond(async () => {
        if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) throw new AdbError("URL must include a scheme, e.g. https://");
        const output = await shell(`am start -a android.intent.action.VIEW -d ${shellQuote(url)}`, { serial });
        if (/^Error/m.test(output)) throw new AdbError(output.trim());
        return `Opened ${url}`;
      }),
  );
}
