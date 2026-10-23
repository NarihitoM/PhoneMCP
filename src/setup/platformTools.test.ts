import assert from "node:assert/strict";
import { test } from "node:test";
import { findPlatformToolsArchive, hostOs } from "./platformTools.js";

function archive(os: string, file: string, sha1: string, size: number): string {
  return `<archive><complete><size>${size}</size><checksum type="sha1">${sha1}</checksum><url>${file}</url></complete><host-os>${os}</host-os></archive>`;
}

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

const INDEX = `
<sdk:repository>
  <remotePackage path="platform-tools"><channelRef ref="channel-2"/><archives>
    ${archive("windows", "platform-tools_r99.0.0-preview-win.zip", SHA_B, 1)}
  </archives></remotePackage>
  <remotePackage path="platform-tools"><channelRef ref="channel-0"/><archives>
    ${archive("linux", "platform-tools_r37.0.1-linux.zip", SHA_A, 9054187)}
    ${archive("windows", "platform-tools_r37.0.1-win.zip", SHA_B, 8044989)}
  </archives></remotePackage>
  <remotePackage path="build-tools;36.0.0"><channelRef ref="channel-0"/><archives>
    ${archive("windows", "build-tools-win.zip", SHA_A, 5)}
  </archives></remotePackage>
</sdk:repository>`;

test("findPlatformToolsArchive picks the stable build for the host OS", () => {
  assert.deepEqual(findPlatformToolsArchive(INDEX, "windows"), {
    file: "platform-tools_r37.0.1-win.zip",
    sha1: SHA_B,
    size: 8044989,
  });
  assert.equal(findPlatformToolsArchive(INDEX, "linux")?.file, "platform-tools_r37.0.1-linux.zip");
  assert.equal(findPlatformToolsArchive(INDEX, "macosx"), null);
});

test("findPlatformToolsArchive rejects unsafe file names", () => {
  const evil = INDEX.replace("platform-tools_r37.0.1-win.zip", "../../evil.zip");

  assert.equal(findPlatformToolsArchive(evil, "windows"), null);
});

test("hostOs maps Node platforms to SDK host names", () => {
  assert.equal(hostOs("win32"), "windows");
  assert.equal(hostOs("darwin"), "macosx");
  assert.equal(hostOs("linux"), "linux");
  assert.equal(hostOs("aix"), null);
});
