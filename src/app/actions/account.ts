"use server";

import { redirect } from "next/navigation";
import { act, str, type ActionState } from "@/lib/action";
import { destroySession, requireUser } from "@/lib/auth/session";
import * as users from "@/lib/services/users";
import * as vehicles from "@/lib/services/vehicles";
import { markRead } from "@/lib/services/notifications";

export async function updateProfileAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await users.updateProfile(u.id, { name: str(fd, "name") });
    return "Profile saved";
  });
}

export async function sendPhoneOtpAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    const r = await users.startPhoneVerification(u.id, str(fd, "phone"));
    return { message: `Code sent to ${r.phone}`, data: { phone: r.phone, sandboxCode: r.sandboxCode ?? null, step: "code" } };
  });
}

export async function confirmPhoneOtpAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await users.confirmPhoneVerification(u.id, str(fd, "phone"), str(fd, "code"));
    return { message: "Phone number verified", data: { step: "done" } };
  });
}

export async function changePasswordAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await users.changePassword(u.id, str(fd, "current"), str(fd, "password"));
    return "Password updated";
  });
}

export async function signOutEverywhereAction() {
  const u = await requireUser();
  await users.signOutEverywhere(u.id);
  await destroySession();
  redirect("/login");
}

function vehicleInput(fd: FormData) {
  return {
    name: str(fd, "name"),
    model: str(fd, "model"),
    batteryKwh: str(fd, "batteryKwh"),
    connectors: fd.getAll("connectors").map(String),
    isDefault: str(fd, "isDefault") === "on",
  };
}

export async function addVehicleAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await vehicles.createVehicle(u.id, vehicleInput(fd));
    return "Vehicle added";
  });
}

export async function updateVehicleAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await vehicles.updateVehicle(u.id, str(fd, "vehicleId"), vehicleInput(fd));
    return "Vehicle updated";
  });
}

export async function deleteVehicleAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await vehicles.deleteVehicle(u.id, str(fd, "vehicleId"));
    return "Vehicle removed";
  });
}

export async function markNotificationsReadAction(fd: FormData) {
  const u = await requireUser();
  await markRead(u.id, str(fd, "id") || undefined);
  const { refresh } = await import("next/cache");
  refresh();
}
