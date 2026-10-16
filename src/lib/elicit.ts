import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface TextField {
  title: string;
  description: string;
}

export function canAskUser(server: McpServer): boolean {
  return Boolean(server.server.getClientCapabilities()?.elicitation);
}

export async function askUser<Key extends string>(
  server: McpServer,
  message: string,
  fields: Record<Key, TextField>,
): Promise<Record<Key, string> | null> {
  const keys = Object.keys(fields) as Key[];
  const properties = Object.fromEntries(
    keys.map((key) => [key, { type: "string" as const, ...fields[key] }]),
  );

  const result = await server.server.elicitInput({
    mode: "form",
    message,
    requestedSchema: { type: "object", properties, required: keys },
  });

  if (result.action !== "accept" || !result.content) return null;

  const answers = {} as Record<Key, string>;
  for (const key of keys) {
    const value = result.content[key];
    answers[key] = typeof value === "string" ? value.trim() : "";
  }
  return answers;
}
