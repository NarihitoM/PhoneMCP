import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AdbError, shell } from "../lib/adb.js";
import { respond, serialParam } from "../lib/tool.js";
import { encodeInputText, isTypeableText } from "../services/text.js";
import { findElement } from "../services/ui.js";

const KEYCODES = {
  home: 3,
  back: 4,
  enter: 66,
  delete: 67,
  tab: 61,
  space: 62,
  recents: 187,
  power: 26,
  volume_up: 24,
  volume_down: 25,
  menu: 82,
} as const;

type KeyName = keyof typeof KEYCODES;

const KEY_NAMES = Object.keys(KEYCODES) as [KeyName, ...KeyName[]];

const coordinate = z.number().int().min(0).max(20_000);

export function registerInputTools(server: McpServer): void {
  server.registerTool(
    "tap",
    {
      title: "Tap",
      description: "Tap the screen at x,y pixels.",
      inputSchema: { x: coordinate, y: coordinate, serial: serialParam },
    },
    ({ x, y, serial }) =>
      respond(async () => {
        await shell(`input tap ${x} ${y}`, { serial });
        return `Tapped (${x},${y})`;
      }),
  );

  server.registerTool(
    "tap_element",
    {
      title: "Tap element",
      description: "Tap an element by its index from the last get_ui call. Set long to long-press.",
      inputSchema: {
        index: z.number().int().min(0).max(10_000),
        long: z.boolean().default(false),
        serial: serialParam,
      },
    },
    ({ index, long, serial }) =>
      respond(async () => {
        const element = findElement(index, serial);
        const { x, y } = element.center;
        const command = long ? `input swipe ${x} ${y} ${x} ${y} 800` : `input tap ${x} ${y}`;
        await shell(command, { serial });
        const label = element.text || element.description || element.resourceId || element.className;
        return `${long ? "Long-pressed" : "Tapped"} [${index}] ${label} at (${x},${y})`;
      }),
  );

  server.registerTool(
    "swipe",
    {
      title: "Swipe",
      description:
        "Swipe from (x1,y1) to (x2,y2). To scroll down the page, swipe upward (y1 > y2).",
      inputSchema: {
        x1: coordinate,
        y1: coordinate,
        x2: coordinate,
        y2: coordinate,
        durationMs: z.number().int().min(50).max(5000).default(300),
        serial: serialParam,
      },
    },
    ({ x1, y1, x2, y2, durationMs, serial }) =>
      respond(async () => {
        await shell(`input swipe ${x1} ${y1} ${x2} ${y2} ${durationMs}`, { serial });
        return `Swiped (${x1},${y1}) -> (${x2},${y2})`;
      }),
  );

  server.registerTool(
    "type_text",
    {
      title: "Type text",
      description:
        "Type text into the focused field (tap the field first). ASCII only. Use press_key enter to submit.",
      inputSchema: { text: z.string().min(1).max(1000), serial: serialParam },
    },
    ({ text, serial }) =>
      respond(async () => {
        if (!isTypeableText(text)) {
          throw new AdbError("type_text supports printable ASCII only (no emoji or non-Latin letters).");
        }
        await shell(`input text ${encodeInputText(text)}`, { serial });
        return `Typed ${text.length} characters`;
      }),
  );

  server.registerTool(
    "press_key",
    {
      title: "Press key",
      description: "Press a hardware or system key.",
      inputSchema: { key: z.enum(KEY_NAMES), serial: serialParam },
    },
    ({ key, serial }) =>
      respond(async () => {
        await shell(`input keyevent ${KEYCODES[key]}`, { serial });
        return `Pressed ${key}`;
      }),
  );
}
