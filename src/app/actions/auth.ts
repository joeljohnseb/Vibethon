"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { act, str, type ActionState } from "@/lib/action";
import { createSession, destroySession, requireUser, safeNext } from "@/lib/auth/session";
import * as users from "@/lib/services/users";

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let userId = "";
  const res = await act(async () => {
    if (str(fd, "terms") !== "on") throw new (await import("@/lib/errors")).AppError("VALIDATION", "Please accept the terms to continue", { terms: "Required" });
    userId = await users.registerWithEmail({ name: str(fd, "name"), email: str(fd, "email"), password: str(fd, "password") });
    if (str(fd, "role") === "giver") await users.setActiveRole(userId, "giver");
    await createSession(userId);
  });
  if (!res.ok) return res;
  redirect(safeNext(str(fd, "next"), str(fd, "role") === "giver" ? "/host?welcome=1" : "/profile?welcome=1"));
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await act(async () => {
    const userId = await users.loginWithEmail(str(fd, "email"), str(fd, "password"), await ip());
    await createSession(userId);
  });
  if (!res.ok) return res;
  redirect(safeNext(str(fd, "next"), "/"));
}

export async function phoneLoginRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act(async () => {
    const r = await users.requestPhoneLogin(str(fd, "phone"));
    return { message: `We sent a 6-digit code to ${r.phone}.`, data: { phone: r.phone, sandboxCode: r.sandboxCode ?? null } };
  });
}

export async function phoneLoginConfirmAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await act(async () => {
    const userId = await users.confirmPhoneLogin(str(fd, "phone"), str(fd, "code"));
    await createSession(userId);
  });
  if (!res.ok) return res;
  redirect(safeNext(str(fd, "next"), "/"));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function switchRoleAction(fd: FormData) {
  const u = await requireUser();
  const role = str(fd, "role") === "giver" ? "giver" : "taker";
  await users.setActiveRole(u.id, role);
  redirect(role === "giver" ? "/host" : "/chargers");
}
