import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateSync, inflateSync } from "node:zlib";
import { decodePng, encodePng, fitWithin, resize } from "./png.js";

function chunk(type: string, body: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  return Buffer.concat([length, Buffer.from(type, "ascii"), body, Buffer.alloc(4)]);
}

function rgbaPng(width: number, height: number, filteredRows: number[][]): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.from(filteredRows.flat()))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

test("decodePng reads RGBA and drops alpha", () => {
  const png = rgbaPng(2, 1, [[0, 10, 20, 30, 255, 40, 50, 60, 128]]);

  assert.deepEqual(decodePng(png), { width: 2, height: 1, pixels: Buffer.from([10, 20, 30, 40, 50, 60]) });
});

test("decodePng reverses Sub, Up, Average and Paeth filters", () => {
  const png = rgbaPng(2, 4, [
    [1, 10, 10, 10, 255, 5, 5, 5, 0],
    [2, 1, 1, 1, 0, 1, 1, 1, 0],
    [3, 4, 4, 4, 0, 3, 3, 3, 0],
    [4, 1, 1, 1, 0, 1, 1, 1, 0],
  ]);

  assert.deepEqual(
    [...(decodePng(png)?.pixels ?? [])],
    [10, 10, 10, 15, 15, 15, 11, 11, 11, 16, 16, 16, 9, 9, 9, 15, 15, 15, 10, 10, 10, 16, 16, 16],
  );
});

test("decodePng round-trips encodePng output", () => {
  const image = { width: 3, height: 2, pixels: Buffer.from([...Array(18).keys()].map((n) => n * 13)) };

  assert.deepEqual(decodePng(encodePng(image)), image);
});

test("decodePng rejects non-PNG data", () => {
  assert.equal(decodePng(Buffer.from("not a png at all, just some text here")), null);
});

function solid(width: number, height: number, value: number) {
  return { width, height, pixels: Buffer.alloc(width * height * 3, value) };
}

test("resize averages blocks", () => {
  const image = { width: 2, height: 2, pixels: Buffer.from([0, 0, 0, 100, 100, 100, 200, 200, 200, 100, 100, 100]) };
  const scaled = resize(image, 1, 1);

  assert.equal(scaled.width, 1);
  assert.equal(scaled.height, 1);
  assert.deepEqual([...scaled.pixels], [100, 100, 100]);
});

test("resize handles non-integer scale factors", () => {
  const scaled = resize(solid(10, 7, 50), 4, 3);

  assert.equal(scaled.pixels.length, 4 * 3 * 3);
  assert.ok(scaled.pixels.every((value) => value === 50));
});

test("fitWithin keeps aspect ratio and never upscales", () => {
  const portrait = fitWithin(solid(1080, 2408, 0), 1024);
  assert.equal(portrait.height, 1024);
  assert.equal(portrait.width, 459);

  const small = fitWithin(solid(300, 600, 0), 1024);
  assert.equal(small.width, 300);
  assert.equal(small.height, 600);
});

test("encodePng writes a valid header and recoverable pixel rows", () => {
  const image = { width: 2, height: 2, pixels: Buffer.from([1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16]) };
  const png = encodePng(image);

  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.toString("ascii", 12, 16), "IHDR");
  assert.equal(png.readUInt32BE(16), 2);
  assert.equal(png.readUInt32BE(20), 2);

  const idatLength = png.readUInt32BE(33);
  const rows = inflateSync(png.subarray(41, 41 + idatLength));
  assert.deepEqual([...rows], [2, 1, 2, 3, 4, 5, 6, 2, 10, 10, 10, 10, 10, 10]);
});
