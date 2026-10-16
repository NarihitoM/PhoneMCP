import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export const serialParam = z
  .string()
  .optional()
  .describe("Device serial from list_devices. Only needed when more than one phone is connected.");

export async function respond(action: () => Promise<CallToolResult | string>): Promise<CallToolResult> {
  try {
    const result = await action();
    return typeof result === "string" ? { content: [{ type: "text", text: result }] } : result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: message }], isError: true };
  }
}
