import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { processExerciseImage } from "../src/exercise-image.js";

test("exercise image is normalized to a compact webp", async () => {
  const source = await sharp({
    create: {
      width: 1600,
      height: 1200,
      channels: 3,
      background: { r: 20, g: 120, b: 90 },
    },
  })
    .png()
    .toBuffer();
  const result = await processExerciseImage(
    `data:image/png;base64,${source.toString("base64")}`,
  );
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.format, "webp");
  assert.ok((metadata.width ?? 0) <= 900);
  assert.ok((metadata.height ?? 0) <= 700);
  assert.ok(result.length < source.length);
});

test("exercise image rejects unsupported payloads", async () => {
  await assert.rejects(() => processExerciseImage("data:text/plain;base64,SGk="));
});
