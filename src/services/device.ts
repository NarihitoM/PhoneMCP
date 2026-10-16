import { adbGlobal, AdbError, shell } from "../lib/adb.js";
import type { Device, MdnsService } from "../types/index.js";

const CONNECT_SERVICE = "_adb-tls-connect._tcp";
const ADDRESS_PATTERN = /^[\w.-]+:\d{1,5}$/;
const PAIRING_CODE_PATTERN = /^\d{6}$/;

export const ADDRESS_HINT = "Use the form ip:port, e.g. 192.168.1.20:37123";
export const PAIRING_CODE_HINT = "Pairing code is 6 digits";

export function isValidAddress(value: string): boolean {
  return ADDRESS_PATTERN.test(value);
}

export function isValidPairingCode(value: string): boolean {
  return PAIRING_CODE_PATTERN.test(value);
}

export function parseDevices(output: string): Device[] {
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [serial, state, ...details] = line.split(/\s+/);
      if (!serial || !state) return [];
      const model = details.find((detail) => detail.startsWith("model:"))?.slice("model:".length);
      return [{ serial, state, ...(model ? { model } : {}) }];
    });
}

export function parseMdnsServices(output: string): MdnsService[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .flatMap(([name, type, address]) => {
      if (!name || !type || !address || !address.includes(":")) return [];
      return [{ name, type, address }];
    });
}

export async function listDevices(): Promise<Device[]> {
  return parseDevices(await adbGlobal(["devices", "-l"]));
}

export async function discoverPhones(): Promise<MdnsService[]> {
  const services = parseMdnsServices(await adbGlobal(["mdns", "services"]));
  return services.filter((service) => service.type.startsWith(CONNECT_SERVICE));
}

export async function connect(address: string): Promise<string> {
  const output = (await adbGlobal(["connect", address], 15_000)).trim();
  if (!/connected to/i.test(output)) throw new AdbError(output || `Could not connect to ${address}`);
  return output;
}

export async function pair(address: string, code: string): Promise<string> {
  const failed = (detail: string) =>
    new AdbError(
      `Pairing failed (${detail}). Check the IP address & port and code in the phone's pairing popup. The code expires after about a minute, so open the popup again for a new one.`,
    );

  let output: string;
  try {
    output = (await adbGlobal(["pair", address, code], 30_000)).trim();
  } catch (error) {
    if (error instanceof AdbError && /adb was not found/.test(error.message)) throw error;
    throw failed(error instanceof Error ? error.message : String(error));
  }

  if (!/successfully paired/i.test(output)) throw failed(output || "no response");
  return output;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectDiscovered(attempts = 1): Promise<string[]> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const phones = await discoverPhones();
    if (phones.length > 0) {
      return Promise.all(
        phones.map((phone) =>
          connect(phone.address).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            return `${phone.address}: ${message}`;
          }),
        ),
      );
    }
    if (attempt < attempts) await delay(1500);
  }
  return [];
}

export async function connectedSummary(): Promise<string> {
  const ready = (await listDevices()).filter((device) => device.state === "device");
  if (ready.length === 0) return "No phone is connected yet.";
  return `Ready: ${ready.map((device) => device.model ?? device.serial).join(", ")}`;
}

export async function screenSize(serial?: string): Promise<{ width: number; height: number }> {
  const output = await shell("wm size", { serial });
  const sizes = [...output.matchAll(/(\d+)x(\d+)/g)];
  const size = sizes.at(-1);
  if (!size) throw new AdbError(`Could not read screen size: ${output.trim()}`);
  return { width: Number(size[1]), height: Number(size[2]) };
}

export async function deviceInfo(serial?: string): Promise<string> {
  const [model, manufacturer, release, sdk, size] = await Promise.all([
    shell("getprop ro.product.model", { serial }),
    shell("getprop ro.product.manufacturer", { serial }),
    shell("getprop ro.build.version.release", { serial }),
    shell("getprop ro.build.version.sdk", { serial }),
    screenSize(serial),
  ]);

  return [
    `Model: ${manufacturer.trim()} ${model.trim()}`,
    `Android: ${release.trim()} (SDK ${sdk.trim()})`,
    `Screen: ${size.width}x${size.height}`,
  ].join("\n");
}
