import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { adbBinary, AdbError } from "../lib/adb.js";
import { respond, serialParam } from "../lib/tool.js";
import { decodePng, encodePng, fitWithin } from "../services/png.js";
import { formatElements, readScreen } from "../services/ui.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const DEFAULT_MAX_SIDE = 1280;
const MIN_SIDE = 480;
const MAX_BASE64_LENGTH = 700 * 1024;
const SCREENSHOT_TIMEOUT_MS = 60_000;

async function scaledPng(maxSide: number, serial?: string): Promise<CallToolResult> {
  const png = await adbBinary(["exec-out", "screencap", "-p"], { serial, timeoutMs: SCREENSHOT_TIMEOUT_MS });
  if (!png.subarray(0, 4).equals(PNG_SIGNATURE)) {
    throw new AdbError("Screenshot failed: phone did not return a PNG. Is the screen on and unlocked?");
  }

  const image = decodePng(png);
  if (!image) return { content: [{ type: "image", data: png.toString("base64"), mimeType: "image/png" }] };

  let side = Math.min(maxSide, Math.max(image.width, image.height));
  let scaled = fitWithin(image, side);
  let data = encodePng(scaled).toString("base64");
  while (data.length > MAX_BASE64_LENGTH && side > MIN_SIDE) {
    side = Math.max(MIN_SIDE, Math.round(side * 0.8));
    scaled = fitWithin(image, side);
    data = encodePng(scaled).toString("base64");
  }

  const factor = image.width / scaled.width;
  const note =
    scaled.width === image.width
      ? `Screenshot ${image.width}x${image.height}. Image coordinates match tap/swipe coordinates.`
      : `Screenshot ${scaled.width}x${scaled.height}, scaled from ${image.width}x${image.height}. Multiply image coordinates by ${factor.toFixed(3)} for tap/swipe.`;

  return {
    content: [
      { type: "image", data, mimeType: "image/png" },
      { type: "text", text: note },
    ],
  };
}

export function registerScreenTools(server: McpServer): void {
  server.registerTool(
    "get_ui",
    {
      title: "Read screen",
      description:
        "Read the current screen as a numbered list of elements (text, id, center x,y). Prefer this over screenshot, then use tap_element with the index.",
      inputSchema: { serial: serialParam },
      annotations: { readOnlyHint: true },
    },
    ({ serial }) => respond(async () => formatElements(await readScreen(serial))),
  );

  server.registerTool(
    "screenshot",
    {
      title: "Screenshot",
      description:
        "Take a PNG screenshot, scaled down to keep it small. Use when get_ui returns nothing useful (games, video, custom-drawn apps). The reply says how to convert image coordinates to tap coordinates.",
      inputSchema: {
        maxSide: z
          .number()
          .int()
          .min(320)
          .max(4096)
          .default(DEFAULT_MAX_SIDE)
          .describe("Longest side of the returned image in pixels"),
        serial: serialParam,
      },
      annotations: { readOnlyHint: true },
    },
    ({ maxSide, serial }) => respond(() => scaledPng(maxSide, serial)),
  );
}
