import sharp from "sharp";

export async function processExerciseImage(value: string) {
  const match =
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error("invalid image");
  const input = Buffer.from(match[2], "base64");
  if (input.length > 8 * 1024 * 1024) throw new Error("image too large");
  return sharp(input, { limitInputPixels: 32_000_000 })
    .rotate()
    .resize(900, 700, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();
}
