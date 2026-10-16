import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDevices, parseMdnsServices } from "./device.js";

test("parseDevices reads serial, state and model", () => {
  const output = [
    "List of devices attached",
    "R58M123ABC             device usb:1-1 product:a51 model:SM_A515F device:a51 transport_id:1",
    "192.168.1.20:37123     unauthorized transport_id:2",
    "",
  ].join("\r\n");

  assert.deepEqual(parseDevices(output), [
    { serial: "R58M123ABC", state: "device", model: "SM_A515F" },
    { serial: "192.168.1.20:37123", state: "unauthorized" },
  ]);
});

test("parseDevices returns empty list when nothing is attached", () => {
  assert.deepEqual(parseDevices("List of devices attached\n\n"), []);
});

test("parseMdnsServices ignores the header and parses services", () => {
  const output = [
    "List of discovered mdns services",
    "adb-R58M123ABC-xYz\t_adb-tls-connect._tcp\t192.168.1.20:37123",
    "adb-R58M123ABC-xYz\t_adb-tls-pairing._tcp\t192.168.1.20:41234",
  ].join("\n");

  assert.deepEqual(parseMdnsServices(output), [
    { name: "adb-R58M123ABC-xYz", type: "_adb-tls-connect._tcp", address: "192.168.1.20:37123" },
    { name: "adb-R58M123ABC-xYz", type: "_adb-tls-pairing._tcp", address: "192.168.1.20:41234" },
  ]);
});
