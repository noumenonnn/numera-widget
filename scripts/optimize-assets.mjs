// Recompress PNG IDAT streams without changing any decoded image bytes or metadata.
import { readFile, writeFile } from "node:fs/promises";
import { deflateSync, inflateSync, crc32 } from "node:zlib";
import assert from "node:assert/strict";
for (const path of ["assets/source/wheel.png", "public/icons/numera.png"]) {
  const source = await readFile(path);
  const chunks = [];
  for (let offset = 8; offset < source.length;) {
    const size = source.readUInt32BE(offset);
    chunks.push(source.subarray(offset, offset + 12 + size));
    offset += 12 + size;
  }
  const type = (chunk) => chunk.toString("ascii", 4, 8);
  const image = inflateSync(
    Buffer.concat(
      chunks
        .filter((chunk) => type(chunk) === "IDAT")
        .map((chunk) => chunk.subarray(8, -4)),
    ),
  );
  const compressed = deflateSync(image, { level: 9 });
  assert.deepEqual(inflateSync(compressed), image);
  const idat = Buffer.alloc(compressed.length + 12);
  idat.writeUInt32BE(compressed.length);
  idat.write("IDAT", 4, "ascii");
  compressed.copy(idat, 8);
  idat.writeUInt32BE(crc32(idat.subarray(4, -4)), idat.length - 4);
  let replaced = false;
  const result = Buffer.concat([
    source.subarray(0, 8),
    ...chunks.flatMap((chunk) => {
      if (type(chunk) !== "IDAT") return [chunk];
      if (replaced) return [];
      replaced = true;
      return [idat];
    }),
  ]);
  if (result.length < source.length) await writeFile(path, result);
  console.log(
    `${path}: ${source.length} → ${Math.min(result.length, source.length)} bytes; decoded bytes identical`,
  );
}
