import { deflateSync, inflateSync } from "node:zlib";

export interface RgbImage {
  width: number;
  height: number;
  pixels: Buffer;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CHANNELS_BY_COLOR_TYPE: Record<number, number> = { 2: 3, 6: 4 };

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function encodePng({ width, height, pixels }: RgbImage): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;

  const stride = width * 3;
  const filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    filtered[row] = 2;
    for (let x = 0; x < stride; x++) {
      const current = pixels[y * stride + x] ?? 0;
      const above = y > 0 ? (pixels[(y - 1) * stride + x] ?? 0) : 0;
      filtered[row + 1 + x] = (current - above) & 0xff;
    }
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(filtered, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

function unfilter(data: Buffer, width: number, height: number, channels: number): Buffer | null {
  const stride = width * channels;
  if (data.length < (stride + 1) * height) return null;

  const output = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = data[y * (stride + 1)];
    const source = y * (stride + 1) + 1;
    const row = y * stride;
    const previous = row - stride;

    for (let x = 0; x < stride; x++) {
      const raw = data[source + x] ?? 0;
      const left = x >= channels ? (output[row + x - channels] ?? 0) : 0;
      const up = y > 0 ? (output[previous + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= channels ? (output[previous + x - channels] ?? 0) : 0;

      let predicted: number;
      switch (filter) {
        case 0: predicted = 0; break;
        case 1: predicted = left; break;
        case 2: predicted = up; break;
        case 3: predicted = (left + up) >> 1; break;
        case 4: predicted = paeth(left, up, upLeft); break;
        default: return null;
      }
      output[row + x] = (raw + predicted) & 0xff;
    }
  }
  return output;
}

export function decodePng(png: Buffer): RgbImage | null {
  if (png.length < 33 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) return null;

  let width = 0;
  let height = 0;
  let channels = 0;
  const data: Buffer[] = [];

  for (let offset = 8; offset + 8 <= png.length; ) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      const [bitDepth, colorType, , , interlace] = body.subarray(8, 13);
      if (bitDepth !== 8 || interlace !== 0) return null;
      const colorChannels = colorType === undefined ? undefined : CHANNELS_BY_COLOR_TYPE[colorType];
      if (!colorChannels) return null;
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = colorChannels;
    } else if (type === "IDAT") {
      data.push(body);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }

  if (width === 0 || height === 0 || data.length === 0) return null;

  const unfiltered = unfilter(inflateSync(Buffer.concat(data)), width, height, channels);
  if (!unfiltered) return null;
  if (channels === 3) return { width, height, pixels: unfiltered };

  const pixels = Buffer.alloc(width * height * 3);
  for (let source = 0, target = 0; target < pixels.length; source += 4, target += 3) {
    pixels[target] = unfiltered[source] ?? 0;
    pixels[target + 1] = unfiltered[source + 1] ?? 0;
    pixels[target + 2] = unfiltered[source + 2] ?? 0;
  }
  return { width, height, pixels };
}

export function resize(image: RgbImage, width: number, height: number): RgbImage {
  if (width >= image.width && height >= image.height) return image;

  const pixels = Buffer.alloc(width * height * 3);
  const scaleX = image.width / width;
  const scaleY = image.height / height;

  for (let y = 0; y < height; y++) {
    const top = Math.floor(y * scaleY);
    const bottom = Math.max(top + 1, Math.floor((y + 1) * scaleY));
    for (let x = 0; x < width; x++) {
      const left = Math.floor(x * scaleX);
      const right = Math.max(left + 1, Math.floor((x + 1) * scaleX));
      const area = (bottom - top) * (right - left);

      for (let channel = 0; channel < 3; channel++) {
        let sum = 0;
        for (let sy = top; sy < bottom; sy++) {
          const rowStart = sy * image.width * 3 + channel;
          for (let sx = left; sx < right; sx++) sum += image.pixels[rowStart + sx * 3] ?? 0;
        }
        pixels[(y * width + x) * 3 + channel] = Math.round(sum / area);
      }
    }
  }

  return { width, height, pixels };
}

export function fitWithin(image: RgbImage, maxSide: number): RgbImage {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  return resize(image, Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
}
