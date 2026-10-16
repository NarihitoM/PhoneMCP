import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AdbError } from "../lib/adb.js";
import { askUser, canAskUser } from "../lib/elicit.js";
import { respond, serialParam } from "../lib/tool.js";
import {
  ADDRESS_HINT,
  connect,
  connectDiscovered,
  connectedSummary,
  deviceInfo,
  isValidAddress,
  isValidPairingCode,
  listDevices,
  pair,
  PAIRING_CODE_HINT,
} from "../services/device.js";

const PAIRING_STEPS =
  "On the phone: Settings > Developer options > Wireless debugging > Pair device with pairing code.";

const addressParam = z.string().refine(isValidAddress, ADDRESS_HINT);

async function pairingDetails(
  server: McpServer,
  address?: string,
  code?: string,
): Promise<{ address: string; code: string } | string> {
  if (address && code) return { address, code };

  if (!canAskUser(server)) {
    return `Ask the user for the pairing details, then call pair_wifi again with address and code. ${PAIRING_STEPS} The popup shows "IP address & port" and a 6-digit code.`;
  }

  const answers = await askUser(server, `${PAIRING_STEPS} Enter what the popup shows.`, {
    address: { title: "IP address & port", description: "e.g. 192.168.1.20:41234" },
    code: { title: "Wi-Fi pairing code", description: "6 digits" },
  });
  if (!answers) return "Pairing cancelled.";

  return { address: answers.address, code: answers.code };
}

export function registerDeviceTools(server: McpServer): void {
  server.registerTool(
    "list_devices",
    {
      title: "List devices",
      description: "List phones connected over USB or Wi-Fi with their serial and state.",
      annotations: { readOnlyHint: true },
    },
    () =>
      respond(async () => {
        const devices = await listDevices();
        if (devices.length === 0) return "No phones connected. Use connect_wifi or plug in USB.";
        return devices
          .map((device) => `${device.serial}  ${device.state}${device.model ? `  ${device.model}` : ""}`)
          .join("\n");
      }),
  );

  server.registerTool(
    "device_info",
    {
      title: "Device info",
      description: "Show phone model, Android version and screen size.",
      inputSchema: { serial: serialParam },
      annotations: { readOnlyHint: true },
    },
    ({ serial }) => respond(() => deviceInfo(serial)),
  );

  server.registerTool(
    "pair_wifi",
    {
      title: "Pair over Wi-Fi",
      description:
        "One-time pairing for Wireless debugging, then connects. Call it without arguments to let the user type the IP address & port and 6-digit code from the phone's 'Pair device with pairing code' popup.",
      inputSchema: {
        address: addressParam.optional().describe("Pairing ip:port shown in the pairing popup"),
        code: z.string().refine(isValidPairingCode, PAIRING_CODE_HINT).optional().describe("6-digit pairing code"),
      },
    },
    ({ address, code }) =>
      respond(async () => {
        const details = await pairingDetails(server, address, code);
        if (typeof details === "string") return details;

        if (!isValidAddress(details.address)) throw new AdbError(ADDRESS_HINT);
        if (!isValidPairingCode(details.code)) throw new AdbError(PAIRING_CODE_HINT);

        const paired = await pair(details.address, details.code);
        await connectDiscovered(4);
        return `${paired}\n${await connectedSummary()}`;
      }),
  );

  server.registerTool(
    "connect_wifi",
    {
      title: "Connect over Wi-Fi",
      description:
        "Connect to a paired phone on the same Wi-Fi. Without an address it finds the phone automatically, and asks the user for the address if it cannot.",
      inputSchema: {
        address: addressParam.optional().describe("ip:port from the Wireless debugging screen (not the pairing port)"),
      },
    },
    ({ address }) =>
      respond(async () => {
        if (address) return connect(address);

        const results = await connectDiscovered(2);
        if (results.length > 0) return `${results.join("\n")}\n${await connectedSummary()}`;

        const hint =
          "No phone found on Wi-Fi. Check Wireless debugging is on, both are on the same network, and the phone was paired (pair_wifi).";
        if (!canAskUser(server)) throw new AdbError(hint);

        const answers = await askUser(server, `${hint} Or enter the address from the Wireless debugging screen.`, {
          address: { title: "IP address & port", description: "Shown under Wireless debugging, e.g. 192.168.1.20:37123" },
        });
        if (!answers) return "Connection cancelled.";
        if (!isValidAddress(answers.address)) throw new AdbError(ADDRESS_HINT);

        return `${await connect(answers.address)}\n${await connectedSummary()}`;
      }),
  );

  server.registerTool(
    "wait",
    {
      title: "Wait",
      description: "Wait for the screen to settle, e.g. after opening an app or tapping a button.",
      inputSchema: { ms: z.number().int().min(100).max(10_000).default(1000) },
      annotations: { readOnlyHint: true },
    },
    ({ ms }) =>
      respond(async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return `Waited ${ms}ms`;
      }),
  );
}
