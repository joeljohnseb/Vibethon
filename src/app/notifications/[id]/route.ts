import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getCurrentUser, safeNext } from "@/lib/auth/session";

/** Open a notification: mark it read and go to its link. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.redirect(new URL("/notifications", req.url));
  const [n] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
    .returning({ link: notifications.link });
  return NextResponse.redirect(new URL(safeNext(n?.link, "/notifications"), req.url));
}
