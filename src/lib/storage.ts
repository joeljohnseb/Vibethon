/**
 * Image storage. Uploads are validated by magic bytes, decoded and re-encoded
 * with sharp (which strips EXIF — including GPS coordinates — and neutralises
 * malformed/polyglot files), resized, and written under STORAGE_DIR with a
 * random key. When BLOB_READ_WRITE_TOKEN is set (Vercel), images go to Vercel
 * Blob instead and the stored key is the public blob URL.
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const KEY_RE = /^[0-9a-f-]{36}\.webp$/;

function storageDir() {
  return path.resolve(process.env.STORAGE_DIR || "./.data/uploads");
}

function sniff(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

export class UploadError extends Error {}

export async function storeImage(buf: Buffer) {
  if (buf.length > MAX_UPLOAD_BYTES) throw new UploadError("Images must be 6 MB or smaller");
  if (!sniff(buf)) throw new UploadError("Only JPEG, PNG or WebP images are allowed");
  const sharp = (await import("sharp")).default;
  let out: { data: Buffer; info: { width: number; height: number } };
  try {
    out = await sharp(buf, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new UploadError("That image couldn't be read");
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`chargers/${randomUUID()}.webp`, out.data, { access: "public", contentType: "image/webp" });
    return { key: blob.url, contentType: "image/webp", width: out.info.width, height: out.info.height };
  }
  const key = `${randomUUID()}.webp`;
  await mkdir(storageDir(), { recursive: true });
  await writeFile(path.join(storageDir(), key), out.data);
  return { key, contentType: "image/webp", width: out.info.width, height: out.info.height };
}

export async function readStoredFile(key: string): Promise<Buffer | null> {
  if (!KEY_RE.test(key)) return null;
  try {
    return await readFile(path.join(storageDir(), key));
  } catch {
    return null;
  }
}

export async function deleteStoredFile(key: string) {
  if (key.startsWith("https://") && process.env.BLOB_READ_WRITE_TOKEN) {
    const { del } = await import("@vercel/blob");
    await del(key).catch(() => {});
    return;
  }
  if (!KEY_RE.test(key)) return;
  await unlink(path.join(storageDir(), key)).catch(() => {});
}

export const photoUrl = (key: string) => (key.startsWith("https://") ? key : `/api/files/${key}`);
