import assert from "node:assert/strict";
import { test } from "node:test";
import { isTemporaryInstall, serverLaunch } from "./launch.js";

test("an installed copy is launched with node and its absolute path", () => {
  const script = "C:\\Users\\alex\\AppData\\Roaming\\npm\\node_modules\\phone-mcp-by-narihito\\dist\\index.js";

  assert.deepEqual(serverLaunch(script, "C:\\node\\node.exe", "win32", "1.0.0"), {
    command: "C:\\node\\node.exe",
    args: [script],
  });
});

test("an npx copy is launched through npx with the version pinned", () => {
  const script = "/home/alex/.npm/_npx/abc123/node_modules/phone-mcp-by-narihito/dist/index.js";

  assert.equal(isTemporaryInstall(script), true);
  assert.deepEqual(serverLaunch(script, "/usr/bin/node", "linux", "1.2.3"), {
    command: "npx",
    args: ["-y", "phone-mcp-by-narihito@1.2.3"],
  });
  assert.deepEqual(serverLaunch(script.replace(/\//g, "\\"), "node.exe", "win32", "1.2.3"), {
    command: "cmd",
    args: ["/c", "npx", "-y", "phone-mcp-by-narihito@1.2.3"],
  });
});
