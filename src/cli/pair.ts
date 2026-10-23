import { parseArgs } from "node:util";
import {
  ADDRESS_HINT,
  connectedSummary,
  connectPaired,
  isValidAddress,
  isValidPairingCode,
  pair,
  PAIRING_CODE_HINT,
} from "../services/device.js";
import { Prompt } from "./prompt.js";

export interface PairOptions {
  address?: string;
  code?: string;
}

export const PAIRING_STEPS = [
  "1. Connect the phone and this computer to the same Wi-Fi.",
  "2. On the phone: Settings > Developer options > Wireless debugging (turn it on).",
  "   No Developer options? Settings > About phone > tap Build number 7 times.",
  "3. Tap 'Pair device with pairing code' and keep the popup open.",
].join("\n");

export async function runPair(prompt: Prompt, options: PairOptions = {}): Promise<boolean> {
  const address =
    options.address && isValidAddress(options.address)
      ? options.address
      : await prompt.ask("IP address & port: ", isValidAddress, ADDRESS_HINT);
  const code =
    options.code && isValidPairingCode(options.code)
      ? options.code
      : await prompt.ask("Wi-Fi pairing code: ", isValidPairingCode, PAIRING_CODE_HINT);

  console.log("\nPairing...");
  const paired = await pair(address, code);
  console.log(paired);

  console.log("Connecting...");
  console.log(await connectPaired(address, paired));

  const summary = await connectedSummary();
  console.log(summary);
  return summary.startsWith("Ready");
}

export async function runPairCommand(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { address: { type: "string" }, code: { type: "string" } },
    allowPositionals: false,
  });

  const prompt = new Prompt();
  try {
    console.log(`Pair your phone over Wi-Fi\n\n${PAIRING_STEPS}\n`);
    await runPair(prompt, values);
    console.log('\nDone. Ask your AI assistant to control the phone, e.g. "open Settings".');
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    prompt.close();
  }
}
