#!/usr/bin/env node
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import {
  ADDRESS_HINT,
  connectedSummary,
  connectPaired,
  isValidAddress,
  isValidPairingCode,
  pair,
  PAIRING_CODE_HINT,
} from "../services/device.js";

const prompt = createInterface({ input, output, terminal: Boolean(input.isTTY) });
const lines = prompt[Symbol.asyncIterator]();

async function ask(question: string, isValid: (value: string) => boolean, hint: string): Promise<string> {
  for (;;) {
    output.write(question);
    const line = await lines.next();
    if (line.done) throw new Error("Input closed before the pairing details were entered.");

    const answer = String(line.value).trim();
    if (!input.isTTY) output.write(`${answer}\n`);
    if (isValid(answer)) return answer;
    console.log(`  ${hint}`);
  }
}

async function main(): Promise<void> {
  console.log("Pair your phone over Wi-Fi\n");
  console.log("1. Connect the phone and this computer to the same Wi-Fi.");
  console.log("2. On the phone: Settings > Developer options > Wireless debugging (turn it on).");
  console.log("3. Tap 'Pair device with pairing code' and keep the popup open.\n");

  const address = await ask("IP address & port: ", isValidAddress, ADDRESS_HINT);
  const code = await ask("Wi-Fi pairing code: ", isValidPairingCode, PAIRING_CODE_HINT);

  console.log("\nPairing...");
  const paired = await pair(address, code);
  console.log(paired);

  console.log("Connecting...");
  console.log(await connectPaired(address, paired));

  console.log(await connectedSummary());
  console.log("\nDone. Ask your AI assistant to control the phone, e.g. \"open Settings\".");
}

try {
  await main();
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  prompt.close();
}
