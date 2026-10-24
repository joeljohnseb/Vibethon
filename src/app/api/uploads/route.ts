import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { chargerPhotos } from "@/lib/db/schema";
import { MAX_UPLOAD_BYTES, photoUrl, storeImage, UploadError } from "@/lib/storage";
import { rateLimit } from "@/lib/ratelimit";
import { AppError } from "@/lib/errors";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.suspendedAt) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  // Same-origin only (defence in depth on top of SameSite cookies).
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  try {
    rateLimit(`upload:${user.id}`, 40, 3600_000);
    const len = Number(req.headers.get("content-length") || 0);
    if (len > MAX_UPLOAD_BYTES + 64_000) throw new UploadError("Images must be 6 MB or smaller");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new UploadError("No file received");
    const stored = await storeImage(Buffer.from(await file.arrayBuffer()));
    const [row] = await db
      .insert(chargerPhotos)
      .values({ uploadedBy: user.id, storageKey: stored.key, contentType: stored.contentType, width: stored.width, height: stored.height })
      .returning({ id: chargerPhotos.id });
    return NextResponse.json({ id: row.id, url: photoUrl(stored.key) });
  } catch (e) {
    if (e instanceof UploadError || e instanceof AppError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[eber:upload]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
